# H3 — Aislamiento de origen del lector ZIM: evidencia y mitigaciones

- **Estado: CONFIRMADO.** El contenido servido en `/zim/{*path}` ejecuta en el **mismo origen** que la
  aplicación educativa y puede leer credenciales, consultar datos privados y ejecutar operaciones
  autenticadas.
- **Fecha:** 2026-11-27/28. **Base:** `2858404` (`educonect-baseline-v1`).
- **Contenido usado:** exclusivamente sintético. Credenciales ficticias. Entorno aislado.
- **El lector integrado NO se ha sustituido.** Este documento no autoriza nada: registra un hecho.

---

## 1. Veredicto y evidencia decisiva

Una página servida **desde el propio ZIM** ejecutó su JavaScript en
`location.origin = http://127.0.0.1:18080`, leyó `localStorage["educonect_admin_token"]` —el JWT real
emitido por `POST /admin/login` de esa misma instancia— y con **ese token robado** obtuvo:

- `GET /api/profesor/estudiantes` → **200**, con datos del alumno ficticio.
- `POST /api/profesor/quizzes` → **201**, quiz creado.

No es una inferencia: hay un navegador real (Chrome for Testing 151, headless, por CDP) y las capturas
de la consola están en `/var/tmp/educonect-h3/logs/cdp-*.out`.

**Lo que esto significa en una frase:** cualquier ZIM que un operador de colegio monte —porque confía
en el contenido, no porque lo haya auditado— puede leer el token del docente y actuar en su nombre.

---

## 2. Resultado por vector

| Vector | Observado |
|---|---|
| `document.cookie` | escribió y leyó `educonect_sesion=cookie-ficticia-123`. **La aplicación no emite cookies**: no hay `Set-Cookie` en ninguna respuesta |
| `sessionStorage` | `educonect_profesor_token` = `demo-token-ficticio-123` |
| `localStorage` | `educonect_estudiante` = `{"nombre":"demo-alumno-ficticio","grado":"6"}`; **`educonect_admin_token` = JWT de 147 caracteres**; claves presentes: `educonect_admin_token`, `educonect_estudiante` |
| `fetch('/api/cursos')` | **200**, 8 727 bytes. Sin CORS de por medio: mismo origen |
| `fetch` autenticado con Bearer **ficticio** | **401** `{"error":"Token inválido"}` — el servidor valida correctamente |
| `fetch` autenticado con **el token robado** | **200** con datos, y `POST /api/profesor/quizzes` → **201** |

La última fila es la que importa: el sistema de autorización **funciona**. Lo que falla no es la
autorización, es que el token esté al alcance de contenido de terceros.

---

## 3. Cabeceras reales (verbatim, sin retocar)

```
GET /api/cursos        HTTP/1.1 200 OK
content-type: application/json
content-length: 8817
date: …

GET /zim/A/Sonda       HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
content-length: 3648
date: …

GET /zim/              HTTP/1.1 307 Temporary Redirect   location: /zim/A/Portada
GET /zim/nada          HTTP/1.1 404 Not Found            content-type: text/html; charset=utf-8
```

**Ninguna** lleva `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Access-Control-Allow-Origin` ni `Set-Cookie`.

---

## 4. Causa raíz, con ubicación exacta

| Hecho | Evidencia |
|---|---|
| El handler del artículo fija **una sola cabecera**: `CONTENT_TYPE` | `edu-conect-rural-server/src/main.rs:1711` (`handler_zim_articulo`) → `:1796` (`servir_entrada_zim`) → `:1831` |
| No hay capa de cabeceras en el árbol de rutas | `grep layer(` sólo encuentra `AuthLayer` en `/api/profesor` y `/admin` (`main.rs:458,479`) y `DefaultBodyLimit` (`:477`) |
| **Cero** `CSP`/`XFO`/`nosniff` en todo el proyecto | `grep` sobre `*.rs`, `*.ts`, `*.tsx`, `*.conf`, `*.toml`, `Dockerfile*` → **0 coincidencias** |
| El único `sandbox=` del proyecto **no es del lector** | `edu-conect-rural-dashboard/components/video-modal.tsx:265`, en el `<iframe>` del modal de vídeo |
| El HTML **sí** se reescribe, y eso confirma que se puede intervenir ahí | `zim_proxy.rs:517` `zim_inyectar_estilos` inyecta un `<style>` antes de `</head>`; el `<script>` de la sonda se sirvió **intacto** |
| Mismo origen **por construcción** | rutas ZIM con `.merge(zim_routes)` en el mismo `Router` (`main.rs:481`), un solo `TcpListener::bind` (`:362`) |

**Corrección a la evidencia previa de RD-02C:** el documento de seguridad describía el defecto como
«CSP con `sandbox … allow-same-origin`». **No hay CSP.** El defecto es más simple y más grave: no existe
ninguna frontera de origen, ni por cabecera ni por atributo. El `allow-same-origin` que se citaba
pertenece al modal de vídeo.

---

## 5. Alcance en red local

- `LISTEN_ADDR` por defecto es **`0.0.0.0:8080`** (`src/config.rs:734`; `Dockerfile` lo fija igual).
- Observado: `GET /api/network` → `"listen_addr":"0.0.0.0:8080"`.
- Alcanzable desde la LAN en la prueba: `curl http://<ip-lan-del-host>:18082/zim/A/Sonda` → **200**, con
  las mismas cabeceras. **La dirección concreta se omite a propósito:** es un dato de red privada y no
  hace falta para reproducir el hallazgo.

**Consecuencia:** no es un problema de un usuario en su equipo. Cualquier dispositivo de la red del
colegio alcanza el mismo origen y el mismo contenido ZIM. Un aula con contenido montado por un docente
expone la sesión de **todos** los que abran ese contenido desde esa red.

---

## 6. Lo que NO se midió

| No medido | Por qué |
|---|---|
| Un ZIM real de terceros (mwoffliner, Wikipedia) con su propio JS | Se usó un ZIM sintético propio. **El camino de código es el mismo** (`get_item` → `CONTENT_TYPE` → inyección de CSS), pero no se ejecutó un paquete de terceros real |
| Un segundo dispositivo físico distinto | Se midió la dirección LAN del propio host (200). Suficiente para probar alcanzabilidad, no para probar latencia ni firewall intermedio |
| Comportamiento con `LISTEN_ADDR=127.0.0.1` | No se probó; es la mitigación propuesta y hay que verificarla con la sonda durable |

**Desvío declarado:** la instancia se arrancó con `--user 1000:1000` (la imagen declara 10001) sólo para
poder escribir el `/data` montado. No afecta cabeceras ni autorización. `JWT_SECRET` y
`ADMIN_INITIAL_PASSWORD` fueron sintéticos; el servidor no arranca sin ellos (`main.rs:329`).

---

## 7. Mitigaciones, evaluadas

**Regla que no se negocia:** ninguna mitigación puede depender de que el contenido deje de funcionar. Un
ZIM con JavaScript legítimo (simulaciones, cuestionarios interactivos, vídeo) debe seguir sirviéndose.

| # | Mitigación | Aísla credenciales | Rompe contenido legítimo | Coste | Veredicto |
|---|---|---|---|---|---|
| **M1** | **Origen separado**: el contenido en otro puerto (p. ej. `127.0.0.1:18081`) u otro hostname | **Sí, estructural.** Dos orígenes distintos no comparten `localStorage` ni cookies por definición del navegador | **No.** El contenido se sirve igual; cambia la URL | Medio: un listener más o un proxy inverso por host | **Preferida** |
| **M2** | `<iframe sandbox="allow-scripts">` **sin** `allow-same-origin` | **Sí**, el iframe queda en origen opaco | **Parcialmente**: el JS corre, pero pierde `localStorage`, `sessionStorage`, cookies y `fetch` con credenciales. Contenido que usa almacenamiento propio se degrada | Bajo | **Buena para contenido no interactivo;** hay que medir qué pierde |
| **M3** | `CSP` estricta en `/zim/*`: `default-src 'none'; script-src 'self' 'unsafe-inline'`… **y sin `allow-same-origin` en `sandbox`** | **Parcial**: reduce superficie pero si se permite `allow-same-origin`, no aísla nada | Depende de las directivas | Bajo | **Refuerzo, no sustituto** |
| **M4** | `X-Content-Type-Options: nosniff` + `X-Frame-Options`/`frame-ancestors` acotado | No | No | Trivial | **Sí, siempre**, junto con otra |
| **M5** | Servir el ZIM sin JS | **Sí** | **Sí**, inaceptable para contenido interactivo | Bajo | No recomendada como única |
| **M6** | Mover el JWT fuera de `localStorage` | No resuelve el mismo origen, pero quita el botín | Cambia cómo se autentica el panel | Medio | **Complementaria necesaria** |

### Sobre M1 frente a M2

**M1 aísla por definición del navegador; M2 aísla por atributo que hay que acertar a escribir y no
quitar.** La diferencia es de naturaleza, no de grado:

- Con M1, aunque alguien olvide el `sandbox`, el contenido está en otro origen y no ve nada.
- Con M2, si alguien edita el `<iframe>` y borra `sandbox`, el agujero vuelve entero.

Por eso **M1 es la mitigación preferida** y M2 es aceptable sólo si M1 resulta inviable por razones de
despliegue (puerto único, proxy existente, requisito de URL).

**M4 va siempre.** Cuesta dos líneas y evita el envenenamiento de tipo MIME.

### Sobre M6, que no es opcional

Aunque se implemente M1, un token accesible por JS sigue siendo robable por **cualquier** XSS en la
propia aplicación. Mover el JWT a una cookie `HttpOnly` (o a memoria con refresco) es una unidad
separada, pero hay que decidirla: hoy el panel guarda el token en `localStorage`
(`profesores-view.tsx:23,69`) y en `sessionStorage` (`static/profesor.html:562,602`), y esas dos
políticas distintas son en sí mismas un defecto.

---

## 8. Verificación de que el contenido legítimo sigue funcionando

Toda mitigación debe superar esta matriz, y **ninguna se acepta sin ella**:

| Caso | Debe seguir funcionando |
|---|---|
| Página estática con HTML y CSS | renderiza igual |
| Página con JS propio de la simulación | ejecuta; su estado interno funciona |
| Página con vídeo/audio embebido | reproduce |
| Enlace interno entre artículos del ZIM | navega |
| Búsqueda desde el frontend de EduConect | devuelve resultados |
| Página que **intenta** leer `localStorage` del origen educativo | **falla**, y ese fallo es el criterio de éxito de la mitigación |

Las cinco primeras filas son la no-regresión. La sexta es la regresión buscada.

---

## 9. Pruebas que deben quedar

El experimento de hoy no es una prueba: es una confirmación puntual. Para que no vuelva a pasar hay que
dejar sondas durables, en el estilo de `tests/docker/verificar-fixture-zim.sh` (exit 0/1/2):

| ID | Afirmación | Control negativo |
|---|---|---|
| **S1** | `GET /zim/*` incluye `Content-Security-Policy` que impide el acceso al origen (`sandbox` sin `allow-same-origin`, `default-src 'none'` o equivalente) | quitar la cabecera del candidato → S1 debe salir 1 |
| **S2** | Desde el contenido servido, no se puede leer `localStorage`, `sessionStorage` ni `document.cookie` del origen educativo | requiere navegador; **si no hay navegador, salir 2 «no verificable», nunca 0** |
| **S3** | `/api/*` protegidas siguen devolviendo 401 con Bearer inválido | — (hoy ya se cumple; se conserva para que la mitigación no debilite la autorización) |
| **S4** | El contenido legítimo de las cinco filas de §8 sigue funcionando | degradar una directiva a propósito → S4 debe salir 1 |
| **S5** | Control global: con la mitigación revertida, S1–S2 fallan | — |

**S2 con salida 2 es deliberado.** Una sonda que no puede medir y devuelve 0 es peor que no tener sonda:
convierte «no lo probé» en «está bien».

---

## 10. Lo que esto cambia en el orden de trabajo

Antes de esta confirmación, H3 era el eje 1 de un estudio sobre el lector separado. Ahora es un **defecto
activo y probado** en la línea base etiquetada, y su corrección **no depende** de ninguna decisión de
arquitectura.

Por eso la tarea `odd/tasks/proteger-lector-actual.md` pasa de registro a **bloqueante de distribución**:
mientras no haya aislamiento, montar contenido de terceros en un aula permite que ese contenido actúe
como cualquier docente autenticado de esa instalación.

**No sustituye al lector integrado.** Este documento no autoriza la migración de RD-02C; autoriza —y
exige— cerrar la frontera de origen sobre lo que ya está desplegado.

---

## 11. Reproducibilidad

```bash
s=/var/tmp/educonect-h3; cd /tmp/educonect-wt/fase1-docs
tar --exclude=./.git -cf - . | tar -xf - -C $s/src
cd $s/src && docker build --target full -t educonect-h3-full .
python3 $s/generar-sonda.py                        # ZIM sintético con la sonda
cp $s/zim/sonda_h3.zim $s/data/contenido/zim/
docker run -d --name h3-full -p 127.0.0.1:18080:8080 -p 18082:8080 -v $s/data:/data \
  --user 1000:1000 \
  -e JWT_SECRET=synthetic-h3-demo-secret-not-real-0123456789 \
  -e ADMIN_INITIAL_PASSWORD=demo-admin-ficticio-2026 \
  -e LISTEN_ADDR=0.0.0.0:8080 educonect-h3-full:latest
curl -sD - http://127.0.0.1:18080/zim/A/Sonda -o /dev/null      # observar ausencia de CSP/XFO/nosniff
```

Artefactos en `/var/tmp/educonect-h3/` (`src/`, `data/`, `zim/`, `paginas/`, `logs/`, `PROCEDENCIA.md`).
Contenedor detenido, imagen local creada, navegador terminado, ningún puerto escuchando.

**Credenciales usadas: ficticias, de una instancia efímera, sin valor fuera de esta prueba.**
