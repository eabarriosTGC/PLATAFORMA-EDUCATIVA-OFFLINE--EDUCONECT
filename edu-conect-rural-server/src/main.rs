mod auth;
mod content;
mod db;
mod models;
mod rate_limit;
mod zim_proxy;

use std::net::SocketAddr;
use std::path::PathBuf;

use axum::{
    extract::{ConnectInfo, Multipart, Path, Query, State},
    http::header,
    http::StatusCode,
    response::{Html, IntoResponse, Json, Response},
    routing::{delete, get, post, put},
    Router,
};
use chrono::Utc;
use serde::Deserialize;
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;

use db::{Database, DbError, SearchResult};
use models::{ApiError, ArchivoResponse, Curso, LoginPayload, LoginResponse, NuevoProgreso, Progreso};
use rate_limit::RateLimiter;
use zim_proxy::{SharedZim, buscar_articulos, obtener_articulo, listar_zims, zim_inyectar_estilos};

#[derive(Clone)]
struct AppState {
    db: Database,
    frontend_path: String,
    zim: SharedZim,
    h264_encoder: &'static str,
    login_limiter: std::sync::Arc<RateLimiter>,
}

// ── helpers ──────────────────────────────────────────────────────────

#[allow(dead_code)]
fn err_400(m: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::BAD_REQUEST, Json(ApiError { error: m.into() }))
}
fn err_422(m: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::UNPROCESSABLE_ENTITY, Json(ApiError { error: m.into() }))
}
fn err_404(m: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::NOT_FOUND, Json(ApiError { error: m.into() }))
}
fn err_429(m: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::TOO_MANY_REQUESTS, Json(ApiError { error: m.into() }))
}
fn err_500(m: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: m.into() }))
}
fn error_response(code: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (code, Json(ApiError { error: msg.into() }))
}
fn map_db_error(err: DbError) -> (StatusCode, Json<ApiError>) {
    match &err {
        DbError::NoEncontrado(msg) => error_response(StatusCode::NOT_FOUND, msg),
        DbError::Validacion(msg) => error_response(StatusCode::UNPROCESSABLE_ENTITY, msg),
        DbError::Sqlite(e) => {
            error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("Error de base de datos: {e}"))
        }
        DbError::Pool(e) => {
            error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("Error de pool de conexiones: {e}"))
        }
    }
}
fn auth_401() -> (StatusCode, Json<ApiError>) {
    (StatusCode::UNAUTHORIZED, Json(ApiError { error: "Credenciales inválidas".into() }))
}

// ── inicio ──────────────────────────────────────────────────────────

/// Detecta el encoder H.264 soportado por el sistema.
/// En Raspberry Pi prefiere `h264_v4l2m2m` (aceleración por hardware).
/// En otros Linux con OpenMAX usa `h264_omx`. Como fallback seguro usa `libx264` (CPU).
fn detect_h264_encoder() -> &'static str {
    let out = std::process::Command::new("ffmpeg")
        .args(["-encoders", "-v", "quiet"])
        .output();
    let stdout = match out {
        Ok(o) => o.stdout,
        Err(_) => return "libx264",
    };
    let s = String::from_utf8_lossy(&stdout);
    if s.contains("h264_v4l2m2m") {
        "h264_v4l2m2m"
    } else if s.contains("h264_omx") {
        "h264_omx"
    } else {
        "libx264"
    }
}

/// Genera un thumbnail para un video usando ffmpeg.
/// Extrae un frame en el segundo 3 y lo guarda como {path}.thumb.jpg
fn generar_thumbnail(video_path: &str) -> Option<String> {
    let thumbnail_path = format!("{}.thumb.jpg", video_path);
    let result = std::process::Command::new("ffmpeg")
        .args([
            "-i", video_path,
            "-ss", "00:00:03",
            "-vframes", "1",
            "-q:v", "2",
            "-y", &thumbnail_path,
        ])
        .output();
    match result {
        Ok(output) if output.status.success() => {
            tracing::info!("🖼️  Thumbnail generado: {}", thumbnail_path);
            Some(thumbnail_path)
        }
        _ => {
            tracing::warn!("⚠️  No se pudo generar thumbnail para: {}", video_path);
            None
        }
    }
}

/// Landing page personalizada
async fn landing_page() -> impl IntoResponse {
    let html = include_str!("../static/index.html");
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html))
}

/// GET /app/ — Dashboard vanilla HTML
async fn dashboard_pagina() -> impl IntoResponse {
    let html = include_str!("../static/dashboard.html");
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "data/educonect.db".into());
    let frontend_path = std::env::var("FRONTEND_PATH").unwrap_or_else(|_| "../edu-conect-rural-dashboard/out/".into());
    let listen_addr: SocketAddr = std::env::var("LISTEN_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".into()).parse().expect("LISTEN_ADDR inválida");

    let database = Database::open(&db_path).expect("Error al abrir la base de datos");

    // Inicializar lector ZIM (Wikipedia offline puro Rust)
    let zim = zim_proxy::inicializar().await;

    // Detectar encoder H.264 soportado por el hardware (Raspberry Pi → h264_v4l2m2m, x86 → libx264)
    let h264_encoder = detect_h264_encoder();
    tracing::info!("🎥 Encoder H.264 seleccionado: {h264_encoder}");

    let state = AppState {
        db: database.clone(),
        frontend_path: frontend_path.clone(),
        zim: zim.clone(),
        h264_encoder,
        login_limiter: std::sync::Arc::new(RateLimiter::new(5, 60)),
    };

    let app = Router::new()
        // ── Health check (sin auth) ──
        .route("/health", get(|| async {
            Json(serde_json::json!({"status": "ok", "version": env!("CARGO_PKG_VERSION")}))
        }))
        .route("/", get(landing_page))
        .route("/app", get(|| async { axum::response::Redirect::to("/app/") }))
        .route("/app/", get(dashboard_pagina))
        .route("/api/cursos", get(listar_cursos))
        .route("/api/cursos/{id}", get(obtener_curso))
        .route("/api/progreso", post(guardar_progreso))
        .route("/api/progreso/{usuario}", get(obtener_progreso_usuario))
        .route("/api/buscar", get(buscar))
        .route("/api/biblioteca", get(listar_biblioteca))
        // ── API módulos (filesystem scan) ──
        .route("/api/modulos", get(listar_modulos))
        .route("/api/multimedia", get(listar_phet))
        .route("/api/youtube", get(|| async {
            Json(serde_json::json!({"videos": [], "total": 0, "status": "offline_content_coming_soon"}))
        }))
        // ── Diccionario offline ──
        .route("/api/diccionario/buscar", get(diccionario_buscar))
        .route("/api/diccionario/sugerir", get(diccionario_sugerir))
        .route("/api/diccionario/palabra-dia", get(diccionario_palabra_dia))
        .route("/diccionario/", get(diccionario_pagina))
        .route("/diccionario", get(|| async { axum::response::Redirect::to("/diccionario/") }))
        // ── TTS offline (sin Python) ──
        .route("/api/tts", get(handler_tts))
        // ── Profesor ──
        .route("/profesor/", get(profesor_pagina))
        .route("/profesor", get(|| async { axum::response::Redirect::to("/profesor/") }))
        .route("/api/profesor/estudiantes", get(profesor_listar_estudiantes))
        .route("/api/profesor/progreso", get(profesor_progreso_completo))
        .route("/api/profesor/progreso/{usuario}", get(profesor_progreso_estudiante))
        .route("/api/profesor/reporte", get(profesor_reporte))
        .route("/api/profesor/exportar", get(profesor_exportar_csv))
        // ── Admin: /admin/login es PÚBLICO; el resto va DENTRO del nest protegido ──
        .route("/admin/login", post(admin_login))
        .nest(
            "/admin",
            Router::new()
                .route("/dashboard", get(admin_dashboard))
                .route("/estadisticas", get(admin_estadisticas))
                .nest(
                    "/contenido",
                    Router::new()
                        .route("/status", get(contenido_status))
                        .route("/cursos", post(contenido_crear_curso))
                        .route("/cursos/{id}", put(contenido_editar_curso).delete(contenido_eliminar_curso))
                        .route("/videos", post(contenido_crear_video))
                        .route("/videos/{id}", delete(contenido_eliminar_video))
                        .route("/archivos", get(contenido_listar_archivos))
                        // Límite de 100MB para uploads (ajustar si la SD lo permite)
                        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024)),
                )
                .layer(auth::AuthLayer::new(state.db.jwt_secret.clone())),
        )        // ── Wikipedia offline (lector ZIM puro Rust) ──
        .route("/zim/", get(handler_zim_raiz))
        .route("/zim", get(handler_zim_raiz))
        .route("/zim/{*path}", get(handler_zim_articulo))
        // ── Wikipedia API ──
        .route("/api/wikipedia/search", get(wikipedia_search))
        .route("/api/wikipedia/article", get(wikipedia_article))
        .route("/api/wikipedia/zims", get(wikipedia_zims))
        // ── PhET simulaciones (coming soon) ──
        .route("/phet/", get(|| async {
            axum::response::Html(r#"<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>PhET — EduConect Rural</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0;}div{text-align:center;padding:2rem;}h1{color:#f4a261;}p{color:#aaa;}</style></head><body><div><h1>🧪 PhET Simulaciones</h1><p>Simulaciones interactivas offline próximamente</p><p style="font-size:0.8rem;">EduConect Rural — La Guajira 🌵</p></div></body></html>"#)
        }))
        .route("/phet", get(|| async { axum::response::Redirect::to("/phet/") }))
        .nest_service("/modulos", ServeDir::new("../edu-conect-rural-dashboard/modulos").append_index_html_on_directories(true))
        .nest_service("/biblioteca", ServeDir::new("data/biblioteca").append_index_html_on_directories(false))
        .nest_service("/videos", ServeDir::new("data/videos"))
        .route("/api/videos", get(listar_videos))
        .route("/api/videos/thumbnail/{id}", get(servir_thumbnail))
        .route("/api/videos/descargar", post(handler_descargar_video))
        .route("/api/videos/convertir", post(handler_convertir_video))
        .route("/api/videos/generar-thumbnails", post(generar_thumbnails_lote))
        .route("/videos-page/", get(videos_pagina))
        .route("/videos-page", get(|| async { axum::response::Redirect::to("/videos-page/") }))
        // ── Static assets (CSS, JS) ──
        .nest_service("/static", ServeDir::new("static"))
        // ── PWA ──
        .route("/sw.js", get(handler_sw_js))
        .route("/manifest.json", get(handler_manifest))
        .route("/app-icon.svg", get(handler_app_icon))
        .fallback_service(ServeDir::new(&state.frontend_path).append_index_html_on_directories(true))
        .with_state(state);

    tracing::info!("🚀 Servidor EduConect Rural escuchando en http://{listen_addr}");
    tracing::info!("📁 Frontend estático servido desde: {frontend_path}");

    let listener = tokio::net::TcpListener::bind(listen_addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("Señal recibida — apagando EduConect Rural...");
        })
        .await
        .unwrap();
}

// ── handlers API pública ──────────────────────────────────────────────

async fn listar_cursos(State(state): State<AppState>) -> Result<Json<Vec<Curso>>, (StatusCode, Json<ApiError>)> {
    state.db.listar_cursos().map(Json).map_err(map_db_error)
}
async fn obtener_curso(State(state): State<AppState>, Path(id): Path<i64>) -> Result<Json<Curso>, (StatusCode, Json<ApiError>)> {
    state.db.obtener_curso(id).map(Json).map_err(map_db_error)
}
async fn guardar_progreso(State(state): State<AppState>, Json(payload): Json<NuevoProgreso>) -> Result<(StatusCode, Json<Progreso>), (StatusCode, Json<ApiError>)> {
    state.db.guardar_progreso(&payload).map(|p| (StatusCode::CREATED, Json(p))).map_err(map_db_error)
}
async fn obtener_progreso_usuario(State(state): State<AppState>, Path(usuario): Path<String>) -> Result<Json<Vec<Progreso>>, (StatusCode, Json<ApiError>)> {
    state.db.progreso_por_usuario(&usuario).map(Json).map_err(map_db_error)
}

#[derive(Deserialize)]
struct SearchQuery { q: String, limite: Option<i64> }

/// GET /api/buscar?q=... — búsqueda full-text
async fn buscar(State(state): State<AppState>, Query(params): Query<SearchQuery>) -> Result<Json<Vec<SearchResult>>, (StatusCode, Json<ApiError>)> {
    if params.q.trim().is_empty() {
        return Ok(Json(vec![]));
    }
    state.db.buscar(&params.q, params.limite.unwrap_or(10)).map(Json).map_err(map_db_error)
}

/// GET /api/biblioteca — devuelve el catálogo completo de la biblioteca digital
async fn listar_biblioteca(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let libros = state.db.listar_biblioteca().map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "libros": libros })))
}

// ── Diccionario offline ─────────────────────────────────────────────

#[derive(Deserialize)]
struct DiccionarioQuery { q: Option<String>, limite: Option<i64> }

/// GET /api/diccionario/buscar?q=palabra — busca en el diccionario
async fn diccionario_buscar(
    State(state): State<AppState>,
    Query(params): Query<DiccionarioQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let q = params.q.unwrap_or_default();
    if q.trim().is_empty() {
        return Ok(Json(serde_json::json!({ "resultados": [] })));
    }
    let resultados = state.db.buscar_en_diccionario(&q, params.limite.unwrap_or(10)).map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "resultados": resultados })))
}

/// GET /api/diccionario/sugerir?q=pre — autocompletado
async fn diccionario_sugerir(
    State(state): State<AppState>,
    Query(params): Query<DiccionarioQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let q = params.q.unwrap_or_default();
    if q.trim().is_empty() {
        return Ok(Json(serde_json::json!({ "sugerencias": [] })));
    }
    let sugerencias = state.db.sugerir_palabras(&q, params.limite.unwrap_or(8)).map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "sugerencias": sugerencias })))
}

/// GET /api/diccionario/palabra-dia — palabra aleatoria del día
async fn diccionario_palabra_dia(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let palabra = state.db.palabra_del_dia().map_err(map_db_error)?;
    Ok(Json(palabra))
}

/// GET /diccionario/ — página HTML del diccionario offline
async fn diccionario_pagina() -> impl IntoResponse {
    let html = include_str!("../static/diccionario.html");
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html))
}

// ── listar videos locales ─────────────────────────────────────────────

async fn listar_videos() -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    // std::fs::read_dir es bloqueante; lo movemos a un hilo para no saturar el reactor de Tokio
    let videos: Vec<serde_json::Value> = tokio::task::spawn_blocking(|| -> Result<Vec<serde_json::Value>, String> {
        let mut videos = Vec::new();
        let dir = std::path::Path::new("data/videos");
        if dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if matches!(ext.to_lowercase().as_str(), "mp4" | "webm" | "ogg" | "mov") {
                            let name = path.file_stem()
                                .and_then(|n| n.to_str())
                                .unwrap_or("video")
                                .replace(['_', '-'], " ");
                            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                            let thumb_path = format!("{}.thumb.jpg", path.display());
                            let thumbnail = std::path::Path::new(&thumb_path).exists()
                                .then(|| format!("/videos/{}.thumb.jpg", path.file_name().unwrap_or_default().to_string_lossy()));
                            let mut entry = serde_json::json!({
                                "id": name.clone(),
                                "title": name,
                                "file": path.file_name().unwrap_or_default().to_string_lossy(),
                                "url": format!("/videos/{}", path.file_name().unwrap_or_default().to_string_lossy()),
                                "size": size,
                                "type": ext.to_lowercase(),
                            });
                            if let Some(thumb_url) = thumbnail {
                                entry["thumbnail"] = serde_json::json!(thumb_url);
                                entry["thumbnail_api"] = serde_json::json!(format!("/api/videos/thumbnail/{}", name));
                            }
                            videos.push(entry);
                        }
                    }
                }
            }
        }
        Ok(videos)
    }).await.map_err(|e| err_500(&format!("Error: {e}")))?
      .map_err(|e| err_500(&e))?;
    Ok(Json(serde_json::json!({ "videos": videos })))
}

/// GET /api/videos/thumbnail/{id} — sirve la miniatura de un video por ID (nombre)
async fn servir_thumbnail(
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let id = id.replace('"', "").replace('\'', "").replace("..", "");
    // Buscar archivo .thumb.jpg con ese nombre base en data/videos
    let videos_dir = std::path::Path::new("data/videos");
    if !videos_dir.is_dir() {
        return Err(err_404("No hay directorio de videos"));
    }
    let entries = std::fs::read_dir(videos_dir).map_err(|_| err_500("Error leyendo directorio"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        // Buscar coincidencia por nombre base (sin extensión) o nombre completo
        let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        if (stem == id || file_name == id) && file_name.ends_with(".thumb.jpg") {
            let data = tokio::fs::read(&path).await.map_err(|_| err_500("Error leyendo thumbnail"))?;
            return Ok((
                [(header::CONTENT_TYPE, "image/jpeg"),
                 (header::CACHE_CONTROL, "public, max-age=86400")],
                data,
            ));
        }
        // También buscar coincidencia parcial: si el id forma parte del nombre
        if file_name.contains(&id) && file_name.ends_with(".thumb.jpg") {
            let data = tokio::fs::read(&path).await.map_err(|_| err_500("Error leyendo thumbnail"))?;
            return Ok((
                [(header::CONTENT_TYPE, "image/jpeg"),
                 (header::CACHE_CONTROL, "public, max-age=86400")],
                data,
            ));
        }
    }
    Err(err_404(&format!("Thumbnail no encontrado para: {id}")))
}

// ── videos page ────────────────────────────────────────────────────

/// GET /videos-page/ — página HTML de galería de videos offline
async fn videos_pagina() -> impl IntoResponse {
    let html = include_str!("../static/videos.html");
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html))
}

// ── PWA handlers ────────────────────────────────────────────────────

/// GET /sw.js — Service Worker para caché offline
async fn handler_sw_js() -> impl IntoResponse {
    let js = include_str!("../static/sw.js");
    (StatusCode::OK, [(header::CONTENT_TYPE, "application/javascript; charset=utf-8")], Html(js))
}

/// GET /manifest.json — PWA manifest
async fn handler_manifest() -> impl IntoResponse {
    let manifest = include_str!("../static/manifest.json");
    (StatusCode::OK, [(header::CONTENT_TYPE, "application/manifest+json; charset=utf-8")], Html(manifest))
}

/// GET /app-icon.svg — Icono SVG de la aplicación
async fn handler_app_icon() -> impl IntoResponse {
    let svg = include_str!("../static/app-icon.svg");
    (StatusCode::OK, [(header::CONTENT_TYPE, "image/svg+xml; charset=utf-8")], Html(svg))
}

// ── TTS offline (espeak-ng nativo, sin Python) ──────────────────────

#[derive(Deserialize)]
struct TtsQuery { text: String, rate: Option<i64> }

/// GET /api/tts?text=hola&rate=150 — genera audio WAV con espeak-ng
async fn handler_tts(
    Query(params): Query<TtsQuery>,
) -> Response {
    if params.text.trim().is_empty() {
        return err_422("El parámetro 'text' no puede estar vacío").into_response();
    }

    let rate = params.rate.unwrap_or(150).clamp(80, 350);
    let text = params.text.trim().to_string();

    // spawn_blocking porque espeak-ng es síncrono
    match tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let child = std::process::Command::new("espeak-ng")
            .arg("-v").arg("es-es+mbrola-3")
            .arg("-s").arg(rate.to_string())
            .arg("-p").arg("40")
            .arg("-w").arg("/dev/stdout")
            .arg("--")
            .arg(&text)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Error al ejecutar espeak-ng: {e}"))?;

        let output = child.wait_with_output()
            .map_err(|e| format!("Error al leer espeak-ng: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("espeak-ng falló: {stderr}"));
        }

        Ok(output.stdout)
    }).await {
        Ok(Ok(audio_data)) => {
            if audio_data.is_empty() {
                return err_500("espeak-ng no generó audio").into_response();
            }
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "audio/wav"),
                    (header::CACHE_CONTROL, "public, max-age=86400"),
                    (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
                ],
                audio_data,
            ).into_response()
        }
        Ok(Err(e)) => err_500(&e).into_response(),
        Err(e) => err_500(&format!("Error interno: {e}")).into_response(),
    }
}

// ── profesor handlers ──────────────────────────────────────────────

async fn profesor_pagina() -> impl IntoResponse {
    let html = include_str!("../static/profesor.html");
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html))
}

async fn profesor_listar_estudiantes(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let estudiantes = state.db.listar_estudiantes().map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "estudiantes": estudiantes })))
}

async fn profesor_progreso_completo(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let progreso = state.db.progreso_completo().map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "progreso": progreso })))
}

async fn profesor_progreso_estudiante(State(state): State<AppState>, Path(usuario): Path<String>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let progreso = state.db.progreso_estudiante(&usuario).map_err(map_db_error)?;
    Ok(Json(serde_json::json!({ "usuario": usuario, "progreso": progreso })))
}

async fn profesor_reporte(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let stats = state.db.estadisticas_docente().map_err(map_db_error)?;
    Ok(Json(stats))
}

async fn profesor_exportar_csv(State(state): State<AppState>) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let csv = state.db.exportar_csv().map_err(map_db_error)?;
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (header::CONTENT_DISPOSITION, "attachment; filename=\"progreso-educonect.csv\""),
        ],
        csv,
    ))
}

// ── descargar video con yt-dlp ──────────────────────────────────────

#[derive(Deserialize)]
struct DescargarPayload { url: String, quality: Option<String> }

/// POST /api/videos/descargar — descarga un video de YouTube con yt-dlp
async fn handler_descargar_video(
    Json(payload): Json<DescargarPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    if payload.url.trim().is_empty() {
        return Err(err_422("La URL no puede estar vacía"));
    }
    let quality = payload.quality.unwrap_or_else(|| "720".into());
    let format_arg = match quality.as_str() {
        "best" => "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "480" => "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best",
        "720" => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
        _ => "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
    };
    let videos_dir = std::path::Path::new("data/videos");
    tokio::fs::create_dir_all(videos_dir).await.map_err(|e| err_500(&e.to_string()))?;
    let output = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let result = std::process::Command::new("yt-dlp")
            .arg("--output").arg(format!("{}/%(title)s.%(ext)s", videos_dir.display()))
            .arg("--format").arg(format_arg)
            .arg("--restrict-filenames").arg("--no-playlist")
            .arg("--embed-metadata").arg("--embed-thumbnail")
            .arg("--merge-output-format").arg("mp4")
            .arg("--no-warnings").arg("--print").arg("filename")
            .arg(&payload.url).output()
            .map_err(|e| format!("Error ejecutando yt-dlp: {e}"))?;
        if !result.status.success() {
            return Err(format!("yt-dlp falló: {}", String::from_utf8_lossy(&result.stderr)));
        }
        let filename = String::from_utf8_lossy(&result.stdout).trim().to_string();
        if filename.is_empty() { return Err("yt-dlp no devolvió nombre de archivo".into()); }
        Ok(filename)
    }).await.map_err(|e| err_500(&format!("Error: {e}")))?
      .map_err(|e| err_500(&e))?;
    let file_stem = std::path::Path::new(&output).file_stem().and_then(|s| s.to_str()).unwrap_or("video").to_string();
    let file_path = std::path::Path::new(&output);
    let metadata = tokio::fs::metadata(&file_path).await.ok();
    let size = metadata.map(|m| m.len()).unwrap_or(0);
    tracing::info!("🎬 Video descargado: {} ({} bytes)", output, size);
    // Generar thumbnail automáticamente después de la descarga
    let thumbnail = generar_thumbnail(&output);
    let thumb_url: Option<String> = thumbnail.as_ref().map(|t| {
        let p = std::path::Path::new(t);
        format!("/videos/{}", p.file_name().unwrap_or_default().to_string_lossy())
    });
    let mut resp = serde_json::json!({
        "ok": true, "file": output, "title": file_stem.replace(['_', '-'], " "),
        "size": size, "url": format!("/videos/{}", file_path.file_name().unwrap_or_default().to_string_lossy())
    });
    if let Some(ref t) = thumb_url {
        resp["thumbnail"] = serde_json::json!(t);
    }
    Ok(Json(resp))
}

// ── convertir / optimizar video ────────────────────────────────────

#[derive(Deserialize)]
struct ConvertirPayload { filename: String }

/// POST /api/videos/convertir — transcodifica un video a H.264 optimizado
async fn handler_convertir_video(
    State(state): State<AppState>,
    Json(payload): Json<ConvertirPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let input_path = std::path::Path::new("data/videos").join(&payload.filename);
    if !input_path.exists() { return Err(err_404(&format!("Archivo no encontrado: {}", payload.filename))); }
    let output_name = format!("{}_opt.mp4", input_path.file_stem().and_then(|s| s.to_str()).unwrap_or("video"));
    let output_path = std::path::Path::new("data/videos").join(&output_name);
    let input = input_path.to_string_lossy().to_string();
    let output = output_path.to_string_lossy().to_string();
    let encoder = state.h264_encoder;
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let result = std::process::Command::new("ffmpeg")
            .args(["-i", &input, "-c:v", encoder, "-preset", "medium", "-crf", "20",
                   "-c:a", "aac", "-b:a", "64k", "-ac", "1",
                   "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
                   "-movflags", "+faststart", "-threads", "2", "-y", &output])
            .output().map_err(|e| format!("ffmpeg falló: {e}"))?;
        if !result.status.success() {
            return Err(format!("ffmpeg: {}", String::from_utf8_lossy(&result.stderr)));
        }
        Ok(())
    }).await.map_err(|e| err_500(&format!("Error: {e}")))?
      .map_err(|e| err_500(&e))?;
    // Generar thumbnail para el video convertido
    let thumbnail = generar_thumbnail(&output_path.to_string_lossy());
    let thumb_url: Option<String> = thumbnail.as_ref().map(|t| {
        let p = std::path::Path::new(t);
        format!("/videos/{}", p.file_name().unwrap_or_default().to_string_lossy())
    });
    let size = tokio::fs::metadata(&output_path).await.map(|m| m.len()).unwrap_or(0);
    let mut resp = serde_json::json!({
        "ok": true, "file": output_name, "size": size,
        "encoder": encoder, "url": format!("/videos/{}", output_name)
    });
    if let Some(ref t) = thumb_url {
        resp["thumbnail"] = serde_json::json!(t);
    }
    Ok(Json(resp))
}

// ── generar thumbnails en lote ──────────────────────────────────────

/// POST /api/videos/generar-thumbnails — genera thumbnails para todos los videos que no tengan uno
async fn generar_thumbnails_lote(
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let resultado = tokio::task::spawn_blocking(|| -> Result<serde_json::Value, String> {
        let dir = std::path::Path::new("data/videos");
        if !dir.is_dir() {
            return Ok(serde_json::json!({"generados": 0, "total": 0, "errores": []}));
        }
        let mut total = 0u64;
        let mut generados = 0u64;
        let mut errores: Vec<String> = Vec::new();
        let entries = std::fs::read_dir(dir).map_err(|e| format!("Error leyendo directorio: {e}"))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Error en entrada: {e}"))?;
            let path = entry.path();
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if matches!(ext.to_lowercase().as_str(), "mp4" | "webm" | "ogg" | "mov") {
                    let video_path = path.to_string_lossy().to_string();
                    let thumb_path_str = format!("{}.thumb.jpg", video_path);
                    if !std::path::Path::new(&thumb_path_str).exists() {
                        total += 1;
                        match generar_thumbnail(&video_path) {
                            Some(_) => { generados += 1; }
                            None => { errores.push(video_path.clone()); }
                        }
                    }
                }
            }
        }
        Ok(serde_json::json!({
            "generados": generados,
            "total": total,
            "errores": errores
        }))
    }).await.map_err(|e| err_500(&format!("Error: {e}")))?;
    Ok(Json(resultado.map_err(|e| err_500(&e))?))
}

// ── handlers admin ────────────────────────────────────────────────────

async fn admin_login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<ApiError>)> {
    // Rate limiting: maximo 5 intentos por IP por minuto
    let ip = addr.ip().to_string();
    if !state.login_limiter.check(&ip).await {
        tracing::warn!("Rate limit excedido para IP {}", ip);
        return Err(err_429("Demasiados intentos. Espera 1 minuto y vuelve a intentar."));
    }

    if payload.usuario.trim().is_empty() { return Err(err_422("El campo 'usuario' no puede estar vacío")); }
    if payload.password.is_empty() { return Err(err_422("El campo 'password' no puede estar vacío")); }
    let admin = state.db.obtener_admin(&payload.usuario).map_err(|_| auth_401())?;
    if !bcrypt::verify(&payload.password, &admin.password_hash).unwrap_or(false) { return Err(auth_401()); }
    let token = auth::create_token(&payload.usuario, &state.db.jwt_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: format!("Error: {e}") })))?;
    Ok(Json(LoginResponse { token, usuario: payload.usuario, expira_en: (Utc::now() + chrono::Duration::hours(24)).timestamp() }))
}

async fn admin_dashboard(user: models::AuthUser) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    Ok(Json(serde_json::json!({"mensaje": format!("Bienvenido, {}", user.usuario), "usuario": user.usuario})))
}

async fn admin_estadisticas(_user: models::AuthUser, State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let n = state.db.listar_cursos().map_err(|e| err_500(&e.to_string()))?.len();
    Ok(Json(serde_json::json!({"total_cursos": n, "total_progresos": state.db.total_registros_progreso().unwrap_or(0), "version": env!("CARGO_PKG_VERSION")})))
}

// ── handlers content management ───────────────────────────────────────

#[derive(Deserialize)]
struct CursoPayload { titulo: String, descripcion: Option<String>, categoria: String, archivo_path: Option<String> }
#[derive(Deserialize)]
struct VideoPayload { titulo: String, canal: Option<String>, duracion: Option<String>, thumbnail: Option<String>, categoria: Option<String>, archivo: Option<String> }

async fn contenido_status(State(state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let n = state.db.listar_cursos().map_err(|e| err_500(&e.to_string()))?.len();
    Ok(Json(serde_json::json!({"total_cursos": n, "total_videos": state.db.total_videos().unwrap_or(0), "total_archivos": state.db.total_archivos().unwrap_or(0), "espacio_usado_kb": content::dir_size_kb("data/contenido")})))
}

#[allow(dead_code)]
async fn contenido_upload(State(state): State<AppState>, mut multipart: Multipart) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let mut items = vec![];
    while let Some(field) = multipart.next_field().await.map_err(|e| err_400(&e.to_string()))? {
        let name = field.file_name().unwrap_or("archivo").to_string();
        let mime = field.content_type().unwrap_or("application/octet-stream").to_string();
        let data = field.bytes().await.map_err(|e| err_400(&e.to_string()))?;
        let ext = name.rsplit('.').next().unwrap_or("bin").to_lowercase();
        let tipo = match ext.as_str() { "pdf"=>"pdf", "mp4"|"webm"|"avi"|"mov"=>"video", "jpg"|"jpeg"|"png"|"gif"|"svg"|"webp"=>"imagen", "md"|"txt"|"html"=>"nota", _=>"otro" };
        let dir = PathBuf::from("data/contenido");
        tokio::fs::create_dir_all(&dir).await.map_err(|e| err_500(&e.to_string()))?;
        let safe = format!("{}_{}", Utc::now().timestamp(), name.replace(' ', "_"));
        tokio::fs::write(dir.join(&safe), &data).await.map_err(|e| err_500(&e.to_string()))?;
        let ruta = format!("data/contenido/{}", safe);
        state.db.insertar_archivo(tipo, &name, &ruta, data.len() as i64, &mime).map_err(|e| err_500(&e.to_string()))?;
        items.push(serde_json::json!({"nombre": name, "ruta": ruta, "tipo": tipo, "tamano": data.len()}));
    }
    Ok(Json(serde_json::json!({"archivos": items})))
}

async fn contenido_crear_curso(State(state): State<AppState>, Json(p): Json<CursoPayload>) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<ApiError>)> {
    if p.titulo.trim().is_empty() { return Err(err_422("El título no puede estar vacío")); }
    state.db.insertar_curso(&p.titulo, &p.descripcion.unwrap_or_default(), &p.categoria, &p.archivo_path.unwrap_or_default()).map_err(|e| err_500(&e.to_string()))?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({"ok": true}))))
}

async fn contenido_editar_curso(State(state): State<AppState>, Path(id): Path<i64>, Json(p): Json<CursoPayload>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    state.db.actualizar_curso(id, &p.titulo, &p.descripcion.unwrap_or_default(), &p.categoria, &p.archivo_path.unwrap_or_default()).map_err(|e| err_500(&e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn contenido_eliminar_curso(State(state): State<AppState>, Path(id): Path<i64>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    state.db.eliminar_curso(id).map_err(|e| err_500(&e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn contenido_crear_video(State(state): State<AppState>, Json(p): Json<VideoPayload>) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<ApiError>)> {
    if p.titulo.trim().is_empty() { return Err(err_422("El título del video no puede estar vacío")); }
    state.db.insertar_video(&p.titulo, &p.canal.unwrap_or_default(), &p.duracion.unwrap_or_default(), &p.thumbnail.unwrap_or_default(), &p.categoria.unwrap_or_default(), &p.archivo.unwrap_or_default()).map_err(|e| err_500(&e.to_string()))?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({"ok": true}))))
}

async fn contenido_eliminar_video(State(state): State<AppState>, Path(id): Path<i64>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    state.db.eliminar_video(id).map_err(|e| err_500(&e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

async fn contenido_listar_archivos(State(state): State<AppState>) -> Result<Json<Vec<ArchivoResponse>>, (StatusCode, Json<ApiError>)> {
    state.db.listar_archivos().map_err(|e| err_500(&e.to_string())).map(Json)
}

// ══════════════════════════════════════════════
//  ZIM — Wikipedia + Wikilibros offline (vía libzim)
// ══════════════════════════════════════════════

/// GET /zim/ — redirige a la página principal del ZIM por defecto
async fn handler_zim_raiz(State(state): State<AppState>) -> axum::response::Response {
    let guard = state.zim.read().await;
    if guard.zims.is_empty() {
        return zim_pagina_no_zims();
    }
    let reader = guard.zims.get(&guard.default_key);
    match reader {
        Some(r) => {
            let url = format!("/zim/{}", r.main_page_url.trim_start_matches('/'));
            axum::response::Redirect::temporary(&url).into_response()
        }
        None => zim_pagina_no_zims(),
    }
}

/// GET /zim/{*path} — sirve un artículo del ZIM por defecto
async fn handler_zim_articulo(
    State(state): State<AppState>,
    Path(path): Path<String>,
) -> Response {
    let guard = state.zim.read().await;
    let reader = match guard.zims.get(&guard.default_key) {
        Some(r) => r,
        None => return zim_pagina_no_zims(),
    };

    servir_entrada_zim(reader, &path)
}

// ── Wikipedia API endpoints ────────────────

#[derive(serde::Deserialize)]
struct WikiSearchQuery {
    q: String,
    #[serde(default)]
    zim: Option<String>,
}

/// GET /api/wikipedia/search?q=colombia[&zim=wikipedia_es_top]
async fn wikipedia_search(
    State(state): State<AppState>,
    Query(params): Query<WikiSearchQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let guard = state.zim.read().await;
    if guard.zims.is_empty() {
        return Ok(Json(serde_json::json!({"results": [], "zims": []})));
    }

    let results = buscar_articulos(&guard, &params.q, params.zim.as_deref(), 20);
    let zims = listar_zims(&guard);

    Ok(Json(serde_json::json!({
        "results": results,
        "zims": zims,
        "query": params.q,
    })))
}

#[derive(serde::Deserialize)]
struct WikiArticleQuery {
    path: String,
    #[serde(default)]
    zim: Option<String>,
}

/// GET /api/wikipedia/article?path=A/Colombia[&zim=wikipedia_es_top]
async fn wikipedia_article(
    State(state): State<AppState>,
    Query(params): Query<WikiArticleQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let guard = state.zim.read().await;
    if guard.zims.is_empty() {
        return Err(err_404("No hay archivos ZIM cargados"));
    }

    match obtener_articulo(&guard, &params.path, params.zim.as_deref()) {
        Some(article) => Ok(Json(serde_json::json!({
            "title": article.title,
            "path": article.path,
            "html": article.html,
            "mime": article.mime,
            "zim_slug": article.zim_slug,
            "zim_name": article.zim_name,
        }))),
        None => Err(err_404("Artículo no encontrado")),
    }
}

/// GET /api/wikipedia/zims — lista los ZIMs disponibles
async fn wikipedia_zims(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let guard = state.zim.read().await;
    Json(serde_json::json!({
        "zims": listar_zims(&guard),
        "default": guard.default_key,
    }))
}

/// Helper: sirve una entrada ZIM como HTML
fn servir_entrada_zim(reader: &zim_proxy::ZimReader, path: &str) -> Response {
    let url = if path.trim().is_empty() || path == "A" {
        &reader.main_page_url
    } else {
        path
    };

    let entry = reader.archive.get_entry_bypath_str(url)
        .or_else(|_| reader.archive.get_entry_bypath_str(&format!("A/{url}")));

    let entry = match entry {
        Ok(e) => e,
        Err(_) => return zim_pagina_no_encontrado(url),
    };

    let item = match entry.get_item(true) {
        Ok(i) => i,
        Err(_) => return zim_pagina_no_encontrado(url),
    };

    let mime = item.get_mimetype().unwrap_or_else(|_| "text/html; charset=utf-8".into());
    let blob = match item.get_data() {
        Ok(b) => b,
        Err(_) => return zim_pagina_no_encontrado(url),
    };
    let data = blob.data().to_vec();

    if mime.starts_with("text/html") {
        let html = String::from_utf8_lossy(&data);
        let styled = zim_inyectar_estilos(&html);
        (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            styled.into_bytes(),
        ).into_response()
    } else {
        (
            StatusCode::OK,
            [(header::CONTENT_TYPE, mime.as_str())],
            data,
        ).into_response()
    }
}

// ── Páginas de error ───────────────────────

fn zim_pagina_no_zims() -> Response {
    let html = r#"<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Wikipedia Offline</title>
<style>
body{font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#e0e0e0;max-width:800px;margin:auto;}
h1{color:#e94560;}h2{color:#0f3460;}
pre{background:#16213e;padding:1rem;border-radius:8px;overflow-x:auto;}
a{color:#e94560;}
.btn{background:#e94560;color:#fff;padding:.5rem 1rem;border-radius:8px;text-decoration:none;display:inline-block;margin-top:1rem;}
</style></head><body>
<h1>📖 Wikipedia Offline</h1>
<p>No hay archivos ZIM cargados.</p>
<h2>Cómo instalar:</h2>
<pre><code>mkdir -p data/contenido/zim
wget -P data/contenido/zim/ \
  https://download.kiwix.org/zim/wikibooks/wikibooks_es_all_nopic_2025-10.zim
# Luego reinicia el servidor</code></pre>
<a class="btn" href="/">← Volver al inicio</a>
</body></html>"#;
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html)).into_response()
}

fn zim_pagina_no_encontrado(url: &str) -> Response {
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>No encontrado</title>
<style>body{{font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#e0e0e0;}}
h1{{color:#e94560;}}a{{color:#e94560;}}
.btn{{background:#e94560;color:#fff;padding:.5rem 1rem;border-radius:8px;text-decoration:none;display:inline-block;margin-top:1rem;}}
</style></head><body>
<h1>📖 Artículo no encontrado</h1>
<p>No se encontró: <code>{url}</code></p>
<a class="btn" href="/zim/">← Página principal</a>
</body></html>"#
    );
    (StatusCode::NOT_FOUND, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], Html(html)).into_response()
}

// ══════════════════════════════════════════════
//  API Módulos Educativos — filesystem scan
// ══════════════════════════════════════════════

#[derive(serde::Serialize)]
struct ModuloInfo {
    id: String,
    titulo: String,
    descripcion: String,
    path: String,
    icono: String,
    categoria: String,
    etiqueta: String,
}

/// GET /api/modulos — escanea ../edu-conect-rural-dashboard/modulos/ y devuelve metadata
async fn listar_modulos() -> Json<serde_json::Value> {
    let modulos_dir = "../edu-conect-rural-dashboard/modulos";
    let modulos = scan_modulos_dir(modulos_dir, false);
    Json(serde_json::json!({
        "modulos": modulos,
        "total": modulos.len(),
    }))
}

/// GET /api/multimedia — solo módulos PhET (simulaciones interactivas)
async fn listar_phet() -> Json<serde_json::Value> {
    let phet_dir = "../edu-conect-rural-dashboard/modulos/phet";
    let phet = scan_modulos_dir(phet_dir, true);
    Json(serde_json::json!({
        "multimedia": phet,
        "total": phet.len(),
    }))
}

fn scan_modulos_dir(dir_path: &str, is_phet: bool) -> Vec<ModuloInfo> {
    let mut modulos = Vec::new();
    let dir = match std::fs::read_dir(dir_path) {
        Ok(d) => d,
        Err(_) => return modulos,
    };

    for entry in dir.flatten() {
        let path = entry.path();
        if !path.is_dir() { continue; }

        let dir_name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if dir_name == "comun" { continue; }
        if is_phet && dir_name == "menu.html" { continue; }

        // Buscar index.html dentro del directorio
        let index_path = path.join("index.html");
        let _html_path = if index_path.exists() {
            index_path
        } else {
            // Buscar cualquier .html
            match std::fs::read_dir(&path) {
                Ok(entries) => {
                    let html_file = entries.flatten()
                        .find(|e| e.path().extension().map(|ext| ext == "html").unwrap_or(false));
                    match html_file {
                        Some(f) => f.path(),
                        None => continue,
                    }
                }
                Err(_) => continue,
            }
        };

        let html_content = match std::fs::read_to_string(&_html_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Extraer título del HTML
        let titulo = extract_html_title(&html_content, &dir_name);
        let icono = guess_icon(&dir_name, &titulo);
        let categoria = guess_category(&dir_name);
        let descripcion = extract_meta_desc(&html_content);
        let etiqueta = if is_phet { "PhET".into() } else { "DBA".into() };

        modulos.push(ModuloInfo {
            id: dir_name.clone(),
            titulo,
            descripcion,
            path: if is_phet { format!("/modulos/phet/{}/", dir_name) } else { format!("/modulos/{}/", dir_name) },
            icono,
            categoria,
            etiqueta,
        });
    }

    modulos
}

fn extract_html_title(html: &str, fallback: &str) -> String {
    // Buscar <title>...</title>
    if let Some(start) = html.find("<title>") {
        let after = &html[start + 7..];
        if let Some(end) = after.find("</title>") {
            return after[..end].trim().to_string();
        }
    }
    // Buscar <h1>...</h1>
    if let Some(start) = html.find("<h1>") {
        let after = &html[start + 4..];
        let end = after.find("</h1>").unwrap_or(after.len());
        let title = after[..end].trim().to_string();
        // Limpiar tags HTML dentro del h1
        let clean = title.replace(|c: char| c == '<' || c == '>', "");
        if !clean.is_empty() { return clean; }
    }
    // Fallback: nombre del directorio
    fallback.replace('-', " ").replace('_', " ")
}

fn extract_meta_desc(html: &str) -> String {
    // Buscar <meta name="description" content="...">
    for line in html.lines() {
        if line.contains("description") && line.contains("content=") {
            if let Some(start) = line.find("content=\"") {
                let after = &line[start + 9..];
                if let Some(end) = after.find('"') {
                    return after[..end].to_string();
                }
            }
        }
    }
    String::new()
}

fn guess_icon(dir_name: &str, titulo: &str) -> String {
    let combined = format!("{} {}", dir_name, titulo).to_lowercase();
    if combined.contains("mate") || combined.contains("lógica") { return "🧮".into(); }
    if combined.contains("leng") || combined.contains("lectura") || combined.contains("vocal") { return "🔤".into(); }
    if combined.contains("cien") || combined.contains("natura") || combined.contains("tabla") { return "🔬".into(); }
    if combined.contains("arte") || combined.contains("música") { return "🎨".into(); }
    if combined.contains("geo") || combined.contains("mapa") { return "🌍".into(); }
    if combined.contains("nutri") || combined.contains("alimen") { return "🥗".into(); }
    if combined.contains("salud") || combined.contains("higiene") { return "🧼".into(); }
    if combined.contains("clima") || combined.contains("agua") { return "💨".into(); }
    if combined.contains("emo") || combined.contains("siento") { return "❤️".into(); }
    if combined.contains("finan") || combined.contains("ahorro") { return "💰".into(); }
    if combined.contains("ciuda") || combined.contains("palabrero") { return "🕊️".into(); }
    if combined.contains("digi") || combined.contains("tecno") { return "💻".into(); }
    if combined.contains("ingl") { return "🇬🇧".into(); }
    if combined.contains("habi") || combined.contains("crítico") { return "🧠".into(); }
    if combined.contains("depor") || combined.contains("cuerpo") { return "🏃".into(); }
    if combined.contains("puzzle") || combined.contains("quiz") { return "🎮".into(); }
    if combined.contains("3d") || combined.contains("mundo") { return "🌐".into(); }
    if combined.contains("phet") { return "🧪".into(); }
    "📚".into()
}

fn guess_category(dir_name: &str) -> String {
    let d = dir_name.to_lowercase();
    if d.starts_with("leng") { return "Lenguaje".into(); }
    if d.starts_with("mate") { return "Matemáticas".into(); }
    if d.starts_with("cien") { return "Ciencias".into(); }
    if d.starts_with("art") { return "Arte".into(); }
    if d.starts_with("geo") { return "Geografía".into(); }
    if d.starts_with("nut") { return "Nutrición".into(); }
    if d.starts_with("sal") { return "Salud".into(); }
    if d.starts_with("cli") { return "Clima".into(); }
    if d.starts_with("emo") { return "Emociones".into(); }
    if d.starts_with("fin") { return "Finanzas".into(); }
    if d.starts_with("ciu") { return "Ciudadanía".into(); }
    if d.starts_with("dig") { return "Digital".into(); }
    if d.starts_with("ing") { return "Inglés".into(); }
    if d.starts_with("hab") { return "Habilidades".into(); }
    if d.starts_with("dep") { return "Deporte".into(); }
    if d.starts_with("puzzle") || d.starts_with("quiz") { return "Juegos".into(); }
    if d.starts_with("mundo") { return "3D".into(); }
    "General".into()
}
