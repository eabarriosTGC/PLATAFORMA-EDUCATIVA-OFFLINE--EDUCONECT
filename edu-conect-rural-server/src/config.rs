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

/// Lee y normaliza `PUBLIC_BASE_URL` (dirección LAN que otros dispositivos
/// usarán para conectarse a EduConect).
///
/// - Ausente o vacía → `None`: el endpoint `/api/network` deriva la dirección
///   del header `Host` de cada solicitud.
/// - Inválida → panic al arrancar: un error de configuración debe ser ruidoso,
///   no un fallback silencioso a una dirección equivocada.
pub fn public_base_url() -> Option<String> {
    public_base_url_desde(&std::env::var("PUBLIC_BASE_URL").unwrap_or_default())
}

/// Núcleo puro de la normalización (testeable sin tocar el entorno).
fn public_base_url_desde(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    Some(
        normalizar_public_base_url(raw)
            .unwrap_or_else(|e| panic!("PUBLIC_BASE_URL inválida (\"{raw}\"): {e}")),
    )
}

/// Valida una URL pública absoluta con un parser real (nunca regex):
/// solo `http`/`https`, host obligatorio (IPv4, IPv6 o hostname), sin
/// credenciales, sin query, sin fragmento, sin subrutas y sin `/` final.
fn normalizar_public_base_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw).map_err(|e| format!("no es una URL válida: {e}"))?;

    if !matches!(url.scheme(), "http" | "https") {
        return Err(format!(
            "esquema \"{}\" no soportado (solo http/https)",
            url.scheme()
        ));
    }

    // Guard estricto contra autoridades vacías: WHATWG interpreta
    // "http:///ruta" como host "ruta" (primer segmento del path). La entrada
    // cruda debe tener un host explícito: "http://" + autoridad no vacía.
    let despues_esquema = &raw[url.scheme().len() + 3..]; // tras "://"
    let autoridad = despues_esquema.split(['/', '?', '#']).next().unwrap_or("");
    if autoridad.is_empty() {
        return Err("falta el host (IPv4, IPv6 o hostname)".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "falta el host (IPv4, IPv6 o hostname)".to_string())?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("no se permiten credenciales (usuario/contraseña)".to_string());
    }
    if url.query().is_some() {
        return Err("no se permite query string".to_string());
    }
    if url.fragment().is_some() {
        return Err("no se permite fragmento".to_string());
    }
    if url.path() != "/" {
        return Err("no se permiten subrutas (solo la raíz)".to_string());
    }

    // Reconstrucción canónica sin `/` final: esquema://host[:puerto]
    let puerto = url.port().map(|p| format!(":{p}")).unwrap_or_default();
    Ok(format!("{}://{}{}", url.scheme(), host, puerto))
}

/// Directorio del contenido ZIM incluido en la imagen (solo lectura).
/// `DEFAULT_ZIM_DIR` lo define el Dockerfile (`/app/default-content/zim`);
/// fuera de Docker se usa una ruta relativa que probablemente no exista
/// (el escaneo de zonas lo tolera y sigue con la zona persistente).
pub fn default_zim_dir() -> String {
    default_zim_dir_desde(&std::env::var("DEFAULT_ZIM_DIR").unwrap_or_default())
}

/// Núcleo puro (testeable sin tocar el entorno): vacío/espacios → default.
fn default_zim_dir_desde(raw: &str) -> String {
    let dir = raw.trim();
    if dir.is_empty() {
        "default-content/zim".to_string()
    } else {
        dir.to_string()
    }
}

/// Directorio de la biblioteca incluida en la imagen (solo lectura).
/// `DEFAULT_BIBLIOTECA_DIR` lo define el Dockerfile; fuera de Docker se usa una
/// ruta relativa que probablemente no exista (el escaneo de zonas lo tolera).
pub fn default_biblioteca_dir() -> String {
    default_biblioteca_dir_desde(&std::env::var("DEFAULT_BIBLIOTECA_DIR").unwrap_or_default())
}

/// Núcleo puro (testeable sin tocar el entorno): vacío/espacios → default.
fn default_biblioteca_dir_desde(raw: &str) -> String {
    let dir = raw.trim();
    if dir.is_empty() {
        "default-content/biblioteca".to_string()
    } else {
        dir.to_string()
    }
}

#[cfg(test)]
mod tests_public_base_url {
    use super::*;

    #[test]
    fn ipv4_lan_valida() {
        assert_eq!(
            normalizar_public_base_url("http://192.168.101.15:8080").unwrap(),
            "http://192.168.101.15:8080"
        );
    }

    #[test]
    fn elimina_barra_final() {
        assert_eq!(
            normalizar_public_base_url("http://192.168.101.15:8080/").unwrap(),
            "http://192.168.101.15:8080"
        );
    }

    #[test]
    fn hostname_valido() {
        assert_eq!(
            normalizar_public_base_url("http://educonnect.local").unwrap(),
            "http://educonnect.local"
        );
    }

    #[test]
    fn https_valido() {
        assert_eq!(
            normalizar_public_base_url("https://educonnect.local:8443").unwrap(),
            "https://educonnect.local:8443"
        );
    }

    #[test]
    fn ipv6_valido() {
        assert_eq!(
            normalizar_public_base_url("http://[::1]:8080").unwrap(),
            "http://[::1]:8080"
        );
    }

    #[test]
    fn puerto_opcional_por_defecto_sin_puerto() {
        assert_eq!(
            normalizar_public_base_url("http://192.168.1.50").unwrap(),
            "http://192.168.1.50"
        );
    }

    #[test]
    fn esquema_distinto_rechazado() {
        assert!(normalizar_public_base_url("ftp://192.168.1.50:8080").is_err());
        assert!(normalizar_public_base_url("file:///tmp/x").is_err());
    }

    #[test]
    fn credenciales_rechazadas() {
        assert!(normalizar_public_base_url("http://usuario:clave@192.168.1.50:8080").is_err());
        assert!(normalizar_public_base_url("http://usuario@192.168.1.50:8080").is_err());
    }

    #[test]
    fn query_fragmento_y_subruta_rechazados() {
        assert!(normalizar_public_base_url("http://192.168.1.50:8080/?x=1").is_err());
        assert!(normalizar_public_base_url("http://192.168.1.50:8080/#seccion").is_err());
        assert!(normalizar_public_base_url("http://192.168.1.50:8080/app").is_err());
        assert!(normalizar_public_base_url("http://192.168.1.50:8080//").is_err());
    }

    #[test]
    fn sin_host_rechazado() {
        assert!(normalizar_public_base_url("http://").is_err());
        assert!(normalizar_public_base_url("http:///ruta").is_err());
    }

    #[test]
    fn url_rota_rechazada() {
        assert!(normalizar_public_base_url("no-es-una-url").is_err());
        assert!(normalizar_public_base_url("192.168.1.50:8080").is_err());
    }

    #[test]
    fn vacia_produce_none() {
        assert_eq!(public_base_url_desde(""), None);
        assert_eq!(public_base_url_desde("   "), None);
    }

    #[test]
    #[should_panic(expected = "PUBLIC_BASE_URL inválida")]
    fn invalida_rechazada_al_arrancar() {
        let _ = public_base_url_desde("ftp://192.168.1.50");
    }
}

#[cfg(test)]
mod tests_default_zim_dir {
    use super::*;

    #[test]
    fn sin_variable_usa_default_relativo() {
        assert_eq!(default_zim_dir_desde(""), "default-content/zim");
        assert_eq!(default_zim_dir_desde("   "), "default-content/zim");
    }

    #[test]
    fn con_variable_usa_la_ruta_de_la_imagen() {
        assert_eq!(
            default_zim_dir_desde("/app/default-content/zim"),
            "/app/default-content/zim"
        );
    }

    #[test]
    fn recorta_espacios() {
        assert_eq!(
            default_zim_dir_desde("  /app/default-content/zim  "),
            "/app/default-content/zim"
        );
    }
}

#[cfg(test)]
mod tests_default_biblioteca_dir {
    use super::*;

    #[test]
    fn sin_variable_usa_default_relativo() {
        assert_eq!(
            default_biblioteca_dir_desde(""),
            "default-content/biblioteca"
        );
    }

    #[test]
    fn con_variable_usa_la_ruta_de_la_imagen() {
        assert_eq!(
            default_biblioteca_dir_desde("/app/default-content/biblioteca"),
            "/app/default-content/biblioteca"
        );
    }

    #[test]
    fn recorta_espacios() {
        assert_eq!(
            default_biblioteca_dir_desde("  /app/default-content/biblioteca  "),
            "/app/default-content/biblioteca"
        );
    }
}
