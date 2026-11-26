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

    let mut flujo =
        std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2)).ok()?;
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
        &app.join("modulos")
            .join("mundo-3d-701")
            .join("index.html"),
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

fn comando_servidor(
    app: &Path,
    data: &Path,
    cwd: &Path,
    puerto: u16,
) -> Command {
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

/// Los tres CWD de la prueba de aceptación de §4 de las decisiones.
fn cwd_de_prueba() -> Vec<PathBuf> {
    #[cfg(unix)]
    {
        vec![
            PathBuf::from("/tmp"),
            PathBuf::from("/var/tmp"),
            PathBuf::from("/home"),
        ]
    }
    #[cfg(not(unix))]
    {
        let base = std::env::temp_dir();
        vec![base.clone(), base.join("d03-a"), base.join("d03-b")]
    }
}

/// Regla `APP_ROOT` de D-03: la raíz de aplicación es el directorio del
/// ejecutable, nunca el CWD. Mismo binario, mismo paquete, tres CWD distintos
/// (la prueba de aceptación de §4): los recursos deben resolverse igual,
/// incluidos `/modulos/*` (bloqueante B3) y el fallback del dashboard.
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

    let mut por_cwd: Vec<(String, Vec<(u16, String)>)> = Vec::new();

    for cwd in cwd_de_prueba() {
        std::fs::create_dir_all(&cwd).ok();
        let puerto = puerto_libre();
        let addr: SocketAddr = format!("127.0.0.1:{puerto}").parse().expect("addr");
        let mut servidor = Servidor::lanzar(&mut comando_servidor(&app, &data, &cwd, puerto));

        let listo = esperar_arranque(&mut servidor, addr, LIMITE_ARRANQUE);
        let mut respuestas = Vec::new();
        if listo {
            for (uri, _) in rutas {
                respuestas.push(http_get(addr, uri).unwrap_or((0, String::new())));
            }
        }

        let (out, err) = servidor.matar_y_leer();

        assert!(
            listo,
            "el paquete no arrancó desde el CWD {}: /health nunca respondió 200. salida:\n{out}{err}",
            cwd.display()
        );
        por_cwd.push((cwd.display().to_string(), respuestas));
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
        .map(|e| e.expect("entrada").file_name().to_string_lossy().to_string())
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
