# Contratos educativos — reglas de coordinación y modelo en discusión

- **S1–S5:** **aprobadas** como reglas de coordinación.
- **E1–E12:** **aceptadas como base de discusión, NO como esquema congelado.** Ninguna se implementa
  como esquema definitivo sin el acuerdo de la revisión conjunta.
- **Nada de este documento está implementado.** No hay una sola migración en el repositorio que cree
  `usuarios`, `colecciones`, `membresias`, `asignaciones`, `intentos` ni `resultados`.

---

## Parte 1 — Reglas de coordinación (aprobadas)

| ID | Regla | Por qué |
|---|---|---|
| **S1** | Cada desarrollador declara su superficie en `docs/equipo/onboarding/<nombre>.md` **antes** de tocar código de producto, y la mantiene al día. | La incorporación no puede depender de conversaciones no versionadas. |
| **S2** | Cada unidad declara su reserva en `odd/tasks/<ID>.md` **antes** de implementar. | La reserva es cooperativa, no un bloqueo del sistema de archivos. |
| **S3** | `src/models.rs` y **toda** migración requieren revisión de los tres. | Es donde tres personas rompen compatibilidad sin darse cuenta. |
| **S4** | Un contrato nuevo se **presenta antes de implementar**, con forma, códigos cerrados y pruebas de aceptación. | Es el patrón que funcionó en `pi-011` y en D-05d. |
| **S5** | Nadie toca el árbol de trabajo de otro, ni hace `reset --hard`, `clean` o `stash` sobre trabajo ajeno. | Un `clean` ajeno borra horas irrecuperables. |

`S3` tiene una consecuencia práctica que conviene decir en voz alta: **tres personas no pueden iterar
un mismo esquema en paralelo.** Por eso E1–E12 se acuerdan una vez y después se implementan por
unidades separadas.

---

## Parte 2 — Modelo educativo propuesto (en discusión)

Base: `evidencias/RD-02A/MODELO-DOMINIO.md` y `PROPUESTA-ESQUEMA.md`. Se reproduce aquí para que no
haga falta salir del repositorio.

| ID | Regla propuesta | Razón | Estado de discusión |
|---|---|---|---|
| **E1** | **Una sola tabla `usuarios`**; `estudiante`, `docente` y `admin` son **roles**, no tres tablas | Evita triple identidad y triples credenciales | Aceptada como dirección |
| **E2** | `usuarios.id` **opaco**; el esquema **no impone** versión de UUID | Resuelve el choque con `contratos-integracion.md:54`, que manda UUIDv7 | **En conflicto abierto** — ver §3.2 |
| **E3** | Aula y grupo en **`colecciones`** con `tipo='aula'\|'grupo'` y `padre_id` | Una sola estructura de agrupamiento | **Necesita decisión de jerarquía** — ver §3.3 |
| **E4** | **`membresias`** única por `(usuario_id, coleccion_id)` | Hoy la nómina se infiere de `progreso` y es falsa | Aceptada como dirección |
| **E5** | **`asignaciones`** apuntan a **exactamente un** destino: una colección **o** un usuario | Prohíbe la ambigüedad «asignado al aula y también a Juan» | **A revisar contra el flujo real** — ver §3.4 |
| **E6** | **`progreso`** = estado **actual**, único por `(usuario_id, contenido_id)`, 0..100, **monotónico** | Nunca retrocede; el histórico va en intentos | **Decisión pedagógica pendiente** — §3.5 |
| **E7** | **`intentos`** **inmutables** tras el envío, con `clave_idempotencia`, único por `(actividad, usuario, numero)` | Es el ledger que hoy no existe | Aceptada; falta concurrencia — §3.6 |
| **E8** | **`resultados`** es **vista derivada**, nunca tabla escrita | Un solo lugar calcula | Aceptada como dirección |
| **E9** | Compatibilidad aditiva: `cursos`, `progreso`, `admin_usuarios`, `quizzes` **sobreviven** | Nadie rompe lo que hoy funciona | Aceptada |
| **E10** | **Sin RLS**: el filtro por institución/nodo va en la capa de consulta | SQLite no tiene RLS; fingirlo es la fuga entre estudiantes | Aceptada, con la carga que implica — §3.7 |
| **E11** | Rol **revalidado en BD** en cada petición autorizada, no confiado del JWT | «rol sólo en JWT → escalada» | Aceptada; falta el cómo — §3.7 |
| **E12** | **Sincronización no se implementa** en esta etapa | Invariantes §8 sin cerrar; `P3` bloqueado | Aceptada |

### Por qué `E2`, `E5`, `E6`, `E10` y `E11` no están cerradas

No es burocracia: cada una cambia el esquema que las otras necesitan.

---

## Parte 3 — Las ocho decisiones que deben tomarse **antes** de implementar

### 3.1 Identidad única y roles contextualizados

`E1` dice una tabla. Falta decidir:

- ¿Un usuario puede ser docente en un aula y estudiante en otra? Si sí, el rol **no** es un atributo del
  usuario: es un atributo de la **membresía**. Eso cambia `E1` y `E4`.
- ¿El login de estudiante existe en el nodo (offline) o se difiere? Si existe, ¿cómo se verifica sin red
  ni reloj fiable?
- ¿Qué pasa con los tokens actuales? Extender los claims a `{sub, rol, nodo}` **invalida todos**
  (`docs/contratos-integracion.md:101-113`): hay que decidir la ventana y la comunicación.

**Bloquea:** todo lo demás. **Decide:** humano + DEV1 (propone) + los tres.

### 3.2 Identificadores opacos, sin imponer versión UUID

**Conflicto real y escrito:** `docs/contratos-integracion.md:54` (`I1`) manda «**UUIDv7 en texto**»;
`MODELO-DOMINIO.md` dice id **opaco** y «el esquema **no** impone versión».

Las dos son defendibles: UUIDv7 es ordenable por tiempo y se genera sin coordinación; el id opaco
permite migrar de esquema sin reescribir claves. Pero **no pueden convivir sin decidir**, porque `I1`
es un contrato que ya está escrito.

**Decisión mínima:** o se relaja `I1` a «opaco, con UUIDv7 como recomendación», o se mantiene y el
esquema lo impone. **No se puede dejar «opaco» en el modelo y «UUIDv7» en el contrato.**

### 3.3 Restricciones de jerarquía de aulas y grupos

`E3` deja aula y grupo en la misma tabla con `padre_id`. Falta:

- ¿El aula **contiene** grupos, o son dos ejes independientes?
- ¿Un estudiante puede estar en dos aulas a la vez? ¿Y en dos grupos del mismo aula?
- ¿Profundidad máxima? Sin límite, `padre_id` permite ciclos y el árbol se corrompe.
- ¿Qué pasa al borrar un aula con grupos y membresías?

**Sin esta decisión, `padre_id` es un campo que permite datos inválidos.**

### 3.4 Separación de progreso, rendimiento e intentos

`E6`/`E7`/`E8` separan tres cosas. Falta validar que el modelo cubra los flujos reales:

- «Tarea para 4.º A **excepto** estos tres»: `E5` (un solo destino) **no lo cubre**. O se permite
  exclusión explícita, o se crea un grupo ad-hoc, o se acepta que se asigna alumno por alumno. **Tres
  decisiones distintas con costes distintos.**
- «Repetir un quiz para subir nota»: ¿el progreso sube (`E6` monotónico) aunque el intento nuevo sea
  peor? ¿Y si el docente quiere que baje?
- «Nota del período»: ¿es un `resultado` derivado, una agregación de intentos, o un campo que el
  docente escribe? Si es lo tercero, `E8` no alcanza.

**Esta es la decisión de DEV2.** Es pedagógica antes que técnica, y equivocarse aquí cuesta una
migración de datos con alumnos reales.

### 3.5 Idempotencia y concurrencia de intentos

`E7` exige `clave_idempotencia` y unicidad por `(actividad, usuario, numero)`. Falta:

- ¿La clave la genera el **cliente** o el **servidor**? Si el cliente está offline, la genera él; hay
  que fijar formato y longitud.
- **Dos dispositivos del mismo alumno** enviando el mismo intento: ¿gana el primero, el último, o se
  rechaza el segundo con conflicto?
- ¿Qué es `numero`? ¿Secuencia por actividad o por alumno? Determina el índice único y el
  comportamiento en reconexión.
- Si el envío se reintenta tras un corte, ¿el servidor distingue reintento de intento nuevo?

**Sin esto, `intentos` acepta duplicados y el reporte del docente cuenta doble.**

### 3.6 Autorización por institución, nodo y membresía

`E10` y `E11` aceptadas; falta el diseño:

- ¿Qué se comprueba por petición: membresía, rol, institución, o las tres? ¿Con qué coste?
- Sin RLS, **cada consulta** debe filtrar. ¿Quién garantiza que ninguna se olvide? Propuesta: una capa
  única de acceso que reciba el contexto y no permita consultar sin él. Eso es más que una convención.
- ¿Un docente ve el progreso de alumnos de otra aula? ¿Y el de su institución?
- `E11` dice rol revalidado en BD **en cada petición**: ¿se cachea por request, por sesión, o nada?

### 3.7 Migración segura de las rutas públicas heredadas

Hoy `POST /api/progreso` y `GET /api/progreso/{usuario}` son **públicos** y escriben por nombre libre.
Pasar a identidad real rompe a **todo cliente que ya funciona**, incluidos los módulos estáticos que
escriben en `localStorage` y el dashboard vanilla.

Falta decidir:

- ¿Periodo de convivencia con las rutas viejas, o corte? Si hay convivencia, ¿cómo se evita que un
  cliente viejo escriba datos huérfanos?
- ¿Qué se hace con las filas de `progreso` cuyo `usuario` es un nombre libre? ¿Se mapean a usuarios
  reales, se archivan, se descartan? **Los datos de alumnos reales no se descartan sin decisión.**
- ¿Cuándo se retiran las rutas públicas? Una ruta pública que escribe datos de menores es un problema
  de privacidad, no sólo de modelo.

### 3.8 Sin sincronización todavía

`E12` cierra la puerta. Consecuencia práctica: **nada en el esquema puede asumir que dos nodos
convergen.** Nada de `updated_at` mágicos, lápidas ni resolución de conflictos «por si acaso». Cuando
llegue, se diseña; adelantarlo hoy sólo añade campos que nadie usa y que habrá que migrar.

---

## Parte 4 — Gates: qué bloquea qué

| Gate | Contenido | Responsable | Bloquea |
|---|---|---|---|
| **G0** | Aprobación arquitectónica de `MODELO-DOMINIO`, `IDENTIDAD-Y-PERMISOS`, `PROPUESTA-ESQUEMA` | Humano + DEV3 + DEV2 | Todo el esquema |
| **G1** | **D-04 estable: ledger de migraciones** y orden garantizado | DEV3 | **Toda** migración |
| **G2** | Contrato de identidad: formato de ID, `nodo`, JWT v2, rol en token o en BD | Humano + los tres | `usuarios`, `membresias`, login |
| **G3** | Contrato de contenido: licencia, hash, versión, mapeo del legado | Humano + DEV2 | `contenido`, `asignaciones` |

> **Ninguna unidad de esquema debe empezar sin G0 y G1.**

`G1` es el que más se subestima: hoy las migraciones se re-ejecutan en cada arranque sin registro. Una
migración nueva sobre ese mecanismo no es reproducible, y con tres desarrolladores escribiendo
migraciones en paralelo el orden importa.

---

## Parte 5 — Compatibilidad con lo que ya existe

`E9` promete que nada se rompe. En concreto:

| Superficie | Compromiso |
|---|---|
| `cursos` | se queda como está |
| `progreso` | se queda; se le agrega `usuario_id` de forma aditiva y se decide qué pasa con `usuario` texto (§3.7) |
| `admin_usuarios` | se queda mientras exista el login de admin; no se convierte en `usuarios` de golpe |
| `quizzes` | se queda; `propietario` (texto) se mapea cuando exista `usuarios` |
| Contrato HTTP `{"error": …}` | se mantiene |
| `/api/capacidades` | **no cambia** por nada de esto (D-05d es ortogonal) |

**Regla de oro:** ningún cambio de esquema en esta fase puede exigir tocar el frontend en la misma
unidad. Si lo exige, la unidad está mal cortada.
