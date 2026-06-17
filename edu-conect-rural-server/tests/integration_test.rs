// Tests de integracion del pool r2d2: peticiones concurrentes sin deadlocks.

use std::net::SocketAddr;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use tower::ServiceExt;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
struct TestState {
    db: edu_conect_rural_server::db::Database,
}

fn setup_test_db() -> TestState {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")),
        )
        .try_init();

    let db_path = format!("data/test_integration_{}.db", std::process::id());
    let db = edu_conect_rural_server::db::Database::open(&db_path)
        .expect("Fallo al abrir BD de test");
    TestState { db }
}

fn cleanup_test_db(_state: &TestState) {
    if let Ok(entries) = std::fs::read_dir("data") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("test_integration_") && name.ends_with(".db") {
                let _ = std::fs::remove_file(entry.path());
                let _ = std::fs::remove_file(format!("{}-wal", entry.path().display()));
                let _ = std::fs::remove_file(format!("{}-shm", entry.path().display()));
            }
        }
    }
}

fn make_app(state: TestState) -> Router {
    Router::new()
        .route("/api/cursos", get(listar_cursos_de_test))
        .route("/api/progreso/{usuario}", get(progreso_de_test))
        .route("/api/progreso", post(guardar_progreso_de_test))
        .with_state(state)
}

async fn listar_cursos_de_test(
    State(state): State<TestState>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, Json<serde_json::Value>)> {
    let cursos = state.db.listar_cursos().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
    })?;
    Ok(Json(
        cursos
            .iter()
            .map(|c| serde_json::json!({"id": c.id, "titulo": c.titulo}))
            .collect(),
    ))
}

async fn progreso_de_test(
    State(state): State<TestState>,
    Path(usuario): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let p = state.db.progreso_por_usuario(&usuario).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
    })?;
    Ok(Json(serde_json::json!({"progreso": p})))
}

#[derive(serde::Deserialize)]
struct ProgresoPayload {
    usuario: String,
    curso_id: i64,
    porcentaje: f64,
}

async fn guardar_progreso_de_test(
    State(state): State<TestState>,
    Json(payload): Json<ProgresoPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let nuevo = edu_conect_rural_server::models::NuevoProgreso {
        usuario: payload.usuario,
        curso_id: payload.curso_id,
        porcentaje: payload.porcentaje,
    };
    let p = state.db.guardar_progreso(&nuevo).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
    })?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({"id": p.id}))))
}

// ======================================================
// TEST 1: 10 lecturas concurrentes sin deadlocks
// ======================================================

#[tokio::test]
async fn test_concurrent_reads_no_deadlock() {
    let state = setup_test_db();
    let app = make_app(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    let actual_addr = listener.local_addr().unwrap();
    let server = axum::serve(listener, app.into_make_service());
    tokio::spawn(async move { server.await.unwrap() });
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let base = format!("http://{}", actual_addr);
    let mut handles = vec![];

    for _ in 0..10 {
        let url = format!("{}/api/cursos", base);
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            let resp = client.get(&url).send().await.unwrap();
            assert_eq!(resp.status(), 200);
            let body: serde_json::Value = resp.json().await.unwrap();
            assert!(body.is_array());
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    cleanup_test_db(&state);
    println!("TEST 1 PASADO: 10 lecturas concurrentes sin deadlocks");
}

// ======================================================
// TEST 2: 10 escrituras concurrentes (upsert)
// ======================================================

#[tokio::test]
async fn test_concurrent_writes_no_deadlock() {
    let state = setup_test_db();
    let app = make_app(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    let actual_addr = listener.local_addr().unwrap();
    let server = axum::serve(listener, app.into_make_service());
    tokio::spawn(async move { server.await.unwrap() });
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let base = format!("http://{}", actual_addr);
    let mut handles = vec![];

    for i in 0..10 {
        let url = format!("{}/api/progreso", base);
        let body = serde_json::json!({
            "usuario": "concurrente_test",
            "curso_id": 1,
            "porcentaje": 10.0 * (i + 1) as f64
        });
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            let resp = client.post(&url).json(&body).send().await.unwrap();
            assert!(resp.status().is_success());
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    let resp = client
        .get(format!("{}/api/progreso/concurrente_test", base))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(!body["progreso"].as_array().unwrap().is_empty());

    cleanup_test_db(&state);
    println!("TEST 2 PASADO: 10 escrituras concurrentes sin deadlocks");
}

// ======================================================
// TEST 3: 5 lecturas + 3 escrituras concurrentes
// ======================================================

#[tokio::test]
async fn test_concurrent_reads_and_writes_no_deadlock() {
    let state = setup_test_db();
    let app = make_app(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    let actual_addr = listener.local_addr().unwrap();
    let server = axum::serve(listener, app.into_make_service());
    tokio::spawn(async move { server.await.unwrap() });
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let base = format!("http://{}", actual_addr);

    // Semilla
    client
        .post(format!("{}/api/progreso", base))
        .json(&serde_json::json!({"usuario": "mixto_test", "curso_id": 1, "porcentaje": 50.0}))
        .send()
        .await
        .unwrap();

    let mut handles = vec![];

    for _ in 0..5 {
        let url = format!("{}/api/progreso/mixto_test", base);
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            let resp = client.get(&url).send().await.unwrap();
            assert_eq!(resp.status(), 200);
        }));
    }

    for i in 0..3 {
        let url = format!("{}/api/progreso", base);
        let body = serde_json::json!({
            "usuario": "mixto_test", "curso_id": 1,
            "porcentaje": 30.0 * (i + 1) as f64
        });
        let client = client.clone();
        handles.push(tokio::spawn(async move {
            let resp = client.post(&url).json(&body).send().await.unwrap();
            assert!(resp.status().is_success());
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    cleanup_test_db(&state);
    println!("TEST 3 PASADO: 5 lecturas + 3 escrituras concurrentes sin deadlocks");
}
