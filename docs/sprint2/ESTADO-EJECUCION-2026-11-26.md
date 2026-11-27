# Estado de ejecución autónoma — 26 de noviembre de 2026

Documento de continuidad para una sesión que retoma sin contexto. Se actualiza a medida que las
unidades cierran. **Engram no funciona** en esta máquina (binario anterior a `v2.0.0-rc.11`): todo el
estado vive acá y en `docs/sprint2/`.

## Autorizaciones vigentes del humano (26/11, antes de ausentarse)

| Decisión | Alcance |
|---|---|
| Publicar | **Push de ramas + PRs apilados**: `git push origin <rama>` y `gh pr create`. |
| Mergear | **Sí, lo que esté verde** y sin hallazgos bloqueantes, respetando el orden del stack. |
| Alcance | **Terminar Fase 0 (T1–T8) y abrir Fase 1** (sprints 3–7). |
| Revisión nativa (RDD) | **Desactivada** por decisión explícita: `gentle-ai review mode disable` ejecutado. Ningún candidato pide consentimiento en esta sesión. |

Decisiones de producto de D-04, ya tomadas y registradas en `odd/tasks/fase0-estabilizacion.md` (L6):
`UNIQUE(palabra, tipo, categoria)`, semillas «todo o nada», deduplicar al arrancar.

## Orden de merge del stack previo — y el error que cometí

El documento `ESTADO-2026-11-26.md` proponía `#3 → #4 → #5 → #2`. Ese orden no funciona, y el que
usé tampoco: **se mergea hoja hacia raíz, nunca al revés**.

Lo que hice: #4 (`d01b` → `d01a`), #5 (`d02` → `d01b`), #3 (`d01a` → `fix/`), #2 (`fix/` → `main`).
Cuando #5 mergeó `d02` en `d01b`, `d01a` ya había recibido `d01b` en #4, así que **`d01a` nunca vio
los commits de D-02 y `main` se quedó sin D-02**. Cinco commits de trabajo revisado y verde quedaron
varados en una rama ya consumida.

Diagnóstico, no suposición: `git merge-base --is-ancestor 398c27c origin/main` → **NO**, y
`git log origin/main..HEAD` listaba los cinco commits de D-02 como ausentes de `main`.

Orden correcto, hoja hacia raíz:

1. **#5** — `d02` → `d01b`
2. **#4** — `d01b` → `d01a` (arrastra D-02)
3. **#3** — `d01a` → `fix/` (arrastra todo)
4. **#2** — `fix/` → `main`

**Reparación en curso:** PR #7 (`feature/d02-config-check` → `main`) devuelve D-02 a `main`. Las
ramas nuevas se abren contra `main` después de #7, para que su diff no arrastre commits ajenos.

## Estado del stack (26/11, reanudación)

Los cuatro PRs que quedaban abiertos se mergearon en `main` en orden de hoja a raíz, todos verdes en
`test (default)` y `test (con-zim)`: #10 `docs/canal-coordinacion`, #11 `feature/d03-app-root`,
#12 `docs/t7-matriz-plataforma`, #13 `chore/win-recipe`. `main` quedó en `4111df0` sin PRs abiertos.
El error de orden descrito abajo queda como historia, no como tarea pendiente.

Con eso Fase 0 tiene T1–T7 y T9 con commit. Sólo T8 sigue abierta, y por la misma razón de siempre:
el `.exe` no se ejecutó en Windows real.

## Unidades

| Unidad | Rama / worktree | Estado |
|---|---|---|
| D-01a · D-01b · D-CI · D-02 | stack de PRs #3–#5, #2 | verdes, en merge |
| D-CI 2 — compuerta `ldd` | `chore/ci-ldd-leg` | **mergeada** (PR #8, `58ddd3b`) |
| D-WIN — evidencia Windows | `chore/win-cross-build` | **mergeada** (PR #9, `c41dd42`); T9 en PR #13 (`9c08fcb`) |
| D-03 — `APP_ROOT` / `DATA_DIR` | `feature/d03-app-root` | **mergeada** (PR #11, `5dc9087`) |
| D-04 — identidad de fila del diccionario | `feat/d04-diccionario-unico` | **T10 cerrada y verificada**: deduplicación del diccionario, migración `008`, tres pruebas, documento corregido. Commits `c3bd5d1`, `b35f253`, `25a624e`; publicada en `main` por el PR #17 (`2858404`) dentro de la línea base `educonect-baseline-v1`. **Esto NO cierra la persistencia en general**: no existe ledger de migraciones (`P1-06`) y siguen abiertos los pendientes de D-04 listados en `odd/tasks/fase0-estabilizacion.md` (L10). |

## Hallazgos verificados que no hay que re-descubrir

- **`diccionario` se duplica en cada arranque**: sin restricción única, ~21.800 filas por arranque.
  `biblioteca` ya se había arreglado en `seeds/007`. Decisión y consecuencia registradas en L6.
- **El leg de Windows funciona**: mingw compila, `rusqlite` con `bundled` compiló SQLite 3.51.3 desde C,
  y el `.exe` corre bajo Wine respondiendo `/health` 200. No pide DLLs de mingw: despliegue de un archivo.
- **`detect_h264_encoder()` no sondea `ffmpeg`**: la línea «Encoder H.264 seleccionado» es una constante
  de respaldo. Los documentos que afirman una detección están equivocados.
- **Regla de proceso, tres veces repetida**: los comandos de verificación fallan en silencio. Confirmar
  estado antes de medir, nunca el código de salida. Todo comando que pueda colgarse va con `timeout`.

## Pendientes de decisión humana (no los resuelvo solo)

- Ejecutar el `.exe` en Windows real (WinBoat, solo RDP interactivo, sin WinRM). Es lo único que separa
  T8 de estar cumplida.
- `~/.wine` (1 GB) creado por una sonda con `HOME` sin aislar. No se borró: es el HOME del humano.
- Fase 1 (sprints 3–7) requiere specs nuevas y decisiones de producto; se abre el documento de feature
  y se avanza solo lo que no dependa de esas decisiones.
