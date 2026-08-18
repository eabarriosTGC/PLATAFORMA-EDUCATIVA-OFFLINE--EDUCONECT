//! Carga y validación estricta de la configuración sensible.
//!
//! `JWT_SECRET` se lee UNA sola vez al arrancar y se inyecta por parámetro
//! (`Database` → `AppState`). Ningún otro módulo debe leer la variable.

/// Defaults históricos conocidos: jamás deben aceptarse como secreto real.
const SECRETOS_CONOCIDOS: &[&str] = &[
    "cambiar_en_produccion_con_openssl_rand_base64_64",
    "educonect-rural-dev-secret",
];

/// Longitud mínima exigida para un JWT_SECRET real
/// (64 chars con `openssl rand -base64 48`).
const LONGITUD_MINIMA: usize = 32;

/// Lee y valida `JWT_SECRET`. Falla con un mensaje claro si falta, está vacío,
/// coincide con un default conocido o es demasiado corto.
pub fn jwt_secret_requerido() -> String {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        panic!(
            "JWT_SECRET no está definida. Crea un archivo .env en la raíz con: \
             JWT_SECRET=$(openssl rand -base64 48)"
        )
    });
    let secret = secret.trim();
    if secret.is_empty() {
        panic!("JWT_SECRET está vacía. Genera una con: openssl rand -base64 48");
    }
    if SECRETOS_CONOCIDOS.contains(&secret) {
        panic!(
            "JWT_SECRET coincide con un valor por defecto conocido. \
             Genera una nueva con: openssl rand -base64 48"
        );
    }
    if secret.len() < LONGITUD_MINIMA {
        panic!(
            "JWT_SECRET demasiado corta ({} chars, mínimo {}). \
             Genera una con: openssl rand -base64 48",
            secret.len(),
            LONGITUD_MINIMA
        );
    }
    secret.to_string()
}
