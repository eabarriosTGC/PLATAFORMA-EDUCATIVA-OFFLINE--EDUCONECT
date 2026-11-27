# Fase 1 — Línea base verificable y desarrollo educativo paralelo

Feature ODD. Alcance: publicar una línea base de desarrollo verificable y habilitar el trabajo
paralelo de tres desarrolladores sobre ella, con contratos y documentos versionados en el
repositorio y no sólo en el canal de coordinación.

Lo que esta fase **no** hace: no implementa `/api/capacidades` (D-05d queda aprobado y publicado
como contrato, sin router), no reemplaza el lector ZIM, no crea `LICENSE`, no integra DEV4-002 y no
hace merge de ninguna implementación nueva.

## Specs

- **S1** — «Verifica nuevamente origin/main y el CI de la referencia 2858404.»
- **S2** — «Corrige la contradicción documental sobre D-04: T10 cerró la deduplicación del
  diccionario, pero no implica que exista un ledger completo de migraciones ni que toda la
  persistencia esté resuelta.»
- **S3** — «Una vez verificada la referencia y su CI, se autoriza publicar el tag anotado
  educonect-baseline-v1 sobre el commit validado.» / «Debe quedar explícito que es una baseline de
  desarrollo, no una release de producción.»
- **S4** — Aprobación condicionada de D-05d: «Se aprueba implementar /api/capacidades después de
  incorporar las siguientes correcciones al contrato» — las diez correcciones enumeradas, que este
  documento recoge como S5 a S14.
- **S5** — «disponible=true implica soportada=true y motivo=ok.» / «motivo=ok implica
  disponible=true.» / «soportada=false implica disponible=false y motivo=no_compilada.» /
  «no_compilada no puede coexistir con soportada=true.»
- **S6** — «Resolver la política de versiones desconocidas y extensiones aditivas.»
- **S7** — «Definir actualización de disponibilidad sin sondas costosas por petición.»
- **S8** — «Distinguir dependencia ausente de dependencia instalada pero fallida.»
- **S9** — «Mantener Cache-Control: no-store.» / «No incluir rutas, secretos, nombres de usuario ni
  detalles internos.»
- **S10** — «A6 debe comprobar HTTP 200 y contenido conocido del fixture, no simplemente una
  respuesta distinta de 503.» / «Incorporar pruebas de estados inválidos, contenido corrupto y
  cambios de disponibilidad.» / «Mantener los controles negativos.»
- **S11** — «Publica el contrato corregido antes de modificar el router. No cambies src/models.rs
  unilateralmente.» / «No implementes D-05e todavía.»
- **S12** — «Se acepta la dirección arquitectónica de estudiar un lector separado.» / «No se autoriza
  todavía reemplazar el lector integrado.»
- **S13** — «Corrige las seis inconsistencias documentales detectadas, distinguiendo mediciones de
  contextos diferentes. No declares diferencias de rendimiento significativas sin evidencia
  suficiente.»
- **S14** — «Prepara una propuesta de implementación dividida en: Supervisor del proceso / Aislamiento
  de red y origen / Detección de contenido inválido / Adaptador compatible con las rutas existentes /
  Recuperación y degradación / Portabilidad Windows / Cumplimiento de licencias.»
- **S15** — «Prioriza el hallazgo H3 de seguridad de origen. Registra una tarea independiente para
  proteger el lector actual si el defecto se confirma, sin esperar la migración completa.» / «No
  autorices contenido activo de terceros bajo el mismo origen con acceso a credenciales educativas.»
- **S16** — «Se aprueban S1–S5 como reglas de coordinación.» / «E1–E12 se aceptan como base de
  discusión, no como esquema congelado.»
- **S17** — Antes de implementar: identidad única y roles contextualizados; identificadores opacos sin
  imponer versión UUID; restricciones de jerarquía de aulas y grupos; separación de progreso,
  rendimiento e intentos; idempotencia y concurrencia de intentos; autorización por institución, nodo
  y membresía; migración segura de las rutas públicas heredadas; sin sincronización todavía.
  «Convoca la revisión conjunta de DEV1, DEV2 y DEV3.»
- **S18** — «Materializa los dos paquetes de incorporación como documentos versionables y
  autocontenidos.» / «no dependas exclusivamente de .git/coordinacion/ para transmitir decisiones y
  contratos.» / «Prepara una ubicación compartida en el repositorio para documentación de
  arquitectura, tareas, acuerdos y referencias de investigación.» / «No publiques evidencias
  privadas, secretos ni rutas personales innecesarias.»
- **S19** — «DEV1 comienza con F-01: identidad, autenticación offline y frontera Firebase.» / «DEV2
  comienza con E-01: flujos profesor-alumno y validación del dominio educativo.» / «Ambos pueden
  investigar, diseñar y preparar prototipos aislados. No deben implementar esquemas definitivos sin
  acuerdo conjunto ni integrar contribuciones al producto antes de aclarar su régimen de licencia.»
- **S20** — «No crear LICENSE todavía.» / «Preparar un inventario separado de código propio,
  dependencias, contenidos educativos y contenido comunitario.» / «Resolver la discrepancia de
  licencia de libzim mediante fuentes primarias y la versión exacta distribuida.» / «No asumir que
  GPL prohíbe comercialización ni que todo despliegue financiado implica automáticamente uso
  comercial de contenido NC.» / «Mantener fuera de cualquier distribución los recursos sin
  autorización suficiente.»
- **S21** — «Conservar sus worktrees.» / «DEV4-002 está aprobada a nivel de revisión, pero no
  integrada.» / «No absorber sus tareas.»
- **S22** — «Registra pi-012 en el canal de coordinación.» / «No hagas merge de nuevas
  implementaciones sin autorización.»

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Verificar `origin/main` y las 6 comprobaciones de CI de 2858404 | S1 | — | verificado |
| T2 | Publicar el tag anotado `educonect-baseline-v1` con la declaración explícita de baseline de desarrollo | S3 | `refs/tags/educonect-baseline-v1` | tag `fbbcf20` |
| T3 | Corregir la contradicción sobre D-04 y la tabla obsoleta de D-05 | S2 | `odd/tasks/fase0-estabilizacion.md`, `docs/sprint2/ESTADO-EJECUCION-2026-11-26.md`, `odd/tasks/d05-perfiles-docker.md` | — |
| T4 | Área documental compartida en el repositorio | S18 | `docs/equipo/` | — |
| T5 | Contrato D-05d corregido, publicado antes de tocar el router | S4, S5-S11 | `docs/equipo/contratos/` | — |
| T6 | Corrección de las seis inconsistencias de RD-02C | S13 | `docs/equipo/kiwix/` | — |
| T7 | Propuesta de implementación de RD-02C en siete ejes | S12, S14 | `docs/equipo/kiwix/` | — |
| T8 | Backlog de seguridad con H3 priorizado y tarea independiente de protección del lector actual | S15 | `docs/equipo/kiwix/` | — |
| T9 | Inventario de decisiones jurídicas en cuatro categorías y resolución de libzim por fuentes primarias | S20 | `docs/equipo/licencias/` | — |
| T10 | Paquetes de incorporación DEV1 (F-01) y DEV2 (E-01) | S18, S19 | `docs/equipo/onboarding/` | — |
| T11 | Agenda de decisiones conjuntas y convocatoria de revisión DEV1/DEV2/DEV3 | S16, S17 | `docs/equipo/agenda-decisiones-conjuntas.md` | — |
| T12 | Registrar `pi-012` | S22 | `.git/coordinacion/mensajes/` | — |

Dependencias: T5 depende de T4 (necesita la ubicación). T6-T8 son independientes entre sí. T10 y T11
dependen de T4 y T5.

## Log

- **L1** — Petición original del humano, verbatim:

  > # Cierre de estabilización e incorporación del equipo educativo
  >
  > Se acepta el cierre reportado de D-05b y D-05c.
  >
  > La referencia 2858404 se propone como línea base común para incorporar al desarrollador
  > principal de Firebase y al desarrollador del apartado profesor-alumno.
  >
  > ## 1. Preparación de la línea base
  > Verifica: Coincidencia entre main y origin/main. Estado verde de todos los jobs. Ausencia de
  > cambios pendientes que condicionen la incorporación. Estado de ramas y worktrees. Criterios de
  > estabilización todavía abiertos. Prepara una propuesta de tag educonect-baseline-v1, sin
  > publicarlo todavía. Distingue claramente una baseline de desarrollo de una release lista para
  > producción.
  >
  > ## 2. Decisiones pendientes
  > ### D-05d — Reproduce íntegramente el contrato pi-011. Se acepta el principio de contrastar las
  > capacidades declaradas contra las rutas reales. Incluye esquema JSON, códigos de motivo,
  > semántica HTTP, comportamiento ante fallos y pruebas de aceptación. Espera aprobación definitiva
  > del contrato antes de implementar.
  > ### RD-02C — Presenta un resumen ejecutivo con: Las cuatro precondiciones de migración.
  > Mediciones comparativas reales. Consumo de memoria. Latencias. Recuperación ante fallos.
  > Resultados de seguridad. Limitaciones de portabilidad. Coste estimado de migración.
  > Consecuencias de conservar el lector integrado. No reemplaces todavía el lector ZIM.
  > ### Licenciamiento — Identifica las decisiones necesarias sobre titularidad, contribuciones,
  > dependencias y contenidos. No crees LICENSE ni cambies licencias sin autorización.
  > ### Windows — Se autoriza obtener y probar el artefacto oficial de kiwix-serve 3.8.1 para Windows
  > x86_64, exclusivamente en un entorno experimental y con procedencia e integridad verificadas.
  > Prepara también las instrucciones para que el humano pruebe EduConect Core desde WinBoat sin
  > toolchain.
  >
  > ## 3. Incorporación de DEV1 y DEV2
  > Prepara dos paquetes de onboarding independientes: DEV1 — Firebase: Arquitectura actual.
  > Persistencia SQLite. Autenticación y permisos existentes. Contratos pendientes. Investigación
  > RD-01A. Restricciones de funcionamiento offline. Archivos y componentes que no debe modificar
  > todavía. DEV2 — Profesor/alumno: Arquitectura frontend y backend educativo. Rutas y
  > funcionalidades existentes. Estado de cuestionarios y progreso. Investigación RD-01B. Brechas de
  > accesibilidad. Dependencias con DEV1. Archivos reservados por Codex. Los paquetes deben incluir
  > referencias verificables a archivos y símbolos del repositorio.
  >
  > ## 4. Coordinación
  > Prepara una propuesta de contratos compartidos que permita trabajar a los tres desarrolladores
  > humanos sin duplicar modelos ni romper compatibilidad. Identifica decisiones que deben tomarse
  > conjuntamente antes de implementar identidad, aulas, grupos, asignaciones, progreso e intentos.
  > Conserva intactos los cambios de Codex. Presenta también el dictamen pi-010 de DEV4-002 para
  > decidir su cierre cuando Codex vuelva. No publiques tags, no integres cambios ni adoptes
  > decisiones irreversibles sin autorización.

- **L2** — Corrección del humano, verbatim: «Autorización de nueva etapa — Baseline y desarrollo
  educativo paralelo. […] Se autoriza publicar el tag anotado educonect-baseline-v1 sobre el commit
  validado. […] Corrige la contradicción documental sobre D-04: T10 cerró la deduplicación del
  diccionario, pero no implica que exista un ledger completo de migraciones ni que toda la
  persistencia esté resuelta.»

- **L3** — Evidencia de la verificación: `origin/main` = `28584049de888db82aaa9ba9e1aeee55014b85bb`;
  `gh api …/commits/2858404/check-runs` → `total_count: 6`, las seis `completed/success`
  (`test (default)`, `test (con-zim)`, `docker`, `build`, `report-build-status`, `deploy`).

- **L4** — Tag publicado: objeto anotado `fbbcf20d450649c9fccf53deaa68d495f1be1a3e` apuntando a
  `2858404`; `git ls-remote --tags origin` lo confirma.

- **L5** — Decisión de ubicación: los entregables viven en `docs/equipo/`, versionados en el
  repositorio, porque el canal `.git/coordinacion/` no se versiona y los tres desarrolladores pueden
  estar en equipos distintos (S18).

- **L6** — Alcance de licencias: no se crea `LICENSE`; se produce inventario y resolución de libzim
  por fuentes primarias (S20).

- **L7** — Ninguna implementación de producto en esta fase: sin cambios en `src/`, sin router, sin
  `src/models.rs`, sin tocar los worktrees de Codex (S11, S21, S22).
