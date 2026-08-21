use crate::db::{Database, DbError};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

const TIPOS: &[&str] = &["choice", "truefalse", "multi", "order", "numeric", "fill"];
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreguntaQuiz {
    #[serde(rename = "type")]
    pub tipo: String,
    pub text: String,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default)]
    pub items: Vec<String>,
    #[serde(default)]
    pub answer: serde_json::Value,
    #[serde(default)]
    pub answers: Vec<usize>,
    #[serde(default = "tiempo_default")]
    pub time: u32,
    #[serde(default)]
    pub accepted: Vec<String>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub tol: Option<f64>,
}
fn tiempo_default() -> u32 {
    20
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuizPayload {
    pub titulo: String,
    #[serde(default)]
    pub descripcion: String,
    #[serde(default = "tema_default")]
    pub tema: String,
    pub preguntas: Vec<PreguntaQuiz>,
}
fn tema_default() -> String {
    "General".into()
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quiz {
    pub id: i64,
    pub titulo: String,
    pub descripcion: String,
    pub tema: String,
    pub preguntas: Vec<PreguntaQuiz>,
    pub propietario: String,
    pub creado_en: String,
    pub actualizado_en: String,
}
#[derive(Debug, Clone, Serialize)]
pub struct QuizResumen {
    pub id: i64,
    pub titulo: String,
    pub descripcion: String,
    pub tema: String,
    pub total_preguntas: usize,
    pub actualizado_en: String,
}

pub fn validar(p: &QuizPayload) -> Result<(), DbError> {
    if p.titulo.trim().is_empty() || p.titulo.chars().count() > 160 {
        return Err(DbError::Validacion(
            "El título debe tener entre 1 y 160 caracteres".into(),
        ));
    }
    if p.preguntas.is_empty() || p.preguntas.len() > 100 {
        return Err(DbError::Validacion(
            "Debe contener entre 1 y 100 preguntas".into(),
        ));
    }
    if p.tema.trim().is_empty() || p.tema.chars().count() > 80 {
        return Err(DbError::Validacion(
            "El tema debe tener entre 1 y 80 caracteres".into(),
        ));
    }
    if p.descripcion.chars().count() > 500 {
        return Err(DbError::Validacion(
            "La descripción no puede superar 500 caracteres".into(),
        ));
    }
    for (i, q) in p.preguntas.iter().enumerate() {
        if !TIPOS.contains(&q.tipo.as_str()) {
            return Err(DbError::Validacion(format!(
                "Tipo inválido en la pregunta {}",
                i + 1
            )));
        }
        if q.text.trim().is_empty() || q.text.chars().count() > 500 {
            return Err(DbError::Validacion(format!(
                "Texto inválido en la pregunta {}",
                i + 1
            )));
        }
        if !(5..=300).contains(&q.time) {
            return Err(DbError::Validacion(format!(
                "Tiempo fuera de rango en la pregunta {}",
                i + 1
            )));
        }
        if matches!(q.tipo.as_str(), "choice" | "truefalse" | "multi") && q.options.len() < 2 {
            return Err(DbError::Validacion(format!(
                "Faltan opciones en la pregunta {}",
                i + 1
            )));
        }
        if matches!(q.tipo.as_str(), "choice" | "truefalse" | "multi") {
            validar_textos(&q.options, i, "opciones")?;
        }
        if q.tipo == "truefalse"
            && (q.options.len() != 2
                || q.options[0] != "Verdadero"
                || q.options[1] != "Falso"
                || indice_respuesta(q).map_or(true, |a| a > 1))
        {
            return Err(DbError::Validacion(format!(
                "Verdadero/Falso inválido en la pregunta {}",
                i + 1
            )));
        }
        if q.tipo == "choice" && indice_respuesta(q).map_or(true, |a| a >= q.options.len()) {
            return Err(DbError::Validacion(format!(
                "Respuesta correcta inválida en la pregunta {}",
                i + 1
            )));
        }
        if q.tipo == "multi"
            && (q.answers.is_empty()
                || q.answers.iter().any(|a| *a >= q.options.len())
                || tiene_duplicados_indices(&q.answers))
        {
            return Err(DbError::Validacion(format!(
                "Selecciona una o más respuestas correctas válidas en la pregunta {}",
                i + 1
            )));
        }
        if q.tipo == "order" && q.items.len() < 2 {
            return Err(DbError::Validacion(format!(
                "Faltan elementos para ordenar en la pregunta {}",
                i + 1
            )));
        }
        if q.tipo == "order" {
            validar_textos(&q.items, i, "elementos")?;
        }
        if q.tipo == "fill" {
            let answer = q.answer.as_str().unwrap_or("").trim();
            if answer.is_empty() {
                return Err(DbError::Validacion(format!(
                    "Falta la respuesta en la pregunta {}",
                    i + 1
                )));
            }
            if q.accepted.iter().any(|v| v.trim().is_empty()) {
                return Err(DbError::Validacion(format!(
                    "Hay respuestas alternativas vacías en la pregunta {}",
                    i + 1
                )));
            }
        }
        if q.tipo == "numeric" {
            let answer = q.answer.as_f64();
            let (Some(answer), Some(min), Some(max)) = (answer, q.min, q.max) else {
                return Err(DbError::Validacion(format!(
                    "Configuración numérica incompleta en la pregunta {}",
                    i + 1
                )));
            };
            let tol = q.tol.unwrap_or(0.0);
            if !answer.is_finite() || !min.is_finite() || !max.is_finite() || !tol.is_finite()
                || min > max || answer < min || answer > max || tol < 0.0
            {
                return Err(DbError::Validacion(format!(
                    "Rango, respuesta o tolerancia inválidos en la pregunta {}",
                    i + 1
                )));
            }
        }
    }
    Ok(())
}

fn indice_respuesta(q: &PreguntaQuiz) -> Option<usize> {
    q.answer.as_u64().and_then(|v| usize::try_from(v).ok())
}

fn validar_textos(items: &[String], pregunta: usize, nombre: &str) -> Result<(), DbError> {
    if items.iter().any(|v| v.trim().is_empty() || v.chars().count() > 200) {
        return Err(DbError::Validacion(format!(
            "Hay {nombre} vacíos o demasiado largos en la pregunta {}",
            pregunta + 1
        )));
    }
    let normalizados: std::collections::HashSet<String> =
        items.iter().map(|v| v.trim().to_lowercase()).collect();
    if normalizados.len() != items.len() {
        return Err(DbError::Validacion(format!(
            "Hay {nombre} repetidos en la pregunta {}",
            pregunta + 1
        )));
    }
    Ok(())
}

fn tiene_duplicados_indices(items: &[usize]) -> bool {
    let unicos: std::collections::HashSet<usize> = items.iter().copied().collect();
    unicos.len() != items.len()
}
fn map_quiz(r: &rusqlite::Row<'_>) -> rusqlite::Result<Quiz> {
    let raw: String = r.get(4)?;
    let preguntas = serde_json::from_str(&raw).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(Quiz {
        id: r.get(0)?,
        titulo: r.get(1)?,
        descripcion: r.get(2)?,
        tema: r.get(3)?,
        preguntas,
        propietario: r.get(5)?,
        creado_en: r.get(6)?,
        actualizado_en: r.get(7)?,
    })
}
impl Database {
    pub fn listar_quizzes(&self, owner: &str) -> Result<Vec<QuizResumen>, DbError> {
        let c = self.conn()?;
        let mut s = c.prepare("SELECT id,titulo,descripcion,tema,preguntas,actualizado_en FROM quizzes WHERE propietario=?1 ORDER BY actualizado_en DESC,id DESC")?;
        let rows = s.query_map([owner], |r| {
            let raw: String = r.get(4)?;
            let n = serde_json::from_str::<Vec<serde_json::Value>>(&raw)
                .map(|v| v.len())
                .unwrap_or(0);
            Ok(QuizResumen {
                id: r.get(0)?,
                titulo: r.get(1)?,
                descripcion: r.get(2)?,
                tema: r.get(3)?,
                total_preguntas: n,
                actualizado_en: r.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
    pub fn obtener_quiz(&self, id: i64, owner: &str) -> Result<Quiz, DbError> {
        self.conn()?.query_row("SELECT id,titulo,descripcion,tema,preguntas,propietario,creado_en,actualizado_en FROM quizzes WHERE id=?1 AND propietario=?2",params![id,owner],map_quiz).optional()?.ok_or_else(||DbError::NoEncontrado("Cuestionario no encontrado".into()))
    }
    pub fn crear_quiz(&self, owner: &str, p: &QuizPayload) -> Result<Quiz, DbError> {
        validar(p)?;
        let raw =
            serde_json::to_string(&p.preguntas).map_err(|e| DbError::Validacion(e.to_string()))?;
        let c = self.conn()?;
        c.execute("INSERT INTO quizzes(titulo,descripcion,tema,preguntas,propietario) VALUES(?1,?2,?3,?4,?5)",params![p.titulo.trim(),p.descripcion.trim(),p.tema.trim(),raw,owner])?;
        self.obtener_quiz(c.last_insert_rowid(), owner)
    }
    pub fn actualizar_quiz(&self, id: i64, owner: &str, p: &QuizPayload) -> Result<Quiz, DbError> {
        validar(p)?;
        let raw =
            serde_json::to_string(&p.preguntas).map_err(|e| DbError::Validacion(e.to_string()))?;
        let n=self.conn()?.execute("UPDATE quizzes SET titulo=?1,descripcion=?2,tema=?3,preguntas=?4,actualizado_en=CURRENT_TIMESTAMP WHERE id=?5 AND propietario=?6",params![p.titulo.trim(),p.descripcion.trim(),p.tema.trim(),raw,id,owner])?;
        if n == 0 {
            return Err(DbError::NoEncontrado("Cuestionario no encontrado".into()));
        }
        self.obtener_quiz(id, owner)
    }
    pub fn eliminar_quiz(&self, id: i64, owner: &str) -> Result<(), DbError> {
        let n = self.conn()?.execute(
            "DELETE FROM quizzes WHERE id=?1 AND propietario=?2",
            params![id, owner],
        )?;
        if n == 0 {
            Err(DbError::NoEncontrado("Cuestionario no encontrado".into()))
        } else {
            Ok(())
        }
    }
    pub fn duplicar_quiz(&self, id: i64, owner: &str) -> Result<Quiz, DbError> {
        let q = self.obtener_quiz(id, owner)?;
        self.crear_quiz(
            owner,
            &QuizPayload {
                titulo: format!("{} (copia)", q.titulo),
                descripcion: q.descripcion,
                tema: q.tema,
                preguntas: q.preguntas,
            },
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn q(t: &str) -> PreguntaQuiz {
        let mut pregunta = PreguntaQuiz {
            tipo: t.into(),
            text: "Pregunta".into(),
            options: vec!["A".into(), "B".into()],
            items: vec!["A".into(), "B".into()],
            answer: serde_json::json!(0),
            answers: vec![],
            time: 20,
            accepted: vec![],
            min: None,
            max: None,
            tol: None,
        };
        match t {
            "truefalse" => pregunta.options = vec!["Verdadero".into(), "Falso".into()],
            "multi" => pregunta.answers = vec![0],
            "fill" => pregunta.answer = serde_json::json!("respuesta"),
            "numeric" => {
                pregunta.answer = serde_json::json!(5);
                pregunta.min = Some(0.0);
                pregunta.max = Some(10.0);
                pregunta.tol = Some(0.0);
            }
            _ => {}
        }
        pregunta
    }
    #[test]
    fn seis_tipos() {
        for t in TIPOS {
            assert!(validar(&QuizPayload {
                titulo: "Quiz".into(),
                descripcion: "".into(),
                tema: "General".into(),
                preguntas: vec![q(t)]
            })
            .is_ok())
        }
    }
    #[test]
    fn tipo_invalido() {
        assert!(validar(&QuizPayload {
            titulo: "Quiz".into(),
            descripcion: "".into(),
            tema: "General".into(),
            preguntas: vec![q("hack")]
        })
        .is_err())
    }

    fn payload(q: PreguntaQuiz) -> QuizPayload {
        QuizPayload {
            titulo: "Quiz".into(),
            descripcion: "".into(),
            tema: "General".into(),
            preguntas: vec![q],
        }
    }

    #[test]
    fn seleccion_multiple_exige_respuesta() {
        let mut pregunta = q("multi");
        pregunta.answers.clear();
        assert!(validar(&payload(pregunta.clone())).is_err());
        pregunta.answers = vec![0, 1];
        assert!(validar(&payload(pregunta)).is_ok());
    }

    #[test]
    fn seleccion_unica_exige_indice_valido() {
        let mut pregunta = q("choice");
        pregunta.answer = serde_json::json!(9);
        assert!(validar(&payload(pregunta)).is_err());
    }

    #[test]
    fn verdadero_falso_es_fijo() {
        let mut pregunta = q("truefalse");
        pregunta.options = vec!["Sí".into(), "No".into()];
        assert!(validar(&payload(pregunta)).is_err());
    }

    #[test]
    fn rechaza_opciones_vacias_o_repetidas() {
        let mut vacia = q("choice");
        vacia.options[1] = " ".into();
        assert!(validar(&payload(vacia)).is_err());
        let mut repetida = q("choice");
        repetida.options = vec!["A".into(), " a ".into()];
        assert!(validar(&payload(repetida)).is_err());
    }

    #[test]
    fn completar_exige_respuesta() {
        let mut pregunta = q("fill");
        pregunta.answer = serde_json::json!("");
        assert!(validar(&payload(pregunta)).is_err());
    }

    #[test]
    fn numerica_valida_rango_y_tolerancia() {
        let mut pregunta = q("numeric");
        pregunta.answer = serde_json::json!(7);
        pregunta.min = Some(1.0);
        pregunta.max = Some(10.0);
        pregunta.tol = Some(0.5);
        assert!(validar(&payload(pregunta.clone())).is_ok());
        pregunta.tol = Some(-1.0);
        assert!(validar(&payload(pregunta)).is_err());
    }
}
