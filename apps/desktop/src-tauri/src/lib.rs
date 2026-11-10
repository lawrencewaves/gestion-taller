//! Aplicación de escritorio de Gonzalvo (ARCHITECTURE §6).
//!
//! Rust solo expone comandos de bajo nivel. Toda la lógica de negocio vive en
//! TypeScript (`packages/core`), igual que en el navegador.

use gonzalvo_db::{Database, Row};
use serde_json::{json, Value as Json};
use std::sync::RwLock;
use tauri::{Manager, State};

#[derive(Default)]
struct AppDb(RwLock<Option<Database>>);

impl AppDb {
    fn with<T>(&self, f: impl FnOnce(&Database) -> Result<T, String>) -> Result<T, String> {
        let guard = self.0.read().map_err(|_| "La base de datos quedó bloqueada.".to_string())?;
        let db = guard.as_ref().ok_or("La base de datos no está abierta.")?;
        f(db)
    }
}

/// Solo nombres sencillos dentro de la carpeta de datos de la aplicación: nunca rutas.
fn valid_file_name(name: &str) -> bool {
    name.ends_with(".db")
        && name.len() <= 64
        && name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
        && !name.starts_with('.')
}

/// Abre la base en la carpeta de datos de la aplicación del usuario. Devuelve la ruta completa.
#[tauri::command]
fn db_open(app: tauri::AppHandle, state: State<'_, AppDb>, file_name: String) -> Result<String, String> {
    if !valid_file_name(&file_name) {
        return Err(format!("Nombre de base de datos no válido: {file_name}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(&file_name);
    let db = Database::open(&path)?;
    *state.0.write().map_err(|_| "La base de datos quedó bloqueada.".to_string())? = Some(db);
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn sql_all(state: State<'_, AppDb>, sql: String, params: Option<Json>) -> Result<Vec<Row>, String> {
    state.with(|db| db.all(&sql, params.as_ref()))
}

#[tauri::command]
fn sql_run(state: State<'_, AppDb>, sql: String, params: Option<Json>) -> Result<Json, String> {
    state.with(|db| db.run(&sql, params.as_ref()).map(|changes| json!({ "changes": changes })))
}

#[tauri::command]
fn sql_exec(state: State<'_, AppDb>, sql: String) -> Result<(), String> {
    state.with(|db| db.exec(&sql))
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppDb::default())
        .invoke_handler(tauri::generate_handler![db_open, sql_all, sql_run, sql_exec])
        .run(tauri::generate_context!())
        .expect("No se ha podido arrancar Gonzalvo");
}

#[cfg(test)]
mod tests {
    use super::valid_file_name;

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
}
