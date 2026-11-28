# Contrato D-05d — `GET /api/capacidades` (v1)

- **Estado:** contrato **aprobado con correcciones** y publicado. **Sin implementar.**
- **Origen:** propuesta `pi-011` (2026-11-27T10:09), aprobada por el propietario el 2026-11-27 con
  diez correcciones obligatorias.
- **Alcance de esta unidad:** sólo el contrato. No se modifica el router, no se toca `src/models.rs`
  y **no se implementa D-05e**.
- **Esquema ejecutable:** [`api-capacidades-v1.schema.json`](api-capacidades-v1.schema.json)
- **Tarea:** `odd/tasks/fase1-baseline-onboarding.md`, T5.

---

## 1. Qué resuelve

El frontend necesita saber qué puede ofrecer **antes** de ofrecerlo. Hoy no lo sabe: las rutas ZIM
responden `503` o no existen según el perfil, TTS depende de un binario del sistema y los videos de
un codificador. Sin una primitiva de descubrimiento, el frontend ofrece funciones que nunca van a
funcionar, o esconde funciones que sí funcionan.

El defecto que este contrato evita, y que la corrección del propietario hace explícito, es
**confundir «compilado» con «usable»**. Un `core` con un ZIM montado no puede servirlo; un `full`
sin contenido no tiene qué servir. Son estados distintos y el cliente debe poder distinguirlos.

---

## 2. Forma

```json
{
  "version": 1,
  "capacidades": {
    "zim":        { "soportada": true,  "disponible": true,  "motivo": "ok" },
    "biblioteca": { "soportada": true,  "disponible": true,  "motivo": "ok" },
    "tts":        { "soportada": true,  "disponible": false, "motivo": "dependencia_ausente" },
    "videos":     { "soportada": false, "disponible": false, "motivo": "no_compilada" }
  }
}
```

Conjunto inicial de capacidades, cerrado: `zim`, `biblioteca`, `tts`, `videos`.

---

## 3. Las tres distinciones

| Campo | Qué significa | Cuándo cambia |
|---|---|---|
| `soportada` | La capacidad está **compilada** en este artefacto. Hecho estático del build. | Nunca en runtime |
| `disponible` | La capacidad se puede **usar ahora**: hay contenido válido y la dependencia responde. | En runtime |
| `motivo` | Código **cerrado y estable** que explica el estado. | Sólo si cambia la condición |

---

## 4. Códigos de motivo — conjunto cerrado de seis

| Código | Significado |
|---|---|
| `ok` | Compilada y usable ahora. |
| `no_compilada` | No está en este artefacto; haría falta recompilar. |
| `contenido_ausente` | Compilada, pero no hay contenido válido disponible. |
| `contenido_invalido` | Hay contenido, pero no se puede usar (corrupto, ilegible, formato inesperado). |
| `dependencia_ausente` | Compilada, pero la dependencia externa **no está instalada**. |
| `dependencia_fallida` | La dependencia **está instalada y falla** al invocarse. |

**Cambio respecto de `pi-011`:** `pi-011` cerraba cinco códigos. La corrección del propietario exige
distinguir «dependencia ausente» de «dependencia instalada pero fallida», lo que **añade
`dependencia_fallida`**. Es la única adición autorizada y está registrada aquí como cambio de
contrato, no como interpretación: seis códigos, ni uno más.

La distinción no es cosmética. `dependencia_ausente` es un problema de instalación (el operador
puede resolverlo); `dependencia_fallida` es un problema de entorno o de recurso (permisos, memoria,
códec ausente). El frontend puede ofrecer un camino de recuperación distinto, y el operador recibe
una señal distinta.

**Reglas de contenido de `motivo`:** nunca rutas del sistema, versiones de bibliotecas,
credenciales, nombres de usuario, identificadores de proceso, ni conteos internos. Un código nuevo es
un cambio de contrato y se acuerda; no se inventa sobre la marcha.

---

## 5. Invariantes — ida y vuelta

La corrección del propietario exige que las implicaciones sean **bidireccionales** donde corresponde.
Estas son las seis combinaciones válidas; **todas las demás son inválidas**:

| # | `soportada` | `disponible` | `motivo` |
|---|---|---|---|
| 1 | `true` | `true` | `ok` |
| 2 | `true` | `false` | `contenido_ausente` |
| 3 | `true` | `false` | `contenido_invalido` |
| 4 | `true` | `false` | `dependencia_ausente` |
| 5 | `true` | `false` | `dependencia_fallida` |
| 6 | `false` | `false` | `no_compilada` |

Formalmente:

```
I1  disponible = true                ⇔  soportada = true  ∧  motivo = ok
I2  motivo = ok                      ⇒  disponible = true  ∧  soportada = true
I3  soportada = false                ⇒  disponible = false ∧  motivo = no_compilada
I4  motivo = no_compilada            ⇒  soportada = false
I5  soportada = false                ⇒  disponible = false
I6  motivo ∈ {contenido_ausente, contenido_invalido,
              dependencia_ausente, dependencia_fallida}  ⇒  soportada = true ∧ disponible = false
```

`I1` en las dos direcciones es lo que cierra el agujero de `pi-011`: no basta con «si está
disponible, el motivo es ok»; también hay que impedir `disponible=false, motivo=ok`, que es una
contradicción silenciosa y la clase de bug que un cliente no puede diagnosticar.

Estas seis están **codificadas en el JSON Schema**, no sólo en prosa. Un cuerpo que las viole es
inválido por construcción.

---

## 6. Política de versiones y extensiones aditivas

`version` es un entero, empieza en `1` y **nunca decrece**.

| Cambio | Efecto en `version` | Efecto en clientes |
|---|---|---|
| Añadir una capacidad (p. ej. `busqueda_fulltext`) | **incrementa** | Un cliente viejo la ignora y no la ofrece. No rompe. |
| Añadir un código de `motivo` | **incrementa** | Un cliente viejo lo ve desconocido y lo trata como **no disponible**. Degrada, no rompe. |
| Quitar o renombrar una capacidad | **incrementa** | El cliente viejo no la encuentra: la trata como no disponible. |
| Cambiar el significado de un código existente | **prohibido** dentro de la misma versión; exige versión nueva y retirada documentada | — |
| Cambiar la forma del sobre | **incrementa** y exige ventana de convivencia | — |

**Reglas del cliente** (obligatorias, forman parte del contrato):

1. Si `version` es **desconocida y mayor** que la máxima que entiende: usa sólo las capacidades que
   reconoce y trata todo lo demás como **no disponible**. No rechaza la respuesta entera.
2. Si recibe una **clave de capacidad desconocida**: la ignora en silencio.
3. Si recibe un **código de `motivo` desconocido**: trata esa capacidad como **no disponible** y
   degrada. Nunca lanza.
4. Si la respuesta es **inválida o ausente**: asume **todo no disponible**. *Fail-closed*, nunca
   *fail-open*.

**Reglas del servidor:** no emite claves fuera del conjunto cerrado de su `version`; no reutiliza un
código con significado nuevo; no incluye datos volátiles (timestamps, contadores, uptime) dentro de
`capacidades`.

La razón de que un cliente de `version:1` funcione con un servidor de `version:2` no es cortesía:
es que el modo por defecto ante lo desconocido es «no ofrecer», y ese modo es seguro.

---

## 7. Actualización de disponibilidad sin sondas costosas

Ninguna petición puede ejecutar una sonda. Concretamente: **no** se lanza un proceso, **no** se
recorre el árbol de contenido y **no** se abre un ZIM como consecuencia de un `GET`.

Modelo:

- El servidor mantiene una **instantánea inmutable** de capacidades en memoria
  (`Arc<RwLock<Snapshot>>` o equivalente); cada petición la lee y la serializa. Coste O(1) y sin I/O.
- La instantánea se recalcula por:
  1. **Invalidación por evento**, inmediata: muerte o reinicio de la dependencia, cambio de la
     dependencia en disco, montaje o desmontaje de contenido detectado por el cambio de `mtime` del
     directorio, o el arranque.
  2. **Revalidación perezosa** para las comprobaciones caras (presencia del binario de TTS,
     codificador de vídeo, recorrido del directorio de ZIM), a lo sumo una vez por ventana de
     frescura.
- **Ventana de frescura:** `disponible` refleja el estado con una antigüedad máxima acotada,
  **propuesta: 10 s**, configurable, y con las invalidaciones por evento como excepción inmediata.
  El valor definitivo es una decisión pendiente de la revisión conjunta: es un compromiso entre
  coste y reactividad, no un detalle de implementación.
- La ventana **no aparece en el cuerpo**. La invariante de estabilidad de `pi-011` se mantiene: dos
  peticiones consecutivas sin cambio de estado devuelven el mismo cuerpo.
- La consecuencia aceptada: durante un instante acotado, `disponible=true` puede ser optimista. Por
  eso toda ruta que dependa de la capacidad **sigue devolviendo 503 cuando falla**, aunque la
  instantánea diga que está disponible. El contrato nunca autoriza a servir 200 sobre contenido que
  no se puede servir — es exactamente el defecto H2 de RD-02C (SIGBUS con caché devolviendo 200).

---

## 7 bis. Política exacta de versiones y extensiones aditivas

Precisa el §6 y lo sustituye donde haya conflicto.

Sea

```
C = {zim, biblioteca, tts, videos}                                  (conjunto cerrado de capacidades)
M = {ok, no_compilada, contenido_ausente, contenido_invalido,
     dependencia_ausente, dependencia_fallida}                       (conjunto cerrado de motivos)
```

**Regla de incremento.** `version` incrementa **si y sólo si** cambia `C` o cambia `M`. Nada más la
incrementa: ni un cambio de implementación, ni un arreglo de bug, ni un cambio de estado en runtime.
Un artefacto compilado publicado tiene una `version` **constante**: es un hecho del build, igual que
`soportada`.

**Tabla de resolución cliente ↔ servidor:**

| Cliente | Servidor | Comportamiento exigido al cliente |
|---|---|---|
| `version = n` | `version = n` | Normal |
| `version = n` | `version = m > n` | Usa las claves de `C` que reconoce. **Ignora en silencio** las claves desconocidas. Trata un `motivo` desconocido como **no disponible para esa capacidad**, dejando las demás intactas. **No rechaza el cuerpo entero.** |
| `version = n` | `version = m < n` | No ocurre dentro de un artefacto (la versión no decrece). Si ocurre, es un fallo de despliegue: modo conservador global. |
| cualquiera | cuerpo inválido, ausente o `version` no entera | **Todo no disponible** (fail-closed global) |
| cualquiera | `200` pero `Content-Type` no es JSON | Todo no disponible |

**Reglas del servidor:**

1. Emite **sólo** claves de `C` y **sólo** motivos de `M` en su `version`.
2. **Nunca** reutiliza un código de `M` con significado distinto. Cambiar el significado de `ok`, por
ejemplo, exige una `version` nueva y una nota de retirada; no es un cambio de texto.
3. **No** negocia versiones: ignora `Accept-Version` y cualquier cabecera equivalente. El cliente se
adapta, el servidor declara.
4. **No** emite datos volátiles dentro de `capacidades` (sin timestamps, uptime, contadores, conteos de
contenido, versiones de biblioteca).

**Escala de degradación, de más local a más global.** El cliente debe degradar en el punto más estrecho
posible:

```
motivo desconocido     → esa capacidad no disponible      (las demás siguen)
clave desconocida       → se ignora                        (las demás siguen)
capacidad ausente       → esa capacidad no disponible
version desconocida     → capacidades reconocidas siguen, el resto no disponible
cuerpo inválido/ausente → TODO no disponible
```

**Por qué per-capacidad y no global:** un `tts` desconocido no debe apagar la biblioteca. Degradar de
más es un error tan caro como degradar de menos, y el aula pierde funciones que sí funcionaban.

---

## 7 ter. Ventana de frescura: techo de revalidación, no excusa

La ventana de **10 s es provisional** y es configurable. Pero su significado es más estrecho de lo que
parece, y conviene fijarlo:

**La ventana gobierna únicamente la detección proactiva.** Es el intervalo máximo entre dos
revalidaciones *programadas* de las comprobaciones caras (presencia del binario de TTS, codificador de
vídeo, recorrido del directorio de contenido).

**La ventana NO gobierna la propagación de un fallo observado.** Regla dura:

> Si el servidor **observa** que una capacidad falla mientras atiende una operación —el proceso murió,
el contenido no se puede abrir, la dependencia sale con código distinto de cero—, esa capacidad pasa a
`disponible=false` **antes de responder a la petición siguiente**. No se espera a que expire la ventana.

Es decir: la ventana acota cuánto puede tardar el servidor en **enterarse** de algo que no ha visto.
Nunca autoriza a **seguir anunciando** algo que ya vio fallar. Un fallo conocido y no propagado no es
un desfase aceptable: es el defecto H2 de RD-02C servido con un contrato encima.

Consecuencia comprobable: `A13` exige que tras provocar un fallo, la **primera** petición siguiente a
`/api/capacidades` ya lo refleje, sin importar cuánto falte para los 10 s.

---

## 7 quater. Dos clases de garantía

Este contrato declara dos cosas distintas y confundirlas es el error que hay que evitar.

### Garantía A — disponibilidad declarada (`/api/capacidades`)

Es una **afirmación sobre el estado conocido**, no una promesa de servicio.

- Alcance: «en el momento en que se calculó la instantánea, y hasta la próxima invalidación o
revalidación, esta es nuestra lectura del estado».
- Puede ser **optimista dentro de la ventana** (§7 ter).
- Su valor para el cliente es **decidir qué ofrecer en la interfaz**, no saber si una operación concreta
  va a funcionar.
- No se cachea (`no-store`), porque un valor viejo convierte una lectura optimista en una mentira.

### Garantía B — garantía por operación (cada ruta real)

Es la garantía **fuerte** y es **por petición**.

- `/zim/{*path}`, `/api/wikipedia/zims`, `/api/wikipedia/search`, la ruta de TTS y la de vídeo responden
  **200 sólo si la operación se completó**. Si la capacidad falla, responden **503** con el mensaje
  canónico de degradación.
- No admite caché de intermediario: un `200` de hace una hora no es una garantía de ahora.
- **Nunca** responde 200 sobre contenido que no puede servir. Un 200 sobre contenido ilegible está
  prohibido por este contrato, aunque la instantánea diga `disponible=true`. Es el caso H2 de RD-02C y
  es la razón de que esta distinción exista.

### Precedencia

> **B manda siempre sobre A.** Cuando las dos discrepan, gana la ruta real. `A` puede decir que sí y `B`
> responder 503; eso es correcto y el cliente debe tolerarlo. Lo que **no** puede pasar es que `B`
> devuelva 200 sobre algo inservible, porque eso ya no es una discrepancia de anuncio: es una mentira.

Corolario para el cliente: **una interfaz no debe inferir éxito de una operación a partir de `A`.** `A`
habilita el botón; `B` decide si la acción funcionó.

---

## 8. Semántica HTTP

| Aspecto | Decisión |
|---|---|
| Método y ruta | `GET /api/capacidades`. Sin `POST`. Sin parámetros. |
| Autenticación | **Ninguna.** Montada fuera de `AuthLayer`: la primitiva de descubrimiento no puede requerir identidad, o el frontend no puede decidir antes de autenticar. |
| Código | **200** siempre que el proceso esté vivo y el contrato sea válido. Un `503` aquí es el defecto que el contrato prohíbe. |
| `Content-Type` | `application/json; charset=utf-8` |
| `Cache-Control` | `no-store` |
| `ETag` | No se emite. La respuesta cambia con el estado y cachearla reintroduce el error `soportada`/`disponible`. |
| `HEAD` | Derivado del framework, sin cuerpo. |
| Efectos laterales | Ninguno: sin escritura, sin mutación de estado observable. Idempotente y verificable con dos llamadas. |
| Errores propios | Ninguno. Un 500 aquí es un bug, no un estado del contrato. |

Nota sobre `no-store`: sin él, un intermediario —incluido el service worker de la PWA— puede servir
un `disponible=true` de hace horas. La corrección del propietario lo mantiene explícitamente por esa
razón.

---

## 9. Comportamiento ante fallos

| Situación | Servidor | Cliente |
|---|---|---|
| Dependencia no instalada | `200`, `soportada=true`, `disponible=false`, `dependencia_ausente` | Oculta la función; el operador debe instalar |
| Dependencia instalada que falla | `200`, `soportada=true`, `disponible=false`, `dependencia_fallida` | Oculta la función; señal distinta al operador |
| Contenido ausente | `200`, `contenido_ausente` | Degrada a «sin contenido» sin romper la navegación |
| Contenido corrupto o ilegible | `200`, `contenido_invalido`; la ruta de esa capacidad devuelve 503 | No intenta servir; informa |
| Capacidad no compilada | `200`, `soportada=false`, `disponible=false`, `no_compilada` | No muestra el punto de entrada |
| Endpoint sin respuesta o timeout | — | Todo no disponible (*fail-closed*) |
| Cuerpo malformado | — | Modo conservador; registra, no rompe |
| Código de `motivo` desconocido | No lo produce (conjunto cerrado) | No disponible; degrada |
| Capacidad nueva de una versión futura | No la produce en `v1` | La ignora |
| La instantánea está vieja y la capacidad falla | La ruta devuelve 503 igualmente | Ve 503 y degrada |

---

## 10. Pruebas de aceptación

Sobre los mecanismos de `tests/docker/` (presentes en la línea base `educonect-baseline-v1`).

| # | Afirmación | Comprobación | Exigencia de la corrección |
|---|---|---|---|
| **A1** | `200` en perfil **core** | `curl -s -o /dev/null -w '%{http_code}' /api/capacidades` → `200` | — |
| **A2** | `200` en perfil **full** | idem | — |
| **A3** | El cuerpo valida contra el esquema | `check-jsonschema --schemafile api-capacidades-v1.schema.json` → exit 0 | — |
| **A4** | Coherencia `zim` en **core** | `zim.soportada=false`, `motivo=no_compilada`, **y** `/api/wikipedia/zims` → `503`, **y** `/zim/` → `503` | — |
| **A5** | Coherencia `zim` en **full sin contenido** | `soportada=true`, `disponible=false`, `motivo=contenido_ausente`; listado de ZIM **vacío**; `/api/wikipedia/zims` → `200` | — |
| **A6** | Coherencia `zim` en **full con el fixture** | `soportada=true`, `disponible=true`, `motivo=ok`; `/api/wikipedia/zims` → **200 y anuncia el libro del fixture**; y una página conocida del fixture por `/zim/<ruta>` → **200** cuyo cuerpo **contiene un literal conocido** | **Corregida**: no basta con «distinto de 503». El literal esperado se toma de `tests/fixtures/zim/paginas/portada.html` en tiempo de prueba, no se escribe a mano, para que no derive. |
| **A7** | Estabilidad | dos peticiones consecutivas sin cambio de estado → cuerpos idénticos byte a byte | — |
| **A8** | Sin filtraciones | el cuerpo no contiene rutas (`/`, `\`, `:`), nombres de usuario, `pid`, versiones de biblioteca ni conteos | **Ampliada**: «no incluye rutas, secretos, nombres de usuario ni detalles internos» |
| **A9** | Ninguna combinación inválida se emite | el servidor, en los perfiles core y full y con contenido ausente/válido, nunca emite uno de los seis triples inválidos | **Nueva** |
| **A10** | Sin dependencia de identidad | la misma petición **sin** `Authorization` → `200` | — |
| **A11** | **Control negativo del validador** | se le entregan al validador **seis documentos inválidos** (uno por invariante `I1`–`I6`); **todos deben ser rechazados** | **Nueva**: prueba que el validador muerde |
| **A12** | **Contenido corrupto** | se trunca una **copia** del fixture → `contenido_invalido`, ruta `503`; se restaura → vuelve a `ok` | **Nueva** |
| **A13** | **Cambio de disponibilidad sin reinicio, y propagación inmediata de un fallo** | (a) montar y desmontar contenido en caliente → `contenido_ausente ⇄ ok` en ambos sentidos; (b) repetir dentro de la ventana de frescura **no** lanza nuevas sondas (no se crean procesos ni se recorre el directorio); (c) **provocar un fallo conocido y comprobar que la petición inmediatamente siguiente a `/api/capacidades` ya lo refleja**, sin esperar los 10 s | **Nueva (b) y corregida (c)**: la ventana es techo de revalidación, no excusa para anunciar un fallo ya observado (§7 ter) |
| **A14** | **`dependencia_ausente` ≠ `dependencia_fallida`** | con el binario de TTS ausente → `dependencia_ausente`; con el binario presente pero que sale con código distinto de cero → `dependencia_fallida` | **Nueva**: es la prueba que justifica el sexto código |
| **A15** | **Control negativo de A4–A6** | se invierte artificialmente un campo y la sonda **debe fallar**; si no falla, la sonda no muerde y A4–A6 no valen | **Mantenida** de `pi-011` |
| **A16** | `Cache-Control` | la cabecera es `no-store` | **Nueva** |
| **A17** | **Precedencia de la garantía por operación sobre la declarada** | con la instantánea en `disponible=true` para `zim`, se rompe el contenido **sin** invalidar la instantánea (se fuerza el caso) → la ruta real devuelve **503**, no 200; el cliente tolera la discrepancia | **Nueva**: es la prueba de §7 quater |
| **A18** | **Degradación per-capacidad, no global** | con un `motivo` desconocido inyectado en una sola capacidad → el cliente deshabilita **esa** y mantiene las demás operativas; con un cuerpo inválido → deshabilita **todas** | **Nueva**: la escala de degradación de §7 bis |

**Sobre A9 y A11 juntas:** A11 valida el validador con datos sintéticos; A9 valida el servidor con
datos reales. Ninguna de las dos, sola, prueba lo mismo. Sin A11, un validador roto hace pasar A9
siempre; sin A9, el servidor podría emitir estados que nadie comprueba.

**Sobre A13:** la comprobación de «no lanza nuevas sondas» se hace contando procesos hijos y
observando el `mtime` del directorio de contenido antes y después de N peticiones dentro de la
ventana. Si el conteo crece con las peticiones, la instantánea no está haciendo su trabajo y el
contrato de coste está roto.

---

## 11. Lo que este contrato no decide

- Qué hace el frontend con cada código (**D-05e**, no autorizada todavía).
- Si el conjunto de capacidades crece: es aditivo, con su `version` incrementada y su aprobación.
- **Nada sobre el lector ZIM.** RD-02C estudia un lector separado; si se aprueba, `zim.disponible`
  pasará a describir un proceso aparte. **El contrato no cambia por eso**, que es precisamente su
  valor: el adaptador de RD-02C se enchufa detrás de la misma forma.
- El valor exacto de la ventana de frescura (§7): propuesta 10 s, decisión de la revisión conjunta.

---

## 12. Estado y siguiente paso

Contrato aprobado con las diez correcciones incorporadas y **publicado antes de tocar el router**,
como se exigió.

Lo que falta, en orden, y nada de esto está hecho:

1. Revisión conjunta de DEV1/DEV2/DEV3 del §7 (ventana de frescura) y del §6 (versiones), en la
   agenda de [`../agenda-decisiones-conjuntas.md`](../agenda-decisiones-conjuntas.md).
2. Implementación en una unidad posterior, con A1–A16. **Requiere revisión de los tres** si toca
   `src/models.rs`, que es contrato.
3. D-05e, sólo después.
