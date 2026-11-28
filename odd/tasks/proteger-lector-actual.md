# Proteger el lector ZIM actual — aislamiento de origen (H3)

Feature ODD. Alcance: cerrar la frontera de origen entre el contenido de terceros (ZIM) y la
aplicación educativa, **sobre el lector integrado que hoy está en producción**, sin esperar a la
migración de RD-02C.

**Estado: DEFECTO CONFIRMADO. T1 cerrada.** La implementación espera autorización, porque toca
`src/main.rs` y el frente de contenido. Evidencia completa en
[`../../docs/equipo/kiwix/h3-aislamiento-origen-evidencia.md`](../../docs/equipo/kiwix/h3-aislamiento-origen-evidencia.md).

**Confirmado con navegador real el 2026-11-27** sobre `2858404`: una página servida desde el propio ZIM
ejecutó JS en el mismo origen, leyó `localStorage["educonect_admin_token"]` —el JWT real de la
instancia— y con él obtuvo `GET /api/profesor/estudiantes` → **200** y `POST /api/profesor/quizzes` →
**201**.

**Es bloqueante de distribución**: mientras no haya aislamiento, montar contenido de terceros en un aula
permite que ese contenido actúe como cualquier docente autenticado de esa instalación.

**Corrección de la evidencia previa:** no existe CSP alguna en el proyecto. El único `sandbox=` está en
el modal de vídeo (`video-modal.tsx:265`), no en la ruta del ZIM. El handler fija una sola cabecera,
`CONTENT_TYPE` (`main.rs:1711 → :1796 → :1831`).

## Specs

- **S1** — «Prioriza el hallazgo H3 de seguridad de origen.»
- **S2** — «Registra una tarea independiente para proteger el lector actual si el defecto se
  confirma, sin esperar la migración completa.»
- **S3** — «No autorices contenido activo de terceros bajo el mismo origen con acceso a credenciales
  educativas.»
- **S4** — «No se autoriza todavía reemplazar el lector integrado.»

## El defecto, en una frase

Las páginas de un ZIM se sirven **bajo el mismo origen** que la aplicación (`/zim/{*path}` en el
mismo puerto que `/api/*`), pueden ejecutar JavaScript, y el CSP actual combina `sandbox` con
`allow-same-origin`, de modo que ese JS quedaría en condiciones de leer la API y el JWT del docente
en `sessionStorage`.

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | **Confirmar el defecto** con un ZIM de prueba que ejecute JS y que intente (a) `fetch('/api/cursos')`, (b) leer `sessionStorage`, (c) leer `document.cookie`. Registrar resultado por cada vector. **Si ningún vector tiene éxito, el defecto no se confirma y esta tarea se cierra como no aplicable** — sin inventar una mitigación para un problema que no existe. | S1, S2 | espacio experimental | **CERRADA — CONFIRMADO** (2026-11-27, Chrome 151 headless por CDP) |
| T2 | Elegir la opción de aislamiento entre las cuatro documentadas en `docs/equipo/kiwix/backlog-seguridad.md`, con la preferencia declarada por origen separado. **Decisión conjunta**, no unilateral. | S1, S3 | `docs/equipo/` | pendiente |
| T3 | Implementar el aislamiento elegido preservando las rutas actuales del frontend | S1 | `src/main.rs`, `frontend` | pendiente |
| T4 | Prueba de aceptación: desde el contenido servido, ninguno de los tres vectores de T1 tiene éxito, **y** el contenido legítimo sigue funcionando | S1, S3 | pruebas | pendiente |
| T5 | Control negativo: la prueba de T4 debe **fallar** si se revierte el aislamiento | S1 | pruebas | pendiente |

## Por qué existe esta tarea separada

RD-02C está en estudio. Si se migra al lector separado, el aislamiento de origen será parte de la
migración — pero la migración **no está autorizada** y puede no ocurrir nunca. Mientras tanto el
defecto, si se confirma, está activo en cada instalación que monte un ZIM.

Registrarlo aparte garantiza que el cierre del agujero no quede rehén de una decisión de
arquitectura que puede tardar meses.

## Restricciones

- No toca `src/models.rs`.
- No toca el router sin autorización y sin revisión de los tres (S3 de coordinación).
- No cambia el contrato de `/api/capacidades`: es ortogonal a D-05d.
- No sustituye al lector integrado (S4).

## Log

- **L1** — Registrada el 2026-11-27 por autorización del propietario, derivada del hallazgo H3 de
  `evidencias/RD-02C/evaluacion-seguridad.md`, al aceptarse la dirección arquitectónica de estudiar un
  lector separado **sin** autorizar la sustitución.
- **L2** — Se registra **antes** de la confirmación experimental, por decisión explícita del
  propietario («si el defecto se confirma»). T1 puede cerrarla como no aplicable.
- **L3** — **T1 cerrada el 2026-11-27: CONFIRMADO.** La sonda del ZIM leyó el JWT del `localStorage` y
ejecutó `POST /api/profesor/quizzes` con **201**. Se corrige además la descripción del defecto: no hay
CSP en el proyecto; el defecto es la **ausencia total** de frontera de origen, no un `allow-same-origin`
mal configurado.
- **L4** — La tarea pasa a **bloqueante de distribución**. La mitigación preferida es **M1 (origen
separado)** por ser estructural; **M2** (`sandbox` sin `allow-same-origin`) sólo si M1 es inviable, y
**M4** (`nosniff`, `frame-ancestors`) va siempre. M6 (sacar el JWT de `localStorage`) es una unidad
aparte, necesaria pero complementaria.
