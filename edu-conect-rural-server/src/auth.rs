//! Módulo de autenticación para el panel de administración.
//!
//! Proporciona:
//! - `POST /admin/login` — autenticación y emisión de JWT
//! - Middleware `AuthLayer` que protege todas las rutas `/admin/*`
//!
//! Dependencias externas: jsonwebtoken, bcrypt, chrono.

// TODO: integrar AuthLayer en main.rs (ver CRITICO 1)
#![allow(dead_code)]

use std::{
    future::Future,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};

use axum::{
    extract::{FromRequestParts, Request, State},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use tower::{Layer, Service};

use crate::db::Database;
use crate::models::{ApiError, AuthClaims, AuthUser, LoginPayload, LoginResponse};

/// Capa de autenticación JWT.
#[derive(Clone)]
pub struct AuthLayer {
    secret: Arc<String>,
}

impl AuthLayer {
    pub fn new(secret: String) -> Self {
        Self {
            secret: Arc::new(secret),
        }
    }
}

impl<S> Layer<S> for AuthLayer {
    type Service = AuthMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AuthMiddleware {
            inner,
            secret: self.secret.clone(),
        }
    }
}

/// Middleware JWT.
#[derive(Clone)]
pub struct AuthMiddleware<S> {
    inner: S,
    secret: Arc<String>,
}

impl<S> Service<Request> for AuthMiddleware<S>
where
    S: Service<Request, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request) -> Self::Future {
        let secret = self.secret.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            match auth_header {
                Some(h) if h.starts_with("Bearer ") => {
                    let token = h.trim_start_matches("Bearer ").trim();
                    match decode_token(token, &secret) {
                        Ok(claims) => {
                            let mut req = req;
                            req.extensions_mut().insert(AuthUser {
                                usuario: claims.sub.clone(),
                            });
                            inner.call(req).await
                        }
                        Err(_e) => Ok(auth_error_response(
                            StatusCode::UNAUTHORIZED,
                            "Token inválido",
                        )),
                    }
                }
                Some(_) => Ok(auth_error_response(
                    StatusCode::UNAUTHORIZED,
                    "Formato inválido. Use: Bearer <token>",
                )),
                None => Ok(auth_error_response(
                    StatusCode::UNAUTHORIZED,
                    "Header Authorization requerido",
                )),
            }
        })
    }
}

/// FromRequestParts para handlers protegidos.
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<ApiError>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts.extensions.get::<AuthUser>().cloned().ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(ApiError {
                    error: "No autenticado".into(),
                }),
            )
        })
    }
}

// ── JWT ───────────────────────────────────────────────────────────────

/// Crea un JWT con expiración de 24 horas.
pub fn create_token(usuario: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = (now + chrono::Duration::hours(24)).timestamp() as usize;
    let iat = now.timestamp() as usize;

    let claims = AuthClaims {
        sub: usuario.to_string(),
        exp,
        iat,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Decodifica y valida un JWT.
pub fn decode_token(token: &str, secret: &str) -> Result<AuthClaims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    validation.leeway = 60;

    let token_data = decode::<AuthClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}

// ── helpers HTTP ──────────────────────────────────────────────────────

fn auth_error_response(code: StatusCode, msg: &str) -> Response {
    (code, Json(ApiError { error: msg.into() })).into_response()
}

// ── Handlers ──────────────────────────────────────────────────────────

/// POST /admin/login — autentica y devuelve JWT.
pub async fn login_handler(
    State(db): State<Database>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<ApiError>)> {
    if payload.usuario.trim().is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: "El campo 'usuario' no puede estar vacío".into(),
            }),
        ));
    }
    if payload.password.is_empty() {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ApiError {
                error: "El campo 'password' no puede estar vacío".into(),
            }),
        ));
    }

    // Buscar admin por usuario (error mapeado a 401 genérico)
    let admin = db
        .obtener_admin(&payload.usuario)
        .map_err(|_| auth_401())?;

    // Verificar password con bcrypt
    let valida = bcrypt::verify(&payload.password, &admin.password_hash).unwrap_or(false);
    if !valida {
        return Err(auth_401());
    }

    // Generar JWT usando el secret de la DB
    let token = create_token(&payload.usuario, &db.jwt_secret).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError {
                error: format!("Error al generar token: {e}"),
            }),
        )
    })?;

    let exp = (Utc::now() + chrono::Duration::hours(24)).timestamp();

    Ok(Json(LoginResponse {
        token,
        usuario: payload.usuario,
        expira_en: exp,
    }))
}

fn auth_401() -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(ApiError {
            error: "Credenciales inválidas".into(),
        }),
    )
}

/// GET /admin/dashboard — protegido.
pub async fn dashboard_handler(
    user: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    Ok(Json(serde_json::json!({
        "mensaje": format!("Bienvenido al panel administrativo, {}", user.usuario),
        "usuario": user.usuario,
    })))
}

/// GET /admin/estadisticas — protegido.
pub async fn estadisticas_handler(
    _user: AuthUser,
    State(db): State<Database>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ApiError>)> {
    let total_cursos = db
        .listar_cursos()
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError {
                    error: format!("Error al obtener estadísticas: {e}"),
                }),
            )
        })?
        .len();

    let progreso_count = db.total_registros_progreso().unwrap_or(0);
    let admin_count = db.total_admins().unwrap_or(1);

    Ok(Json(serde_json::json!({
        "total_cursos": total_cursos,
        "total_progresos": progreso_count,
        "total_administradores": admin_count,
        "version": env!("CARGO_PKG_VERSION"),
    })))
}

/// Construye el router admin (YA NO USADO — las rutas se definen en main.rs).
/// Se mantiene por referencia.
#[allow(dead_code)]
pub fn admin_router() -> Router<Database> {
    // Las rutas protegidas comparten el mismo secret que está en Database
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        "educonect-rural-dev-secret".into()
    });

    Router::new()
        // Login — público
        .route("/admin/login", post(login_handler))
        // Dashboard — protegido con middleware JWT
        .route("/admin/dashboard", get(dashboard_handler))
        .route("/admin/estadisticas", get(estadisticas_handler))
        .layer(AuthLayer::new(secret))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_decode_token() {
        let secret = "test-secret-key";
        let token = create_token("admin_test", secret).unwrap();
        let claims = decode_token(&token, secret).unwrap();
        assert_eq!(claims.sub, "admin_test");
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn test_decode_invalid_token() {
        assert!(decode_token("token-invalido", "secreto").is_err());
    }

    #[test]
    fn test_decode_token_wrong_secret() {
        let token = create_token("admin", "secreto-real").unwrap();
        assert!(decode_token(&token, "secreto-distinto").is_err());
    }

    #[test]
    fn test_decode_malformed_token() {
        assert!(decode_token("no.es.jwt", "secreto").is_err());
    }

    #[test]
    fn test_bcrypt_hash_and_verify() {
        let password = "admin123";
        let hash = bcrypt::hash(password, 4).unwrap();
        assert!(bcrypt::verify(password, &hash).unwrap());
        assert!(!bcrypt::verify("wrong", &hash).unwrap());
    }

    #[test]
    fn test_login_payload_deserialize() {
        let payload: LoginPayload =
            serde_json::from_str(r#"{"usuario":"admin","password":"admin123"}"#).unwrap();
        assert_eq!(payload.usuario, "admin");
        assert_eq!(payload.password, "admin123");
    }
}
