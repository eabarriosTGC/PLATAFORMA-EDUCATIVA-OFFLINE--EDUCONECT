# RD-02C — Propuesta de implementación del lector separado

- **Estado:** propuesta. **No autoriza reemplazar el lector integrado.** La dirección arquitectónica
  —estudiar un lector separado— está aceptada; la sustitución no.
- **Regla de oro:** nada de esto se implementa antes de cerrar las cuatro precondiciones de
  `evaluacion-portabilidad.md` / `propuesta-decision.md`, y la primera de ellas es la supervisión.
- **Restricción explícita:** **no se autoriza contenido activo de terceros bajo el mismo origen con
  acceso a credenciales educativas.** Ningún eje de abajo puede implementarse de forma que lo
  permita, aunque resulte más simple.

Los siete ejes son independientes en su mayor parte: **E2 y E7 pueden ejecutarse primero y sin
esperar a los demás**, y el eje 3 (detección de contenido inválido) es el que más valor entrega por
unidad de riesgo.

---

## Eje 1 — Supervisor del proceso

**Problema medido:** el caso 5 (SIGKILL) deja 68 de 82 peticiones fallando, la primera a los +51 ms,
**sin reinicio automático**. El caso 7 muestra que un supervisor ingenuo reduce la indisponibilidad
a ≈ 0,1 s (detección +5 ms, primer artículo 200 a +117 ms). El caso 9 (SIGBUS, exit 135, volcado de
núcleo) no tiene ninguna recuperación: el proceso muere y nada lo levanta.

**Qué debe existir, en este orden:**

1. **Supervisión con reinicio** con *backoff* exponencial y techo, para no entrar en un ciclo de
   reinicios que consuma la máquina del aula.
2. **Detección de muerte silenciosa**, que es el caso que hoy no existe: un proceso vivo que ya no
   sirve. Criterio: una sonda propia contra el lector con plazo corto, más la comprobación de que el
   lector responde por el puerto esperado.
3. **Detección de SIGBUS.** El ZIM truncado produce exit 135 con páginas cacheadas aún sirviendo
   200. El supervisor debe tratar la señal como fallo **de contenido**, no sólo como caída de
   proceso, y no reintentar indefinidamente sobre un fichero roto.
4. **Un único dueño del ciclo de vida.** Hoy conviven `docker stop` (10 173 ms, `exit=137`), systemd
   y el arranque manual. Debe quedar uno por modo de despliegue y el resto debe ser explícito.

**Aceptación:** tras `SIGKILL`, el lector vuelve a servir en menos de un plazo declarado y las rutas
ZIM dejan de responder 503 en menos de ese plazo; tras un ZIM truncado, **no** hay ciclo de
reinicios infinito y el estado es `contenido_invalido`.

**Riesgo si se omite:** es el estado actual. Migrar sin supervisión es peor que no migrar.

---

## Eje 2 — Aislamiento de red y origen

**Hallazgos que lo motivan:**

- **H1** — `--address` por defecto es `all`. Documental, pero es el defecto por omisión de la
  herramienta.
- **H3 (prioritario)** — ver [`backlog-seguridad.md`](backlog-seguridad.md). Es el hallazgo que hay
  que cerrar **antes** de cualquier migración y también **sin** ella.
- **H8** — todas las respuestas de kiwix llevan `Access-Control-Allow-Origin: *`.
- **H4–H6** — sin `nosniff`, sin `X-Frame-Options`/`frame-ancestors`.
- `-L 0` y `-L 2` producen reset en la tercera conexión.

**Qué debe existir:**

1. **`--address=127.0.0.1` obligatorio y verificado al arrancar**, no una bandera que se pueda
   olvidar: el arranque **falla** si el lector quedó escuchando fuera de loopback. Ya se verificó que
   `ss` muestra `127.0.0.1:18081` con la bandera puesta; lo que falta es que sin la bandera no
   arranque.
2. **Puerto propio**, distinto del de EduConect (medido: 18080 Rust / 18081 kiwix; y **colisión
   documentada en 8080** en el guion de Windows). Un puerto propio es la forma más simple de
   aislamiento de origen.
3. **Sin proxy bajo el mismo origen.** `--address` + puerto propio bastan; un proxy bajo el mismo
   origen reintroduce H3 exactamente igual que hoy.
4. **Cabeceras**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` o `frame-ancestors`
   acotado, y **sin `ACAO: *`**.
5. **Prueba de aislamiento** que falle el arranque si algo de lo anterior no se cumple.

**Aceptación:** desde otra interfaz de red, `000` en menos de 1 ms (ya medido); `ss` muestra sólo
`127.0.0.1`; ninguna respuesta del lector lleva `ACAO: *`; un iframe desde el origen de EduConect no
puede leer nada del lector.

---

## Eje 3 — Detección de contenido inválido

**Problema medido:** casos 3–4 de `matriz-recuperacion.md`: con un ZIM ilegible, el lector **arranca
y sirve 404**, y **el catálogo anuncia un libro que no puede abrir**. Falla hacia adelante. Más el
caso 9: ZIM truncado, páginas cacheadas 200, primera no cacheada `000`, exit 135.

**Qué debe existir:**

1. **Validación al montar**: comprobar el fichero antes de anunciarlo (tamaño, cabecera, apertura
   real del libro). Si no se puede abrir, **no entra al catálogo**.
2. **Comprobación de integridad no costosa por petición**: una comprobación de `mtime`/tamaño que
   invalide el catálogo cuando el fichero cambia bajo los pies.
3. **Mapeo a los códigos del contrato D-05d**: un libro ilegible produce `contenido_invalido`, no
   `ok` ni `contenido_ausente`. Esto es lo que hace que el contrato de capacidades diga la verdad.
4. **Nunca 200 sobre contenido que no se puede servir.** Es la regla que el caso 9 viola.

**Aceptación:** con el fixture truncado → `contenido_invalido`, ruta 503, catálogo sin el libro; al
restaurar → vuelve a `ok`. Con un ZIM válido → 200 y contenido conocido (prueba A6 de D-05d).

---

## Eje 4 — Adaptador compatible con las rutas existentes

**Por qué es un eje propio:** EduConect **no habla con kiwix**. No existe variable de configuración
para apuntarlo y sus rutas ZIM responden 503 (`comparacion-arquitecturas.md:19`; sólo existe
`DEFAULT_ZIM_DIR` en `config.rs`). La migración no es «cambiar de lector»: es **construir el puente**.

**Qué debe existir:**

1. **Adaptador detrás de las rutas actuales** (`/zim/{*path}`, `/api/wikipedia/zims`,
   `/api/wikipedia/search`) de forma que el frontend no cambie. Es el requisito que hace que el
   trabajo pueda hacerse por partes.
2. **Traducción de errores**: el 404 del lector por libro ausente y el 503 por proceso caído son
   cosas distintas y el adaptador debe preservar la distinción.
3. **Sin credenciales compartidas hacia el lector**: el adaptador no reenvía cookies ni tokens de
   sesión educativa. El lector no debe poder ver un JWT docente.
4. **Contrato de capacidades intacto**: `zim.disponible` pasa a describir el proceso aparte; la forma
   de `/api/capacidades` **no cambia**. Es exactamente para esto que D-05d se publicó antes.

**Aceptación:** con las rutas actuales, el comportamiento observable del frontend no cambia en
`core` (503) y mejora en `full` (búsqueda con resultados reales); ninguna petición al lector lleva
credenciales educativas.

---

## Eje 5 — Recuperación y degradación

**Lo que la evidencia ya sostiene:**

| Situación | Comportamiento requerido |
|---|---|
| Lector caído | Rutas ZIM 503 en 0,3–0,9 ms; `/health` y `/api/*` intactos (medido en el caso 5 y en S9) |
| Lector corrupto | `contenido_invalido`, sin ciclo de reinicios |
| ZIM tardío | Detectado por evento o por `--monitorLibrary`; hoy **no** se detecta sin señal (caso 8) |
| Reinicio del lector | Primer 200 en ~41 ms (medido) |
| Reinicio de EduConect | Orden de arranque independiente (caso 1) |

**Qué debe existir:**

1. **Degradación explícita, nunca silenciosa**: 503 con el código correcto, no 404 ni 200 vacío.
2. **Sin dependencia dura**: si el lector no está, EduConect arranca y sirve todo lo demás. Hoy es
   así por construcción; la migración no puede perderlo.
3. **Supervisión acoplada al catálogo**: cuando el lector muere, el catálogo deja de anunciar libros
   que no puede servir.
4. **Procedimiento documentado de recuperación** para cada fallo del eje 1.

**Aceptación:** la misma matriz de 9 casos + S9, ejecutada sobre la arquitectura C, con las mismas
aserciones que hoy se hacen sobre B.

---

## Eje 6 — Portabilidad Windows

**Lo que ya está resuelto por esta fase:**

- Artefacto oficial **`kiwix-tools_win-x86_64-3.8.1.zip`** localizado, descargado y con **md5
  coincidente** con el editor (`95f953f7…`), sha256 propio registrado
  (`fcd01ed2…`), 18 301 924 bytes.
- `kiwix-serve.exe` es PE32+ x86_64 y **se ejecuta bajo Wine 11.22** reportando
  `kiwix-tools 3.8.1 / libkiwix 14.1.1 / libzim 9.4.0`.
- **Sirve el fixture de D-05b**: `GET /` → 200 (4 981 B), `/catalog/v2/entries` → 200 (1 553 B),
  `/content/<libro>` → 302. `/search` → 404, **no verificado** si por falta de índice en el fixture o
  por parámetros.

**Lo que sigue abierto y es la precondición 4:**

1. **Ejecutarlo en Windows real.** Wine no es Windows. El propio repositorio lo dice: el `.exe`
   nunca se ejecutó en Windows real.
2. **No hay artefacto para 3.8.2**: 9 binarios Linux/macOS y ninguno Windows; el último `win-x86_64`
   es 3.8.1 y el último `win-i686` 3.7.0. **La versión de Windows va un escalón por detrás.**
3. **El `.exe` completo de EduConect no es producible** desde aquí: la receta de compilación cruzada
   no incluye libzim/xapian/icu. En Windows, EduConect Core funciona; EduConect con lector
   integrado, no.
4. **Verificaciones pendientes en el huésped**: `--daemon` inerte, ausencia de SIGHUP, SCM y
   firewall, `-M/--monitorLibrary`, y si el lector ve el loopback de la VM.

**Instrucciones para el humano:** están en el informe de esta entrega (§2.4). Este documento no las
duplica porque deben actualizarse con lo que se observe en la máquina, no antes.

**Nota estratégica:** el argumento de portabilidad **favorece** la migración, no la perjudica. Hoy
Windows no puede tener lector integrado; con lector separado sí, usando el binario oficial. Pero eso
sólo se sostiene cuando el eje 2 exista: un lector separado sin aislamiento en Windows es peor que no
tener lector.

---

## Eje 7 — Cumplimiento de licencias

**Estado:** [`../licencias/libzim.md`](../licencias/libzim.md) resuelve la discrepancia por fuentes
primarias. Resumen operativo:

| Componente | Versión distribuida | Licencia efectiva | Obligación |
|---|---|---|---|
| libzim | 9.4.0 (dentro de kiwix-tools 3.8.1 win) | `GPL-2.0-or-later` aguas arriba | Texto de licencia + fuente correspondiente |
| libzim8 (Debian) | 8.1.1 (upstream 8.1.1) | aguas arriba `GPL-2.0-or-later`; Debian registra `GPL-3+` | `debian/copyright` + texto GPL-3 + fuente |
| kiwix-tools | 3.8.1 / 3.8.2 | `GPL-3.0-or-later` | GPLv3 §4 y §6 |
| libkiwix | incluido en kiwix-tools | `GPL-3.0` (or-later no verificado) | Términos de GPLv3 |
| xapian-core | incluido | `GPL-2.0-or-later` | GPL |

**Denominador común seguro: `GPL-3.0-or-later`.**

**Dos precisiones que la autorización exige no dar por sentadas:**

1. **GPL no prohíbe comercializar.** Prohíbe imponer restricciones adicionales sobre el software
   cubierto y obliga a entregar la fuente correspondiente. Un colegio o una fundación pueden cobrar
   por el servicio, el soporte o el hardware. Lo que no pueden es cerrar el código de las
   bibliotecas GPL que distribuyen.
2. **Un despliegue financiado no implica automáticamente uso comercial del contenido NC.**
   `CC BY-NC 4.0` prohíbe el uso «primarily intended for or directed toward commercial advantage or
   monetary compensation». Un proyecto financiado por una empresa que se entrega **gratis** a escuelas
   no es automáticamente comercial. Lo que sí es insostenible es razonar por asociación en cualquiera
   de las dos direcciones. La determinación es caso por caso y es una decisión jurídica, no técnica.

**Qué debe existir antes de distribuir con lector separado:**

1. `LICENSE` del proyecto — **no se crea en esta fase**.
2. Titularidad definida — sin ella no hay licenciante que firme nada.
3. Avisos de terceros completos: hoy `THIRD_PARTY_NOTICES.md` tiene tres líneas y no cubre ni PhET ni
   kiwix ni libzim.
4. Texto de GPLv3 acompañando al binario/servicio, y camino a la fuente correspondiente.
5. Contenido sin autorización suficiente **fuera** de cualquier distribución, incluidos los bundles
   PhET con cláusula NC y el material pendiente de permiso editorial.

**Riesgo si se omite:** distribuir kiwix-tools sin el texto de licencia y sin camino a la fuente es
un incumplimiento de GPLv3, no un detalle de documentación. Es el tipo de defecto que se descubre
cuando ya hay una institución usando el producto.

---

## Orden de ejecución propuesto

| Orden | Eje | Justificación |
|---|---|---|
| 1 | **E2 (aislamiento) + H3** | Cierra un defecto **actual**, con o sin migración. Máximo valor por riesgo. |
| 2 | **E3 (contenido inválido)** | Elimina el fallo-adelante (catálogo anunciando libro ilegible) y alimenta D-05d con verdad. |
| 3 | **E1 (supervisor)** | Sin esto la migración es una regresión de disponibilidad. |
| 4 | **E7 (licencias)** | Bloquea cualquier distribución; puede avanzar en paralelo porque es documental. |
| 5 | **E6 (Windows real)** | Precondición 4; requiere máquina, no código. |
| 6 | **E4 (adaptador)** | Sólo con 1–3 en pie; es donde se toca el producto. |
| 7 | **E5 (recuperación)** | Ejecuta la matriz completa sobre C; cierra la fase. |

## Ejes que no deben empezar todavía

- **E4** antes de E2: construir el puente antes del aislamiento traslada H3 al puente.
- **E5** antes de E1: no se puede medir recuperación de lo que no se supervisa.
- Cualquier eje antes de que exista decisión humana sobre la migración: esta propuesta es **estudio**,
  no autorización.
