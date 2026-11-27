# Backlog de seguridad del lector ZIM — priorizado

- **Origen:** `evidencias/RD-02C/evaluacion-seguridad.md` (11 hallazgos).
- **Regla:** los hallazgos **actuales** se atienden sin esperar la migración. La migración no es
  requisito para proteger lo que ya está sirviendo.
- **Restricción vigente:** no se autoriza contenido activo de terceros bajo el mismo origen con
  acceso a credenciales educativas.

---

## Prioridad 1 — H3 (contenido de terceros con acceso al origen educativo)

**Este es el hallazgo que hay que cerrar primero, y no depende de RD-02C.**

**Qué dice la evidencia:** el lector sirve las páginas del ZIM **bajo el mismo origen que la
aplicación educativa** (`/zim/{*path}` en el mismo puerto que `/api/*`, `src/main.rs:387-389`). Las
páginas del ZIM pueden ejecutar JavaScript. El CSP presente combina `sandbox` con
`allow-same-origin` y `default-src 'self'`, lo que —bajo el origen de EduConect— deja al JS del ZIM
en condiciones de leer la API y el JWT de `sessionStorage` del docente autenticado. La evidencia
también constata que en `src/` **no hay** CSP, `sandbox` ni `nosniff` propios.

**Por qué es el más grave:** no es un fallo de robustez, es una **frontera de confianza ausente**. Un
ZIM es contenido de terceros: cualquiera puede publicar uno, y el operador de un colegio lo monta
porque confía en el contenido, no porque lo haya auditado. En el momento en que ese contenido puede
leer el token de un docente, la confianza se paga con la cuenta de todos.

**Estado:** **a confirmar experimentalmente antes de implementar.** La evidencia lo describe; no hay
una prueba que lo demuestre con un ZIM que ejecute JS, porque el fixture de D-05b no lleva
JavaScript. La tarea independiente está en
[`../../../odd/tasks/proteger-lector-actual.md`](../../../odd/tasks/proteger-lector-actual.md).

**Opciones, en orden de preferencia:**

| # | Opción | Efecto | Coste |
|---|---|---|---|
| 1 | **Origen separado** (hostname o puerto propio para el contenido) | Rompe el acceso a `sessionStorage` y a la API por política de origen del navegador, sin depender de que el CSP esté bien. Es una garantía **estructural**. | Medio: exige puerto/host propio y ajustar el frontend |
| 2 | **`sandbox` sin `allow-same-origin`** | Aísla el contenido de forma opaca; el JS del ZIM deja de ver el origen. Puede romper JS legítimo del contenido. | Bajo, con riesgo funcional |
| 3 | **CSP estricta** en las respuestas de `/zim/*` (`default-src 'none'` + `frame-ancestors` acotado + `nosniff`) | Reduce superficie; no sustituye al aislamiento de origen si se permite `allow-same-origin`. | Bajo |
| 4 | **Servir el ZIM sólo en modo lectura sin JS** | Máxima seguridad, mínima funcionalidad; inviable si el contenido requiere JS. | Bajo, con pérdida funcional |

**Preferencia declarada:** opción 1, con la 3 como refuerzo. Es la única que no depende de acertar con
una lista de directivas: dos orígenes distintos no se ven, por definición.

---

## Prioridad 2 — H2 (SIGBUS sirviendo 200 desde caché)

**Qué dice la evidencia:** con el ZIM truncado a cero, las páginas ya cacheadas siguen devolviendo
**200** (71 965 B) y la primera no cacheada devuelve `000` con **exit 135** y volcado de núcleo.

**Por qué importa:** es un fallo que **miente**. El contrato D-05d exige que `disponible=true` no se
sostenga sobre contenido que no se puede servir. H2 es la demostración de que hoy sí se sostiene.

**Mitigación:** eje 1 (supervisor) + eje 3 (detección de contenido inválido) de
[`rd02c-propuesta-implementacion.md`](rd02c-propuesta-implementacion.md). **Independiente de la
migración**: aplica al lector integrado igual.

---

## Prioridad 3 — H1 (`--address` por defecto en `all`)

**Estado:** documental. La evidencia dice «No se ha ejecutado nunca sin la bandera», y `ss` muestra
sólo `127.0.0.1:18081`.

**Por qué sigue en el backlog:** un defecto por omisión de la herramienta es una trampa para el
próximo que la invoque. Se cierra exigiendo la bandera y **fallando el arranque** si el lector quedó
escuchando fuera de loopback. Coste bajo; no esperar.

---

## Prioridad 4 — H7 / H8 (`Access-Control-Allow-Origin: *`)

- **H7**: `/api/tts` responde `ACAO: *` (`src/main.rs:968`).
- **H8**: **todas** las respuestas de kiwix llevan `ACAO: *`.

**Efecto:** cualquier página de cualquier sitio puede leer esas respuestas desde el navegador de un
usuario en la red del colegio. En una red de aula es un vector real.

**Mitigación:** eliminar el comodín; si hace falta CORS, lista explícita de orígenes propios.

---

## Prioridad 5 — H4, H5, H6 (cabeceras ausentes y límites de conexión)

- Sin `X-Content-Type-Options: nosniff`.
- Sin `X-Frame-Options` ni `frame-ancestors`.
- `-L 0` y `-L 2` producen reset en la tercera conexión, con `ConnectionResetError` en clientes
  legítimos.

**Mitigación:** cabeceras en el adaptador o en el lector; fijar `-L` con criterio y documentar cuál.

---

## Prioridad 6 — H10 (`pageLength` sin límite)

Una sola respuesta de 119 107 B. No es una fuga, es un amplificador: en una red de aula con
conexión mala, un cliente puede pedir páginas grandes y consumir el enlace.

**Mitigación:** límite superior y valor por omisión razonable.

---

## Lo que la evaluación **no** encontró

Conviene registrarlo para no reabrir lo mismo:

- **Sin XSS** con dos familias de payload.
- **Sin traversal**: `404`/`302`, sin fugas de fichero.
- **Sin `Set-Cookie`** en el lector.
- **Redirecciones nunca salen del host.**

Es decir: el problema no es la implementación de las rutas, es **la frontera de origen y la falta de
supervisión**.

---

## Tabla resumen

| ID | Severidad | Defecto | Depende de migración | Prioridad |
|---|---|---|---|---|
| H3 | Alta | Contenido de terceros bajo el mismo origen con acceso a credenciales | **No** | 1 |
| H2 | Alta | SIGBUS sirviendo 200 desde caché | **No** | 2 |
| H1 | Alta (documental) | `--address` por defecto en `all` | No | 3 |
| H7 | — | `ACAO: *` en `/api/tts` | No | 4 |
| H8 | — | `ACAO: *` en todas las respuestas del lector | No | 4 |
| H4-H6 | Media | `nosniff`, `XFO`/`frame-ancestors`, límite de conexiones | No | 5 |
| H10 | — | `pageLength` sin límite | No | 6 |

**Ninguno de los siete exige la migración.** Por eso el eje 2 de la propuesta va primero: se puede
cerrar el agujero sin decidir la arquitectura.
