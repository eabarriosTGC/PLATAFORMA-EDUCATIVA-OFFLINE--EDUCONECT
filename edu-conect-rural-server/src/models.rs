use serde::{Deserialize, Serialize};

// ── Dominio: Cursos ───────────────────────────────────────────────────

/// Curso disponible en la plataforma.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Curso {
    pub id: i64,
    pub titulo: String,
    pub descripcion: String,
    pub categoria: String,
    pub archivo_path: String,
}

/// Payload para crear progreso (POST /api/progreso).
#[derive(Debug, Clone, Deserialize)]
pub struct NuevoProgreso {
    pub usuario: String,
    pub curso_id: i64,
    pub porcentaje: f64,
}

/// Progreso de un estudiante en un curso (respuesta API).
#[derive(Debug, Clone, Serialize)]
pub struct Progreso {
    pub id: i64,
    pub usuario: String,
    pub curso_id: i64,
    pub porcentaje: f64,
    pub ultima_vez: String,
}

/// Respuesta de error unificada.
#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub error: String,
}

// ── Dominio: Autenticación ────────────────────────────────────────────

/// Payload para POST /admin/login
#[derive(Debug, Clone, Deserialize)]
pub struct LoginPayload {
    pub usuario: String,
    pub password: String,
}

/// Respuesta de login exitoso
#[derive(Debug, Clone, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub usuario: String,
    pub expira_en: i64,
}

/// Claims del JWT (contenido del token)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    /// Usuario (subject)
    pub sub: String,
    /// Expiración (timestamp Unix)
    pub exp: usize,
    /// Emitido en (timestamp Unix)
    pub iat: usize,
}

/// Usuario autenticado, inyectado en handlers protegidos.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub usuario: String,
}

/// Administrador almacenado en BD
#[derive(Debug, Clone)]
pub struct AdminUsuario {
    #[allow(dead_code)]
    pub id: i64,
    #[allow(dead_code)]
    pub usuario: String,
    pub password_hash: String,
}

/// Archivo subido por el gestor de contenido
#[derive(Debug, Clone, Serialize)]
pub struct ArchivoResponse {
    pub id: i64,
    pub tipo: String,
    pub nombre_original: String,
    pub ruta_archivo: String,
    pub tamano: i64,
    pub mime_type: String,
}
