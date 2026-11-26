//! Regresión de Hallazgo B (D-02): el arranque no debe crear directorios antes
//! de validar la configuración.
//!
//! Se ejecuta el binario real, no una función: el defecto original vivía en el
//! **orden** de las operaciones dentro de `main()`, y solo el proceso completo
//! lo reproduce.

use std::path::PathBuf;
use std::process::Command;

fn dir_unico(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("educonect-arranque-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("crear directorio del test");
    dir
}

#[test]
fn sin_jwt_secret_no_crea_directorios() {
    let base = dir_unico("sin-jwt");
    let data_dir = base.join("data");

    let salida = Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
        .current_dir(&base)
        .env_remove("JWT_SECRET")
        .env_remove("ADMIN_INITIAL_PASSWORD")
        .env("DATA_DIR", &data_dir)
        .env("LISTEN_ADDR", "127.0.0.1:0")
        .output()
        .expect("ejecutar el binario");

    assert!(
        !salida.status.success(),
        "el arranque debe fallar sin JWT_SECRET"
    );

    let stdout = String::from_utf8_lossy(&salida.stdout);
    assert!(
        stdout.contains("JWT_SECRET"),
        "el diagnóstico debe nombrar la variable. stdout: {stdout}"
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

    // `output()` bloquearía: un arranque válido se queda sirviendo. Se lanza el
    // proceso, se espera a que cree el directorio y se lo termina.
    let mut hijo = Command::new(env!("CARGO_BIN_EXE_edu-conect-rural-server"))
        .current_dir(&base)
        .env("JWT_SECRET", "x".repeat(48))
        .env("ADMIN_INITIAL_PASSWORD", "arranque-test-password-1234")
        .env("DATA_DIR", &data_dir)
        .env("LISTEN_ADDR", "127.0.0.1:0")
        .spawn()
        .expect("lanzar el binario");

    let mut creado = false;
    for _ in 0..200 {
        if data_dir.exists() {
            creado = true;
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let _ = hijo.kill();
    let _ = hijo.wait();

    assert!(
        creado,
        "con configuración válida el arranque debe crear {}",
        data_dir.display()
    );

    let _ = std::fs::remove_dir_all(&base);
}
