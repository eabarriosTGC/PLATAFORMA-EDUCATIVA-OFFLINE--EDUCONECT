//! Lector ZIM multi-archivo — Wikipedia + Wikilibros + Vikidia offline.
//!
//! Escanea data/contenido/zim/ por archivos .zim, los abre todos,
//! y expone búsqueda textual + extracción de artículos vía libzim.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::RwLock;
use tracing::{info, warn};
use zim_rs::archive::Archive;

// ============================================================
//  Tipos compartidos
// ============================================================

/// Un lector ZIM individual
pub struct ZimReader {
    pub archive: Archive,
    pub nombre: String,         // nombre amigable (ej. "Wikipedia ES Top")
    pub slug: String,           // clave interna (ej. "wikipedia_es_top")
    pub main_page_url: String,
    pub article_count: u32,
    pub icon: &'static str,     // emoji
}

/// Biblioteca de archivos ZIM cargados
pub struct ZimLibrary {
    pub zims: HashMap<String, ZimReader>,
    /// El ZIM por defecto para /zim/ (el primero que se cargó)
    pub default_key: String,
}

/// Referencia compartida thread-safe
pub type SharedZim = Arc<RwLock<ZimLibrary>>;

const ZIM_DIR: &str = "data/contenido/zim";

/// Valida que un archivo tenga el header ZIM correcto (magic bytes "ZIM\x04")
fn validar_header_zim(path: &std::path::Path) -> Result<(), String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("no se pudo abrir: {e}"))?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic)
        .map_err(|e| format!("no se pudo leer header: {e}"))?;
    if magic == [0x5A, 0x49, 0x4D, 0x04] {
        Ok(())
    } else if magic == [0, 0, 0, 0] {
        Err("archivo corrupto o descarga incompleta (todo ceros)".into())
    } else {
        let hex: Vec<String> = magic.iter().map(|b| format!("{b:02x}")).collect();
        Err(format!("formato desconocido (magic: {})", hex.join(" ")))
    }
}

// ============================================================
//  Inicialización
// ============================================================

/// Escanea data/contenido/zim/ y abre TODOS los .zim encontrados.
/// Prioriza Wikipedia > Vikidia > Wikibooks para el default.
pub async fn inicializar() -> SharedZim {
    let library = ZimLibrary {
        zims: HashMap::new(),
        default_key: String::new(),
    };
    let state: SharedZim = Arc::new(RwLock::new(library));

    let dir = PathBuf::from(ZIM_DIR);
    if !dir.exists() {
        let _ = tokio::fs::create_dir_all(&dir).await;
        warn!("📁 Directorio ZIM creado en {ZIM_DIR}. Coloca archivos .zim allí.");
        return state;
    }

    let mut entries = match tokio::fs::read_dir(&dir).await {
        Ok(e) => e,
        Err(_) => return state,
    };

    let mut zims: Vec<PathBuf> = vec![];
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().map(|e| e == "zim").unwrap_or(false) {
            zims.push(path);
        }
    }

    if zims.is_empty() {
        warn!("⚠️  No hay archivos .zim en {ZIM_DIR}.");
        info!("   Descarga ZIMs desde: https://download.kiwix.org/zim/wikipedia/");
        return state;
    }

    // Ordenar: Wikipedia primero, luego Vikidia, luego Wikilibros
    zims.sort_by(|a, b| {
        let a_str = a.to_string_lossy().to_lowercase();
        let b_str = b.to_string_lossy().to_lowercase();
        // Prioridad: top > otros wikipedia > vikidia > wikibooks
        let a_prio = if a_str.contains("top") { -1 } else if a_str.contains("wikipedia") { 0 } else if a_str.contains("vikidia") { 1 } else { 2 };
        let b_prio = if b_str.contains("top") { -1 } else if b_str.contains("wikipedia") { 0 } else if b_str.contains("vikidia") { 1 } else { 2 };
        a_prio.cmp(&b_prio).then(a_str.cmp(&b_str))
    });

    let mut lock = state.write().await;
    let mut first_key = String::new();

    for path in &zims {
        let path_str = path.to_string_lossy().to_string();
        let filename = path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // ── Validar header ZIM antes de intentar abrir ──
        match validar_header_zim(path) {
            Err(razon) => {
                warn!("   ⚠️  {} — {}", filename, razon);
                continue;
            }
            Ok(_) => {}
        }

        // Generar nombre amigable y slug
        let (nombre, icon, slug) = classify_zim(&filename);

        info!("📖 Abriendo ZIM: {} ({})", nombre, path.file_name().unwrap().to_string_lossy());

        match Archive::new(&path_str) {
            Ok(archive) => {
                let count = archive.get_articlecount();
                let (main_url, _) = encontrar_pagina_principal(&archive);

                let reader = ZimReader {
                    archive,
                    nombre: nombre.clone(),
                    slug: slug.clone(),
                    main_page_url: main_url,
                    article_count: count,
                    icon,
                };

                info!("   ✅ {} artículos — {}", count, nombre);

                if first_key.is_empty() {
                    first_key = slug.clone();
                    lock.default_key = slug.clone();
                }

                lock.zims.insert(slug, reader);
            }
            Err(_) => {
                warn!("   ❌ No se pudo abrir: formato no soportado");
            }
        }
    }

    if lock.zims.is_empty() {
        warn!("❌ No se pudo abrir ningún archivo ZIM");
    } else {
        info!("📚 {} archivos ZIM cargados. Default: {}", lock.zims.len(), lock.default_key);
    }

    drop(lock);
    state
}

fn classify_zim(filename: &str) -> (String, &'static str, String) {
    let lower = filename.to_lowercase();

    if lower.contains("wikipedia") && lower.contains("top") {
        ("Wikipedia ES (Top)".into(), "🌐", "wikipedia_es_top".into())
    } else if lower.contains("wikipedia") && lower.contains("mathematics") {
        ("Wikipedia ES — Matemáticas".into(), "🧮", "wikipedia_es_math".into())
    } else if lower.contains("wikipedia") && lower.contains("physics") {
        ("Wikipedia ES — Física".into(), "⚛️", "wikipedia_es_physics".into())
    } else if lower.contains("wikipedia") && lower.contains("chemistry") {
        ("Wikipedia ES — Química".into(), "🧪", "wikipedia_es_chemistry".into())
    } else if lower.contains("wikipedia") && lower.contains("climate") {
        ("Wikipedia ES — Cambio Climático".into(), "🌍", "wikipedia_es_climate".into())
    } else if lower.contains("wikipedia") {
        ("Wikipedia ES".into(), "🌐", "wikipedia_es".into())
    } else if lower.contains("vikidia") {
        ("Vikidia ES".into(), "📚", "vikidia_es".into())
    } else if lower.contains("wikibooks") {
        ("Wikilibros ES".into(), "📘", "wikibooks_es".into())
    } else {
        ("ZIM Desconocido".into(), "📦", filename.to_lowercase().replace(' ', "_"))
    }
}

fn encontrar_pagina_principal(archive: &Archive) -> (String, String) {
    let candidates = [
        "A/mainPage",
        "A/Main_Page",
        "A/Mainpage",
        "A/Página_principal",
        "A/Portada",
        "A/Wikibooks",
        "A/Wikipedia",
        "A/Wikipedia:Portada",
    ];

    for candidate in &candidates {
        if let Ok(entry) = archive.get_entry_bypath_str(candidate) {
            let title = entry.get_title();
            let path = entry.get_path();
            if !path.is_empty() {
                return (path, title);
            }
        }
    }

    if let Ok(main) = archive.get_metadata("mainPage") {
        if !main.is_empty() {
            return (main.clone(), main);
        }
    }

    ("A/mainPage".to_string(), "Wikipedia Offline".to_string())
}

// ============================================================
//  API de búsqueda para el frontend
// ============================================================

/// Resultado de búsqueda liviano
#[derive(serde::Serialize, Clone)]
pub struct WikiResult {
    pub title: String,
    pub path: String,
    pub snippet: String,
    pub zim_slug: String,
    pub zim_name: String,
}

/// Busca artículos en TODOS los ZIMs o en uno específico.
/// `query` — término de búsqueda (case-insensitive, partial match en título)
/// `zim_slug` — si se especifica, solo busca en ese ZIM
/// `limit` — máximo de resultados
pub fn buscar_articulos(
    library: &ZimLibrary,
    query: &str,
    zim_slug: Option<&str>,
    limit: usize,
) -> Vec<WikiResult> {
    let query_lower = query.to_lowercase();
    let mut results: Vec<WikiResult> = vec![];

    let zims: Vec<&ZimReader> = if let Some(slug) = zim_slug {
        library.zims.get(slug).into_iter().collect()
    } else {
        library.zims.values().collect()
    };

    for reader in zims {
        if results.len() >= limit { break; }

        // Usar sugerencias del índice ZIM (más rápido que iterar)
        // Intentar búsqueda por prefijo en el namespace A/
        let search_paths = [
            format!("A/{}", query_lower),
            format!("A/{}", capitalize_first(&query_lower)),
        ];

        for search_path in &search_paths {
            if let Ok(entry) = reader.archive.get_entry_bypath_str(search_path) {
                let title = entry.get_title();
                let path = entry.get_path();
                if !title.is_empty() && title.to_lowercase().contains(&query_lower) {
                    results.push(WikiResult {
                        title,
                        path,
                        snippet: String::new(),
                        zim_slug: reader.slug.clone(),
                        zim_name: reader.nombre.clone(),
                    });
                }
            }
        }

        // Búsqueda por prefijo: intentar paths comunes
        // Wikipedia ZIM usa namespace A/ con título capitalizado
        let mut prefixes = vec![format!("A/{}", capitalize_first(&query_lower))];
        // También probar con el título exacto lowercase
        if query_lower != capitalize_first(&query_lower) {
            prefixes.push(format!("A/{}", query_lower));
        }

        for prefix in &prefixes {
            if results.len() >= limit { break; }
            if let Ok(entry) = reader.archive.get_entry_bypath_str(prefix) {
                let title = entry.get_title();
                let path = entry.get_path();
                if !title.is_empty() && title.to_lowercase().contains(&query_lower) {
                    if !results.iter().any(|r| r.path == path) {
                        results.push(WikiResult {
                            title,
                            path,
                            snippet: String::new(),
                            zim_slug: reader.slug.clone(),
                            zim_name: reader.nombre.clone(),
                        });
                    }
                }
            }
        }
    }

    results.truncate(limit);
    results
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

/// Resultado de un artículo completo
#[derive(serde::Serialize)]
pub struct WikiArticle {
    pub title: String,
    pub path: String,
    pub html: String,
    pub mime: String,
    pub zim_slug: String,
    pub zim_name: String,
}

/// Obtiene un artículo completo desde un ZIM por su path
pub fn obtener_articulo(
    library: &ZimLibrary,
    path: &str,
    zim_slug: Option<&str>,
) -> Option<WikiArticle> {
    // Determinar qué ZIM usar
    let reader = if let Some(slug) = zim_slug {
        library.zims.get(slug)?
    } else {
        // Intentar en cada ZIM
        library.zims.values().find(|r| {
            r.archive.get_entry_bypath_str(path).is_ok()
        })?
    };

    let entry = reader.archive.get_entry_bypath_str(path).ok()?;
    let item = entry.get_item(true).ok()?;
    let mime = item.get_mimetype().unwrap_or_else(|_| "text/html; charset=utf-8".into());
    let blob = item.get_data().ok()?;
    let data = blob.data().to_vec();

    let html = if mime.starts_with("text/html") {
        let raw = String::from_utf8_lossy(&data).to_string();
        zim_inyectar_estilos_api(&raw)
    } else {
        String::from_utf8_lossy(&data).to_string()
    };

    Some(WikiArticle {
        title: entry.get_title(),
        path: entry.get_path(),
        html,
        mime,
        zim_slug: reader.slug.clone(),
        zim_name: reader.nombre.clone(),
    })
}

/// Lista de ZIMs disponibles
pub fn listar_zims(library: &ZimLibrary) -> Vec<serde_json::Value> {
    library.zims.values().map(|r| {
        serde_json::json!({
            "slug": r.slug,
            "nombre": r.nombre,
            "icon": r.icon,
            "articles": r.article_count,
        })
    }).collect()
}

/// Inyecta estilos oscuros en HTML de ZIM — para visualización standalone (/zim/)
pub fn zim_inyectar_estilos(html: &str) -> String {
    let css = r#"<style>
body{background:#1a1a2e!important;color:#e0e0e0!important;font-family:sans-serif;line-height:1.6;padding:1rem;}
a{color:#00b4d8!important;}a:visited{color:#7b2d8e!important;}
h1,h2,h3,h4{color:#e94560!important;}
table{background:#16213e!important;border-collapse:collapse;width:100%;}
td,th{border:1px solid #333;padding:8px;}
code,pre{background:#0f3460!important;color:#00ff88;padding:2px 4px;border-radius:4px;}
img{max-width:100%;height:auto;}
.mw-parser-output{background:#1a1a2e!important;color:#e0e0e0!important;}
.thumbinner{background:#16213e!important;border-color:#333!important;}
.thumbcaption{color:#aaa!important;}
.toc{background:#16213e!important;border-color:#333!important;}
.mw-editsection{display:none!important;}
#mw-head,#mw-panel,#footer,.noprint,ul#filetoc{display:none!important;}
#content,#bodyContent{margin:0!important;}
.mw-body{background:#1a1a2e!important;color:#e0e0e0!important;border:none!important;padding:0!important;}
.infobox{background:#16213e!important;border-color:#333!important;}
.navbox{background:#16213e!important;border-color:#333!important;}
.catlinks{background:#16213e!important;border-color:#333!important;}
</style>"#;
    if let Some(pos) = html.find("</head>") {
        let mut result = String::with_capacity(html.len() + css.len() + 50);
        result.push_str(&html[..pos]);
        if !html.contains("viewport") {
            result.push_str(r#"<meta name="viewport" content="width=device-width, initial-scale=1">"#);
        }
        result.push_str(css);
        result.push_str(&html[pos..]);
        result
    } else {
        format!("{css}\n{html}")
    }
}

/// Inyecta estilos SCOPED para embeber en el dashboard (API).
/// No usa `body` ni selectores globales — todo va prefijado con `.wiki-article-content`.
pub fn zim_inyectar_estilos_api(html: &str) -> String {
    let css = r##"<style>
.wiki-article-content{background:#1a1a2e!important;color:#e0e0e0!important;font-family:sans-serif;line-height:1.7;padding:1.5rem;border-radius:0 0 8px 8px;font-size:0.95rem;overflow-x:auto;}
.wiki-article-content a{color:#00b4d8!important;}
.wiki-article-content a:visited{color:#7b2d8e!important;}
.wiki-article-content h1,.wiki-article-content h2,.wiki-article-content h3,.wiki-article-content h4{color:#e94560!important;}
.wiki-article-content table{background:#16213e!important;border-collapse:collapse;width:100%;}
.wiki-article-content td,.wiki-article-content th{border:1px solid #333;padding:8px;}
.wiki-article-content code,.wiki-article-content pre{background:#0f3460!important;color:#00ff88;padding:2px 4px;border-radius:4px;}
.wiki-article-content img{max-width:100%;height:auto;}
.wiki-article-content .mw-parser-output{background:#1a1a2e!important;color:#e0e0e0!important;}
.wiki-article-content .thumbinner{background:#16213e!important;border-color:#333!important;}
.wiki-article-content .thumbcaption{color:#aaa!important;}
.wiki-article-content .toc{background:#16213e!important;border-color:#333!important;}
.wiki-article-content .mw-editsection{display:none!important;}
.wiki-article-content #mw-head,.wiki-article-content #mw-panel,.wiki-article-content #footer,.wiki-article-content .noprint,.wiki-article-content ul#filetoc{display:none!important;}
.wiki-article-content #content,.wiki-article-content #bodyContent{margin:0!important;}
.wiki-article-content .mw-body{background:#1a1a2e!important;color:#e0e0e0!important;border:none!important;padding:0!important;}
.wiki-article-content .infobox{background:#16213e!important;border-color:#333!important;}
.wiki-article-content .navbox{background:#16213e!important;border-color:#333!important;}
.wiki-article-content .catlinks{background:#16213e!important;border-color:#333!important;}
</style>"##;
    if let Some(pos) = html.find("</head>") {
        let mut result = String::with_capacity(html.len() + css.len() + 50);
        result.push_str(&html[..pos]);
        result.push_str(css);
        result.push_str(&html[pos..]);
        result
    } else {
        format!("{css}\n{html}")
    }
}
