//! Regresión del arranque: configuración (D-02) y layout portable (D-03).
//!
//! Se ejecuta el binario real, no una función: los defectos originales vivían en
//! el **orden** de las operaciones dentro de `main()` y en la resolución de rutas
//! respecto del directorio de trabajo, y solo el proceso completo los reproduce.
//!
//! Reglas de esta suite — incidente del intento anterior: una prueba quedó 30
//! minutos bloqueada contra un servidor vivo, a 0 % de CPU, y su salida nunca se
//! imprimió:
//!
//! 1. Ningún `wait`/`output` sin límite sobre el servidor. `Servidor` espera con
//!    tope, mata, y solo entonces lee la salida.
//! 2. Toda lectura de socket lleva `connect_timeout` y `set_read_timeout`.
//! 3. `Servidor` mata al hijo al salir de ámbito, incluso si una aserción entra
//!    en pánico: nunca queda un servidor huérfano ni una tubería abierta.

use std::io::Read as _;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

/// Nombre del ejecutable, con el sufijo de la plataforma.
const BINARIO: &str = if cfg!(windows) {
    "edu-conect-rural-server.exe"
} else {
    "edu-conect-rural-server"
};

/// Tope para un proceso que **debe terminar** (arranque inválido). Si no
/// termina, es un fallo: se lo mata y la prueba falla con su salida.
const LIMITE_SALIDA: Duration = Duration::from_secs(30);

/// Tope para un arranque válido: tiempo máximo para que `/health` responda.
const LIMITE_ARRANQUE: Duration = Duration::from_secs(60);

// ── proceso hijo con muerte garantizada ─────────────────────────────

struct Servidor {
    hijo: Child,
}

impl Servidor {
    fn lanzar(cmd: &mut Command) -> Self {
        let hijo = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("lanzar el binario");
        Self { hijo }
    }

    /// Espera **acotada**. `None` si el proceso sigue vivo al cumplirse el tope.
    fn esperar_salida(&mut self, limite: Duration) -> Option<ExitStatus> {
        let tope = Instant::now() + limite;
        loop {
            match self.hijo.try_wait().expect("consultar el estado del hijo") {
                Some(estado) => return Some(estado),
                None if Instant::now() >= tope => return None,
                None => std::thread::sleep(Duration::from_millis(50)),
            }
        }
    }

    /// `true` si el proceso ya terminó (murió o salió por su cuenta).
    fn termino(&mut self) -> bool {
        self.hijo
            .try_wait()
            .expect("consultar el estado del hijo")
            .is_some()
    }

    /// Lee lo que el hijo alcanzó a escribir.
    ///
    /// **Solo se llama con el proceso muerto**: `read_to_end` sobre la tubería de
    /// un servidor vivo bloquea hasta que el proceso escriba y cierre, que es
    /// exactamente el bloqueo de 30 minutos del intento anterior. Por eso es
    /// privada y su único llamador externo es `matar_y_leer`, que mata primero.
    fn leer(&mut self) -> (String, String) {
        let mut out = Vec::new();
        let mut err = Vec::new();
        if let Some(mut o) = self.hijo.stdout.take() {
            let _ = o.read_to_end(&mut out);
        }
        if let Some(mut e) = self.hijo.stderr.take() {
            let _ = e.read_to_end(&mut err);
        }
        (
            String::from_utf8_lossy(&out).into_owned(),
            String::from_utf8_lossy(&err).into_owned(),
        )
    }

    /// Mata y **después** lee: el orden que impide bloquearse contra un servidor
    /// vivo. Es la única vía pública de leer la salida de un proceso que no salió.
    fn matar_y_leer(&mut self) -> (String, String) {
        let _ = self.hijo.kill();
        let _ = self.hijo.wait();
        self.leer()
    }
}

impl Drop for Servidor {
    fn drop(&mut self) {
        // Matar siempre: una aserción que entra en pánico no deja el servidor vivo.
        let _ = self.hijo.kill();
        let _ = self.hijo.wait();
    }
}

/// Ejecuta un proceso que **debe terminar** y devuelve `(estado, stdout+stderr)`.
///
/// Reemplaza a `Command::output()`: sobre un proceso que se queda sirviendo,
/// `output()` bloquea indefinidamente y sin imprimir nada. Aquí el tope es
/// explícito, el hijo se mata y la salida ya emitida se conserva como evidencia.
fn ejecutar_y_terminar(cmd: &mut Command, limite: Duration) -> (ExitStatus, String) {
    let mut servidor = Servidor::lanzar(cmd);
    let estado = servidor.esperar_salida(limite);
    // Con `Some` el proceso ya terminó y sus tuberías están en EOF; con `None`
    // hay que matarlo antes de leer, nunca leer de un servidor vivo.
    let (out, err) = match estado {
        Some(_) => servidor.leer(),
        None => {
            let salida = servidor.matar_y_leer();
            panic!(
                "el proceso no terminó en {limite:?}: se lo mató. \
                 Un arranque inválido debe salir, no quedarse sirviendo. salida:\n{}{}",
                salida.0, salida.1
            );
        }
    };
    (
        estado.expect("estado confirmado arriba"),
        format!("{out}{err}"),
    )
}

fn dir_unico(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("educonect-arranque-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("crear directorio del test");
    dir
}

/// `GET` HTTP/1.1 mínimo, sin dependencias: (código, cuerpo en minúsculas).
/// Toda operación de red tiene tope: conectar y leer.
fn http_get(addr: SocketAddr, ruta: &str) -> Option<(u16, String)> {
    use std::io::Write as _;

    let mut flujo = std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2)).ok()?;
    flujo.set_read_timeout(Some(Duration::from_secs(10))).ok()?;
    write!(
        flujo,
        "GET {ruta} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n"
    )
    .ok()?;
    let mut crudo = Vec::new();
    flujo.read_to_end(&mut crudo).ok()?;
    let texto = String::from_utf8_lossy(&crudo).into_owned();
    let codigo = texto.split_whitespace().nth(1)?.parse().ok()?;
    let cuerpo = texto
        .split_once("\r\n\r\n")
        .map(|(_, c)| c.to_string())
        .unwrap_or_default();
    Some((codigo, cuerpo.to_lowercase()))
}

/// Solicitud HTTP/1.1 mínima con método y cuerpo JSON opcional: (código, cuerpo
/// tal cual, sin normalizar). Mismos topes que `http_get`.
fn http_solicitud(
    addr: SocketAddr,
    metodo: &str,
    ruta: &str,
    json: Option<&str>,
) -> Option<(u16, String)> {
    use std::io::Write as _;

    let mut flujo = std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2)).ok()?;
    flujo.set_read_timeout(Some(Duration::from_secs(10))).ok()?;
    let cuerpo = json.unwrap_or_default();
    let mut peticion = format!("{metodo} {ruta} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n");
    if json.is_some() {
        peticion.push_str(&format!(
            "Content-Type: application/json\r\nContent-Length: {}\r\n",
            cuerpo.len()
        ));
    }
    peticion.push_str("\r\n");
    peticion.push_str(cuerpo);
    write!(flujo, "{peticion}").ok()?;
    let mut crudo = Vec::new();
    flujo.read_to_end(&mut crudo).ok()?;
    let texto = String::from_utf8_lossy(&crudo).into_owned();
    let codigo = texto.split_whitespace().nth(1)?.parse().ok()?;
    let cuerpo = texto
        .split_once("\r\n\r\n")
        .map(|(_, c)| c.to_string())
        .unwrap_or_default();
    Some((codigo, cuerpo))
}

/// Primer `"id": N` de una respuesta JSON del catálogo, sin dependencias.
fn primer_id(cuerpo: &str) -> Option<i64> {
    let resto = cuerpo.split_once("\"id\"")?.1.split_once(':')?.1;
    let digitos: String = resto
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digitos.parse().ok()
}

/// ¿Hay un archivo con ese nombre en algún lugar del árbol? Sirve para afirmar
/// que **no** se creó una base de datos en otro sitio.
fn contiene_archivo(dir: &Path, nombre: &str) -> bool {
    let Ok(entradas) = std::fs::read_dir(dir) else {
        return false;
    };
    for entrada in entradas.flatten() {
        let ruta = entrada.path();
        if ruta.file_name().is_some_and(|n| n == nombre) {
            return true;
        }
        if ruta.is_dir() && contiene_archivo(&ruta, nombre) {
            return true;
        }
    }
    false
}

// ── configuración inválida: falla antes de crear nada (D-02) ────────

#[test]
fn sin_jwt_secret_no_crea_directorios() {
    let base = dir_unico("sin-jwt");
    let data_dir = base.join("data");

    let (estado, todo) = ejecutar_y_terminar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env_remove("JWT_SECRET")
            .env_remove("ADMIN_INITIAL_PASSWORD")
            .env("DATA_DIR", &data_dir)
            .env("LISTEN_ADDR", "127.0.0.1:0"),
        LIMITE_SALIDA,
    );

    assert!(
        !estado.success(),
        "el arranque debe fallar sin JWT_SECRET. salida:\n{todo}"
    );
    assert!(
        todo.contains("JWT_SECRET"),
        "el diagnóstico debe nombrar la variable. salida:\n{todo}"
    );
    assert!(
        !data_dir.exists(),
        "el arranque creó {} antes de validar la configuración",
        data_dir.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn con_configuracion_valida_crea_los_directorios() {
    let base = dir_unico("valida");
    let data_dir = base.join("data");

    let mut servidor = Servidor::lanzar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env("JWT_SECRET", "x".repeat(48))
            .env("ADMIN_INITIAL_PASSWORD", "arranque-test-password-1234")
            .env("DATA_DIR", &data_dir)
            .env("LISTEN_ADDR", "127.0.0.1:0"),
    );

    // Un arranque válido se queda sirviendo: se espera el efecto observado, no
    // la salida del proceso.
    let tope = Instant::now() + LIMITE_ARRANQUE;
    let mut creado = false;
    while Instant::now() < tope {
        if data_dir.exists() {
            creado = true;
            break;
        }
        if servidor.termino() {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    let (out, err) = servidor.matar_y_leer();

    assert!(
        creado,
        "con configuración válida el arranque debe crear {}. salida:\n{out}{err}",
        data_dir.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

// ══════════════════════════════════════════════════════════════════════
//  D-03 — layout portable: `APP_ROOT` derivada del ejecutable y `DATA_DIR`
//  resuelto por plataforma. Pruebas contra el binario real, porque el defecto
//  original (B3, `/modulos/*` 404) solo se reproduce con un proceso arrancado
//  desde un CWD distinto del de los recursos.
// ══════════════════════════════════════════════════════════════════════

fn escribir(ruta: &Path, contenido: &str) {
    std::fs::create_dir_all(ruta.parent().expect("padre de la ruta")).expect("crear directorios");
    std::fs::write(ruta, contenido).expect("escribir archivo de prueba");
}

/// Paquete de distribución mínimo con la estructura plana de D-03.A:
/// el ejecutable en la raíz, junto a `modulos/`, `static/` y `frontend/`.
fn paquete(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!("educonect-d03-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&base);

    let app = base.join("app");
    std::fs::create_dir_all(&app).expect("crear APP_ROOT del paquete");
    std::fs::copy(
        env!("CARGO_BIN_EXE_edu-conect-rural-server"),
        app.join(BINARIO),
    )
    .expect("copiar el binario a la raíz del paquete");

    escribir(
        &app.join("modulos").join("mundo-3d-701").join("index.html"),
        "<title>Mundo 3D 701</title><p>modulo del paquete</p>",
    );
    escribir(
        &app.join("static").join("js").join("api.js"),
        "// api.js del paquete\n",
    );
    // Dashboard: el export estático se sirve como fallback desde `APP_ROOT/frontend`.
    escribir(
        &app.join("frontend").join("dashboard-test.html"),
        "<title>Dashboard del paquete</title><p>dashboard del paquete</p>",
    );

    base
}

fn puerto_libre() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("puerto libre");
    listener.local_addr().expect("addr").port()
}

fn esperar_arranque(servidor: &mut Servidor, addr: SocketAddr, limite: Duration) -> bool {
    let tope = Instant::now() + limite;
    while Instant::now() < tope {
        if matches!(http_get(addr, "/health"), Some((200, _))) {
            return true;
        }
        // Si murió, no va a responder nunca: no se espera el tope completo.
        if servidor.termino() {
            return false;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

fn comando_servidor(app: &Path, data: &Path, cwd: &Path, puerto: u16) -> Command {
    let mut cmd = Command::new(app.join(BINARIO));
    cmd.current_dir(cwd)
        .env_remove("APP_ROOT")
        .env("JWT_SECRET", "x".repeat(48))
        .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
        .env("DATA_DIR", data)
        .env("LISTEN_ADDR", format!("127.0.0.1:{puerto}"))
        .env("RUST_LOG", "warn");
    cmd
}

/// Los tres CWD de la prueba de aceptación de §4 de las decisiones, más el
/// **señuelo**: un CWD que contiene un `modulos/` con los mismos nombres de
/// módulo y contenido distinto. Si la resolución dependiera del CWD, el señuelo
/// ganaría en ese directorio y las cuatro respuestas dejarían de ser idénticas.
fn cwd_de_prueba(senuelo: &Path) -> Vec<PathBuf> {
    #[cfg(unix)]
    let mut cwds = vec![
        PathBuf::from("/tmp"),
        PathBuf::from("/var/tmp"),
        PathBuf::from("/home"),
    ];
    #[cfg(not(unix))]
    let mut cwds = {
        let base = std::env::temp_dir();
        vec![base.clone(), base.join("d03-a"), base.join("d03-b")]
    };
    cwds.push(senuelo.to_path_buf());
    cwds
}

/// Rutas de travesía: ninguna puede salir de `APP_ROOT` ni revelar un archivo del
/// sistema. `http_get` las envía literales, sin normalizar del lado del cliente.
const TRAVESIAS: [&str; 4] = [
    "/modulos/../../../../etc/passwd",
    "/modulos/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
    "/modulos/%2f..%2f..%2f..%2f..%2fetc%2fpasswd",
    "/modulos/....//....//....//....//etc/passwd",
];

/// Regla `APP_ROOT` de D-03: la raíz de aplicación es el directorio del
/// ejecutable, nunca el CWD. Mismo binario, mismo paquete, los CWD de la prueba
/// de aceptación de §4 **más un señuelo** con `modulos/` propio: los recursos
/// deben resolverse igual, incluidos `/modulos/*` (bloqueante B3), el fallback del
/// dashboard, la lista de `/api/modulos` y las travesías de ruta.
#[test]
fn app_root_no_depende_del_cwd() {
    let base = paquete("tres-cwd");
    let app = base.join("app");
    let data = base.join("data");

    let rutas = [
        ("/modulos/mundo-3d-701/", "mundo 3d 701"),
        ("/static/js/api.js", "api.js del paquete"),
        ("/dashboard-test.html", "dashboard del paquete"),
        ("/api/modulos", "mundo-3d-701"),
    ];

    // Señuelo: mismo nombre de módulo, contenido distinto, en el CWD.
    let senuelo = base.join("senuelo");
    escribir(
        &senuelo
            .join("modulos")
            .join("mundo-3d-701")
            .join("index.html"),
        "<title>Senuelo</title><p>modulo del cwd, no del paquete</p>",
    );
    escribir(
        &senuelo.join("modulos").join("mundo-3d").join("index.html"),
        "<title>Senuelo 3D</title><p>modulo del cwd</p>",
    );

    let mut por_cwd: Vec<(String, Vec<(u16, String)>)> = Vec::new();
    let mut travesias_por_cwd: Vec<(String, Vec<(u16, String)>)> = Vec::new();

    for cwd in cwd_de_prueba(&senuelo) {
        std::fs::create_dir_all(&cwd).ok();
        let puerto = puerto_libre();
        let addr: SocketAddr = format!("127.0.0.1:{puerto}").parse().expect("addr");
        let mut servidor = Servidor::lanzar(&mut comando_servidor(&app, &data, &cwd, puerto));

        let listo = esperar_arranque(&mut servidor, addr, LIMITE_ARRANQUE);
        let mut respuestas = Vec::new();
        let mut travesias = Vec::new();
        if listo {
            for (uri, _) in rutas {
                respuestas.push(http_get(addr, uri).unwrap_or((0, String::new())));
            }
            for uri in TRAVESIAS {
                travesias.push(http_get(addr, uri).unwrap_or((0, String::new())));
            }
        }

        let (out, err) = servidor.matar_y_leer();

        assert!(
            listo,
            "el paquete no arrancó desde el CWD {}: /health nunca respondió 200. salida:\n{out}{err}",
            cwd.display()
        );
        por_cwd.push((cwd.display().to_string(), respuestas));
        travesias_por_cwd.push((cwd.display().to_string(), travesias));
    }

    // El señuelo del CWD nunca gana, y ninguna travesía filtra ni sirve el
    // `modulos/` del directorio de trabajo.
    for (cwd, respuestas) in &travesias_por_cwd {
        for (ruta, (codigo, cuerpo)) in TRAVESIAS.iter().zip(respuestas.iter()) {
            assert_eq!(
                *codigo, 404,
                "{ruta} desde el CWD {cwd} devolvió {codigo}, no 404"
            );
            assert!(
                !cuerpo.contains("root:x:"),
                "{ruta} desde el CWD {cwd} filtró /etc/passwd"
            );
            assert!(
                !cuerpo.contains("modulo del cwd"),
                "{ruta} desde el CWD {cwd} sirvió el módulo del señuelo"
            );
        }
    }
    for (cwd, respuestas) in &por_cwd {
        for ((uri, _), (codigo, cuerpo)) in rutas.iter().zip(respuestas.iter()) {
            assert!(
                *codigo != 200 || !cuerpo.contains("modulo del cwd"),
                "{uri} desde el CWD {cwd} sirvió el señuelo del directorio de trabajo"
            );
        }
    }

    for (cwd, respuestas) in &por_cwd {
        for ((uri, marca), (codigo, cuerpo)) in rutas.iter().zip(respuestas.iter()) {
            assert_eq!(
                *codigo, 200,
                "{uri} respondió {codigo} desde el CWD {cwd}: la ruta no se resuelve respecto de APP_ROOT"
            );
            assert!(
                cuerpo.contains(marca),
                "{uri} desde el CWD {cwd} no sirvió el contenido de APP_ROOT: {cuerpo:.120}"
            );
        }
    }

    // Las travesías también son idénticas entre CWD.
    for (cwd, respuestas) in travesias_por_cwd.iter().skip(1) {
        assert_eq!(
            respuestas, &travesias_por_cwd[0].1,
            "la respuesta a las travesías cambió según el CWD ({cwd} vs {})",
            travesias_por_cwd[0].0
        );
    }

    // Las resoluciones son idénticas, no solo exitosas.
    for (cwd, respuestas) in por_cwd.iter().skip(1) {
        assert_eq!(
            respuestas, &por_cwd[0].1,
            "la resolución de recursos cambió según el CWD ({cwd} vs {})",
            por_cwd[0].0
        );
    }

    assert!(
        data.join("educonect.db").is_file(),
        "DATA_DIR {} no recibió la base de datos",
        data.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

/// Regla `APP_ROOT` de D-03: debe existir. Un `APP_ROOT` declarado que no existe
/// no se sustituye por el CWD ni por otro candidato: se falla y se nombra.
#[test]
fn app_root_inexistente_falla_antes_de_crear_nada() {
    let base = dir_unico("d03-app-root-ausente");
    let data_dir = base.join("data");
    let app_root = base.join("no-existe");

    let (estado, todo) = ejecutar_y_terminar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env("APP_ROOT", &app_root)
            .env("JWT_SECRET", "x".repeat(48))
            .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
            .env("DATA_DIR", &data_dir)
            .env("LISTEN_ADDR", "127.0.0.1:0"),
        LIMITE_SALIDA,
    );

    assert!(
        !estado.success(),
        "un APP_ROOT inexistente no puede arrancar. salida:\n{todo}"
    );
    assert!(
        todo.contains("APP_ROOT"),
        "el diagnóstico debe nombrar APP_ROOT. salida:\n{todo}"
    );
    assert!(
        todo.contains(&app_root.to_string_lossy().to_string()),
        "el diagnóstico debe nombrar la ruta declarada {}. salida:\n{todo}",
        app_root.display()
    );
    assert!(
        !data_dir.exists(),
        "el arranque creó {} antes de validar APP_ROOT",
        data_dir.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

/// Regla `DATA_DIR` de D-03: no escribible es un fallo ruidoso, con mensaje
/// específico, **antes** de crear nada. Ni la base, ni videos, ni contenido.
#[cfg(unix)]
#[test]
fn data_dir_no_escribible_falla_antes_de_crear_nada() {
    use std::os::unix::fs::PermissionsExt;

    let base = dir_unico("d03-no-escribible");
    let data_dir = base.join("solo-lectura");
    std::fs::create_dir_all(&data_dir).expect("crear DATA_DIR del test");
    std::fs::set_permissions(&data_dir, std::fs::Permissions::from_mode(0o555))
        .expect("marcar DATA_DIR como solo lectura");

    let (estado, todo) = ejecutar_y_terminar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env("JWT_SECRET", "x".repeat(48))
            .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
            .env("DATA_DIR", &data_dir)
            .env("LISTEN_ADDR", "127.0.0.1:0"),
        LIMITE_SALIDA,
    );

    assert!(
        !estado.success(),
        "un DATA_DIR sin permiso de escritura no puede arrancar. salida:\n{todo}"
    );
    assert!(
        todo.contains("DATA_DIR"),
        "el diagnóstico debe nombrar DATA_DIR. salida:\n{todo}"
    );
    assert!(
        todo.contains("escribible"),
        "el diagnóstico debe decir que no es escribible. salida:\n{todo}"
    );

    let contenido: Vec<_> = std::fs::read_dir(&data_dir)
        .expect("read_dir")
        .map(|e| e.expect("entrada").file_name())
        .collect();
    assert!(
        contenido.is_empty(),
        "el arranque creó {contenido:?} dentro de un DATA_DIR no escribible"
    );

    let _ = std::fs::set_permissions(&data_dir, std::fs::Permissions::from_mode(0o755));
    let _ = std::fs::remove_dir_all(&base);
}

/// Pregunta abierta de D-03: qué pasa con la base de una instalación anterior
/// cuando `DATA_DIR` deja de resolverse al viejo `./data` relativo al CWD. No
/// puede arrancar en silencio con una base nueva y vacía: sería pérdida de datos.
///
/// Decisión implementada: fallar con un mensaje que nombra la base heredada y la
/// ruta resuelta. Nunca migrar en automático ni ignorar el archivo.
#[test]
fn base_de_instalacion_anterior_no_se_abandona_en_silencio() {
    let base = dir_unico("d03-heredada");
    let heredada = base.join("data").join("educonect.db");
    escribir(&heredada, "base de datos de la instalación anterior");

    // Ni `DATA_DIR` ni `APP_ROOT` se definen: es el caso en que la resolución por
    // defecto cambió respecto de la versión anterior (`./data` relativo al CWD).
    // `HOME`/`XDG_DATA_HOME` se acotan al directorio de la prueba para que la
    // resolución por defecto no toque el perfil real del usuario que ejecuta.
    let xdg = base.join("xdg");
    let (estado, todo) = ejecutar_y_terminar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env_remove("DATA_DIR")
            .env_remove("APP_ROOT")
            .env("XDG_DATA_HOME", &xdg)
            .env("HOME", base.join("home"))
            .env("JWT_SECRET", "x".repeat(48))
            .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
            .env("LISTEN_ADDR", "127.0.0.1:0"),
        LIMITE_SALIDA,
    );

    assert!(
        !estado.success(),
        "el arranque debe fallar para no dejar la base anterior huérfana. salida:\n{todo}"
    );
    assert!(
        todo.contains("DATA_DIR"),
        "el diagnóstico debe nombrar DATA_DIR. salida:\n{todo}"
    );
    assert!(
        todo.contains(&heredada.to_string_lossy().to_string()),
        "el diagnóstico debe nombrar la base heredada {}. salida:\n{todo}",
        heredada.display()
    );

    // Nada se creó: ni videos, ni contenido, ni base nueva, ni el perfil.
    let hermanos: Vec<_> = std::fs::read_dir(base.join("data"))
        .expect("read_dir")
        .map(|e| {
            e.expect("entrada")
                .file_name()
                .to_string_lossy()
                .to_string()
        })
        .collect();
    assert_eq!(
        hermanos,
        vec!["educonect.db".to_string()],
        "el intento dejó archivos nuevos junto a la base heredada"
    );
    assert!(
        !xdg.exists(),
        "el intento creó la raíz de datos por defecto {}",
        xdg.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

/// Escape hatch de la prueba anterior, y prueba de que **no hay pérdida de datos
/// silenciosa**: con `DATA_DIR` declarada la elección es explícita, el arranque
/// usa ese archivo y no crea una base nueva en otra parte.
///
/// El archivo heredado se escribe con contenido que no es SQLite a propósito: si
/// el arranque lo usa, tiene que fallar; si lo ignorara y creara una base nueva,
/// arrancaría sirviendo. Arrancar sirviendo sería la pérdida de datos.
#[test]
fn data_dir_declarada_usa_la_base_existente_y_no_crea_otra() {
    let base = dir_unico("d03-reutiliza");
    let data_dir = base.join("data");
    let heredada = data_dir.join("educonect.db");
    let contenido = b"base de datos de la instalacion anterior";
    escribir(&heredada, &String::from_utf8_lossy(contenido));

    let mut comando = Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"));
    comando
        .current_dir(&base)
        .env("DATA_DIR", &data_dir)
        .env("JWT_SECRET", "x".repeat(48))
        .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
        .env("LISTEN_ADDR", "127.0.0.1:0");
    comando.env_remove("APP_ROOT");

    let (estado, todo) = ejecutar_y_terminar(&mut comando, LIMITE_SALIDA);

    assert!(
        !estado.success(),
        "con DATA_DIR declarada, el arranque debe usar la base existente. salida:\n{todo}"
    );
    assert!(
        !todo.contains("escuchando"),
        "el arranque ignoró la base existente y sirvió con una base nueva. salida:\n{todo}"
    );
    assert_eq!(
        std::fs::read(&heredada).expect("leer la base heredada"),
        contenido,
        "el intento modificó la base de la instalación anterior"
    );

    let _ = std::fs::remove_dir_all(&base);
}

/// Regla `DATA_DIR` de D-03, cara positiva de la prueba anterior: con `DATA_DIR`
/// declarada y una base **sí** válida, el progreso escrito antes de un reinicio
/// sigue ahí después, y no apareció una base nueva bajo `HOME`.
///
/// Es la prueba de que la resolución por plataforma no creó dos bases: una por el
/// camino declarado y otra por el default del perfil.
#[test]
fn data_dir_declarada_reutiliza_misma_base_sin_crear_otra() {
    let base = paquete("reutiliza-misma");
    let app = base.join("app");
    let data = base.join("data");
    let home = base.join("home");
    let cwd = base.join("cwd");
    std::fs::create_dir_all(&home).expect("crear HOME del test");
    std::fs::create_dir_all(&cwd).expect("crear CWD del test");

    // Primer arranque: escribe progreso por la API.
    let puerto = puerto_libre();
    let addr: SocketAddr = format!("127.0.0.1:{puerto}").parse().expect("addr");
    let mut cmd = comando_servidor(&app, &data, &cwd, puerto);
    cmd.env("HOME", &home).env_remove("XDG_DATA_HOME");
    let mut servidor = Servidor::lanzar(&mut cmd);

    assert!(
        esperar_arranque(&mut servidor, addr, LIMITE_ARRANQUE),
        "el paquete no arrancó con DATA_DIR declarada"
    );

    let (codigo, catalogo) =
        http_solicitud(addr, "GET", "/api/cursos", None).expect("GET /api/cursos");
    assert_eq!(codigo, 200, "GET /api/cursos respondió {codigo}");
    let curso_id = primer_id(&catalogo).expect("el catálogo sembrado debe traer al menos un curso");

    let cuerpo = format!("{{\"usuario\":\"ana\",\"curso_id\":{curso_id},\"porcentaje\":42.5}}");
    let (codigo, respuesta) =
        http_solicitud(addr, "POST", "/api/progreso", Some(&cuerpo)).expect("POST /api/progreso");
    let (out, err) = servidor.matar_y_leer();
    assert_eq!(
        codigo, 201,
        "POST /api/progreso respondió {codigo}: {respuesta:.200}\n{out}{err}"
    );

    // Segundo arranque: el mismo DATA_DIR, otro puerto (el anterior puede estar
    // en TIME_WAIT; lo que se prueba es la base, no el socket).
    let puerto = puerto_libre();
    let addr: SocketAddr = format!("127.0.0.1:{puerto}").parse().expect("addr");
    let mut cmd = comando_servidor(&app, &data, &cwd, puerto);
    cmd.env("HOME", &home).env_remove("XDG_DATA_HOME");
    let mut servidor = Servidor::lanzar(&mut cmd);

    assert!(
        esperar_arranque(&mut servidor, addr, LIMITE_ARRANQUE),
        "el paquete no volvió a arrancar sobre el mismo DATA_DIR"
    );

    let (codigo, progreso) =
        http_solicitud(addr, "GET", "/api/progreso/ana", None).expect("GET /api/progreso/ana");
    let (out, err) = servidor.matar_y_leer();

    assert_eq!(
        codigo, 200,
        "GET /api/progreso/ana respondió {codigo}\n{out}{err}"
    );
    assert!(
        progreso.contains("ana") && progreso.contains("42.5"),
        "el progreso escrito antes del reinicio no sobrevivió: {progreso:.300}\n{out}{err}"
    );
    assert!(
        data.join("educonect.db").is_file(),
        "la base no quedó en DATA_DIR ({})",
        data.display()
    );
    assert!(
        !contiene_archivo(&home, "educonect.db"),
        "apareció una base nueva bajo HOME ({}): la raíz declarada no fue la única que se usó",
        home.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}

/// Endurecimiento de la guardia de base heredada (A3 de la verificación
/// independiente): un `data/` heredado **ilegible** hacía que `is_file()`
/// devolviera `false` y el proceso arrancara con una base nueva y vacía.
/// Cualquier error que no sea «no existe» debe fallar nombrando la ruta.
#[cfg(unix)]
#[test]
fn base_heredada_dir_ilegible_no_arranca_vacia() {
    use std::os::unix::fs::PermissionsExt;

    let base = dir_unico("d03-heredada-ilegible");
    let heredado = base.join("data");
    escribir(
        &heredado.join("educonect.db"),
        "base de datos de la instalación anterior",
    );
    // Intransitable para cualquiera que no sea root u otro dueño con permiso.
    std::fs::set_permissions(&heredado, std::fs::Permissions::from_mode(0o000))
        .expect("marcar data/ como intransitable");

    // root atraviesa el 0000: el caso no se puede reproducir. Se declara, no se
    // finge haberlo probado.
    if std::fs::metadata(heredado.join("educonect.db")).is_ok() {
        std::fs::set_permissions(&heredado, std::fs::Permissions::from_mode(0o755)).ok();
        let _ = std::fs::remove_dir_all(&base);
        eprintln!("OMITIDA: el usuario es root (o equivalente), 0000 no impide el sondeo");
        return;
    }

    let xdg = base.join("xdg");
    let (estado, todo) = ejecutar_y_terminar(
        Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
            .current_dir(&base)
            .env_remove("DATA_DIR")
            .env_remove("APP_ROOT")
            .env("XDG_DATA_HOME", &xdg)
            .env("HOME", base.join("home"))
            .env("JWT_SECRET", "x".repeat(48))
            .env("ADMIN_INITIAL_PASSWORD", "d03-password-segura-1234")
            .env("LISTEN_ADDR", "127.0.0.1:0"),
        LIMITE_SALIDA,
    );

    // Restaurar permisos antes de afirmar nada: el directorio es del test.
    std::fs::set_permissions(&heredado, std::fs::Permissions::from_mode(0o755))
        .expect("restaurar permisos del data/ del test");

    assert!(
        !estado.success(),
        "un data/ heredado ilegible no puede dejar arrancar una base vacía. salida:\n{todo}"
    );
    assert!(
        todo.contains(&heredado.to_string_lossy().to_string()),
        "el diagnóstico debe nombrar el directorio heredado ilegible {}. salida:\n{todo}",
        heredado.display()
    );
    assert!(
        todo.contains("DATA_DIR"),
        "el diagnóstico debe nombrar DATA_DIR. salida:\n{todo}"
    );
    assert!(
        !xdg.exists(),
        "el intento creó la raíz de datos por defecto {} sin poder descartar la base heredada",
        xdg.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}
