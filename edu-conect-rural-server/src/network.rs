//! Endpoint `GET /api/network` — dirección LAN que otros dispositivos usan
//! para conectarse a EduConect.
//!
//! Lógica pura, testeable sin HTTP: la política de "mismo origen" decide entre
//! la URL configurada (`PUBLIC_BASE_URL`) y el `Host` de cada solicitud.
//! Nunca descubre IPs desde el contenedor ni expone interfaces internas.

use serde::Serialize;

/// Respuesta de `GET /api/network`.
///
/// - `configured`: `PUBLIC_BASE_URL` normalizada.
/// - `request_host`: derivada del header `Host` de la solicitud.
/// - `unavailable`: sin configuración y sin `Host` (no se inventa dirección).
#[derive(Debug, Serialize)]
pub struct NetworkResponse {
    pub access_url: Option<String>,
    pub source: &'static str,
    pub request_origin: Option<String>,
    pub listen_addr: String,
}

/// Construye la respuesta del endpoint.
///
/// - `configured`: valor normalizado de `PUBLIC_BASE_URL` (o `None`).
/// - `host`: valor del header `Host` de la solicitud (o `None`).
/// - `listen_addr`: dirección de escucha configurada (p. ej. `0.0.0.0:8080`).
///
/// No confía en `X-Forwarded-Proto`: sin política de proxies confiables,
/// el origen derivado es siempre `http://<Host>`.
pub fn construir_respuesta(
    configured: Option<&str>,
    host: Option<&str>,
    listen_addr: &str,
) -> NetworkResponse {
    if let Some(url) = configured {
        return NetworkResponse {
            access_url: Some(url.to_string()),
            source: "configured",
            request_origin: host.map(origin_desde_host),
            listen_addr: listen_addr.to_string(),
        };
    }

    match host {
        Some(h) => {
            let origin = origin_desde_host(h);
            NetworkResponse {
                access_url: Some(origin.clone()),
                source: "request_host",
                request_origin: Some(origin),
                listen_addr: listen_addr.to_string(),
            }
        }
        None => NetworkResponse {
            access_url: None,
            source: "unavailable",
            request_origin: None,
            listen_addr: listen_addr.to_string(),
        },
    }
}

/// Origen derivado del `Host`: el servidor actual solo habla HTTP.
fn origin_desde_host(host: &str) -> String {
    format!("http://{host}")
}

/// Genera el SVG del QR que codifica EXCLUSIVAMENTE `url`.
/// Rendering local con crate puro Rust (sin CDN, sin red en runtime).
/// El QR completo funciona sin internet.
pub fn generar_svg_qr(url: &str) -> Result<String, String> {
    let code =
        qrcode::QrCode::new(url.as_bytes()).map_err(|e| format!("error generando el QR: {e}"))?;
    Ok(code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(280, 280)
        .build())
}

/// SVG del QR para una respuesta de red ya resuelta.
/// `Err` cuando no hay URL → el handler responde 503 (jamás un QR vacío).
pub fn svg_qr_para(resp: &NetworkResponse) -> Result<String, String> {
    match &resp.access_url {
        Some(url) => generar_svg_qr(url),
        None => Err("sin dirección de red disponible".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LISTEN: &str = "0.0.0.0:8080";

    #[test]
    fn prefiere_configuracion() {
        let r = construir_respuesta(
            Some("http://192.168.101.15:8080"),
            Some("localhost:8080"),
            LISTEN,
        );
        assert_eq!(r.access_url.as_deref(), Some("http://192.168.101.15:8080"));
        assert_eq!(r.source, "configured");
        assert_eq!(r.request_origin.as_deref(), Some("http://localhost:8080"));
        assert_eq!(r.listen_addr, LISTEN);
    }

    #[test]
    fn configurada_sin_host_no_inventa_origin() {
        let r = construir_respuesta(Some("http://192.168.101.15:8080"), None, LISTEN);
        assert_eq!(r.access_url.as_deref(), Some("http://192.168.101.15:8080"));
        assert_eq!(r.source, "configured");
        assert_eq!(r.request_origin, None);
    }

    #[test]
    fn cae_al_host() {
        let r = construir_respuesta(None, Some("192.168.101.15:8080"), LISTEN);
        assert_eq!(r.access_url.as_deref(), Some("http://192.168.101.15:8080"));
        assert_eq!(r.source, "request_host");
        assert_eq!(
            r.request_origin.as_deref(),
            Some("http://192.168.101.15:8080")
        );
    }

    #[test]
    fn host_permite_puerto_y_hostname() {
        let r = construir_respuesta(None, Some("educonnect.local"), LISTEN);
        assert_eq!(r.access_url.as_deref(), Some("http://educonnect.local"));
        assert_eq!(r.source, "request_host");
    }

    #[test]
    fn sin_configuracion_ni_host_unavailable() {
        let r = construir_respuesta(None, None, LISTEN);
        assert_eq!(r.access_url, None);
        assert_eq!(r.source, "unavailable");
        assert_eq!(r.request_origin, None);
        assert_eq!(r.listen_addr, LISTEN);
    }

    #[test]
    fn respuesta_nunca_filtra_secretos() {
        let r = construir_respuesta(
            Some("http://192.168.101.15:8080"),
            Some("localhost:8080"),
            LISTEN,
        );
        let json = serde_json::to_string(&r).unwrap();

        // Sin secretos ni valores sensibles.
        assert!(!json.contains("JWT_SECRET"));
        assert!(!json.contains("admin123"));
        assert!(!json.contains("ADMIN_INITIAL_PASSWORD"));

        // Solo los cuatro campos del contrato, nada más.
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let obj = value.as_object().unwrap();
        let mut keys: Vec<&String> = obj.keys().collect();
        keys.sort();
        assert_eq!(
            keys,
            vec!["access_url", "listen_addr", "request_origin", "source"]
        );
    }

    // ── QR ─────────────────────────────────────────────────────────

    #[test]
    fn qr_svg_valido_para_url_configurada() {
        let resp = construir_respuesta(
            Some("http://192.168.101.15:8080"),
            Some("localhost:8080"),
            LISTEN,
        );
        let svg = svg_qr_para(&resp).expect("URL configurada debe generar QR");
        assert!(
            svg.trim_start().starts_with("<?xml"),
            "debe empezar con el prologo XML"
        );
        assert!(svg.contains("<svg xmlns=\"http://www.w3.org/2000/svg\""));
        assert!(svg.contains("viewBox"));
        assert!(svg.contains("<path"), "debe contener módulos dibujados");
        assert!(svg.trim_end().ends_with("</svg>"));
    }

    #[test]
    fn qr_fallback_por_host_genera_svg() {
        let resp = construir_respuesta(None, Some("192.168.101.15:8080"), LISTEN);
        let svg = svg_qr_para(&resp).expect("fallback por Host debe generar QR");
        assert!(svg.contains("<path"));
    }

    #[test]
    fn qr_sin_url_devuelve_error_para_503() {
        let resp = construir_respuesta(None, None, LISTEN);
        assert!(svg_qr_para(&resp).is_err(), "sin URL no debe fabricarse QR");
    }

    #[test]
    fn qr_no_puede_generarse_de_datos_vacios_o_rotos() {
        // URL de más de 2953 bytes excede la capacidad del QR.
        let larga = format!("http://{}", "a".repeat(3000));
        assert!(generar_svg_qr(&larga).is_err());
    }
}
