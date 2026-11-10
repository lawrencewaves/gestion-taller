// Sin ventana de consola en Windows (si algún día se compila para Windows).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gonzalvo_lib::run()
}
