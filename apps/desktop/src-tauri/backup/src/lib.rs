//! Copias de seguridad cifradas del escritorio (ARCHITECTURE §8, D-013, D-038).
//!
//! Este crate solo cifra, descifra y mueve archivos. Cuándo copiar, qué conservar y
//! si una copia se puede restaurar lo decide `packages/core`.
//!
//! ## Formato de archivo `.gonzalvo` (versión 1)
//!
//! | Bytes | Contenido |
//! |---|---|
//! | 8  | `GONZALVO` |
//! | 1  | versión del formato (1) |
//! | 1  | derivación de clave (1 = Argon2id v1.3) |
//! | 12 | memoria (KiB), pasadas e hilos de Argon2id, `u32` little-endian |
//! | 16 | sal |
//! | 19 | nonce de STREAM |
//!
//! Después, la base de datos en bloques de 64 KiB cifrados con XChaCha20-Poly1305 en
//! modo STREAM (big-endian de 32 bits): cada bloque lleva su etiqueta de 16 bytes, la
//! cabecera entera va autenticada en cada bloque y el último bloque va marcado, así que
//! cualquier cambio, bloque reordenado o archivo cortado se detecta al descifrar.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::generic_array::GenericArray;
use chacha20poly1305::aead::rand_core::RngCore;
use chacha20poly1305::aead::stream::{DecryptorBE32, EncryptorBE32};
use chacha20poly1305::aead::{OsRng, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

const MAGIC: &[u8; 8] = b"GONZALVO";
const FORMAT: u8 = 1;
const KDF_ARGON2ID: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 19;
const HEADER_LEN: usize = 8 + 1 + 1 + 12 + SALT_LEN + NONCE_LEN;
const CHUNK: usize = 64 * 1024;
const TAG_LEN: usize = 16;

/// Extensión de las copias cifradas.
pub const EXTENSION: &str = ".gonzalvo";
/// Carpeta temporal dentro del destino: el archivo solo aparece con su nombre cuando está completo.
pub const TEMP_DIR: &str = ".gonzalvo-temporal";

const WRONG_KEY: &str = "La clave no corresponde a esta copia o el archivo está dañado.";
const NOT_A_BACKUP: &str = "El archivo no es una copia de seguridad de Gonzalvo.";

/// Parámetros de Argon2id. Se guardan en cada copia: se pueden subir sin romper las anteriores.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KdfParams {
    pub memory_kib: u32,
    pub passes: u32,
    pub lanes: u32,
}

impl KdfParams {
    /// Los mismos que las contraseñas de usuario (D-037): 19 MiB, 2 pasadas, 1 hilo.
    pub const DEFAULT: Self = Self { memory_kib: 19 * 1024, passes: 2, lanes: 1 };

    /// Un archivo manipulado no puede pedir memoria o tiempo desorbitados.
    fn sane(&self) -> bool {
        (8..=1024 * 1024).contains(&self.memory_kib) && (1..=16).contains(&self.passes) && (1..=8).contains(&self.lanes)
    }
}

// ---------------------------------------------------------------------------
// Clave de recuperación
// ---------------------------------------------------------------------------

/// Base32 de Crockford: sin I, L, O ni U, para que no se confundan al copiarla a mano.
const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KEY_SYMBOLS: usize = 25;

/// Clave nueva de 125 bits, en 5 grupos de 5 caracteres (`7KQ2M-XW9PD-…`).
pub fn generate_key() -> String {
    let mut bytes = [0u8; KEY_SYMBOLS];
    OsRng.fill_bytes(&mut bytes);
    // 256 es múltiplo de 32: cada símbolo es uniforme.
    let symbols: String = bytes.iter().map(|b| ALPHABET[(*b & 31) as usize] as char).collect();
    group(&symbols)
}

fn group(symbols: &str) -> String {
    symbols.as_bytes().chunks(5).map(|c| std::str::from_utf8(c).unwrap_or_default()).collect::<Vec<_>>().join("-")
}

/// Acepta la clave como la escriba una persona: minúsculas, espacios, guiones, O por 0, I o L por 1.
/// Devuelve la forma canónica agrupada.
pub fn normalize_key(input: &str) -> Result<String, String> {
    let symbols: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        })
        .collect();
    if symbols.len() != KEY_SYMBOLS || !symbols.bytes().all(|b| ALPHABET.contains(&b)) {
        return Err(format!("La clave tiene que tener {KEY_SYMBOLS} letras y números, como aparece en la hoja de recuperación."));
    }
    Ok(group(&symbols))
}

fn derive(key: &str, salt: &[u8], params: KdfParams) -> Result<[u8; 32], String> {
    let canonical = normalize_key(key)?.replace('-', "");
    let argon = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(params.memory_kib, params.passes, params.lanes, Some(32)).map_err(|e| e.to_string())?,
    );
    let mut out = [0u8; 32];
    argon.hash_password_into(canonical.as_bytes(), salt, &mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

// ---------------------------------------------------------------------------
// Cifrado por bloques
// ---------------------------------------------------------------------------

/// Lee hasta llenar `buf` o llegar al final. Devuelve los bytes leídos.
fn read_full(input: &mut impl Read, buf: &mut [u8]) -> io::Result<usize> {
    let mut filled = 0;
    while filled < buf.len() {
        match input.read(&mut buf[filled..]) {
            Ok(0) => break,
            Ok(n) => filled += n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    Ok(filled)
}

fn read_block(input: &mut impl Read, size: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; size];
    let n = read_full(input, &mut buf).map_err(io_err)?;
    buf.truncate(n);
    Ok(buf)
}

fn io_err(e: io::Error) -> String {
    format!("Error al leer o escribir la copia: {e}")
}

fn header(params: KdfParams, salt: &[u8; SALT_LEN], nonce: &[u8; NONCE_LEN]) -> Vec<u8> {
    let mut h = Vec::with_capacity(HEADER_LEN);
    h.extend_from_slice(MAGIC);
    h.push(FORMAT);
    h.push(KDF_ARGON2ID);
    h.extend_from_slice(&params.memory_kib.to_le_bytes());
    h.extend_from_slice(&params.passes.to_le_bytes());
    h.extend_from_slice(&params.lanes.to_le_bytes());
    h.extend_from_slice(salt);
    h.extend_from_slice(nonce);
    h
}

/// Cifra todo `input` en `output` con la clave de recuperación.
pub fn encrypt(input: &mut impl Read, output: &mut impl Write, key: &str) -> Result<(), String> {
    encrypt_with(input, output, key, KdfParams::DEFAULT)
}

pub fn encrypt_with(input: &mut impl Read, output: &mut impl Write, key: &str, params: KdfParams) -> Result<(), String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let aad = header(params, &salt, &nonce);
    let cipher = XChaCha20Poly1305::new(GenericArray::from_slice(&derive(key, &salt, params)?));
    let mut stream = EncryptorBE32::from_aead(cipher, GenericArray::from_slice(&nonce));
    output.write_all(&aad).map_err(io_err)?;

    // Se lee un bloque por delante para saber cuál es el último.
    let mut current = read_block(input, CHUNK)?;
    loop {
        let next = read_block(input, CHUNK)?;
        if next.is_empty() {
            let sealed = stream.encrypt_last(Payload { msg: &current, aad: &aad }).map_err(|_| "No se ha podido cifrar la copia.")?;
            output.write_all(&sealed).map_err(io_err)?;
            return output.flush().map_err(io_err);
        }
        let sealed = stream.encrypt_next(Payload { msg: &current, aad: &aad }).map_err(|_| "No se ha podido cifrar la copia.")?;
        output.write_all(&sealed).map_err(io_err)?;
        current = next;
    }
}

/// Descifra y comprueba cada bloque. Si algo no cuadra, falla sin dar detalles que ayuden a un atacante.
pub fn decrypt(input: &mut impl Read, output: &mut impl Write, key: &str) -> Result<(), String> {
    let aad = read_block(input, HEADER_LEN)?;
    if aad.len() != HEADER_LEN || &aad[..8] != MAGIC {
        return Err(NOT_A_BACKUP.into());
    }
    if aad[8] != FORMAT || aad[9] != KDF_ARGON2ID {
        return Err("Esta copia es de una versión más nueva de Gonzalvo. Actualiza el programa para abrirla.".into());
    }
    let u32_at = |i: usize| u32::from_le_bytes([aad[i], aad[i + 1], aad[i + 2], aad[i + 3]]);
    let params = KdfParams { memory_kib: u32_at(10), passes: u32_at(14), lanes: u32_at(18) };
    if !params.sane() {
        return Err(NOT_A_BACKUP.into());
    }
    let salt = &aad[22..22 + SALT_LEN];
    let nonce = &aad[22 + SALT_LEN..HEADER_LEN];
    let cipher = XChaCha20Poly1305::new(GenericArray::from_slice(&derive(key, salt, params)?));
    let mut stream = DecryptorBE32::from_aead(cipher, GenericArray::from_slice(nonce));

    let sealed_len = CHUNK + TAG_LEN;
    let mut current = read_block(input, sealed_len)?;
    loop {
        let next = read_block(input, sealed_len)?;
        if next.is_empty() {
            let plain = stream.decrypt_last(Payload { msg: &current, aad: &aad }).map_err(|_| WRONG_KEY)?;
            output.write_all(&plain).map_err(io_err)?;
            return output.flush().map_err(io_err);
        }
        if current.len() != sealed_len {
            return Err(WRONG_KEY.into());
        }
        let plain = stream.decrypt_next(Payload { msg: &current, aad: &aad }).map_err(|_| WRONG_KEY)?;
        output.write_all(&plain).map_err(io_err)?;
        current = next;
    }
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

/// Nombres que escribe Gonzalvo (`gonzalvo-taller-2026-11-10T17-32-05Z.gonzalvo`). Nunca rutas.
pub fn valid_name(name: &str) -> bool {
    name.starts_with("gonzalvo-")
        && name.ends_with(EXTENSION)
        && name.len() <= 80
        && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
        && !name.contains("..")
}

fn check_name(name: &str) -> Result<(), String> {
    if valid_name(name) {
        Ok(())
    } else {
        Err(format!("Nombre de copia no válido: {name}"))
    }
}

/// La carpeta de destino existe. Si es la de Google Drive y no aparece, casi siempre es que Drive no está abierto.
pub fn check_folder(dir: &Path) -> Result<(), String> {
    if dir.is_dir() {
        Ok(())
    } else {
        Err(format!(
            "No se encuentra la carpeta de copias: {}. Si es la de Google Drive, comprueba que Google Drive está abierto en este ordenador.",
            dir.display()
        ))
    }
}

/// Resultado de una copia escrita.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Written {
    pub file_name: String,
    pub size_bytes: u64,
    /// SHA-256 del archivo cifrado, para comprobar que llega intacto a su destino.
    pub sha256: String,
}

struct Hashing<W: Write> {
    inner: W,
    hasher: Sha256,
    count: u64,
}

impl<W: Write> Write for Hashing<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = self.inner.write(buf)?;
        self.hasher.update(&buf[..n]);
        self.count += n as u64;
        Ok(n)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

/// Borra un archivo temporal pase lo que pase, salvo que se decida conservarlo.
struct TempFile(Option<PathBuf>);

impl TempFile {
    fn new(path: PathBuf) -> Self {
        Self(Some(path))
    }
    fn path(&self) -> &Path {
        self.0.as_deref().unwrap_or(Path::new(""))
    }
    fn keep(mut self) {
        self.0 = None;
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        if let Some(path) = &self.0 {
            let _ = fs::remove_file(path);
        }
    }
}

/// Cifra `plain` en `dest_dir/file_name` sin que nunca exista allí un archivo a medias:
/// se escribe en una carpeta temporal del mismo destino, se fuerza al disco, se vuelve a
/// leer entero para comprobarlo y solo entonces se mueve a su nombre definitivo.
pub fn write_encrypted(plain: &Path, dest_dir: &Path, file_name: &str, key: &str) -> Result<Written, String> {
    write_encrypted_with(plain, dest_dir, file_name, key, KdfParams::DEFAULT)
}

pub fn write_encrypted_with(plain: &Path, dest_dir: &Path, file_name: &str, key: &str, params: KdfParams) -> Result<Written, String> {
    check_name(file_name)?;
    check_folder(dest_dir)?;
    let final_path = dest_dir.join(file_name);
    if final_path.exists() {
        return Err(format!("Ya existe una copia con el nombre {file_name}."));
    }
    let temp_dir = dest_dir.join(TEMP_DIR);
    fs::create_dir_all(&temp_dir).map_err(|e| format!("No se puede escribir en la carpeta de copias: {e}"))?;
    let temp = TempFile::new(temp_dir.join(format!("{file_name}.parcial")));

    let mut source = BufReader::new(File::open(plain).map_err(io_err)?);
    let file = File::create(temp.path()).map_err(|e| format!("No se puede escribir en la carpeta de copias: {e}"))?;
    let mut out = Hashing { inner: BufWriter::new(file), hasher: Sha256::new(), count: 0 };
    encrypt_with(&mut source, &mut out, key, params)?;
    let Hashing { inner, hasher, count } = out;
    let file = inner.into_inner().map_err(|e| io_err(e.into_error()))?;
    file.sync_all().map_err(io_err)?;
    drop(file);

    // Comprobación de lo que ha quedado escrito (RF-BAK-04).
    decrypt(&mut BufReader::new(File::open(temp.path()).map_err(io_err)?), &mut io::sink(), key)?;

    fs::rename(temp.path(), &final_path).map_err(|e| format!("No se ha podido colocar la copia en su carpeta: {e}"))?;
    temp.keep(); // Ya no es temporal: es la copia.
    let _ = fs::remove_dir(&temp_dir); // Solo si ha quedado vacía.
    let sha256 = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    Ok(Written { file_name: file_name.to_string(), size_bytes: count, sha256 })
}

/// Descifra una copia en `out`, forzándola al disco. Si falla, no deja nada.
pub fn decrypt_to_file(dir: &Path, file_name: &str, out: &Path, key: &str) -> Result<(), String> {
    check_name(file_name)?;
    let mut source = BufReader::new(File::open(dir.join(file_name)).map_err(io_err)?);
    let temp = TempFile::new(out.to_path_buf());
    let mut writer = BufWriter::new(File::create(temp.path()).map_err(io_err)?);
    decrypt(&mut source, &mut writer, key)?;
    writer.into_inner().map_err(|e| io_err(e.into_error()))?.sync_all().map_err(io_err)?;
    temp.keep();
    Ok(())
}

/// Comprueba que la clave abre una copia, sin escribir nada.
pub fn check_key(dir: &Path, file_name: &str, key: &str) -> Result<(), String> {
    check_name(file_name)?;
    decrypt(&mut BufReader::new(File::open(dir.join(file_name)).map_err(io_err)?), &mut io::sink(), key)
}

/// Copia de la carpeta, de la más nueva a la más antigua.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub size_bytes: u64,
}

/// Copias de Gonzalvo que empiezan por `prefix` (una por entorno: `gonzalvo-taller-`, `gonzalvo-local-`).
pub fn list(dir: &Path, prefix: &str) -> Result<Vec<Entry>, String> {
    check_folder(dir)?;
    let mut out: Vec<Entry> = fs::read_dir(dir)
        .map_err(|e| format!("No se puede leer la carpeta de copias: {e}"))?
        .filter_map(Result::ok)
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let meta = e.metadata().ok()?;
            (meta.is_file() && valid_name(&name) && name.starts_with(prefix)).then_some(Entry { name, size_bytes: meta.len() })
        })
        .collect();
    // La fecha va en el nombre en formato ISO: el orden alfabético es el cronológico.
    out.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(out)
}

pub fn remove(dir: &Path, file_name: &str) -> Result<(), String> {
    check_name(file_name)?;
    fs::remove_file(dir.join(file_name)).map_err(|e| format!("No se ha podido borrar la copia {file_name}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parámetros ligeros: las pruebas no necesitan 19 MiB por derivación.
    const FAST: KdfParams = KdfParams { memory_kib: 64, passes: 1, lanes: 1 };

    fn roundtrip(data: &[u8], key: &str) -> Result<Vec<u8>, String> {
        let mut sealed = Vec::new();
        encrypt_with(&mut &data[..], &mut sealed, key, FAST)?;
        let mut plain = Vec::new();
        decrypt(&mut &sealed[..], &mut plain, key)?;
        Ok(plain)
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gonzalvo-backup-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn clave_legible_y_tolerante_al_escribirla() {
        let key = generate_key();
        assert_eq!(key.len(), 29);
        assert_eq!(key.matches('-').count(), 4);
        assert_eq!(normalize_key(&key).unwrap(), key);
        assert_ne!(generate_key(), key);
        assert_eq!(normalize_key("abcde fghjk-mnpqr st0vw xyz1o").unwrap(), "ABCDE-FGHJK-MNPQR-ST0VW-XYZ10");
        assert_eq!(normalize_key("iiiii lllll ooooo 00000 11111").unwrap(), "11111-11111-00000-00000-11111");
        assert!(normalize_key("corta").is_err());
        assert!(normalize_key("UUUUU-UUUUU-UUUUU-UUUUU-UUUUU").is_err());
    }

    #[test]
    fn cifra_y_descifra_de_cualquier_tamano() {
        let key = generate_key();
        for size in [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK + 5] {
            let data: Vec<u8> = (0..size).map(|i| (i % 251) as u8).collect();
            assert_eq!(roundtrip(&data, &key).unwrap(), data, "tamaño {size}");
        }
    }

    #[test]
    fn la_clave_escrita_a_mano_tambien_sirve() {
        let key = generate_key();
        let mut sealed = Vec::new();
        encrypt_with(&mut &b"datos"[..], &mut sealed, &key, FAST).unwrap();
        let mut plain = Vec::new();
        decrypt(&mut &sealed[..], &mut plain, &key.to_lowercase().replace('-', " ")).unwrap();
        assert_eq!(plain, b"datos");
    }

    #[test]
    fn detecta_clave_equivocada_cambios_y_archivos_cortados() {
        let key = generate_key();
        let data = vec![7u8; 2 * CHUNK + 10];
        let mut sealed = Vec::new();
        encrypt_with(&mut &data[..], &mut sealed, &key, FAST).unwrap();
        let open = |bytes: &[u8], k: &str| decrypt(&mut &bytes[..], &mut io::sink(), k);

        assert_eq!(open(&sealed, &generate_key()).unwrap_err(), WRONG_KEY);

        let mut changed = sealed.clone();
        changed[HEADER_LEN + 100] ^= 1;
        assert_eq!(open(&changed, &key).unwrap_err(), WRONG_KEY);

        let mut header_changed = sealed.clone();
        header_changed[HEADER_LEN - 1] ^= 1; // nonce
        assert!(open(&header_changed, &key).is_err());

        // Sin el último bloque: el anterior no está marcado como último.
        let cut = &sealed[..HEADER_LEN + 2 * (CHUNK + TAG_LEN)];
        assert_eq!(open(cut, &key).unwrap_err(), WRONG_KEY);
        assert!(open(&sealed[..HEADER_LEN + 10], &key).is_err());

        assert_eq!(open(b"PK\x03\x04 no es una copia", &key).unwrap_err(), NOT_A_BACKUP);
        let mut greedy = sealed.clone();
        greedy[10..14].copy_from_slice(&u32::MAX.to_le_bytes());
        assert_eq!(open(&greedy, &key).unwrap_err(), NOT_A_BACKUP);
    }

    #[test]
    fn escribe_entera_comprueba_y_no_deja_temporales() {
        let dir = temp_dir("escribe");
        let plain = dir.join("base.db");
        fs::write(&plain, vec![3u8; CHUNK + 123]).unwrap();
        let dest = dir.join("Drive");
        fs::create_dir_all(&dest).unwrap();
        let key = generate_key();
        let name = "gonzalvo-taller-2026-11-10T17-32-05Z.gonzalvo";

        let w = write_encrypted_with(&plain, &dest, name, &key, FAST).unwrap();
        let on_disk = fs::read(dest.join(name)).unwrap();
        assert_eq!(w.size_bytes, on_disk.len() as u64);
        let digest: String = Sha256::digest(&on_disk).iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(w.sha256, digest);
        assert!(!dest.join(TEMP_DIR).exists());

        assert!(write_encrypted_with(&plain, &dest, name, &key, FAST).unwrap_err().contains("Ya existe"));
        assert!(write_encrypted_with(&plain, &dir.join("no-existe"), name, &key, FAST).unwrap_err().contains("Google Drive"));
        assert!(write_encrypted_with(&plain, &dest, "../fuera.gonzalvo", &key, FAST).is_err());

        check_key(&dest, name, &key).unwrap();
        assert!(check_key(&dest, name, &generate_key()).is_err());
        let out = dir.join("restaurada.db");
        assert!(decrypt_to_file(&dest, name, &out, &generate_key()).is_err());
        assert!(!out.exists(), "un descifrado fallido no deja archivo");
        decrypt_to_file(&dest, name, &out, &key).unwrap();
        assert_eq!(fs::read(&out).unwrap(), fs::read(&plain).unwrap());

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn lista_solo_las_copias_del_entorno() {
        let dir = temp_dir("lista");
        for name in [
            "gonzalvo-taller-2026-11-09T08-00-00Z.gonzalvo",
            "gonzalvo-taller-2026-11-10T08-00-00Z.gonzalvo",
            "gonzalvo-local-2026-11-10T09-00-00Z.gonzalvo",
            "otra-cosa.pdf",
        ] {
            fs::write(dir.join(name), b"x").unwrap();
        }
        fs::create_dir_all(dir.join("gonzalvo-taller-carpeta.gonzalvo")).unwrap();
        let names: Vec<String> = list(&dir, "gonzalvo-taller-").unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, ["gonzalvo-taller-2026-11-10T08-00-00Z.gonzalvo", "gonzalvo-taller-2026-11-09T08-00-00Z.gonzalvo"]);

        remove(&dir, "gonzalvo-taller-2026-11-09T08-00-00Z.gonzalvo").unwrap();
        assert!(remove(&dir, "otra-cosa.pdf").is_err());
        assert_eq!(list(&dir, "gonzalvo-taller-").unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
}
