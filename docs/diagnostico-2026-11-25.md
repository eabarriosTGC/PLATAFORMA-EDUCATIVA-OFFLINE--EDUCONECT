# Diagnóstico EduConect Rural — Miércoles 25 de Noviembre 2026

Auditoría read-only de los 4 sectores del proyecto, con foco en **por qué los módulos 3D no funcionan**.
Ningún archivo de código fue modificado. Rama auditada: `fix/portable-runtime-baseline`
(commit `a27adec`). Estado: `start.sh` modificado, `Dockerfile.local` y `docker-compose.local.yml` sin trackear.

Método: 4 exploradores independientes, sin acceso a runtime. Todo hallazgo está citado como
`ruta:línea`. Lo que no se pudo verificar está en la sección **No verificado** y **no** debe
tratarse como hecho.

---

## 1. Resumen ejecutivo

**Los módulos 3D no están rotos por código. Están rotos por despliegue.**

Dos sectores distintos llegaron a la misma conclusión por caminos separados:

- **No hay CDN en ningún lado.** `modulos/comun/three.min.js` existe, es un build UMD real de
  three **r128** y los 13 módulos 3D lo cargan por ruta relativa. Offline-safe. Bien hecho.
- **No hay assets faltantes.** Cero `.glb/.gltf/.obj/.wasm` referenciados en todo `modulos/`. Toda
  la geometría es procedural. No existe una sola referencia rota entre los 61 módulos.
- **Pero `/modulos/*` devuelve 404 en todo lo que no sea Docker.** El backend sirve
  `ServeDir::new("modulos")` **relativo al CWD** (`src/main.rs:410`), y el árbol de módulos vive en
  `edu-conect-rural-dashboard/modulos/`. `install.sh` nunca copia `modulos/` ni `static/`.
  En Docker funciona porque `Dockerfile:114` los hornea en `/app`.

Consecuencia: en la Raspberry Pi y en desarrollo local, **todo el catálogo 3D es inalcanzable**.
En Docker funciona.

Solo **2 bugs de código 3D** son reales y reproducibles leyendo la fuente (§3).

---

## 2. Modelo de servido (mapa de rutas)

| Ruta | Directorio / handler | URL de ejemplo | Evidencia |
|---|---|---|---|
| `/modulos` | `ServeDir::new("modulos")` — **CWD-relativo**, `append_index_html_on_directories(true)` | `/modulos/mundo-3d-701/` | `edu-conect-rural-server/src/main.rs:410` |
| `/static` | `ServeDir::new("static")` — CWD-relativo | `/static/js/api.js` | `edu-conect-rural-server/src/main.rs:421` |
| `/videos` | `ServeDir::new(&state.paths.videos)` = `$DATA_DIR/videos`; **sin** index | `/videos/x.mp4` | `src/main.rs:412`, `:68-70` |
| `/biblioteca/{*path}` | handler propio, dos zonas `/data/biblioteca` → `/app/default-content/biblioteca`, Range manual | `/biblioteca/wayuu/x.pdf` | `src/main.rs:411`, `:573-663` |
| `*` fallback | `ServeDir::new(frontend_path)`; `FRONTEND_PATH` default `../edu-conect-rural-dashboard/out/` | `/icon.svg`, `/_next/...` | `src/main.rs:426`, `:283-284` |
| `/`, `/app/`, `/diccionario/`, `/profesor/`, `/videos-page/` | HTML embebido con `include_str!` | `/app/` | `src/main.rs:327-329`, `:344-354` |
| `/sw.js`, `/manifest.json`, `/app-icon.svg` | `include_str!` desde `static/` | `/app-icon.svg` | `src/main.rs:423-425`, `:815-847` |
| `/zim/{*path}` | lector libzim | `/zim/A/Colombia` | `src/main.rs:398-400` |

**El dashboard es export estático de Next**: `output: "export"`, `trailingSlash: true`
(`edu-conect-rural-dashboard/next.config.mjs:8-9`). Sin rewrites, sin API routes, sin proxy.
`modulos/` **no** está dentro de `public/` (`public/` tiene solo 4 iconos), así que el export nunca
lo incluye. Solo lo sirve el backend Rust.

URL correcta de un módulo 3D: `http://<host>:8080/modulos/mundo-3d-701/`

---

## 3. Bugs reales de código 3D (2)

| Módulo | Bug | Evidencia |
|---|---|---|
| **cie-410** magnetismo | `register('campo', p)` setea `userData.partId`, y la línea siguiente **reemplaza** el objeto `userData` completo. El `pick()` después ve `userData.partId === undefined`: tocar una partícula amarilla no hace nada. Las misiones 3 y 6 dicen explícitamente "toca una de las partículas amarillas". Quedan completables solo por la fila de botones. | `modulos/cie-410/app.js:46-47` vs `:66`; misiones en `:14-17` |
| **cie-407** parábola | `new THREE.Vector3(0,2,0)` en scope top-level corre **antes** del guard `!window.THREE`. Si la lib falla al cargar, `app.js` muere en la ejecución y ni siquiera se muestra la tarjeta de fallback. Los otros 9 módulos hacen el guard primero. | `modulos/cie-407/app.js:22` vs guard `:65` |

Fix sugerido para cie-410: `Object.assign(p.userData, {angulo, ...})` en vez de asignación directa,
o setear `p.userData.partId = 'campo'` después de la línea 47.

Fix sugerido para cie-407: mover el `Vector3` dentro de `initThree()`.

---

## 4. Estado verificado de los módulos 3D (13)

Cargados con `../comun/three.min.js` local, sin CDN, sin assets externos:

| Módulo | three.js | Veredicto |
|---|---|---|
| cie-402 | `cie-402/index.html:60` | OK — guardado en `app.js:132`, `#fallback` |
| cie-403 | `cie-403/index.html:74` | OK — `app.js:111` |
| cie-404 | `cie-404/index.html:63` | OK — `app.js:69` |
| cie-405 | `cie-405/index.html:58` | OK — `app.js:83` |
| cie-406 | `cie-406/index.html:55` | OK — `app.js:61` |
| cie-407 | `cie-407/index.html:60` | **FRÁGIL** — ver §3 |
| cie-408 | `cie-408/index.html:55` | OK — `app.js:66` |
| cie-409 | `cie-409/index.html:55` | OK — `app.js:59` |
| cie-410 | `cie-410/index.html:55` | **ROTO parcial** — ver §3 |
| qui-401 | `qui-401/index.html:57` | OK — `app.js:4`, fallback de texto |
| mundo-3d-701 | `index.html:237` | OK — guard en `:244-245` |
| cien-306 | `index.html:497` | OK — guard en `:504-505`, `#error-info` |
| cien-308 | `index.html:121` | OK — swap a panel de error en `:126-127` |

**phet** (5 simulaciones) no usa three.js: son builds single-file de PhET con assets inlinados en
base64. Los 5 `*_es.html` existen. Sin deps externas.

Compatibilidad con r128 confirmada: sin `THREE.Geometry`, sin `.addAttribute`, sin `OrbitControls`,
sin `GLTFLoader`, sin `outputColorSpace`. Todos los constructores usados existen en r128.

**Riesgo compartido:** `modulos/comun/three.min.js` (589 KB) es punto único de falla para los 13
módulos, se sirve **sin comprimir** (`Cargo.toml:11` solo `features=["fs"]`, sin `CompressionLayer`),
y **ningún paso de build lo empaqueta** (`edu-conect-rural-dashboard/package.json:4-9` no lo copia).

---

## 5. Bloqueantes de arranque (más graves que el 3D)

| # | Síntoma | Evidencia | Causa |
|---|---|---|---|
| 1 | Servidor panickea al bootear en instalación limpia | `src/config.rs:20-27` exige `JWT_SECRET`; `install.sh:189-196` exporta solo `DB_PATH`/`FRONTEND_PATH`/`LISTEN_ADDR` | `JWT_SECRET` nunca provisionado |
| 2 | Contenedor/CI nunca llega a healthy en volumen nuevo | `src/db.rs:243-258` → `initial_password_requerida`; `docker-compose.yml:13` y `docker-compose.local.yml:13` pasan `${ADMIN_INITIAL_PASSWORD:-}` vacío; `.github/workflows/ci.yml:60-66` no lo pasa | `ADMIN_INITIAL_PASSWORD` vacío ⇒ `Database::open` error ⇒ panic en `main.rs:299` |
| 3 | PDF de curso en blanco (404) | `static/js/curso-viewer.js:205,214,350` apunta a `/api/cursos/{id}/archivo` | La ruta **no existe** en el router; cae al `ServeDir(frontend)` → 404 |
| 4 | `/modulos/*` 404 y `/api/modulos` vacío fuera de Docker | `src/main.rs:410`, `:1791`; `install.sh:189-191` | `ServeDir::new("modulos")` CWD-relativo; solo Docker crea `/app/modulos` |
| 5 | Todo `/static/js/*` y `/static/dashboard.css` 404 en la Pi | `src/main.rs:421`; `install.sh:191` | `static/` nunca se copia a `/opt/educonect` |
| 6 | La Pi instalada nunca materializa el árbol de módulos | `deploy/educonect.service:6,9` (`WorkingDirectory=/opt/educonect`, `FRONTEND_PATH=/opt/educonect/dashboard/out`) vs `install.sh:261-262` (copia a `/opt/educonect/data/frontend/`, sin `modulos/`, sin `dashboard/out`) | `install.sh` y la unit de systemd no coinciden en el layout |
| 7 | **16 tarjetas de curso muertas** | `seeds/002_modulos.sql:7-14` (`modulo-vocales`, `modulo-mili`, `modulo-lagarto`, `modulo-pintor`, `modulo-rana`, `modulo-raton-perez`, `modulo-caracol`, `modulo-mirringa`), `:26-32` (`modulo-conteo-wayuu`, `modulo-cangrejitos`, `modulo-geometria`, `modulo-sumas-semillas`, `modulo-formas-entorno`, `modulo-patrones-wayuu`, `modulo-medidas`), `:44` (`modulo1-agua`) | Slugs legacy; los directorios reales son `leng-10x`, `mate-20x`, `cien-30x`. `/api/modulos` escanea filesystem, así que el catálogo nuevo salva el caso, pero la tabla `cursos` queda apuntando a la nada |

### Contexto histórico del bloqueante 4
`docs/avance-2026-06-04.md:5-11` documenta que los módulos se movieron **fuera** de `out/` para
resolver un 404 previo (el `npm run build` regeneraba `out/` y borraba los módulos). La mudanza
quedó bien en el código (`main.rs:410` usa `"modulos"`) pero `install.sh` nunca se actualizó.
Es una regresión de la solución anterior, no un bug original.

---

## 6. Configuración y datos

| # | Síntoma | Evidencia | Causa |
|---|---|---|---|
| 8 | `DB_PATH` es config muerta | `start.sh:11,33` e `install.sh:194` exportan `DB_PATH`; el server solo lee `DATA_DIR` (`src/main.rs:272`, `:66-77`) | La DB termina en `./data/` según CWD, no donde los scripts creen |
| 9 | Videos descargados no aparecen en `/videos` | server usa `$DATA_DIR/videos` (`main.rs:69`); `install.sh:20` setea `VIDEO_DIR=$DATA_DIR/contenido/videos` | Mismatch de directorios |
| 10 | `/api/tts` devuelve 500 | `src/main.rs:870` pide voz `es-es+mbrola-3`; `Dockerfile:71` solo instala `espeak-ng`, sin mbrola | Voz inexistente ⇒ exit != 0 ⇒ "espeak-ng falló" (`main.rs:890`) |
| 11 | Quizzes rompen con replay externo del esquema | `src/quiz.rs:365,389,399,423` consultan `quizzes.publicado`; ausente en `migrations/005_quizzes.sql`, agregada solo por `ALTER TABLE` en `src/db.rs:139-144` | Esquema fresco ≠ archivos de migración |
| 12 | Esquemas de `biblioteca`/`diccionario` viven en `seeds/`, no en `migrations/` | `seeds/005_biblioteca_fts.sql:8-39`, `seeds/006_diccionarios.sql:6-40`; se corren en cada boot (`db.rs:148-160`) | Viola el contrato de migraciones; `reindex_search` (`db.rs:186-197`) depende del orden |
| 13 | Archivo de seed muerto | `seeds/002_admin.sql` está vacío y nunca se ejecuta (`db.rs:150-155` lista 001, 002_modulos, 005, 006, 007) | Residuo |
| 14 | Iconos PWA faltan en instalación | `static/manifest.json:15,21` pide `/app-icon-192.png` y `/app-icon-512.png`; solo `/app-icon.svg` tiene ruta (`main.rs:425`) | Los PNG existen en `static/` pero nada los monta en la raíz |
| 15 | `data/` está completamente vacío | `data/{biblioteca,contenido,contenido/zim,videos}`: cero archivos. `seeds/005_biblioteca_fts.sql:47-49` apunta a `data/biblioteca/wayuu/*.pdf` → todos MISSING | Por diseño los PDFs se bajan en build (`Dockerfile:99`, `main.rs:58,546`). El repo no lleva payload |

---

## 7. Integración frontend

| # | Síntoma | Evidencia | Causa |
|---|---|---|---|
| 16 | Parte del dashboard falla desde tablets en la LAN | `edu-conect-rural-dashboard/lib/api.ts:3` `API_BASE = process.env.NEXT_PUBLIC_API_URL \|\| "http://localhost:8080"`, usado por `getCursos`/`getProgreso` (`app/page.tsx:30-41`); otras vistas usan `/api/...` relativo (`components/video-grid.tsx:86`, `biblioteca-view.tsx:38`) | Hardcode de `localhost` + mezcla de absoluto y relativo. Sin `NEXT_PUBLIC_API_URL`, apunta al loopback de la propia Pi |
| 17 | El catálogo de módulos no está en el sidebar | `components/sidebar.tsx:34-39` no tiene ítem `/modulos/`; solo se llega por la vista de profesores (`profesores-view.tsx:316`) y por 8 tarjetas curadas (`lib/app-state.tsx:50-57`) | De 13 módulos 3D, el dashboard expone **uno**: `mundo-3d-701` |
| 18 | Contador de módulos queda genérico | `modulos/index.html:186-201` — el `catch` se traga el error | Depende de `/api/modulos`; sin API o con CWD malo, no muestra número |
| 19 | El grid del catálogo puede desincronizarse | `modulos/index.html:188` usa `/api/modulos` **solo** para el contador; las tarjetas son HTML estático | Drift manual posible |
| 20 | Etiqueta obsoleta | `components/profesores-view.tsx:318` dice "21 módulos educativos disponibles" | Hay 61 |
| 21 | "Volver" apunta a la página equivocada | `comun/volver.js:5` hardcodea `../index.html`; `soc-601/soc-601/index.html:612` lo carga con `../../comun/` | El helper asume profundidad 1; el duplicado anidado necesita `../../` |

**Nota sobre el conteo:** el catálogo lista **61 entradas** y el disco tiene 56 directorios con
`index.html` + 5 subdirs `phet/*` = 61. No hay módulo faltante ni extra. El número "59" que circula
es incorrecto.

**Degradación elegante que sí existe** (no son defectos): `cie-402/app.js:184` envuelve el init en
try/catch y muestra `#fallback` (`index.html:22`); `cien-306/index.html:502-505` con `#error-info`;
`cien-308/index.html:126-127` cambia a panel de error si `THREE` es undefined.

**Throttling GPU:** los módulos viejos no se protegen para una Pi — `cien-306/index.html:608` y
`mundo-3d-701/index.html:264` usan `antialias: true` sin tope de pixel-ratio, mientras los nuevos sí
(`cie-402/app.js:134-135`: antialias off si `hardwareConcurrency <= 4`, `setPixelRatio(min(dpr,1.5))`).

**Iframe letterbox:** `components/video-modal.tsx:268` usa `className="w-full aspect-video"`, que
recorta los módulos 3D de viewport completo.

---

## 8. Contenido huérfano

| Elemento | Estado | Evidencia |
|---|---|---|
| `modulos-matematicas-grado1/` | Mini-sitio completo y funcional (`index.html` + 4 submodules: `conteo-wayuu`, `sumas-concreto`, `formas-entorno`, `secuencias-chinchorro`, 12 refs que resuelven). **Sin un solo enlace entrante.** No está bajo `modulos/` ni `public/`, así que ni `ServeDir` ni el export de Next lo sirven. Su README instruye copiarlo a mano. | `README.md:48`, `:154` |
| `modulos/phet/menu.html` | Nada lo enlaza; el catálogo linkea las 5 sims directo | `modulos/index.html:146-150` |
| `modulos/soc-601/soc-601/index.html` | Copia anidada duplicada de `soc-601/index.html`; alcanzable solo por URL directa | `:612` |
| `comun/visor-pdf.html` + `comun/diario.js` | Cero referencias desde módulos. `diario.js:13` define `STORAGE_KEY='educonect_diario'` — API de diario nunca usada (el progreso real viene de `/api/progreso`) | grep `diario` en `modulos/**/*.html` → 0 |
| `edu-conect-rural-server/static/paleta-wayuu.css` | Sin referencias salvo README/CONTRIBUTING | `README.md:239`, `CONTRIBUTING.md:89` |
| `Cargo.toml:22` | Dep `zim` opcional, sin feature y sin `use zim::` en `src/` — legado que arrastra xz2/zstd si se habilita | — |

---

## 9. Riesgos offline / Raspberry Pi

1. **libzim nativo requerido en build *y* runtime.** `zim-rs 0.1.1` → `zim-sys` vía `cxx`+`pkg-config`
   (`Cargo.toml:23`, `Cargo.lock:3641-3656`). Docker lo maneja (`Dockerfile:10 libzim-dev`, `:71 libzim8`).
   Pero `cross-compile.sh:53-56` compila `aarch64-unknown-linux-musl` **estático** mientras libzim es
   una shared lib de C++: el cross-compile estático no es viable como está escrito.
2. **Google Fonts en build-time.** `app/layout.tsx:2` importa `next/font/google` y `:5-14` lo usa.
   La salida final es self-hosted, pero `next build` **sin internet falla**.
3. **`modulos/` solo vive dentro de la imagen**; `/data` es el único volumen (`docker-compose.yml:7-9`).
   Agregar un módulo en la Pi requiere rebuild de imagen.
4. **`/api/videos/descargar`** necesita `yt-dlp` + internet en tiempo de request (`main.rs:1130-1160`);
   offline devuelve 500 JSON (esperado, pero ruidoso).
5. Startup shell-out a `ffmpeg -encoders` (`main.rs:145-151`) — no fatal, asume `libx264`.
6. Sin llamadas de red al arrancar: ZIM y biblioteca se escanean local, `config.rs:104-135` solo lee env.

---

## 10. Cobertura de tests

**Cubierto:** `tests/integration_test.rs` — 3 tests (10 lecturas concurrentes, 10 upserts
concurrentes, mixto). Unit tests en `db.rs:977-1300` (bootstrap/WAL/rotación admin),
`config.rs:148-296` (URL/ZIM dir), `network.rs:91+`, `quiz.rs:476+` (scoring), `auth.rs:278+`,
`rate_limit.rs:59+`, `zim_proxy.rs:590+`.

**Dos problemas serios:**
- El integration test monta **su propio** router (`integration_test.rs:46-51`), no el de `main.rs`.
  **Ninguna ruta real está testeada.**
- CI corre `cargo test --test integration_test` (`.github/workflows/ci.yml:49`) → **todos los unit
  tests quedan afuera en CI**. Y el smoke test de Docker no pasa `ADMIN_INITIAL_PASSWORD`
  (`.github/workflows/ci.yml:60-66`).

**Sin cobertura:** servir estático y `/modulos`, scan de `/api/modulos`, Range de `/biblioteca`,
`/zim/*`, `/api/tts`, middleware de auth en `/api/profesor` y `/admin`, handlers HTTP de quizzes,
`/api/buscar` FTS, export CSV, la migración de `publicado`.

---

## 11. No verificado — no tratar como hecho

- Si `/opt/educonect/modulos` existe realmente en la Pi. El 404 se concluyó por código + CWD, **no**
  por request observado.
- Si la creación de contexto WebGL funciona en el Chromium/GPU de la Pi. Sin runtime ni browser.
- Si `next build` corrió alguna vez sin internet (fallo de fonts). Inferido de `app/layout.tsx:2`.
- Comportamiento real de `soc-602` `volverInicio()` (`:438`) — solo leído el call site.
- Si `mime_guess 2.0.5` mapea `.wasm/.glb/.gltf` (sin fuente local y sin assets en disco: moot).
- Si `data/{biblioteca,videos,contenido/zim}` se pueblan en build/deploy (`Dockerfile:97-99`,
  `download-biblioteca.sh`): **no en el repo**; en la imagen, no verificado.
- Si algún script solo-CI copia `modulos/` a `out/` — no se encontró ninguno, pero no verificado.
- Peso real de los 5 `phet/*_es.html` y su tiempo de carga en GPU de Pi.
- Estado real de CI (no se ejecutó build/run: auditoría read-only).

---

## 12. Backlog priorizado para retomar

Ordenado por impacto real, no por tamaño.

### P0 — desbloquea el 3D en producción
- [ ] **Servir `modulos/` y `static/` de forma robusta.** Resolver el CWD-relativo de
      `main.rs:410` y `:421` (path absoluto por env, o anclar a `CARGO_MANIFEST_DIR`), y arreglar
      `install.sh` para copiar `modulos/` y `static/` al destino que dice la unit de systemd.
      *Desbloquea los 13 módulos 3D, no dos.*
- [ ] Alinear `install.sh:261-262` con `deploy/educonect.service:6,9` (layout `/opt/educonect`).
- [ ] Verificar en la Pi que `/modulos/mundo-3d-701/` responde 200.

### P1 — arranque
- [ ] Provisionar `JWT_SECRET` en `install.sh` (generar si falta, persistir con permisos 600).
- [ ] Provisionar `ADMIN_INITIAL_PASSWORD` en `docker-compose*.yml` y en CI (o hacerlo opcional con
      rotación forzada en primer login). Hoy impide healthy check.
- [ ] Implementar la ruta `/api/cursos/{id}/archivo` o corregir `curso-viewer.js:205,214,350`.

### P2 — los 2 bugs 3D
- [ ] `cie-410/app.js:46-47` — merge en vez de reemplazo de `userData` (desbloquea picking en 2/6 misiones).
- [ ] `cie-407/app.js:22` — mover `Vector3` dentro de `initThree()` para que el fallback funcione.

### P3 — datos muertos
- [ ] Re-seed de `seeds/002_modulos.sql` con los slugs reales (`leng-*`, `mate-*`, `cien-*`).
- [ ] Integrar o retirar `modulos-matematicas-grado1/` (contenido real, hoy inalcanzable).
- [ ] Mover `biblioteca`/`diccionario` de `seeds/` a `migrations/`; agregar `quizzes.publicado` a
      `005_quizzes.sql`.
- [ ] Borrar `seeds/002_admin.sql` o poblarlo.
- [ ] Resolver el mismatch `DB_PATH`/`DATA_DIR` y `VIDEO_DIR`.

### P4 — calidad y descubribilidad
- [ ] Exponer el catálogo `/modulos/` en `components/sidebar.tsx`.
- [ ] Unificar `API_BASE` (`lib/api.ts:3`): todo relativo, o `NEXT_PUBLIC_API_URL` obligatoria.
- [ ] Corregir "21 módulos" → el número real, en `profesores-view.tsx:318`.
- [ ] `CompressionLayer` en `Cargo.toml`/`main.rs` — 589 KB de three.min.js sin comprimir por WiFi.
- [ ] Tope de pixel-ratio y antialias condicional en `cien-306` y `mundo-3d-701` (como `cie-402:134`).
- [ ] Rutas para los iconos PWA 192/512.
- [ ] Instalar mbrola en la imagen o cambiar la voz de `/api/tts`.
- [ ] Unificar el "volver" de los módulos en `comun/volver.js` (profundidad configurable).
- [ ] `aspect-video` del iframe en `video-modal.tsx:268` — no recortar labs 3D.

### P5 — tests
- [ ] CI debe correr **todos** los targets (`cargo test`), no solo `--test integration_test`.
- [ ] Test de humo por módulo 3D: cargar los 10 `index.html` headless y assertar `window.THREE` y
      `renderer.domElement`. Cada módulo ya expone un flag listo: `solarLabReady` (`cie-402/app.js:176`),
      `cellLabReady` (cie-403), `anatomyAtlasReady` (cie-404), `geometryLabReady` (cie-405),
      `agua3dReady` (cie-406), `parabola3dReady` (cie-407), `adn3dReady` (cie-408),
      `graficas3dReady` (cie-409), `magnetismo3dReady` (cie-410), `molecularLabReady` (`qui-401/app.js:38`).
      Pass/fail trivial de implementar.
- [ ] Test de integración contra el router real de `main.rs`, no uno ad-hoc.

---

## 13. Nota de proceso

La memoria persistente (Engram) **no estaba operativa** durante esta sesión: el binario `engram`
es previo a `v2.0.0-rc.11` y no soporta `instance-id`, por lo que `mem_doctor` falla y toda
escritura de memoria se rechaza. Este documento existe para que el diagnóstico no dependa de memoria.
Si Engram se repara, este contenido debería migrarse a una observación del proyecto.
