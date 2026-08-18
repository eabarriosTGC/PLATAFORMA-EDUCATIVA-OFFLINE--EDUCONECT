//! Utilidades de gestión de contenido (subida de archivos, helpers).
//! Los handlers están en main.rs para compatibilidad con AppState.

/// Calcula el tamaño total de un directorio en KB.
pub fn dir_size_kb(path: &std::path::Path) -> i64 {
    if !path.exists() { return 0; }
    let mut total = 0i64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for e in entries.flatten() {
            if let Ok(m) = e.metadata() { total += m.len() as i64; }
        }
    }
    total / 1024
}
