# Proteger el lector ZIM actual — aislamiento de origen (H3)

Feature ODD. Alcance: cerrar la frontera de origen entre el contenido de terceros (ZIM) y la
aplicación educativa, **sobre el lector integrado que hoy está en producción**, sin esperar a la
migración de RD-02C.

**Estado: REGISTRADA, NO INICIADA.** La implementación espera dos cosas: (a) que el defecto se
**confirme** con una prueba, y (b) autorización, porque toca `src/main.rs` y posiblemente el
frontend.

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
| T1 | **Confirmar el defecto** con un ZIM de prueba que ejecute JS y que intente (a) `fetch('/api/cursos')`, (b) leer `sessionStorage`, (c) leer `document.cookie`. Registrar resultado por cada vector. **Si ningún vector tiene éxito, el defecto no se confirma y esta tarea se cierra como no aplicable** — sin inventar una mitigación para un problema que no existe. | S1, S2 | espacio experimental | pendiente |
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
