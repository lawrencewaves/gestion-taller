//! Conexión SQLite del escritorio (ARCHITECTURE §6, D-008).
//!
//! Una sola conexión de escritura, protegida por un `Mutex`. La cola de operaciones
//! y las transacciones se gestionan en TypeScript (`createSerialExecutor`), igual que
//! en el navegador: Rust solo ejecuta SQL con parámetros y devuelve filas en JSON.

use rusqlite::types::{Value, ValueRef};
use rusqlite::{Connection, OpenFlags, Statement};
use serde_json::{Map, Number, Value as Json};
use std::path::Path;
use std::sync::Mutex;

pub type Row = Map<String, Json>;

pub struct Database {
    conn: Mutex<Connection>,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl Database {
    /// Abre (o crea) el archivo de la base con la configuración de escritorio.
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| format!("No se puede crear la carpeta de datos: {e}"))?;
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_NO_MUTEX;
        let conn = Connection::open_with_flags(path, flags).map_err(err)?;
        // WAL: lecturas y escrituras sin bloquearse y una copia de seguridad coherente.
        // synchronous FULL: nada confirmado se pierde aunque se vaya la luz.
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )
        .map_err(err)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    /// Base en memoria, para pruebas.
    pub fn open_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(err)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(err)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
        let conn = self.conn.lock().map_err(|_| "La conexión quedó bloqueada por un error anterior.".to_string())?;
        f(&conn)
    }

    /// Filas de una consulta, como objetos JSON columna → valor.
    pub fn all(&self, sql: &str, params: Option<&Json>) -> Result<Vec<Row>, String> {
        self.with(|conn| {
            let mut stmt = conn.prepare(sql).map_err(err)?;
            bind(&mut stmt, params)?;
            let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
            let mut rows = stmt.raw_query();
            let mut out = Vec::new();
            while let Some(row) = rows.next().map_err(err)? {
                let mut obj = Map::with_capacity(names.len());
                for (i, name) in names.iter().enumerate() {
                    obj.insert(name.clone(), to_json(row.get_ref(i).map_err(err)?));
                }
                out.push(obj);
            }
            Ok(out)
        })
    }

    /// Una sentencia de escritura. Devuelve las filas afectadas.
    pub fn run(&self, sql: &str, params: Option<&Json>) -> Result<u64, String> {
        self.with(|conn| {
            let mut stmt = conn.prepare(sql).map_err(err)?;
            bind(&mut stmt, params)?;
            let changes = stmt.raw_execute().map_err(err)?;
            Ok(changes as u64)
        })
    }

    /// Varias sentencias sin parámetros (migraciones, BEGIN/COMMIT).
    pub fn exec(&self, sql: &str) -> Result<(), String> {
        self.with(|conn| conn.execute_batch(sql).map_err(err))
    }
}

fn to_sql(v: &Json) -> Result<Value, String> {
    Ok(match v {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Integer(i64::from(*b)),
        Json::Number(n) => match n.as_i64() {
            Some(i) => Value::Integer(i),
            None => Value::Real(n.as_f64().ok_or("Número fuera de rango")?),
        },
        Json::String(s) => Value::Text(s.clone()),
        Json::Array(items) => Value::Blob(
            items
                .iter()
                .map(|b| b.as_u64().filter(|x| *x <= 255).map(|x| x as u8).ok_or("Un binario solo admite bytes 0–255"))
                .collect::<Result<Vec<u8>, _>>()?,
        ),
        Json::Object(_) => return Err("Un parámetro no puede ser un objeto".into()),
    })
}

/// Parámetros por posición (`[1, "a"]`) o por nombre (`{"$nombre": "a"}`), como en el navegador.
fn bind(stmt: &mut Statement<'_>, params: Option<&Json>) -> Result<(), String> {
    match params {
        None | Some(Json::Null) => Ok(()),
        Some(Json::Array(values)) => {
            if values.len() != stmt.parameter_count() {
                return Err(format!("La consulta espera {} parámetros y ha recibido {}", stmt.parameter_count(), values.len()));
            }
            for (i, v) in values.iter().enumerate() {
                stmt.raw_bind_parameter(i + 1, to_sql(v)?).map_err(err)?;
            }
            Ok(())
        }
        Some(Json::Object(named)) => {
            for (name, v) in named {
                let idx = stmt
                    .parameter_index(name)
                    .map_err(err)?
                    .ok_or_else(|| format!("La consulta no tiene el parámetro {name}"))?;
                stmt.raw_bind_parameter(idx, to_sql(v)?).map_err(err)?;
            }
            Ok(())
        }
        Some(_) => Err("Los parámetros deben ser una lista o un objeto".into()),
    }
}

fn to_json(v: ValueRef<'_>) -> Json {
    match v {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(i) => Json::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f).map(Json::Number).unwrap_or(Json::Null),
        ValueRef::Text(t) => Json::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Json::Array(b.iter().map(|x| Json::from(*x)).collect()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db() -> Database {
        let db = Database::open_in_memory().unwrap();
        db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER, ratio REAL, data BLOB) STRICT").unwrap();
        db
    }

    #[test]
    fn parametros_por_posicion_y_por_nombre() {
        let db = db();
        assert_eq!(db.run("INSERT INTO t (name, price) VALUES (?, ?)", Some(&json!(["Marta", 32307]))).unwrap(), 1);
        db.run("INSERT INTO t (name, ratio) VALUES ($name, $ratio)", Some(&json!({"$name": "Jordi", "$ratio": 0.21}))).unwrap();
        let rows = db.all("SELECT name, price, ratio FROM t ORDER BY id", None).unwrap();
        assert_eq!(Json::Array(rows.into_iter().map(Json::Object).collect()), json!([
            {"name": "Marta", "price": 32307, "ratio": null},
            {"name": "Jordi", "price": null, "ratio": 0.21}
        ]));
    }

    #[test]
    fn binarios_ida_y_vuelta() {
        let db = db();
        db.run("INSERT INTO t (name, data) VALUES (?, ?)", Some(&json!(["x", [0, 1, 255]]))).unwrap();
        let rows = db.all("SELECT data FROM t", None).unwrap();
        assert_eq!(rows[0]["data"], json!([0, 1, 255]));
    }

    #[test]
    fn errores_claros() {
        let db = db();
        assert!(db.run("INSERT INTO t (name) VALUES (?)", Some(&json!([]))).unwrap_err().contains("espera 1"));
        assert!(db.run("INSERT INTO t (name) VALUES ($n)", Some(&json!({"$otro": 1}))).unwrap_err().contains("no tiene el parámetro"));
        assert!(db.run("INSERT INTO t (name) VALUES (?)", Some(&json!([{"a": 1}]))).is_err());
        // Tabla STRICT: texto donde va un número.
        assert!(db.run("INSERT INTO t (name, price) VALUES ('a', 'caro')", None).is_err());
    }

    #[test]
    fn transacciones_desde_fuera() {
        let db = db();
        db.exec("BEGIN IMMEDIATE").unwrap();
        db.run("INSERT INTO t (name) VALUES ('a')", None).unwrap();
        db.exec("ROLLBACK").unwrap();
        let rows = db.all("SELECT count(*) AS n FROM t", None).unwrap();
        assert_eq!(rows[0]["n"], json!(0));
    }

    #[test]
    fn archivo_con_wal_y_claves_foraneas() {
        let dir = std::env::temp_dir().join(format!("gonzalvo-db-test-{}", std::process::id()));
        let path = dir.join("datos").join("prueba.db");
        {
            let db = Database::open(&path).unwrap();
            assert_eq!(db.all("PRAGMA journal_mode", None).unwrap()[0]["journal_mode"], json!("wal"));
            assert_eq!(db.all("PRAGMA foreign_keys", None).unwrap()[0]["foreign_keys"], json!(1));
            db.exec("CREATE TABLE k (v TEXT) STRICT; INSERT INTO k VALUES ('persistente');").unwrap();
        }
        let again = Database::open(&path).unwrap();
        assert_eq!(again.all("SELECT v FROM k", None).unwrap()[0]["v"], json!("persistente"));
        drop(again);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
