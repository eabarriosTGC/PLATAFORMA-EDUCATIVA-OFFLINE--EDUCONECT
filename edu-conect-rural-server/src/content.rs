//! Utilidades de gestión de contenido (subida de archivos, helpers).
//! Los handlers están en main.rs para compatibilidad con AppState.

use std::path::PathBuf;

/// Calcula el tamaño total de un directorio en KB.
pub fn dir_size_kb(path: &str) -> i64 {
    let dir = PathBuf::from(path);
    if !dir.exists() { return 0; }
    let mut total = 0i64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            if let Ok(m) = e.metadata() { total += m.len() as i64; }
        }
    }
    total / 1024
}
