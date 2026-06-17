use rusqlite::{params, Connection};
use thiserror::Error;

use crate::models::{AdminUsuario, ArchivoResponse, Curso, NuevoProgreso, Progreso};
use serde::Serialize;

/// Resultado de búsqueda unificado
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub tipo: String,       // "curso" | "video" | "libro"
    pub id: i64,
    pub titulo: String,
    pub descripcion: String,
    pub categoria: String,
    pub rango: Option<i64>, // relevancia FTS5
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archivo_path: Option<String>, // ruta para libros
}

/// Errores tipificados de la capa de base de datos.
#[derive(Error, Debug)]
pub enum DbError {
    #[error("{0}")]
    NoEncontrado(String),

    #[error("{0}")]
    Validacion(String),

    #[error("Error de base de datos: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Error de pool de conexiones: {0}")]
    Pool(#[from] r2d2::Error),
}

/// Contenedor thread-safe del pool SQLite + configuración.
#[derive(Clone)]
pub struct Database {
    pool: r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>,
    pub jwt_secret: String,
}

impl Database {
    /// Helper privado: obtiene una conexión del pool o devuelve error.
    fn conn(&self) -> Result<r2d2::PooledConnection<r2d2_sqlite::SqliteConnectionManager>, DbError> {
        Ok(self.pool.get()?)
    }

    /// Abre (o crea) la base de datos y ejecuta migraciones + seeds.
    pub fn open(path: &str) -> Result<Self, DbError> {
        let manager = r2d2_sqlite::SqliteConnectionManager::file(path)
            .with_init(|c: &mut Connection| -> Result<(), rusqlite::Error> {
                c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            });
        let pool = r2d2::Pool::builder()
            .max_size(8)
            .build(manager)?;

        // ⚠️ IMPORTANTE: en PRODUCCIÓN este valor DEBE venir de la variable de entorno JWT_SECRET.
        // Aquí solo es un valor por defecto para desarrollo local.
        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            tracing::warn!("⚠️  JWT_SECRET no configurado. Usando secreto de DESARROLLO (cambiarlo en producción)");
            "educonect-rural-dev-secret".into()
        });

        let db = Self { pool, jwt_secret };
        db.ejecutar_migraciones()?;
        db.ejecutar_seeds()?;
        db.run_auth_migrations()?;
        db.run_content_migrations()?;
        db.run_search_migrations()?;
        db.reindex_search()?;
        tracing::info!("Base de datos lista: {path} (pool r2d2, max_size=8)");
        Ok(db)
    }

    // ── migraciones / seeds ──────────────────────────────────────────

    fn ejecutar_migraciones(&self) -> Result<(), DbError> {
        let sql = include_str!("../migrations/001_init.sql");
        let conn = self.conn()?;
        conn.execute_batch(sql)?;
        tracing::info!("Migraciones ejecutadas");
        Ok(())
    }

    fn ejecutar_seeds(&self) -> Result<(), DbError> {
        let sql1 = include_str!("../seeds/001_cursos.sql");
        let sql2 = include_str!("../seeds/002_modulos.sql");
        let sql5 = include_str!("../seeds/005_biblioteca_fts.sql");
        let sql6 = include_str!("../seeds/006_diccionarios.sql");
        let conn = self.conn()?;
        conn.execute_batch(sql1)?;
        conn.execute_batch(sql2)?;
        conn.execute_batch(sql5)?;
        conn.execute_batch(sql6)?;
        tracing::info!("Semillas cargadas (cursos + módulos + biblioteca + diccionarios)");
        Ok(())
    }

    // ── cursos ───────────────────────────────────────────────────────

    /// Retorna todos los cursos.
    pub fn listar_cursos(&self) -> Result<Vec<Curso>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, titulo, descripcion, categoria, archivo_path FROM cursos ORDER BY id",
        )?;

        let cursos = stmt
            .query_map([], |row| {
                Ok(Curso {
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get(2)?,
                    categoria: row.get(3)?,
                    archivo_path: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(cursos)
    }

    /// Retorna un curso por su id.
    pub fn obtener_curso(&self, id: i64) -> Result<Curso, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT id, titulo, descripcion, categoria, archivo_path FROM cursos WHERE id = ?1",
            params![id],
            |row| {
                Ok(Curso {
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get(2)?,
                    categoria: row.get(3)?,
                    archivo_path: row.get(4)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NoEncontrado(format!("Curso con id={id} no encontrado"))
            }
            other => DbError::Sqlite(other),
        })
    }

    // ── progreso ─────────────────────────────────────────────────────

    /// Guarda (upsert) progreso de un estudiante.
    /// Si ya existe registro para ese usuario+curso, lo actualiza.
    pub fn guardar_progreso(&self, payload: &NuevoProgreso) -> Result<Progreso, DbError> {
        // Validar datos
        if payload.usuario.trim().is_empty() {
            return Err(DbError::Validacion(
                "El campo 'usuario' no puede estar vacío".into(),
            ));
        }
        if !(0.0..=100.0).contains(&payload.porcentaje) {
            return Err(DbError::Validacion(
                format!(
                    "El campo 'porcentaje' debe estar entre 0 y 100. Valor recibido: {}",
                    payload.porcentaje
                ),
            ));
        }

        // Verificar que el curso existe
        self.obtener_curso(payload.curso_id)?;

        let conn = self.conn()?;

        // UPSERT: INSERT ... ON CONFLICT DO UPDATE
        conn.execute(
            "INSERT INTO progreso (usuario, curso_id, porcentaje, ultima_vez) \
             VALUES (?1, ?2, ?3, datetime('now')) \
             ON CONFLICT(usuario, curso_id) DO UPDATE SET \
                porcentaje = excluded.porcentaje, \
                ultima_vez = excluded.ultima_vez",
            params![payload.usuario, payload.curso_id, payload.porcentaje],
        )?;

        // Devolver el registro recién insertado/actualizado
        drop(conn);
        self.obtener_un_progreso(&payload.usuario, payload.curso_id)
    }

    /// Progreso de un usuario en todos los cursos.
    pub fn progreso_por_usuario(&self, usuario: &str) -> Result<Vec<Progreso>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, usuario, curso_id, porcentaje, ultima_vez \
             FROM progreso WHERE usuario = ?1 ORDER BY ultima_vez DESC",
        )?;

        let resultados = stmt
            .query_map(params![usuario], |row| {
                Ok(Progreso {
                    id: row.get(0)?,
                    usuario: row.get(1)?,
                    curso_id: row.get(2)?,
                    porcentaje: row.get(3)?,
                    ultima_vez: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(resultados)
    }

    /// Obtiene un progreso específico (usuario + curso).
    fn obtener_un_progreso(&self, usuario: &str, curso_id: i64) -> Result<Progreso, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT id, usuario, curso_id, porcentaje, ultima_vez \
             FROM progreso WHERE usuario = ?1 AND curso_id = ?2",
            params![usuario, curso_id],
            |row| {
                Ok(Progreso {
                    id: row.get(0)?,
                    usuario: row.get(1)?,
                    curso_id: row.get(2)?,
                    porcentaje: row.get(3)?,
                    ultima_vez: row.get(4)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => DbError::NoEncontrado(format!(
                "Progreso no encontrado para usuario={usuario} curso={curso_id}"
            )),
            other => DbError::Sqlite(other),
        })
    }

    // ── autenticación ────────────────────────────────────────────────

    /// Crea la tabla de admins y el admin por defecto si no existe.
    fn ejecutar_migraciones_auth(&self) -> Result<(), DbError> {
        let sql = include_str!("../migrations/002_auth.sql");
        self.conn()?.execute_batch(sql)?;

        // Crear admin por defecto si no hay ninguno
        let conn = self.conn()?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM admin_usuarios", [], |row| row.get(0))
            .unwrap_or(0);

        if count == 0 {
            let hash = bcrypt::hash("admin123", 12).expect("Error al hashear password por defecto");
            conn.execute(
                "INSERT INTO admin_usuarios (usuario, password_hash) VALUES (?1, ?2)",
                params!["admin", hash],
            )?;
            tracing::info!("🔑 Admin por defecto creado: admin / admin123");
        }

        Ok(())
    }

    /// Ejecuta migraciones de auth (llamado después de las migraciones base).
    pub fn run_auth_migrations(&self) -> Result<(), DbError> {
        self.ejecutar_migraciones_auth()
    }

    /// Obtiene un admin por nombre de usuario.
    pub fn obtener_admin(&self, usuario: &str) -> Result<AdminUsuario, DbError> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT id, usuario, password_hash FROM admin_usuarios WHERE usuario = ?1",
            params![usuario],
            |row| {
                Ok(AdminUsuario {
                    id: row.get(0)?,
                    usuario: row.get(1)?,
                    password_hash: row.get(2)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                DbError::NoEncontrado(format!("Admin '{usuario}' no encontrado"))
            }
            other => DbError::Sqlite(other),
        })
    }

    /// Total de registros de progreso.
    pub fn total_registros_progreso(&self) -> Result<i64, DbError> {
        let conn = self.conn()?;
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM progreso", [], |row| row.get(0))?;
        Ok(count)
    }

    /// Total de administradores registrados.
    pub fn total_admins(&self) -> Result<i64, DbError> {
        let conn = self.conn()?;
        let count: i64 =
            conn.query_row("SELECT COUNT(*) FROM admin_usuarios", [], |row| row.get(0))?;
        Ok(count)
    }

    // ── contenido ────────────────────────────────────────────────────

    pub fn run_content_migrations(&self) -> Result<(), DbError> {
        let sql = include_str!("../migrations/003_content.sql");
        self.conn()?.execute_batch(sql)?;
        tracing::info!("Migraciones de contenido ejecutadas");
        Ok(())
    }

    pub fn total_videos(&self) -> Result<i64, DbError> {
        let conn = self.conn()?;
        Ok(conn.query_row("SELECT COUNT(*) FROM videos WHERE activo=1", [], |r| r.get(0))?)
    }

    pub fn total_archivos(&self) -> Result<i64, DbError> {
        let conn = self.conn()?;
        Ok(conn.query_row("SELECT COUNT(*) FROM archivos", [], |r| r.get(0))?)
    }

    pub fn insertar_curso(&self, titulo: &str, descripcion: &str, categoria: &str, archivo_path: &str) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("INSERT INTO cursos (titulo, descripcion, categoria, archivo_path) VALUES (?1, ?2, ?3, ?4)",
            params![titulo, descripcion, categoria, archivo_path])?;
        Ok(())
    }

    pub fn actualizar_curso(&self, id: i64, titulo: &str, descripcion: &str, categoria: &str, archivo_path: &str) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("UPDATE cursos SET titulo=?1, descripcion=?2, categoria=?3, archivo_path=?4 WHERE id=?5",
            params![titulo, descripcion, categoria, archivo_path, id])?;
        Ok(())
    }

    pub fn eliminar_curso(&self, id: i64) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM cursos WHERE id=?1", params![id])?;
        Ok(())
    }

    pub fn insertar_video(&self, titulo: &str, canal: &str, duracion: &str, thumbnail: &str, categoria: &str, archivo: &str) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("INSERT INTO videos (titulo, canal, duracion, thumbnail, categoria, archivo) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![titulo, canal, duracion, thumbnail, categoria, archivo])?;
        Ok(())
    }

    pub fn eliminar_video(&self, id: i64) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM videos WHERE id=?1", params![id])?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn insertar_archivo(&self, tipo: &str, nombre: &str, ruta: &str, tamano: i64, mime: &str) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("INSERT INTO archivos (tipo, nombre_original, ruta_archivo, tamano, mime_type) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![tipo, nombre, ruta, tamano, mime])?;
        Ok(())
    }
    pub fn listar_archivos(&self) -> Result<Vec<ArchivoResponse>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT id, tipo, nombre_original, ruta_archivo, tamano, mime_type FROM archivos ORDER BY id DESC")?;
        let items = stmt
            .query_map([], |row| {
                Ok(ArchivoResponse {
                    id: row.get(0)?,
                    tipo: row.get(1)?,
                    nombre_original: row.get(2)?,
                    ruta_archivo: row.get(3)?,
                    tamano: row.get(4)?,
                    mime_type: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    // ── búsqueda full-text ──────────────────────────────────────────

    pub fn run_search_migrations(&self) -> Result<(), DbError> {
        let sql = include_str!("../migrations/004_search.sql");
        self.conn()?.execute_batch(sql)?;
        tracing::info!("Índices FTS5 creados");
        Ok(())
    }

    /// Re-indexa contenido existente en los índices FTS5
    pub fn reindex_search(&self) -> Result<(), DbError> {
        let conn = self.conn()?;
        conn.execute("INSERT INTO cursos_fts(cursos_fts) VALUES('rebuild')", [])?;
        conn.execute("INSERT INTO videos_fts(videos_fts) VALUES('rebuild')", [])?;
        conn.execute("INSERT INTO biblioteca_fts(biblioteca_fts) VALUES('rebuild')", [])?;
        conn.execute("INSERT INTO diccionario_fts(diccionario_fts) VALUES('rebuild')", [])?;
        tracing::info!("Índices FTS5 reconstruidos (cursos, videos, biblioteca, diccionario)");
        Ok(())
    }

    /// Búsqueda full-text en cursos, videos y biblioteca.
    /// Retorna resultados combinados ordenados por relevancia.
    pub fn buscar(&self, query: &str, limite: i64) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn()?;
        let mut resultados = Vec::new();

        // Buscar en cursos
        if let Ok(mut stmt) = conn.prepare(
            "SELECT c.id, c.titulo, c.descripcion, c.categoria, rank
             FROM cursos_fts f
             JOIN cursos c ON c.id = f.rowid
             WHERE cursos_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        ) {
            if let Ok(rows) = stmt.query_map(params![query, limite], |row| {
                Ok(SearchResult {
                    tipo: "curso".into(),
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get(2)?,
                    categoria: row.get(3)?,
                    rango: Some(row.get::<_, f64>(4).unwrap_or(0.0) as i64),
                    archivo_path: None,
                })
            }) {
                for r in rows.flatten() {
                    resultados.push(r);
                }
            }
        }

        // Buscar en videos
        if let Ok(mut stmt) = conn.prepare(
            "SELECT v.id, v.titulo, v.categoria, v.canal, rank
             FROM videos_fts f
             JOIN videos v ON v.id = f.rowid
             WHERE videos_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        ) {
            if let Ok(rows) = stmt.query_map(params![query, limite], |row| {
                Ok(SearchResult {
                    tipo: "video".into(),
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get::<_, String>(3).unwrap_or_default(),
                    categoria: row.get(2)?,
                    rango: Some(row.get::<_, f64>(4).unwrap_or(0.0) as i64),
                    archivo_path: None,
                })
            }) {
                for r in rows.flatten() {
                    resultados.push(r);
                }
            }
        }

        // Buscar en biblioteca
        if let Ok(mut stmt) = conn.prepare(
            "SELECT b.id, b.titulo, b.descripcion, b.categoria, b.archivo_path, rank
             FROM biblioteca_fts f
             JOIN biblioteca b ON b.id = f.rowid
             WHERE biblioteca_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        ) {
            if let Ok(rows) = stmt.query_map(params![query, limite], |row| {
                Ok(SearchResult {
                    tipo: "libro".into(),
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get(2)?,
                    categoria: row.get(3)?,
                    rango: Some(row.get::<_, f64>(5).unwrap_or(0.0) as i64),
                    archivo_path: Some(row.get(4)?),
                })
            }) {
                for r in rows.flatten() {
                    resultados.push(r);
                }
            }
        }

        // Ordenar por relevancia (menor rank = más relevante en FTS5)
        resultados.sort_by_key(|a| a.rango);
        resultados.truncate(limite as usize);

        Ok(resultados)
    }

    // ── biblioteca ────────────────────────────────────────────────────

    /// Búsqueda full-text exclusiva en la biblioteca digital.
    #[allow(dead_code)]
    pub fn buscar_en_biblioteca(&self, query: &str, limite: i64) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn()?;
        let mut resultados = Vec::new();

        let mut stmt = conn.prepare(
            "SELECT b.id, b.titulo, b.descripcion, b.categoria, b.archivo_path, rank
             FROM biblioteca_fts f
             JOIN biblioteca b ON b.id = f.rowid
             WHERE biblioteca_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![query, limite], |row| {
            Ok(SearchResult {
                tipo: "libro".into(),
                id: row.get(0)?,
                titulo: row.get(1)?,
                descripcion: row.get(2)?,
                categoria: row.get(3)?,
                rango: Some(row.get::<_, f64>(5).unwrap_or(0.0) as i64),
                archivo_path: Some(row.get(4)?),
            })
        })?;

        for r in rows {
            resultados.push(r?);
        }

        Ok(resultados)
    }

    pub fn listar_biblioteca(&self) -> Result<Vec<SearchResult>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, titulo, descripcion, categoria, archivo_path FROM biblioteca ORDER BY id DESC"
        )?;
        let items = stmt
            .query_map([], |row| {
                Ok(SearchResult {
                    tipo: "libro".into(),
                    id: row.get(0)?,
                    titulo: row.get(1)?,
                    descripcion: row.get(2)?,
                    categoria: row.get(3)?,
                    rango: None,
                    archivo_path: Some(row.get(4)?),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    // ── diccionario ──────────────────────────────────────────────────

    pub fn buscar_en_diccionario(&self, query: &str, limite: i64) -> Result<Vec<serde_json::Value>, DbError> {
        let conn = self.conn()?;
        let exacta = conn.query_row(
            "SELECT id, palabra, definicion, tipo, categoria, sinonimos, antonimos, relacionadas
             FROM diccionario WHERE palabra = ?1 LIMIT 1",
            params![query],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "palabra": row.get::<_, String>(1)?,
                    "definicion": row.get::<_, String>(2)?,
                    "tipo": row.get::<_, String>(3)?,
                    "categoria": row.get::<_, String>(4)?,
                    "sinonimos": row.get::<_, String>(5)?,
                    "antonimos": row.get::<_, String>(6)?,
                    "relacionadas": row.get::<_, String>(7)?,
                    "coincidencia": "exacta",
                }))
            },
        );
        if let Ok(entry) = exacta { return Ok(vec![entry]); }
        let fts_query = format!("\"{}\" OR {}*", query.replace('"', ""), query.replace('"', ""));
        let mut stmt = conn.prepare(
            "SELECT d.id, d.palabra, d.definicion, d.tipo, d.categoria,
                    d.sinonimos, d.antonimos, d.relacionadas, rank
             FROM diccionario_fts f JOIN diccionario d ON d.id = f.rowid
             WHERE diccionario_fts MATCH ?1 ORDER BY rank LIMIT ?2",
        )?;
        let results = stmt.query_map(params![fts_query, limite], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "palabra": row.get::<_, String>(1)?,
                "definicion": row.get::<_, String>(2)?,
                "tipo": row.get::<_, String>(3)?,
                "categoria": row.get::<_, String>(4)?,
                "sinonimos": row.get::<_, String>(5)?,
                "antonimos": row.get::<_, String>(6)?,
                "relacionadas": row.get::<_, String>(7)?,
                "coincidencia": "fts",
            }))
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    }

    pub fn sugerir_palabras(&self, prefijo: &str, limite: i64) -> Result<Vec<serde_json::Value>, DbError> {
        let conn = self.conn()?;
        let pattern = format!("{}%", prefijo);
        let mut stmt = conn.prepare(
            "SELECT DISTINCT palabra FROM diccionario WHERE palabra LIKE ?1 ORDER BY palabra LIMIT ?2",
        )?;
        let results = stmt.query_map(params![pattern, limite], |row| {
            Ok(serde_json::json!({"palabra": row.get::<_, String>(0)?}))
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    }

    pub fn palabra_del_dia(&self) -> Result<serde_json::Value, DbError> {
        let conn = self.conn()?;
        let entry = conn.query_row(
            "SELECT id, palabra, definicion, tipo, categoria, sinonimos, antonimos, relacionadas
             FROM diccionario WHERE categoria = 'general' AND definicion != ''
             ORDER BY RANDOM() LIMIT 1",
            [],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "palabra": row.get::<_, String>(1)?,
                    "definicion": row.get::<_, String>(2)?,
                    "tipo": row.get::<_, String>(3)?,
                    "categoria": row.get::<_, String>(4)?,
                    "sinonimos": row.get::<_, String>(5)?,
                    "antonimos": row.get::<_, String>(6)?,
                    "relacionadas": row.get::<_, String>(7)?,
                }))
            },
        )?;
        Ok(entry)
    }

    // ── profesor ──────────────────────────────────────────────────

    pub fn listar_estudiantes(&self) -> Result<Vec<serde_json::Value>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT p.usuario, COUNT(p.curso_id) as cursos_iniciados,
                    ROUND(AVG(p.porcentaje), 1) as promedio,
                    MAX(p.ultima_vez) as ultima_actividad
             FROM progreso p GROUP BY p.usuario ORDER BY ultima_actividad DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "usuario": row.get::<_, String>(0)?,
                "cursos_iniciados": row.get::<_, i64>(1)?,
                "promedio": row.get::<_, f64>(2)?,
                "ultima_actividad": row.get::<_, String>(3)?,
            }))
        })?;
        let mut results = Vec::new();
        for r in rows { results.push(r?); }
        Ok(results)
    }

    pub fn progreso_completo(&self) -> Result<Vec<serde_json::Value>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT p.id, p.usuario, p.curso_id, c.titulo, c.categoria,
                    p.porcentaje, p.ultima_vez
             FROM progreso p JOIN cursos c ON c.id = p.curso_id
             ORDER BY p.ultima_vez DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?, "usuario": row.get::<_, String>(1)?,
                "curso_id": row.get::<_, i64>(2)?, "curso_titulo": row.get::<_, String>(3)?,
                "curso_categoria": row.get::<_, String>(4)?,
                "porcentaje": row.get::<_, f64>(5)?, "ultima_vez": row.get::<_, String>(6)?,
            }))
        })?;
        let mut results = Vec::new();
        for r in rows { results.push(r?); }
        Ok(results)
    }

    pub fn progreso_estudiante(&self, usuario: &str) -> Result<Vec<serde_json::Value>, DbError> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT p.id, p.usuario, p.curso_id, c.titulo, c.categoria,
                    p.porcentaje, p.ultima_vez
             FROM progreso p JOIN cursos c ON c.id = p.curso_id
             WHERE p.usuario = ?1 ORDER BY p.porcentaje DESC"
        )?;
        let rows = stmt.query_map(params![usuario], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?, "usuario": row.get::<_, String>(1)?,
                "curso_id": row.get::<_, i64>(2)?, "curso_titulo": row.get::<_, String>(3)?,
                "curso_categoria": row.get::<_, String>(4)?,
                "porcentaje": row.get::<_, f64>(5)?, "ultima_vez": row.get::<_, String>(6)?,
            }))
        })?;
        let mut results = Vec::new();
        for r in rows { results.push(r?); }
        Ok(results)
    }
    pub fn exportar_csv(&self) -> Result<String, DbError> {
        let data = self.progreso_completo()?;
        let mut csv = String::from("usuario,curso,porcentaje,ultima_vez\n");
        for row in &data {
            csv.push_str(&format!("{},{},{},{}\n",
                escape_csv(row["usuario"].as_str().unwrap_or("")),
                escape_csv(row["curso_titulo"].as_str().unwrap_or("")),
                row["porcentaje"].as_f64().unwrap_or(0.0),
                escape_csv(row["ultima_vez"].as_str().unwrap_or("")),
            ));
        }
        Ok(csv)
    }

    pub fn estadisticas_docente(&self) -> Result<serde_json::Value, DbError> {
        let conn = self.conn()?;
        let total_estudiantes: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT usuario) FROM progreso", [], |r| r.get(0)
        ).unwrap_or(0);
        let total_progresos: i64 = conn.query_row(
            "SELECT COUNT(*) FROM progreso", [], |r| r.get(0)
        ).unwrap_or(0);
        let promedio_general: f64 = conn.query_row(
            "SELECT COALESCE(ROUND(AVG(porcentaje), 1), 0.0) FROM progreso", [], |r| r.get(0)
        ).unwrap_or(0.0);
        let cursos_activos: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT curso_id) FROM progreso WHERE porcentaje < 100", [], |r| r.get(0)
        ).unwrap_or(0);
        let cursos_completados: i64 = conn.query_row(
            "SELECT COUNT(*) FROM progreso WHERE porcentaje >= 100", [], |r| r.get(0)
        ).unwrap_or(0);
        let mut stmt = conn.prepare(
            "SELECT c.titulo, COUNT(DISTINCT p.usuario), ROUND(AVG(p.porcentaje), 1)
             FROM progreso p JOIN cursos c ON c.id = p.curso_id
             GROUP BY p.curso_id ORDER BY COUNT(DISTINCT p.usuario) DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({"curso": row.get::<_, String>(0)?,
                "estudiantes": row.get::<_, i64>(1)?, "promedio": row.get::<_, f64>(2)?}))
        })?;
        let mut por_curso = Vec::new();
        for r in rows { por_curso.push(r?); }
        Ok(serde_json::json!({
            "total_estudiantes": total_estudiantes, "total_progresos": total_progresos,
            "promedio_general": promedio_general, "cursos_activos": cursos_activos,
            "cursos_completados": cursos_completados, "por_curso": por_curso,
        }))
    }
}

/// Escapa un campo CSV: si contiene `,`, `"` o `\n`, lo envuelve en comillas
/// y escapa las comillas internas. Previene CSV injection (campos que empiezan
/// con `=`, `+`, `-`, `@` los spreadsheet los interpretan como fórmulas).
fn escape_csv(s: &str) -> String {
    let needs_quotes = s.contains(',') || s.contains('"') || s.contains('\n');
    if needs_quotes {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_error_enum() {
        let e = DbError::NoEncontrado("test".into());
        assert_eq!(format!("{}", e), "test");

        let e = DbError::Validacion("bad".into());
        assert_eq!(format!("{}", e), "bad");

        let e = DbError::Sqlite(rusqlite::Error::InvalidParameterName("x".into()));
        assert!(format!("{}", e).contains("Error de base de datos"));
    }

    #[test]
    fn test_search_result_serialize() {
        let sr = SearchResult {
            tipo: "curso".into(),
            id: 1,
            titulo: "Test".into(),
            descripcion: "Desc".into(),
            categoria: "matematica".into(),
            rango: Some(42),
            archivo_path: None,
        };
        let json = serde_json::to_string(&sr).unwrap();
        assert!(json.contains("\"tipo\":\"curso\""));
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"titulo\":\"Test\""));
        assert!(!json.contains("archivo_path"));
    }

    #[test]
    fn test_search_result_with_archivo() {
        let sr = SearchResult {
            tipo: "libro".into(),
            id: 2,
            titulo: "Libro".into(),
            descripcion: "Desc".into(),
            categoria: "lectura".into(),
            rango: None,
            archivo_path: Some("/ruta/libro.pdf".into()),
        };
        let json = serde_json::to_string(&sr).unwrap();
        assert!(json.contains("\"archivo_path\":\"/ruta/libro.pdf\""));
    }
}
