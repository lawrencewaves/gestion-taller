fn main() {
    // El canal de actualizaciones depende del entorno de la compilación (D-041).
    println!("cargo:rerun-if-env-changed=VITE_ENV");
    tauri_build::build()
}
