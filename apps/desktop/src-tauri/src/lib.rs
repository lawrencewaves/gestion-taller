//! Aplicación de escritorio de Gonzalvo (ARCHITECTURE §6).
//!
//! Rust solo expone comandos de bajo nivel. Toda la lógica de negocio vive en
//! TypeScript (`packages/core`), igual que en el navegador.

use gonzalvo_db::{inspect_file, Database, Row};
use serde_json::{json, Value as Json};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

struct OpenDb {
    db: Database,
    path: PathBuf,
}

#[derive(Default)]
struct AppDb(RwLock<Option<OpenDb>>);

const LOCKED: &str = "La base de datos quedó bloqueada.";

impl AppDb {
    fn with<T>(&self, f: impl FnOnce(&OpenDb) -> Result<T, String>) -> Result<T, String> {
        let guard = self.0.read().map_err(|_| LOCKED.to_string())?;
        let open = guard.as_ref().ok_or("La base de datos no está abierta.")?;
        f(open)
    }
}

/// Solo nombres sencillos dentro de la carpeta de datos de la aplicación: nunca rutas.
fn valid_file_name(name: &str) -> bool {
    name.ends_with(".db")
        && name.len() <= 64
        && name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
        && !name.starts_with('.')
}

/// Etiquetas que se añaden a los nombres de las copias locales (fecha y motivo).
fn valid_label(label: &str) -> bool {
    !label.is_empty() && label.len() <= 80 && label.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn data_dir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join(sub);
    fs::create_dir_all(&dir).map_err(|e| format!("No se puede crear la carpeta {sub}: {e}"))?;
    Ok(dir)
}

/// Borra un archivo al salir del comando, haya ido bien o mal.
struct RemoveOnDrop(PathBuf);

impl Drop for RemoveOnDrop {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

/// Abre la base en la carpeta de datos de la aplicación del usuario. Devuelve la ruta completa.
#[tauri::command]
fn db_open(app: AppHandle, state: State<'_, AppDb>, file_name: String) -> Result<String, String> {
    if !valid_file_name(&file_name) {
        return Err(format!("Nombre de base de datos no válido: {file_name}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(&file_name);
    let db = Database::open(&path)?;
    *state.0.write().map_err(|_| LOCKED.to_string())? = Some(OpenDb { db, path: path.clone() });
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn sql_all(state: State<'_, AppDb>, sql: String, params: Option<Json>) -> Result<Vec<Row>, String> {
    state.with(|o| o.db.all(&sql, params.as_ref()))
}

#[tauri::command]
fn sql_run(state: State<'_, AppDb>, sql: String, params: Option<Json>) -> Result<Json, String> {
    state.with(|o| o.db.run(&sql, params.as_ref()).map(|changes| json!({ "changes": changes })))
}

#[tauri::command]
fn sql_exec(state: State<'_, AppDb>, sql: String) -> Result<(), String> {
    state.with(|o| o.db.exec(&sql))
}

/// Copias locales de seguridad antes de migrar o restaurar (RNF-08). Se guardan las 5 últimas.
const LOCAL_SNAPSHOTS_KEPT: usize = 5;

fn local_snapshot(dir: &Path, state: &AppDb, label: &str) -> Result<String, String> {
    if !valid_label(label) {
        return Err(format!("Etiqueta de copia no válida: {label}"));
    }
    let stem = state.with(|o| Ok(o.path.file_stem().and_then(|s| s.to_str()).unwrap_or("datos").to_string()))?;
    let name = format!("{stem}-{label}.db");
    state.with(|o| o.db.snapshot_to(&dir.join(&name)))?;

    let prefix = format!("{stem}-");
    let mut old: Vec<String> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| n.starts_with(&prefix) && n.ends_with(".db"))
        .collect();
    old.sort();
    let excess = old.len().saturating_sub(LOCAL_SNAPSHOTS_KEPT);
    for n in &old[..excess] {
        let _ = fs::remove_file(dir.join(n));
    }
    Ok(name)
}

#[tauri::command]
async fn db_local_snapshot(app: AppHandle, state: State<'_, AppDb>, label: String) -> Result<String, String> {
    local_snapshot(&data_dir(&app, "copias-previas")?, &state, &label)
}

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------

/// Argon2id: la contraseña nunca se cifra en JavaScript (RNF-03).
/// Asíncronos: el cálculo tarda unas décimas y no debe congelar la ventana.
#[tauri::command]
async fn password_hash(password: String) -> Result<String, String> {
    gonzalvo_password::hash(&password)
}

#[tauri::command]
async fn password_verify(password: String, hash: String) -> bool {
    gonzalvo_password::verify(&password, &hash)
}

// ---------------------------------------------------------------------------
// Copias de seguridad (ARCHITECTURE §8, D-038)
// ---------------------------------------------------------------------------

const KEYRING_SERVICE: &str = "com.lawrencewaves.gonzalvo";

/// Una clave por base (`copias-taller`, `copias-local`): las pruebas nunca usan la del taller.
fn key_entry(state: &AppDb) -> Result<keyring::Entry, String> {
    let stem = state.with(|o| Ok(o.path.file_stem().and_then(|s| s.to_str()).unwrap_or("datos").to_string()))?;
    keyring::Entry::new(KEYRING_SERVICE, &format!("copias-{stem}"))
        .map_err(|e| format!("No se puede usar el Administrador de credenciales: {e}"))
}

fn stored_key(state: &AppDb) -> Result<Option<String>, String> {
    match key_entry(state)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("No se puede leer la clave de copias del Administrador de credenciales: {e}")),
    }
}

fn require_key(state: &AppDb) -> Result<String, String> {
    stored_key(state)?.ok_or_else(|| "Todavía no hay clave de copias en este ordenador.".to_string())
}

fn save_key(state: &AppDb, key: &str) -> Result<(), String> {
    key_entry(state)?
        .set_password(key)
        .map_err(|e| format!("No se puede guardar la clave en el Administrador de credenciales: {e}"))
}

#[tauri::command]
async fn backup_pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().set_title("Elige la carpeta de las copias de seguridad").blocking_pick_folder();
    match picked {
        None => Ok(None),
        Some(p) => p.into_path().map(|p| Some(p.to_string_lossy().into_owned())).map_err(|e| e.to_string()),
    }
}

#[tauri::command]
fn backup_key_status(state: State<'_, AppDb>) -> Result<bool, String> {
    Ok(stored_key(&state)?.is_some())
}

/// Genera la clave, la guarda y la devuelve una vez para la hoja de recuperación.
#[tauri::command]
fn backup_key_create(state: State<'_, AppDb>) -> Result<String, String> {
    if stored_key(&state)?.is_some() {
        return Err("Ya hay una clave de copias en este ordenador.".into());
    }
    let key = gonzalvo_backup::generate_key();
    save_key(&state, &key)?;
    Ok(key)
}

#[tauri::command]
fn backup_key_reveal(state: State<'_, AppDb>) -> Result<String, String> {
    require_key(&state)
}

/// Comprueba que una clave escrita a mano abre una copia existente (evita guardar una clave con erratas).
#[tauri::command]
async fn backup_key_check(folder: String, file_name: String, key: String) -> Result<(), String> {
    gonzalvo_backup::check_key(Path::new(&folder), &file_name, &key)
}

#[tauri::command]
fn backup_key_set(state: State<'_, AppDb>, key: String) -> Result<(), String> {
    save_key(&state, &gonzalvo_backup::normalize_key(&key)?)
}

/// Copia coherente → integridad → cifrado → comprobación → movimiento atómico al destino.
fn create_backup(state: &AppDb, work_dir: &Path, dest: &Path, file_name: &str, key: &str) -> Result<gonzalvo_backup::Written, String> {
    gonzalvo_backup::check_folder(dest)?;
    let plain = RemoveOnDrop(work_dir.join("copia.db"));
    state.with(|o| o.db.snapshot_to(&plain.0))?;
    inspect_file(&plain.0)?;
    gonzalvo_backup::write_encrypted(&plain.0, dest, file_name, key)
}

#[tauri::command]
async fn backup_create(app: AppHandle, state: State<'_, AppDb>, folder: String, file_name: String) -> Result<Json, String> {
    let key = require_key(&state)?;
    let w = create_backup(&state, &data_dir(&app, "temporal")?, Path::new(&folder), &file_name, &key)?;
    Ok(json!({ "fileName": w.file_name, "sizeBytes": w.size_bytes, "sha256": w.sha256 }))
}

#[tauri::command]
async fn backup_list(folder: String, prefix: String) -> Result<Vec<Json>, String> {
    Ok(gonzalvo_backup::list(Path::new(&folder), &prefix)?
        .into_iter()
        .map(|e| json!({ "name": e.name, "sizeBytes": e.size_bytes }))
        .collect())
}

#[tauri::command]
async fn backup_delete(folder: String, file_name: String) -> Result<(), String> {
    gonzalvo_backup::remove(Path::new(&folder), &file_name)
}

fn staging(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app, "temporal")?.join("restaurar.db"))
}

/// Descifra y comprueba la copia sin tocar los datos actuales. Devuelve versión y entorno para que `core` decida.
#[tauri::command]
async fn backup_restore_prepare(app: AppHandle, state: State<'_, AppDb>, folder: String, file_name: String) -> Result<Json, String> {
    let key = require_key(&state)?;
    let target = staging(&app)?;
    let _ = fs::remove_file(&target);
    gonzalvo_backup::decrypt_to_file(Path::new(&folder), &file_name, &target, &key)?;
    match inspect_file(&target) {
        Ok(info) => Ok(json!({ "schemaVersion": info.schema_version, "environment": info.environment })),
        Err(e) => {
            let _ = fs::remove_file(&target);
            Err(e)
        }
    }
}

#[tauri::command]
fn backup_restore_cancel(app: AppHandle) -> Result<(), String> {
    let _ = fs::remove_file(staging(&app)?);
    Ok(())
}

/// Copia local del estado actual, cierra la base y pone la copia preparada en su lugar.
/// La base queda cerrada: `core` la vuelve a abrir y migrar a continuación.
fn apply_restore(state: &AppDb, prepared: &Path, safety_dir: &Path, label: &str) -> Result<String, String> {
    if !prepared.is_file() {
        return Err("No hay ninguna copia preparada para restaurar.".into());
    }
    let safety = local_snapshot(safety_dir, state, label)?;
    let mut guard = state.0.write().map_err(|_| LOCKED.to_string())?;
    let open = guard.take().ok_or("La base de datos no está abierta.")?;
    let path = open.path.clone();
    drop(open); // Cierra la conexión y vuelca el WAL al archivo.
    // Un WAL que sobreviviera pertenece a la base anterior: aplicarlo a la restaurada la dañaría.
    for ext in ["-wal", "-shm"] {
        let side = PathBuf::from(format!("{}{ext}", path.display()));
        if side.exists() {
            fs::remove_file(&side).map_err(|e| format!("No se puede preparar la restauración: {e}"))?;
        }
    }
    fs::rename(prepared, &path).map_err(|e| format!("No se ha podido colocar la copia restaurada: {e}"))?;
    Ok(safety)
}

#[tauri::command]
async fn backup_restore_apply(app: AppHandle, state: State<'_, AppDb>, label: String) -> Result<String, String> {
    apply_restore(&state, &staging(&app)?, &data_dir(&app, "copias-previas")?, &label)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppDb::default())
        .invoke_handler(tauri::generate_handler![
            db_open,
            sql_all,
            sql_run,
            sql_exec,
            db_local_snapshot,
            password_hash,
            password_verify,
            backup_pick_folder,
            backup_key_status,
            backup_key_create,
            backup_key_reveal,
            backup_key_check,
            backup_key_set,
            backup_create,
            backup_list,
            backup_delete,
            backup_restore_prepare,
            backup_restore_cancel,
            backup_restore_apply,
        ])
        .run(tauri::generate_context!())
        .expect("No se ha podido arrancar Gonzalvo");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solo_nombres_de_archivo_seguros() {
        assert!(valid_file_name("local.db"));
        assert!(valid_file_name("taller.db"));
        assert!(!valid_file_name("../otro.db"));
        assert!(!valid_file_name("/etc/x.db"));
        assert!(!valid_file_name(".oculto.db"));
        assert!(!valid_file_name("taller.sqlite"));
        assert!(!valid_file_name("Taller.db"));
    }

    #[test]
    fn etiquetas_sin_rutas() {
        assert!(valid_label("2026-11-10T17-32-05Z-antes-de-migrar"));
        assert!(!valid_label(""));
        assert!(!valid_label("../x"));
        assert!(!valid_label("a b"));
        assert!(!valid_label(&"a".repeat(81)));
    }

    /// Ciclo real sin ventana: base abierta con WAL → copia cifrada → cambios → restaurar → reabrir.
    #[test]
    fn copia_y_restauracion_de_punta_a_punta() {
        let root = std::env::temp_dir().join(format!("gonzalvo-ciclo-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let (data, work, drive, safety) = (root.join("datos"), root.join("temporal"), root.join("Drive"), root.join("previas"));
        for d in [&data, &work, &drive, &safety] {
            fs::create_dir_all(d).unwrap();
        }
        let db_path = data.join("local.db");
        let state = AppDb::default();
        let open = |state: &AppDb| {
            *state.0.write().unwrap() = Some(OpenDb { db: Database::open(&db_path).unwrap(), path: db_path.clone() });
        };
        let clients = |state: &AppDb| state.with(|o| o.db.all("SELECT name FROM c ORDER BY name", None)).unwrap().len();
        open(&state);
        state
            .with(|o| {
                o.db.exec(
                    "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY) STRICT; INSERT INTO schema_migrations VALUES (1);
                     CREATE TABLE settings (id INTEGER PRIMARY KEY, environment TEXT) STRICT; INSERT INTO settings VALUES (1, 'LOCAL');
                     CREATE TABLE c (name TEXT NOT NULL) STRICT; INSERT INTO c VALUES ('Marta'), ('Jordi');",
                )
            })
            .unwrap();

        let key = gonzalvo_backup::generate_key();
        let name = "gonzalvo-local-2026-11-10T17-32-05Z.gonzalvo";
        let w = create_backup(&state, &work, &drive, name, &key).unwrap();
        assert!(drive.join(name).is_file());
        assert!(!work.join("copia.db").exists(), "no queda la copia sin cifrar");
        assert!(w.size_bytes > 0);
        // El archivo de Drive no contiene los datos en claro.
        let raw = fs::read(drive.join(name)).unwrap();
        assert!(!raw.windows(5).any(|win| win == b"Marta"));

        // Después de la copia se trabaja y se estropea algo.
        state.with(|o| o.db.run("DELETE FROM c WHERE name = 'Marta'", None)).unwrap();
        state.with(|o| o.db.run("INSERT INTO c VALUES ('Error')", None)).unwrap();

        let prepared = work.join("restaurar.db");
        gonzalvo_backup::decrypt_to_file(&drive, name, &prepared, &key).unwrap();
        assert_eq!(inspect_file(&prepared).unwrap().environment.as_deref(), Some("LOCAL"));
        let saved = apply_restore(&state, &prepared, &safety, "2026-11-10T18-00-00Z-antes-de-restaurar").unwrap();
        assert!(state.with(|_| Ok(())).is_err(), "la base queda cerrada hasta que core la reabra");
        assert!(!prepared.exists());
        assert!(!PathBuf::from(format!("{}-wal", db_path.display())).exists());

        open(&state);
        let names = state.with(|o| o.db.all("SELECT name FROM c ORDER BY name", None)).unwrap();
        assert_eq!(Json::Array(names.into_iter().map(Json::Object).collect()), json!([{"name": "Jordi"}, {"name": "Marta"}]));
        // La copia previa guarda el estado que se ha sustituido.
        let before = Database::open(&safety.join(&saved)).unwrap();
        assert_eq!(before.all("SELECT name FROM c", None).unwrap().len(), 2);
        assert!(before.all("SELECT 1 FROM c WHERE name = 'Error'", None).unwrap().len() == 1);
        assert_eq!(clients(&state), 2);

        // Sin copia preparada no se toca nada.
        assert!(apply_restore(&state, &prepared, &safety, "x").unwrap_err().contains("No hay ninguna copia preparada"));
        assert_eq!(clients(&state), 2);

        drop(state);
        drop(before);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn solo_se_guardan_las_ultimas_copias_locales() {
        let root = std::env::temp_dir().join(format!("gonzalvo-previas-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let path = root.join("local.db");
        let state = AppDb::default();
        *state.0.write().unwrap() = Some(OpenDb { db: Database::open(&path).unwrap(), path: path.clone() });
        let dir = root.join("previas");
        fs::create_dir_all(&dir).unwrap();
        for i in 0..8 {
            local_snapshot(&dir, &state, &format!("2026-11-1{i}T00-00-00Z")).unwrap();
        }
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        left.sort();
        assert_eq!(left.len(), LOCAL_SNAPSHOTS_KEPT);
        assert_eq!(left[0], "local-2026-11-13T00-00-00Z.db");
        assert!(local_snapshot(&dir, &state, "../fuera").is_err());
        drop(state);
        fs::remove_dir_all(root).unwrap();
    }
}
