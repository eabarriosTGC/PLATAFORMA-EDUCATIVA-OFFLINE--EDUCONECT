# Sprint 1 — Informe de reproducción de bloqueantes P0

**Persona C · Backend, estabilización e integración**
Criterio de aceptación del sprint: *informe de reproducción con evidencia, pasos y resultados*.

| Campo | Valor |
|---|---|
| Fecha | Noviembre de 2026 |
| Rama | `fix/portable-runtime-baseline` (commit `a27adec`) |
| Método | **Ejecución real del binario compilado** en contenedor + lectura de código |
| Artefactos usados | Imagen `educonetv2-educonect:latest` (947 MB) y binario `target/release/edu-conect-rural-server` |
| Fuente de la lista | `docs/propuesta-windpeshi-innova.md` §2.3 (siete bloqueantes) |

---

## 1. Resumen

De los siete bloqueantes declarados:

| Estado | Cantidad | Cuáles |
|---|---|---|
| **Confirmados en ejecución** | 3 | B1, B2, B6 |
| Confirmados solo por lectura de código | 3 | B3, B4, B5 |
| Por lectura, con discrepancia a verificar | 1 | B7 |

Tres de los siete ya no son hipótesis: se observó el pánico y el 404 con el binario real. Los otros cuatro requieren un entorno que esta máquina no tiene (ver §6).

---

## 2. Entorno de reproducción

| Elemento | Estado |
|---|---|
| Rust / Cargo en la máquina de trabajo | **Ausente** — no se puede compilar aquí |
| `libzim.so.8` en la máquina de trabajo | **Ausente** — el binario del host no arranca |
| Imagen Docker con el binario y sus dependencias | **Disponible** (`educonetv2-educonect:latest`) |
| Docker | Disponible |
| Hardware objetivo (PC Linux, PC Windows, Raspberry Pi) | **No disponible** |

Consecuencia metodológica: **todo lo que se reproduce aquí es dentro del contenedor.** Donde el contenedor difiere del hardware objetivo (rutas del sistema de archivos, CWD, systemd, Windows), el resultado no aplica y se declara como no reproducido.

Comando base usado en todos los casos:

```bash
SEC="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
docker run --rm -d --name p0 -p 18090:8080 \
  -e JWT_SECRET="$SEC" -e ADMIN_INITIAL_PASSWORD="ClaveDePrueba123" \
  educonetv2-educonect:latest
```

---

## 3. Bloqueantes confirmados en ejecución

### B1 — Arranque sin `JWT_SECRET` · CONFIRMADO

**Pasos:** ejecutar la imagen sin `JWT_SECRET`.

**Resultado observado:**

```
INFO  📁 Directorio de datos: /data
thread 'main' panicked at src/config.rs:20:9:
JWT_SECRET no está definida. Crea un archivo .env en la raíz con: JWT_SECRET=$(openssl rand -base64 48)
```

**Lectura:** el proceso termina antes de abrir la base de datos. No hay reintento, no hay valor por defecto, no hay servicio degradado: el nodo no arranca.

**Causa:** `install.sh` no provisiona la variable. Ver §5.

---

### B2 — Arranque con `JWT_SECRET` y volumen nuevo, sin `ADMIN_INITIAL_PASSWORD` · CONFIRMADO

**Pasos:** variable de JWT presente, sin `ADMIN_INITIAL_PASSWORD`, volumen vacío.

**Resultado observado:**

```
INFO  Migraciones ejecutadas
INFO  Semillas cargadas (cursos + módulos + biblioteca + diccionarios + dedupe biblioteca)
thread 'main' panicked at src/main.rs:298:10:
Error al abrir la base de datos: Validacion("ADMIN_INITIAL_PASSWORD no está definida o está vacía.
Se necesita para crear o migrar el administrador inicial (mínimo 12 caracteres).")
```

**Hallazgo nuevo (no estaba en el diagnóstico):** el mínimo exigido son **12 caracteres**, no 8. Cualquier guía de instalación que sugiera una contraseña corta produce el mismo pánico con otro mensaje.

**Hallazgo nuevo relevante:** las migraciones y las semillas **sí se ejecutan** antes del pánico. El intento fallido deja la base de datos creada y poblada. Un operador que reintente verá un estado distinto al de la primera vez, y eso complica el diagnóstico. Es un efecto secundario a documentar.

---

### B6 — Descarga de archivos de curso · CONFIRMADO

**Pasos:** con el sistema operativo, consultar el curso 1 y su archivo.

**Resultado observado:**

| Petición | Resultado |
|---|---|
| `GET /api/cursos` | HTTP 200 — el curso 1 declara `"archivo_path": "/contenido/matematicas-wayuu.pdf"` |
| `GET /api/cursos/1/archivo` | **HTTP 404** |

**Lectura:** la tabla declara una ruta de archivo que ningún handler sirve, y el visor (`static/js/curso-viewer.js:205,214,350`) pide `/api/cursos/{id}/archivo`, que tampoco existe. Son **dos rutas distintas, ambas inexistentes**. El visor de PDF queda en blanco cualquiera sea el curso.

**Agravante:** ninguna de las dos rutas aparece en el registro del router (`src/main.rs:322-425`). No es un handler roto: es ausencia de handler.

---

## 4. Bloqueantes confirmados solo por lectura

### B3 — `/modulos/*` fuera de Docker

En el contenedor responde **HTTP 200** (`/modulos/mundo-3d-701/`), porque la imagen hornea el árbol en `/app/modulos`. La causa del fallo fuera de Docker es verificable en el código: `ServeDir::new("modulos")` resuelve contra el directorio de trabajo (`src/main.rs:410`) y `install.sh` no copia ese árbol al destino de instalación.

**No reproducido** porque esta máquina no puede ejecutar el binario fuera del contenedor (§2). **Confirmado en el contenedor que el árbol es correcto**: `/api/modulos` devuelve exactamente **61 módulos**, lo que coincide con el conteo del diagnóstico y descarta que haya módulos faltantes en la imagen.

### B4 — `/static/*` fuera de Docker

Mismo patrón: `ServeDir::new("static")` relativo al CWD (`src/main.rs:421`). En el contenedor responde HTTP 200. No reproducido fuera del contenedor por la misma limitación.

### B5 — Instalador contra unidad systemd

Confirmado por comparación directa de los dos archivos:

| Aspecto | `install.sh` (genera la unidad) | `deploy/educonect.service` (versionada) |
|---|---|---|
| Directorio de trabajo | `${INSTALL_DIR}` | `/opt/educonect` |
| Ejecutable | `${INSTALL_DIR}/bin/edu-conect-rural-server` | `/opt/educonect/server/edu-conect-rural-server` |
| Frontend | `${INSTALL_DIR}/data/frontend` | `/opt/educonect/dashboard/out` |
| Usuario | `root` | `pi` |
| `ExecStartPre` | `scripts/setup-hotspot.sh` | — |
| `Restart` | `on-failure` | `always` |
| `JWT_SECRET` | **ausente** | **ausente** |
| `ADMIN_INITIAL_PASSWORD` | **ausente** | **ausente** |

Son dos despliegues incompatibles con el mismo nombre. Ninguno de los dos provisiona los secretos: por eso B1 y B2 ocurren en cualquier instalación limpia, con cualquiera de los dos.

---

## 5. Revisión de configuración de secretos

| Archivo | `JWT_SECRET` | `ADMIN_INITIAL_PASSWORD` | Evaluación |
|---|---|---|---|
| `install.sh` | No se genera ni se escribe en la unidad | No se genera | Causa directa de B1 y B2 |
| `docker-compose.yml` | `${JWT_SECRET:?…}` — falla rápido y con mensaje claro | `${ADMIN_INITIAL_PASSWORD:-}` — **vacío** | B2 en volumen nuevo |
| `docker-compose.local.yml` | Ídem | Ídem | Ídem |
| `.github/workflows/ci.yml` (humo Docker) | `JWT_SECRET=test-secreto-para-ci` | **No se pasa** | El humo de CI no puede pasar en volumen nuevo |

**Conclusión:** el único camino que hoy arranca es Docker con la variable definida a mano. Ni la instalación en hardware ni el humo de integración continua llegan a estado saludable.

**Advertencia de implementación:** `src/db.rs:369-395` valida `ADMIN_INITIAL_PASSWORD` a propósito y existe una prueba que exige el rechazo del arranque sin ella (`src/db.rs:1173`). La corrección es **provisionar**, no relajar. Tocar el guard rompe una prueba de seguridad deliberada.

---

## 6. Lo que no se pudo reproducir, y por qué

| Bloqueante | Motivo | Qué se necesitaría |
|---|---|---|
| B3 y B4 fuera de contenedor | Sin `cargo` y sin `libzim.so.8` en la máquina | Entorno de compilación Linux con `libzim-dev`, o un nodo instalado |
| B5 en ejecución | Sin systemd en el objetivo de prueba | PC Linux o Raspberry Pi con la instalación ejecutada |
| B7 en ejecución | Requiere inspeccionar el catálogo completo del dashboard | Navegador sobre el nodo instalado |
| Comportamiento en Windows | No hay entorno Windows | PC de colegio o máquina virtual Windows |
| Carga WebGL de los 13 módulos 3D | El contenedor no tiene navegador con GPU | Navegador en el hardware objetivo |

**B7 — discrepancia a verificar.** El diagnóstico afirma que 16 tarjetas de curso apuntan a slugs inexistentes (`seeds/002_modulos.sql:7-14,26-32,44`). En ejecución, `/api/cursos` devuelve cursos con `id` numérico y `archivo_path` bajo `/contenido/`. Las dos cosas pueden ser ciertas si la tabla contiene además filas con slug legacy. **No se verificó el catálogo completo**: la consulta se truncó a los primeros registros. Queda como verificación pendiente del Sprint 2, no como hecho.

---

## 7. Lista de correcciones priorizadas

| # | Corrección | Archivo | Cierra | Riesgo |
|---|---|---|---|---|
| 1 | Generar `JWT_SECRET` en la instalación, persistirlo con permisos `600` y no imprimirlo en el log | `install.sh` | B1 | Alto: manejo de secreto |
| 2 | Generar `ADMIN_INITIAL_PASSWORD` (≥12 caracteres), mostrarla una sola vez y exigir cambio en el primer acceso | `install.sh` | B2 | Alto: manejo de secreto |
| 3 | Pasar `ADMIN_INITIAL_PASSWORD` en el humo de CI y en los compose, o hacer explícito que el volumen debe estar inicializado | `.github/workflows/ci.yml`, `docker-compose*.yml` | B2 en CI | Medio |
| 4 | Definir una sola raíz de aplicación, derivada de la ubicación del ejecutable y anulable por variable | `src/config.rs`, `src/main.rs:410,421` | B3, B4 | Medio: cambia resolución de rutas |
| 5 | Unificar unidad systemd e instalador en un único layout; agregar los dos secretos a la unidad | `install.sh`, `deploy/educonect.service` | B5 | Alto: entregable de instalación |
| 6 | Implementar `/api/cursos/{id}/archivo` sirviendo desde `archivo_path`, con rangos y validación de ruta | `src/main.rs`, `static/js/curso-viewer.js` | B6 | Medio |
| 7 | Revisar el catálogo completo de cursos y corregir los slugs muertos | `seeds/002_modulos.sql` | B7 | Bajo |
| 8 | Documentar que un arranque fallido deja base y semillas creadas | `DEPLOY.md` | — | Bajo |

**Orden de ejecución propuesto:** 4 y 5 primero entre sí, luego 1 y 2 juntos (mismo archivo), después 3, 6, 7 y 8. La corrección 4 condiciona a la 6: sin raíz estable, el handler de archivos resuelve contra el CWD y hereda el mismo defecto.

---

## 8. Puertas que este sprint no cierra

El criterio de aceptación del Sprint 1 es un informe, no una corrección. Este documento lo cumple. Lo que **no** se puede declarar:

- «EDUConect arranca» — arranca en contenedor con dos variables puestas a mano.
- «Funciona en hardware objetivo» — no se ejecutó en ningún hardware objetivo.
- «Windows está soportado» — no existe paquete portable y no se probó nada en Windows.
- «B3, B4 y B7 están confirmados» — están confirmados por lectura, no en ejecución.

El Sprint 2 debe aportar la instalación reproducible que este informe declara como faltante.

---

## 9. Cómo reproducir este informe

```bash
# B1
docker run --rm educonetv2-educonect:latest

# B2
docker run --rm -e JWT_SECRET="$(head -c 48 /dev/urandom | base64)" \
  educonetv2-educonect:latest

# B6 y conteo de módulos
SEC="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
docker run --rm -d --name p0 -p 18090:8080 \
  -e JWT_SECRET="$SEC" -e ADMIN_INITIAL_PASSWORD="ClaveDePrueba123" \
  educonetv2-educonect:latest
sleep 12
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18090/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18090/api/cursos/1/archivo
curl -s http://127.0.0.1:18090/api/modulos | grep -o '"id":' | wc -l
docker rm -f p0
```

Resultados esperados, según lo observado: `500/pánico`, `500/pánico`, `200`, `404`, `61`.
