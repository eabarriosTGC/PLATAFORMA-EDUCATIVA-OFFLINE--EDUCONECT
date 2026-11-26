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

/// Contraseñas iniciales conocidas: jamás deben aceptarse para el administrador.
const PASSWORDS_INICIALES_CONOCIDAS: &[&str] = &["admin123"];

/// Longitud mínima para la contraseña inicial del administrador.
const LONGITUD_MINIMA_PASSWORD: usize = 12;

/// Política de `ADMIN_INITIAL_PASSWORD`. Sin estado, sin E/S.
///
/// Es la **única** fuente de verdad de esta regla: la usan tanto el arranque
/// (`Database::open`) como el modo `--check`. Si divergieran, `--check` diría
/// que todo está bien y el arranque fallaría igual.
///
/// Devuelve el mensaje de rechazo, que siempre nombra la variable para que el
/// operador sepa qué corregir.
pub fn validar_politica_password(candidata: &str) -> Result<(), String> {
    let pwd = candidata.trim();
    if pwd.is_empty() {
        return Err("ADMIN_INITIAL_PASSWORD no está definida o está vacía. \
                    Se necesita para crear o migrar el administrador inicial \
                    (mínimo 12 caracteres)."
            .into());
    }
    if PASSWORDS_INICIALES_CONOCIDAS.contains(&pwd) {
        return Err(
            "ADMIN_INITIAL_PASSWORD coincide con una contraseña conocida (admin123). \
                    Genera una nueva con: openssl rand -base64 24"
                .into(),
        );
    }
    if pwd.len() < LONGITUD_MINIMA_PASSWORD {
        return Err(format!(
            "ADMIN_INITIAL_PASSWORD demasiado corta ({} chars, mínimo {}). \
             Genera una con: openssl rand -base64 24",
            pwd.len(),
            LONGITUD_MINIMA_PASSWORD
        ));
    }
    Ok(())
}

/// Valida `JWT_SECRET`. Sin estado, sin E/S, sin `panic!`.
///
/// Es la única fuente de la regla: la usa `cargar()`, y las pruebas la
/// ejercitan sin tocar el entorno.
pub fn validar_jwt_secret(candidata: &str) -> Result<(), String> {
    let secret = candidata.trim();
    if secret.is_empty() {
        return Err("variable ausente o vacía. Genera una con: openssl rand -base64 48".into());
    }
    if SECRETOS_CONOCIDOS.contains(&secret) {
        return Err(
            "coincide con un valor por defecto conocido. Genera una nueva con: openssl rand -base64 48"
                .into(),
        );
    }
    if secret.len() < LONGITUD_MINIMA {
        return Err(format!(
            "demasiado corta ({} chars, mínimo {}). Genera una con: openssl rand -base64 48",
            secret.len(),
            LONGITUD_MINIMA
        ));
    }
    Ok(())
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

/// Núcleo puro (testeable sin tocar el entorno): vacío/espacios → default.
#[cfg(feature = "zim")]
fn default_zim_dir_desde(raw: &str) -> String {
    let dir = raw.trim();
    if dir.is_empty() {
        "default-content/zim".to_string()
    } else {
        dir.to_string()
    }
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
}

#[cfg(all(test, feature = "zim"))]
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

// ══════════════════════════════════════════════
//  Configuración centralizada (D-02)
// ══════════════════════════════════════════════

use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Gravedad {
    Error,
    Aviso,
}

/// Un problema o confirmación sobre una variable concreta.
/// **Nunca contiene el valor de un secreto.**
#[derive(Debug, Clone)]
pub struct Hallazgo {
    pub variable: &'static str,
    pub gravedad: Gravedad,
    pub motivo: String,
}

impl Hallazgo {
    fn error(variable: &'static str, motivo: impl Into<String>) -> Self {
        Self {
            variable,
            gravedad: Gravedad::Error,
            motivo: motivo.into(),
        }
    }
    fn aviso(variable: &'static str, motivo: impl Into<String>) -> Self {
        Self {
            variable,
            gravedad: Gravedad::Aviso,
            motivo: motivo.into(),
        }
    }
}

impl std::fmt::Display for Hallazgo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let etiqueta = match self.gravedad {
            Gravedad::Error => "ERROR",
            Gravedad::Aviso => "AVISO",
        };
        write!(f, "[{etiqueta}] {}: {}", self.variable, self.motivo)
    }
}

/// Configuración ya validada: todos sus campos son usables sin más comprobaciones.
///
/// No deriva `Debug` a propósito: contiene el secreto JWT y la contraseña
/// inicial del administrador, y un `{:?}` accidental los filtraría.
#[derive(Clone)]
pub struct Configuracion {
    pub jwt_secret: String,
    /// Raíz de aplicación: directorio que contiene el ejecutable (D-03.A).
    /// Solo lectura; de aquí salen `modulos/`, `static/` y `frontend/`.
    pub app_root: PathBuf,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub frontend_path: PathBuf,
    pub listen_addr: SocketAddr,
    pub public_base_url: Option<String>,
    pub default_biblioteca_dir: PathBuf,
    #[cfg(feature = "zim")]
    pub default_zim_dir: PathBuf,
    pub admin_initial_password: Option<String>,
    /// Avisos no bloqueantes detectados al cargar. Los errores abortan en `cargar`.
    pub avisos: Vec<Hallazgo>,
}

fn leer(var: &str) -> Option<String> {
    std::env::var(var)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Absolutiza contra una base **inyectada**. Puro: quien llama decide la base,
/// y por eso la resolución se puede probar sin tocar el entorno.
fn absolutizar(ruta: &std::path::Path, base: &std::path::Path) -> PathBuf {
    if ruta.is_absolute() {
        ruta.to_path_buf()
    } else {
        base.join(ruta)
    }
}

// ══════════════════════════════════════════════
//  D-03 — raíz de aplicación y raíz de datos
// ══════════════════════════════════════════════

/// Sistema operativo relevante para la tabla de `DATA_DIR` de §D-03.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum So {
    Linux,
    Windows,
    #[default]
    Otro,
}

/// Entorno del sistema que decide la raíz de datos **por defecto**.
///
/// Se construye una sola vez en `cargar()`. El resto de la resolución es puro y
/// testeable: la tabla por plataforma se verifica en Linux para las ramas de
/// Windows sin necesitar una máquina Windows.
#[derive(Debug, Clone, Default)]
pub struct EntornoPlataforma {
    pub so: So,
    /// `true` si el proceso corre como servicio (systemd en Linux, SYSTEM en Windows).
    pub es_servicio: bool,
    pub home: Option<String>,
    pub xdg_data_home: Option<String>,
    pub program_data: Option<String>,
    pub local_app_data: Option<String>,
}

impl EntornoPlataforma {
    /// Única lectura del entorno de plataforma del crate.
    fn leer() -> Self {
        let so = if cfg!(target_os = "linux") {
            So::Linux
        } else if cfg!(target_os = "windows") {
            So::Windows
        } else {
            So::Otro
        };
        let es_servicio = match so {
            // systemd define INVOCATION_ID en cualquier unidad que ejecute el
            // proceso; un arranque interactivo no la tiene.
            So::Linux => std::env::var_os("INVOCATION_ID").is_some(),
            // Un servicio de Windows corre como SYSTEM; una sesión de usuario no.
            So::Windows => leer("USERNAME")
                .map(|u| u.eq_ignore_ascii_case("system"))
                .unwrap_or(false),
            So::Otro => false,
        };
        Self {
            so,
            es_servicio,
            home: leer("HOME"),
            xdg_data_home: leer("XDG_DATA_HOME"),
            program_data: leer("ProgramData"),
            local_app_data: leer("LOCALAPPDATA"),
        }
    }
}

/// Raíz de aplicación: el directorio que **contiene el ejecutable**.
///
/// Estructura plana de §D-03.A: sin búsquedas hacia arriba ni listas de
/// candidatos. `APP_ROOT` declarada gana, pero debe ser absoluta y existir: el
/// CWD no participa en la resolución, ni siquiera como respaldo.
pub fn resolver_app_root(
    declarada: Option<&str>,
    ejecutable: Option<&std::path::Path>,
) -> Result<PathBuf, String> {
    if let Some(raw) = declarada.map(str::trim).filter(|v| !v.is_empty()) {
        let ruta = PathBuf::from(raw);
        if !ruta.is_absolute() {
            return Err(format!(
                "\"{raw}\" debe ser una ruta absoluta: una raíz relativa volvería a depender \
                 del directorio de trabajo, que es lo que D-03 elimina"
            ));
        }
        if !ruta.is_dir() {
            return Err(format!(
                "{} no existe o no es un directorio. La raíz de aplicación debe existir: \
                 contiene modulos/, static/ y frontend/",
                ruta.display()
            ));
        }
        return Ok(ruta);
    }

    let exe = ejecutable.ok_or_else(|| {
        "no se pudo determinar la ruta del ejecutable (current_exe falló). \
         Definí APP_ROOT con la raíz de la aplicación"
            .to_string()
    })?;
    // Resolver symlinks: un lanzador que apunte al binario desde otro sitio debe
    // seguir encontrando los recursos que están junto al ejecutable real.
    let exe = exe.canonicalize().unwrap_or_else(|_| exe.to_path_buf());
    exe.parent().map(std::path::Path::to_path_buf).ok_or_else(|| {
        format!(
            "el ejecutable {} no tiene directorio padre: no hay raíz de aplicación",
            exe.display()
        )
    })
}

fn directorio_de_entorno(
    valor: Option<&str>,
    variable: &str,
    cwd: &std::path::Path,
) -> Result<PathBuf, String> {
    match valor.map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) => Ok(absolutizar(std::path::Path::new(v), cwd)),
        None => Err(format!(
            "DATA_DIR no está definida y {variable} no está disponible: no se puede resolver \
             la raíz de datos por defecto. Definí DATA_DIR con el directorio escribible de \
             esta instalación"
        )),
    }
}

/// Tabla de `DATA_DIR` de §D-03, como función pura.
///
/// `DATA_DIR` declarada gana siempre. Sin declarar, la raíz depende de la
/// plataforma **y** del contexto (servicio o usuario), nunca del CWD.
pub fn resolver_data_dir(
    declarada: Option<&str>,
    entorno: &EntornoPlataforma,
    cwd: &std::path::Path,
) -> Result<PathBuf, String> {
    if let Some(raw) = declarada.map(str::trim).filter(|v| !v.is_empty()) {
        return Ok(absolutizar(std::path::Path::new(raw), cwd));
    }

    match (entorno.so, entorno.es_servicio) {
        // Linux como servicio: la raíz de datos vive fuera del paquete, de modo
        // que reemplazar la aplicación no la toca (R-01).
        (So::Linux, true) => Ok(PathBuf::from("/var/lib/educonect")),
        // Windows como servicio: perfil de máquina, escribible por SYSTEM y no
        // por un usuario sin privilegios.
        (So::Windows, true) => Ok(directorio_de_entorno(
            entorno.program_data.as_deref(),
            "ProgramData",
            cwd,
        )?
        .join("EduConect")),
        // Windows como usuario: perfil del usuario, sin pedir administrador.
        (So::Windows, false) => Ok(directorio_de_entorno(
            entorno.local_app_data.as_deref(),
            "LOCALAPPDATA",
            cwd,
        )?
        .join("EduConect")),
        // Linux como usuario, cualquier otro Unix, y cualquier plataforma sin
        // noción de servicio: XDG, con respaldo en el perfil.
        (_, _) => {
            if entorno
                .xdg_data_home
                .as_deref()
                .map(str::trim)
                .is_some_and(|v| !v.is_empty())
            {
                return Ok(directorio_de_entorno(
                    entorno.xdg_data_home.as_deref(),
                    "XDG_DATA_HOME",
                    cwd,
                )?
                .join("educonect"));
            }
            Ok(
                directorio_de_entorno(entorno.home.as_deref(), "HOME", cwd)?
                    .join(".local")
                    .join("share")
                    .join("educonect"),
            )
        }
    }
}

fn misma_ruta(a: &std::path::Path, b: &std::path::Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => a == b,
    }
}

/// Base de datos de una instalación anterior que quedó **huérfana**.
///
/// La versión previa resolvía `DATA_DIR` como `./data` relativo al CWD. Si ese
/// archivo existe y la resolución actual apunta a otro lugar, arrancar crearía
/// una base nueva y vacía en silencio: pérdida de datos. Devuelve la ruta
/// heredada para que el arranque falle nombrándola, en lugar de migrar sola o
/// de ignorarla.
pub fn base_de_instalacion_anterior(
    cwd: &std::path::Path,
    data_dir_resuelta: &std::path::Path,
) -> Option<PathBuf> {
    let heredada = cwd.join("data").join("educonect.db");
    if !heredada.is_file() {
        return None;
    }
    if misma_ruta(&heredada, &data_dir_resuelta.join("educonect.db")) {
        return None;
    }
    Some(heredada)
}

/// Lee y valida las ocho variables de entorno. **Sin efectos secundarios**: no
/// crea directorios, no abre la base de datos, no lanza procesos.
///
/// Devuelve **todos** los errores juntos. Si hay al menos un `Gravedad::Error`,
/// devuelve `Err` con la lista completa; si no, `Ok`.
pub fn cargar() -> Result<Configuracion, Vec<Hallazgo>> {
    let mut hallazgos: Vec<Hallazgo> = Vec::new();

    // Base para absolutizar rutas declaradas y para detectar la base heredada.
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let entorno = EntornoPlataforma::leer();

    // 0. APP_ROOT — raíz de aplicación, derivada del ejecutable (D-03).
    //    Si falla, el placeholder solo se usa para calcular rutas que ya no
    //    importan: la lista de hallazgos contiene un ERROR y el arranque aborta.
    let app_root = match resolver_app_root(
        leer("APP_ROOT").as_deref(),
        std::env::current_exe().ok().as_deref(),
    ) {
        Ok(p) => p,
        Err(motivo) => {
            hallazgos.push(Hallazgo::error("APP_ROOT", motivo));
            cwd.clone()
        }
    };

    // 1. JWT_SECRET
    let jwt_secret = match leer("JWT_SECRET") {
        None => {
            hallazgos.push(Hallazgo::error(
                "JWT_SECRET",
                "variable ausente. Genera una con: openssl rand -base64 48",
            ));
            String::new()
        }
        Some(v) => match validar_jwt_secret(&v) {
            Ok(()) => v,
            Err(motivo) => {
                hallazgos.push(Hallazgo::error("JWT_SECRET", motivo));
                String::new()
            }
        },
    };

    // 2. PUBLIC_BASE_URL — ausente es válido; presente e inválida es error.
    let public_base_url = match leer("PUBLIC_BASE_URL") {
        None => None,
        Some(v) => match normalizar_public_base_url(&v) {
            Ok(u) => Some(u),
            Err(e) => {
                hallazgos.push(Hallazgo::error(
                    "PUBLIC_BASE_URL",
                    format!("inválida (\"{v}\"): {e}"),
                ));
                None
            }
        },
    };

    // 3-4. Directorios incluidos en el paquete. Ausentes → default **bajo
    //      `APP_ROOT`**, nunca relativo al CWD (D-03).
    let default_biblioteca_dir = absolutizar(
        &PathBuf::from(default_biblioteca_dir_desde(
            &leer("DEFAULT_BIBLIOTECA_DIR").unwrap_or_default(),
        )),
        &app_root,
    );
    #[cfg(feature = "zim")]
    let default_zim_dir = absolutizar(
        &PathBuf::from(default_zim_dir_desde(
            &leer("DEFAULT_ZIM_DIR").unwrap_or_default(),
        )),
        &app_root,
    );

    // 5. DATA_DIR — tabla de D-03 por plataforma y contexto. La escritura la
    //    comprueba `verificar`: aquí no se crea nada.
    let data_dir_declarada = leer("DATA_DIR");
    let data_dir = match resolver_data_dir(data_dir_declarada.as_deref(), &entorno, &cwd) {
        Ok(p) => p,
        Err(motivo) => {
            hallazgos.push(Hallazgo::error("DATA_DIR", motivo));
            cwd.join("data")
        }
    };
    let db_path = data_dir.join("educonect.db");

    // Una instalación anterior guardaba la base en `./data` relativo al CWD y la
    // resolución por defecto ya no depende del CWD. Con `DATA_DIR` sin declarar,
    // arrancar sobre una base nueva y vacía sería pérdida de datos silenciosa:
    // se falla y se nombra la base heredada. Con `DATA_DIR` declarada la
    // elección es explícita y no se opina.
    if data_dir_declarada.is_none() {
        if let Some(heredada) = base_de_instalacion_anterior(&cwd, &data_dir) {
            let sugerida = heredada
                .parent()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| heredada.display().to_string());
            hallazgos.push(Hallazgo::error(
                "DATA_DIR",
                format!(
                    "hay una base de datos de una instalación anterior en {} y la raíz de datos \
                     resuelta ahora es {}. No se arranca con una base nueva y vacía en silencio: \
                     definí DATA_DIR={sugerida} para reutilizar la instalación existente, o mové o \
                     renombrá ese archivo si querés empezar de cero",
                    heredada.display(),
                    data_dir.display()
                ),
            ));
        }
    }

    // 6. FRONTEND_PATH — por defecto `<APP_ROOT>/frontend`. El antiguo
    //    `../edu-conect-rural-dashboard/out/` dependía del CWD y desaparece.
    let frontend_path = match leer("FRONTEND_PATH") {
        Some(raw) => absolutizar(std::path::Path::new(&raw), &cwd),
        None => app_root.join("frontend"),
    };

    // 7. LISTEN_ADDR
    let listen_addr_raw = leer("LISTEN_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into());
    let listen_addr = match listen_addr_raw.parse::<SocketAddr>() {
        Ok(a) => a,
        Err(e) => {
            hallazgos.push(Hallazgo::error(
                "LISTEN_ADDR",
                format!("inválida (\"{listen_addr_raw}\"): {e}"),
            ));
            "0.0.0.0:8080".parse().expect("literal válido")
        }
    };

    // 8. ADMIN_INITIAL_PASSWORD — ausente es AVISO, no error: solo se exige
    //    cuando la base necesita crear o rotar el administrador, y eso no se
    //    puede saber sin abrirla.
    let admin_initial_password = match leer("ADMIN_INITIAL_PASSWORD") {
        None => {
            hallazgos.push(Hallazgo::aviso(
                "ADMIN_INITIAL_PASSWORD",
                "variable ausente. No se podrá crear ni rotar el administrador inicial si hiciera falta",
            ));
            None
        }
        Some(v) => match validar_politica_password(&v) {
            Ok(()) => Some(v),
            Err(motivo) => {
                hallazgos.push(Hallazgo::error("ADMIN_INITIAL_PASSWORD", motivo));
                None
            }
        },
    };

    if hallazgos.iter().any(|h| h.gravedad == Gravedad::Error) {
        return Err(hallazgos);
    }

    Ok(Configuracion {
        jwt_secret,
        app_root,
        data_dir,
        db_path,
        frontend_path,
        listen_addr,
        public_base_url,
        default_biblioteca_dir,
        #[cfg(feature = "zim")]
        default_zim_dir,
        admin_initial_password,
        avisos: hallazgos,
    })
}

/// Imprime los hallazgos en stdout, uno por línea.
///
/// Nunca imprime el valor de un secreto: `Hallazgo.motivo` no los contiene.
pub fn informar(hallazgos: &[Hallazgo]) {
    for h in hallazgos {
        println!("{h}");
    }
}

/// `true` si la lista contiene al menos un `Gravedad::Error`.
pub fn hay_error(hallazgos: &[Hallazgo]) -> bool {
    hallazgos.iter().any(|h| h.gravedad == Gravedad::Error)
}

fn es_directorio_escribible(p: &std::path::Path) -> bool {
    p.is_dir()
        && !p
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(true)
}

/// Primer ancestro que existe, empezando por `p` y subiendo.
fn ancestro_existente(p: &std::path::Path) -> Option<std::path::PathBuf> {
    let mut actual = Some(p);
    while let Some(a) = actual {
        if a.exists() {
            return Some(a.to_path_buf());
        }
        actual = a.parent();
    }
    None
}

/// Comprueba el entorno contra una configuración ya validada.
///
/// **Solo lectura**: `exists`, `is_dir` y `permissions`. No crea directorios, no
/// abre la base de datos, no lanza procesos y no abre sockets. La creación de
/// directorios sigue siendo responsabilidad del arranque.
pub(crate) fn verificar(conf: &Configuracion) -> Vec<Hallazgo> {
    let mut hallazgos = Vec::new();

    // APP_ROOT: debe existir. Es de solo lectura por diseño (R-01): no se exige
    // permiso de escritura, y exigirlo sería el error que D-03 corrige.
    if !conf.app_root.is_dir() {
        hallazgos.push(Hallazgo::error(
            "APP_ROOT",
            format!(
                "{} no existe o no es un directorio. El ejecutable debe vivir en la raíz de la \
                 aplicación, junto a modulos/, static/ y frontend/",
                conf.app_root.display()
            ),
        ));
    } else if !conf.app_root.join("modulos").is_dir() {
        hallazgos.push(Hallazgo::aviso(
            "APP_ROOT",
            format!(
                "{} no tiene modulos/; /modulos/* responderá 404 y /api/modulos devolverá una \
                 lista vacía",
                conf.app_root.display()
            ),
        ));
    }

    // DATA_DIR: se valida la ruta declarada, nunca se crea.
    if conf.data_dir.exists() {
        if !es_directorio_escribible(&conf.data_dir) {
            hallazgos.push(Hallazgo::error(
                "DATA_DIR",
                format!(
                    "{} no es un directorio escribible. Revisá permisos o cambiá DATA_DIR",
                    conf.data_dir.display()
                ),
            ));
        }
    } else {
        match ancestro_existente(&conf.data_dir) {
            Some(a) if es_directorio_escribible(&a) => hallazgos.push(Hallazgo::aviso(
                "DATA_DIR",
                format!(
                    "{} no existe todavía; se creará al arrancar (su ancestro existente más cercano, {}, es escribible)",
                    conf.data_dir.display(),
                    a.display()
                ),
            )),
            Some(a) => hallazgos.push(Hallazgo::error(
                "DATA_DIR",
                format!(
                    "{} no existe y su ancestro existente más cercano ({}) no es escribible",
                    conf.data_dir.display(),
                    a.display()
                ),
            )),
            None => hallazgos.push(Hallazgo::error(
                "DATA_DIR",
                format!("{} no existe y no tiene ningún ancestro válido", conf.data_dir.display()),
            )),
        }
    }

    // DB_PATH: si ya existe, no debe ser de solo lectura.
    if conf.db_path.exists() {
        let solo_lectura = conf
            .db_path
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(true);
        if !conf.db_path.is_file() || solo_lectura {
            hallazgos.push(Hallazgo::error(
                "DATA_DIR",
                format!(
                    "{} existe pero no es una base de datos escribible",
                    conf.db_path.display()
                ),
            ));
        }
    }

    // FRONTEND_PATH: ausente es aviso, no error — el default apunta a `out/`,
    // que no está generado en desarrollo y bloquearía todo arranque.
    if !conf.frontend_path.is_dir() {
        hallazgos.push(Hallazgo::aviso(
            "FRONTEND_PATH",
            format!(
                "{} no existe o no es un directorio; el dashboard no se servirá",
                conf.frontend_path.display()
            ),
        ));
    }

    hallazgos
}

/// Modo `--check`: valida configuración y entorno **sin mutar nada**.
///
/// Devuelve el código de salida: `0` si no hay errores (los avisos no fallan),
/// `1` si hay al menos uno. Escribe a stdout, no al log de `tracing`.
pub fn check(verbose: bool) -> i32 {
    let (mut hallazgos, errores_de_carga) = match cargar() {
        Ok(conf) => {
            let mut hs = conf.avisos.clone();
            hs.extend(verificar(&conf));
            (hs, false)
        }
        Err(hs) => (hs, true),
    };

    // Orden fijo: errores primero, después avisos.
    hallazgos.sort_by_key(|h| match h.gravedad {
        Gravedad::Error => 0,
        Gravedad::Aviso => 1,
    });

    for h in &hallazgos {
        println!("{h}");
    }

    let falla = errores_de_carga || hay_error(&hallazgos);
    if falla {
        println!("\nResultado: configuración no válida.");
    } else if verbose {
        println!("Resultado: configuración válida.");
    }
    println!("No se realizaron modificaciones.");

    if falla {
        1
    } else {
        0
    }
}

#[cfg(test)]
mod tests_verificar {
    use super::*;

    fn conf_con(data_dir: PathBuf, frontend_path: PathBuf) -> Configuracion {
        Configuracion {
            jwt_secret: "x".repeat(48),
            // Raíz de aplicación de las pruebas: el directorio temporal del
            // sistema existe siempre y no se toca. No tiene `modulos/`, lo que
            // produce un aviso (nunca un error) por diseño.
            app_root: std::env::temp_dir(),
            db_path: data_dir.join("educonect.db"),
            data_dir,
            frontend_path,
            listen_addr: "127.0.0.1:8080".parse().expect("addr"),
            public_base_url: None,
            default_biblioteca_dir: PathBuf::from("default-content/biblioteca"),
            #[cfg(feature = "zim")]
            default_zim_dir: PathBuf::from("default-content/zim"),
            admin_initial_password: None,
            avisos: Vec::new(),
        }
    }

    fn temp(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("educonect-verif-{}-{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn data_dir_inexistente_es_aviso_y_no_lo_crea() {
        let dir = temp("noexiste");
        let hallazgos = verificar(&conf_con(dir.clone(), PathBuf::from("/no/existe")));
        assert!(
            hallazgos
                .iter()
                .any(|h| h.variable == "DATA_DIR" && h.gravedad == Gravedad::Aviso),
            "DATA_DIR inexistente con ancestro escribible debe ser aviso"
        );
        assert!(
            !dir.exists(),
            "verificar no debe crear DATA_DIR: {} existe",
            dir.display()
        );
    }

    #[test]
    fn frontend_inexistente_es_aviso_y_no_hay_error() {
        let dir = temp("fe");
        std::fs::create_dir_all(&dir).expect("dir");
        let hallazgos = verificar(&conf_con(dir.clone(), PathBuf::from("/no/existe/frontend")));
        assert!(hallazgos
            .iter()
            .any(|h| h.variable == "FRONTEND_PATH" && h.gravedad == Gravedad::Aviso));
        assert!(
            !hay_error(&hallazgos),
            "un frontend ausente no debe bloquear el arranque"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn verificar_no_modifica_el_contenido_de_data_dir() {
        let dir = temp("hash");
        std::fs::create_dir_all(&dir).expect("dir");
        std::fs::write(dir.join("existente.txt"), b"contenido intacto").expect("write");

        let antes: Vec<_> = std::fs::read_dir(&dir)
            .expect("read_dir")
            .map(|e| e.expect("entry").file_name())
            .collect();
        let contenido_antes = std::fs::read(dir.join("existente.txt")).expect("read");

        let _ = verificar(&conf_con(dir.clone(), PathBuf::from("/no/existe")));

        let despues: Vec<_> = std::fs::read_dir(&dir)
            .expect("read_dir")
            .map(|e| e.expect("entry").file_name())
            .collect();
        let contenido_despues = std::fs::read(dir.join("existente.txt")).expect("read");

        assert_eq!(
            antes, despues,
            "verificar creó o borró archivos en DATA_DIR"
        );
        assert_eq!(
            contenido_antes, contenido_despues,
            "verificar modificó el contenido de DATA_DIR"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}

// ══════════════════════════════════════════════
//  D-03 — raíces de aplicación y de datos (núcleo puro)
// ══════════════════════════════════════════════

#[cfg(test)]
mod tests_raices {
    use super::*;

    fn entorno(so: So, es_servicio: bool) -> EntornoPlataforma {
        EntornoPlataforma {
            so,
            es_servicio,
            ..Default::default()
        }
    }

    fn temp(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("educonect-raices-{}-{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).expect("crear directorio del test");
        d
    }

    // ── APP_ROOT ────────────────────────────────────────────────────

    #[test]
    fn app_root_por_defecto_es_el_directorio_del_ejecutable() {
        let base = temp("app-root-exe");
        let app = base.join("educonect");
        std::fs::create_dir_all(&app).expect("crear app");
        let exe = app.join("edu-conect-rural-server");
        std::fs::write(&exe, b"binario").expect("escribir ejecutable de prueba");

        let resuelta = resolver_app_root(None, Some(&exe)).expect("resolver APP_ROOT");
        assert_eq!(
            resuelta,
            app.canonicalize().expect("canonicalizar app"),
            "APP_ROOT debe ser el directorio que contiene el ejecutable"
        );

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn app_root_declarada_debe_ser_absoluta() {
        let error = resolver_app_root(Some("app"), None).expect_err("una raíz relativa se rechaza");
        assert!(
            error.contains("absoluta"),
            "el mensaje debe explicar que se exige una ruta absoluta: {error}"
        );
    }

    #[test]
    fn app_root_declarada_debe_existir_y_nombrar_la_ruta() {
        let base = temp("app-root-ausente");
        let ausente = base.join("no-existe");

        let error = resolver_app_root(Some(&ausente.to_string_lossy()), None)
            .expect_err("un APP_ROOT inexistente se rechaza");
        assert!(
            error.contains(&ausente.to_string_lossy().to_string()),
            "el mensaje debe nombrar la ruta declarada: {error}"
        );

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn app_root_declarada_existente_se_usa_tal_cual() {
        let base = temp("app-root-ok");
        let resuelta = resolver_app_root(Some(&base.to_string_lossy()), None).expect("resolver");
        assert_eq!(resuelta, base);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn app_root_sin_ejecutable_ni_variable_falla() {
        let error = resolver_app_root(None, None).expect_err("sin ejecutable no hay raíz");
        assert!(
            error.contains("APP_ROOT"),
            "el mensaje debe decir cómo resolverlo: {error}"
        );
    }

    // ── DATA_DIR: tabla por plataforma (§D-03) ──────────────────────

    #[test]
    fn data_dir_linux_servicio_es_var_lib() {
        let cwd = temp("data-linux-servicio");
        assert_eq!(
            resolver_data_dir(None, &entorno(So::Linux, true), &cwd).expect("resolver"),
            PathBuf::from("/var/lib/educonect")
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_linux_usuario_usa_xdg_data_home() {
        let cwd = temp("data-linux-xdg");
        let mut e = entorno(So::Linux, false);
        e.xdg_data_home = Some("/perfil/xdg".into());
        e.home = Some("/perfil".into());
        assert_eq!(
            resolver_data_dir(None, &e, &cwd).expect("resolver"),
            PathBuf::from("/perfil/xdg/educonect"),
            "XDG_DATA_HOME gana sobre HOME"
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_linux_usuario_sin_xdg_usa_el_perfil() {
        let cwd = temp("data-linux-home");
        let mut e = entorno(So::Linux, false);
        e.home = Some("/home/alumno".into());
        assert_eq!(
            resolver_data_dir(None, &e, &cwd).expect("resolver"),
            PathBuf::from("/home/alumno/.local/share/educonect")
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_sin_home_es_error_que_nombra_la_variable() {
        let cwd = temp("data-sin-home");
        let error = resolver_data_dir(None, &entorno(So::Linux, false), &cwd)
            .expect_err("sin perfil no hay raíz de datos por defecto");
        assert!(
            error.contains("DATA_DIR"),
            "el mensaje debe nombrar DATA_DIR: {error}"
        );
        assert!(
            error.contains("HOME"),
            "el mensaje debe decir qué variable falta: {error}"
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_windows_usuario_usa_local_app_data() {
        let cwd = temp("data-win-usuario");
        let mut e = entorno(So::Windows, false);
        e.local_app_data = Some("/perfil/AppData/Local".into());
        e.program_data = Some("/ProgramData".into());
        assert_eq!(
            resolver_data_dir(None, &e, &cwd).expect("resolver"),
            PathBuf::from("/perfil/AppData/Local/EduConect")
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_windows_servicio_usa_program_data() {
        let cwd = temp("data-win-servicio");
        let mut e = entorno(So::Windows, true);
        e.local_app_data = Some("/perfil/AppData/Local".into());
        e.program_data = Some("/ProgramData".into());
        assert_eq!(
            resolver_data_dir(None, &e, &cwd).expect("resolver"),
            PathBuf::from("/ProgramData/EduConect")
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_declarada_gana_en_todas_las_plataformas() {
        let cwd = temp("data-declarada");
        for so in [So::Linux, So::Windows, So::Otro] {
            for es_servicio in [true, false] {
                let mut e = entorno(so, es_servicio);
                e.home = Some("/perfil".into());
                e.xdg_data_home = Some("/xdg".into());
                e.program_data = Some("/ProgramData".into());
                e.local_app_data = Some("/Local".into());
                assert_eq!(
                    resolver_data_dir(Some("/datos/educonect"), &e, &cwd).expect("resolver"),
                    PathBuf::from("/datos/educonect"),
                    "{so:?} servicio={es_servicio}: DATA_DIR declarada debe ganar"
                );
            }
        }
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_declarada_relativa_se_absolutiza_contra_el_cwd() {
        let cwd = temp("data-relativa");
        assert_eq!(
            resolver_data_dir(Some("datos"), &entorno(So::Linux, false), &cwd).expect("resolver"),
            cwd.join("datos"),
            "una DATA_DIR relativa declarada se absolutiza contra el CWD declarado"
        );
        let _ = std::fs::remove_dir_all(&cwd);
    }

    #[test]
    fn data_dir_por_defecto_no_depende_del_cwd() {
        let uno = temp("data-cwd-uno");
        let otro = temp("data-cwd-dos");
        let mut e = entorno(So::Linux, false);
        e.home = Some("/home/profe".into());
        assert_eq!(
            resolver_data_dir(None, &e, &uno).expect("resolver"),
            resolver_data_dir(None, &e, &otro).expect("resolver"),
            "la raíz de datos por defecto no puede depender del directorio de trabajo"
        );
        let _ = std::fs::remove_dir_all(&uno);
        let _ = std::fs::remove_dir_all(&otro);
    }

    // ── base de datos de una instalación anterior ───────────────────

    #[test]
    fn sin_base_heredada_no_se_reporta_nada() {
        let cwd = temp("heredada-sin");
        let nueva = temp("heredada-sin-nueva");
        assert_eq!(base_de_instalacion_anterior(&cwd, &nueva), None);
        let _ = std::fs::remove_dir_all(&cwd);
        let _ = std::fs::remove_dir_all(&nueva);
    }

    #[test]
    fn base_heredada_en_otra_raiz_se_reporta() {
        let cwd = temp("heredada-otra");
        let nueva = temp("heredada-otra-nueva");
        let heredada = cwd.join("data").join("educonect.db");
        std::fs::create_dir_all(heredada.parent().expect("padre")).expect("crear data");
        std::fs::write(&heredada, b"sqlite viejo").expect("escribir base heredada");

        assert_eq!(
            base_de_instalacion_anterior(&cwd, &nueva),
            Some(heredada.clone()),
            "una base huérfana debe reportarse"
        );
        assert!(
            heredada.is_file(),
            "reportarla no puede moverla ni borrarla"
        );

        let _ = std::fs::remove_dir_all(&cwd);
        let _ = std::fs::remove_dir_all(&nueva);
    }

    #[test]
    fn base_heredada_en_la_misma_raiz_no_se_reporta() {
        let cwd = temp("heredada-misma");
        let heredada = cwd.join("data").join("educonect.db");
        std::fs::create_dir_all(heredada.parent().expect("padre")).expect("crear data");
        std::fs::write(&heredada, b"sqlite vigente").expect("escribir base");

        assert_eq!(
            base_de_instalacion_anterior(&cwd, &cwd.join("data")),
            None,
            "si la raíz resuelta es la misma, la base no está huérfana"
        );

        let _ = std::fs::remove_dir_all(&cwd);
    }
}
