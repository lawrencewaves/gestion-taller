//! Cifrado de contraseñas con Argon2id (RNF-03).
//!
//! Parámetros recomendados por OWASP para Argon2id: 19 MiB de memoria, 2 pasadas,
//! 1 hilo. El resultado es una cadena PHC (`$argon2id$v=19$m=…`) que incluye
//! algoritmo, parámetros y sal: se puede subir la dificultad sin migrar nada.

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};

fn argon2() -> Argon2<'static> {
    let params = Params::new(19 * 1024, 2, 1, None).expect("parámetros de Argon2 válidos");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

pub fn hash(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    argon2()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("No se ha podido cifrar la contraseña: {e}"))
}

/// `false` si la contraseña no coincide o el formato no es válido; nunca falla por ello.
pub fn verify(password: &str, stored: &str) -> bool {
    match PasswordHash::new(stored) {
        Ok(parsed) => argon2().verify_password(password.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifica_la_correcta_y_rechaza_las_demas() {
        let h = hash("taller2026").unwrap();
        assert!(h.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        assert!(verify("taller2026", &h));
        assert!(!verify("Taller2026", &h));
    }

    #[test]
    fn sal_distinta_cada_vez() {
        assert_ne!(hash("igual").unwrap(), hash("igual").unwrap());
    }

    #[test]
    fn formatos_desconocidos_no_fallan() {
        assert!(!verify("x", "pbkdf2-sha256$1000$abc$def"));
        assert!(!verify("x", ""));
    }
}
