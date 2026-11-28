# Coordinación en GitHub — propuesta operativa

- **Premisa nueva:** GitHub es la **fuente compartida de verdad** para los tres desarrolladores.
- **Qué cambia:** `.git/coordinacion/` sigue siendo el registro de los agentes locales (Pi/DEV3, Codex,
  DeepSeek). Deja de ser **requisito** para un desarrollador externo. Nada que un humano necesite para
  trabajar puede vivir sólo ahí.
- **Estado:** propuesta preparada. Las plantillas están materializadas en `.github/`; **las etiquetas y
  los issues no se crean todavía** — eso es una acción sobre el tracker y espera tu autorización.

---

## 1. Etiquetas

Tres ejes ortogonales. Un issue puede llevar varias, pero **exactamente una** de prioridad.

### Prioridad

| Etiqueta | Significado | Color sugerido |
|---|---|---|
| `P0-bloqueante` | Impide trabajar a otro o deja el producto inseguro | `b60205` |
| `P1-alta` | Bloquea una unidad de otro desarrollador | `d93f0b` |
| `P2-media` | Trabajo planificado, sin bloqueo | `fbca04` |
| `P3-baja` | Mejora, deuda, documentación | `0e8a16` |

### Área

| Etiqueta | Alcance |
|---|---|
| `area/identidad` | usuarios, roles, autenticación, sesión, Firebase |
| `area/educativo` | aulas, grupos, membresías, asignaciones, progreso, intentos, quizzes |
| `area/infra` | migraciones, ledger, arranque, persistencia, despliegue |
| `area/contenido` | biblioteca, diccionario, ZIM, taxonomía, importación |
| `area/seguridad` | aislamiento de origen, credenciales, autorización |
| `area/documentacion` | contratos, onboarding, evidencia |

### Tipo y bloqueo

| Etiqueta | Significado |
|---|---|
| `tipo/contrato` | propone una forma acordada. **No implementa** |
| `tipo/implementacion` | escribe código de producto |
| `tipo/investigacion` | produce evidencia, no código |
| `tipo/decision` | espera decisión humana o conjunta |
| `bloqueado` | no puede avanzar; el issue debe decir por qué y por quién |
| `bloquea-a-otros` | su cierre desbloquea trabajo de otra persona |

### Responsable

`dev1-firebase` · `dev2-educativo` · `dev3-infra` · `owner` (propietario del proyecto)

---

## 2. Plantilla de tarea

En [`.github/ISSUE_TEMPLATE/tarea.md`](../../../.github/ISSUE_TEMPLATE/tarea.md). Obliga a declarar
objetivo, alcance, **fuera de alcance**, criterios de aceptación con **control negativo**, dependencias y
superficies. El control negativo es obligatorio porque una prueba que no puede fallar no prueba nada.

## 3. Plantilla de Pull Request

En [`.github/pull_request_template.md`](../../../.github/pull_request_template.md). Obliga a declarar qué
criterios se cumplieron, **qué no se probó**, y si toca superficies reservadas o contratos.

## 4. Revisión de contratos compartidos

Un contrato no se revisa en un PR de código: se revisa **antes**, en su propio issue `tipo/contrato`.

```
1. Alguien abre un issue `tipo/contrato` con la forma propuesta, los códigos cerrados y las pruebas
   de aceptación.   (patrón que funcionó en pi-011 y en D-05d)
2. Los tres revisan y comentan EN el issue, no en un chat.
3. El propietario aprueba o devuelve. Si aprueba, la aprobación queda escrita en el issue.
4. Sólo entonces se abre un PR de implementación que lo cita: `Closes #<contrato>`.
5. Un PR que cambia `src/models.rs` o cualquier migración necesita revisión de los tres (S3).
```

**Nada de esto congela el modelo educativo todavía.** `E1–E12` son base de discusión y esperan la
revisión conjunta descrita en [`../agenda-decisiones-conjuntas.md`](../agenda-decisiones-conjuntas.md).

---

## 5. Issues iniciales — textos listos para crear

Cada uno está completo para pegarlo tal cual. **No se crean en esta unidad.**

### I1 · F-01 — Identidad, autenticación offline y frontera Firebase

- **Etiquetas:** `P1-alta` `area/identidad` `tipo/contrato` `dev1-firebase`
- **Dependencias:** ninguna para empezar (es diseño). Bloquea a I6.

**Objetivo.** Proponer, con evidencia, la frontera entre Firebase y el nodo para identidad y
autenticación. **Es diseño, no implementación.**

**Contexto.** No existe ni una línea de Firebase en el código. Los claims del JWT son sólo
`{sub, exp, iat}` —sin rol, sin nodo—. No hay tabla `usuarios`. «Profesor» es el admin del dispositivo.
La decisión abierta #2 del contrato (`docs/contratos-integracion.md:328-329`) dice literalmente
«Dev 1 propone».

**Alcance.** Documento de propuesta que responda: ¿Firebase Auth para administradores, para todos, o para
nadie? ¿Cómo se verifica un token sin red? ¿Qué pasa con los tokens actuales, que se invalidan todos al
extender los claims? ¿Cómo se revalida el rol en BD sin una consulta por petición? ¿Qué NO va a Firestore
y cómo se prueba la no-duplicación?

**Fuera de alcance.** Escribir código de producto. Esquemas definitivos. Sincronización.

**Criterios de aceptación.**
1. La propuesta cita `archivo:línea` para cada afirmación sobre el código actual.
2. Responde las seis preguntas de arriba, cada una con su consecuencia si se elige la alternativa.
3. Declara qué no pudo verificar y por qué.
4. **Control negativo:** identifica al menos un diseño plausible que **no** funciona offline, y explica
   por qué falla. Un documento que sólo propone lo que le gusta no acredita haber evaluado.

**Lectura obligatoria.** `docs/equipo/onboarding/dev1-firebase.md`.

---

### I2 · E-01 — Flujos profesor-alumno y validación del dominio educativo

- **Etiquetas:** `P1-alta` `area/educativo` `tipo/contrato` `dev2-educativo`
- **Dependencias:** ninguna para empezar. Bloquea a I6 y a la Sesión 4 de la agenda.

**Objetivo.** Validar el dominio educativo contra los flujos reales y producir correcciones al modelo
**antes** de que nadie escriba esquema.

**Contexto.** Los intentos **no se persisten**: la nota vive en `localStorage`. El progreso se escribe con
`0` literal y el avance real por módulo nunca llega al servidor: tres verdades distintas. La nómina del
docente se deriva de las filas de `progreso`, así que **un alumno que nunca escribió progreso no existe
para el sistema**.

**Alcance.** Recorrido real del docente y del alumno; contraste con `E1–E12`; taxonomía y metadatos;
brechas de accesibilidad priorizadas por impacto; decisiones que se necesitan de DEV1.

**Fuera de alcance.** Código de producto. Esquemas definitivos.

**Criterios de aceptación.**
1. Los dos recorridos derivados del código, con `archivo:línea`.
2. Para cada una de `E1–E12`: ¿sirve al flujo observado, le falta algo o le sobra?
3. Responde concretamente: ¿`E5` (un solo destino) cubre «tarea para 4.º A excepto estos tres»? ¿`E6`
   (progreso monotónico) es correcto cuando un alumno reprueba?
4. Brechas de accesibilidad ordenadas por impacto en el aula, no por checklist.
5. **Control negativo:** identifica al menos una regla de `E1–E12` que **no** debe implementarse como está
   escrita, y explica el caso real que la rompe.

**Lectura obligatoria.** `docs/equipo/onboarding/dev2-profesor-alumno.md`.

---

### I3 · D-04b — Ledger de migraciones SQLite (cierra G1)

- **Etiquetas:** `P0-bloqueante` `area/infra` `tipo/implementacion` `dev3-infra` `bloquea-a-otros`
- **Dependencias:** ninguna. **Bloquea todo esquema nuevo** (I6 y cualquier migración).

**Objetivo.** Cerrar G1: registro verificable de qué migración y qué semilla se aplicó, con checksums,
orden, exclusión de concurrentes, adopción segura, detección de divergencia, backup con WAL y recuperación
verificable.

**Contexto.** No existe ledger. Cada migración se re-ejecuta en cada arranque. Las semillas corren
**antes** que 002–005. Dos `DELETE` destructivos y cinco `rebuild` de FTS ocurren en cada boot. Nada
impide dos procesos migrando a la vez, y el puerto se vincula **después** de abrir la base.

**Alcance.** Diseño ya presentado en `odd/tasks/d04b-ledger-migraciones.md`. Implementación por pasos
P1–P5, con el riesgo declarado en cada uno.

**Fuera de alcance.** Tablas de `usuarios`, `aulas`, `grupos`, `intentos`. Modelo educativo.

**Criterios de aceptación.** C1–C13 del documento, **cada uno con su control negativo en rojo**.

**Prohibición explícita.** No marcar migraciones antiguas como aplicadas sin verificar el estado real del
esquema. Una base existente se adopta **verificando forma**; si está parcial, **aborta con informe**, no
adivina.

---

### I4 · H3 — Aislamiento de origen del lector ZIM

- **Etiquetas:** `P0-bloqueante` `area/seguridad` `tipo/implementacion` `dev3-infra`
- **Dependencias:** ninguna. **Bloqueante de distribución.**

**Objetivo.** Separar el contenido de terceros del origen educativo, sobre el lector integrado actual.

**Contexto — confirmado con navegador real el 2026-11-27.** Una página servida desde el propio ZIM leyó
`localStorage["educonect_admin_token"]` (el JWT real) y ejecutó `POST /api/profesor/quizzes` con **201**.
No existe CSP, `X-Frame-Options` ni `nosniff` en ningún `.rs`. El handler fija una sola cabecera,
`CONTENT_TYPE`. `LISTEN_ADDR` por defecto es `0.0.0.0:8080`: alcanzable desde la LAN.

**Alcance.** Elegir e implementar la mitigación entre M1 (origen separado, **preferida**), M2 (`sandbox`
sin `allow-same-origin`), M4 (`nosniff` + `frame-ancestors`, siempre). Añadir las sondas S1–S5.

**Fuera de alcance.** Sustituir el lector integrado (RD-02C no está autorizado). Mover el JWT fuera de
`localStorage` es **I5**, unidad aparte.

**Criterios de aceptación.**
1. Desde el contenido servido no se puede leer `localStorage`, `sessionStorage` ni `document.cookie` del
   origen educativo.
2. El contenido legítimo de la matriz de §8 de la evidencia sigue funcionando (estático, JS propio, vídeo,
   enlaces internos, búsqueda).
3. S1–S5 con sus controles negativos; **S2 sale 2, no 0, si no hay navegador**.
4. `/api/*` protegidas siguen devolviendo 401 con Bearer inválido.

---

### I5 · M6 — Sacar el JWT de `localStorage`

- **Etiquetas:** `P2-media` `area/seguridad` `area/identidad` `tipo/decision`
- **Dependencias:** I1 (identidad). Complementa a I4, no la sustituye.

**Objetivo.** Decidir y ejecutar dónde vive el token de sesión.

**Contexto.** Hoy está en `localStorage` en el dashboard Next (`profesores-view.tsx:23,69`) y en
`sessionStorage` en el panel vanilla (`static/profesor.html:562,602`). Dos políticas de vida de sesión en
el mismo producto. Cualquier XSS —no sólo contenido ZIM— basta para robarlo.

**Alcance.** Decidir entre cookie `HttpOnly`, memoria con refresco, o la alternativa que proponga I1.
Unificar las dos políticas.

**Criterios de aceptación.** Una sola política; el token no accesible por JS; el panel vanilla y el Next
se comportan igual ante cierre de pestaña y expiración.

---

### I6 · Contrato D-05d — implementación

- **Etiquetas:** `P2-media` `area/infra` `tipo/implementacion` `dev3-infra`
- **Dependencias:** revisión de los tres del contrato (I7). **Bloquea a D-05e.**

**Objetivo.** Implementar `GET /api/capacidades` según `docs/equipo/contratos/api-capacidades-v1.md`.

**Fuera de alcance.** D-05e. Cambiar `src/models.rs` sin revisión de los tres.

**Criterios de aceptación.** A1–A18, con los controles negativos A11, A15 y A17–A18.

---

### I7 · Revisión conjunta de contratos (Sesión 1 y 2)

- **Etiquetas:** `P0-bloqueante` `tipo/decision` `owner` `bloquea-a-otros`
- **Dependencias:** ninguna.

**Objetivo.** Cerrar G0 y G1 en sesión conjunta, y fijar el calendario de las sesiones 3–6.

**Alcance.** Agenda completa en `docs/equipo/agenda-decisiones-conjuntas.md`.

**Criterios de aceptación.**
1. Las ocho decisiones de la Sesión 3 y 4 tienen dueño y fecha, o están aplazadas con fecha.
2. El conflicto `I1` (UUIDv7) contra modelo de id opaco está resuelto en un sentido o en otro.
3. Cada decisión queda escrita en el repositorio, no en un acta.

---

### I8 · Decisiones jurídicas pendientes

- **Etiquetas:** `P0-bloqueante` `tipo/decision` `owner` `area/documentacion`
- **Dependencias:** ninguna. **Bloquea la integración de contribuciones de todo el mundo.**

**Objetivo.** Resolver J1–J12 del inventario, empezando por la titularidad.

**Contexto.** No existe `LICENSE`. La titularidad tiene **tres candidatos incompatibles** ya escritos en
el repositorio. Sin regla de entrada, cada desarrollador conserva sus derechos y el proyecto no puede
ceder nada.

**Alcance mínimo para desbloquear.** J1 (titularidad), J2 (texto), J3 (regla de contribución). El resto
puede esperar, salvo J8/J10 (contenido no autorizado) que se resuelven **excluyendo**, y eso no requiere
elegir licencia.

---

## 6. Dependencias entre tareas

```
I8 (jurídico: titularidad)  ──► habilita integrar contribuciones de I1 e I2
I7 (revisión conjunta)      ──► G0 + G1 acordados
   │
   ├──► I3 (D-04b ledger)   ──► desbloquea TODO esquema
   │                              └──► I6 (D-05d impl) si toca models.rs
   ├──► I1 (F-01 identidad) ──► I5 (M6 JWT)
   └──► I2 (E-01 educativo) ──► Sesión 4 (dominio)

I4 (H3 aislamiento)         ──► independiente de todo. Bloqueante de distribución.
```

**Lo que puede empezar hoy sin esperar nada:** I1, I2, I4 y la Sesión 1.

---

## 7. Lo que no se hace en esta unidad

- **No se crean las etiquetas ni los issues.** Es una acción sobre el tracker y espera tu autorización;
  los textos de §5 están listos para pegarlos.
- **No se congelan los contratos educativos.** `E1–E12` siguen como base de discusión.
- **`.git/coordinacion/` se mantiene** para los agentes locales, sin convertirse en requisito para nadie.
- **No se absorben tareas de Codex.** DEV4-002 sigue con dueño Codex.

## 8. Cómo se crean, cuando lo autorices

```bash
# etiquetas
gh label create P0-bloqueante --color b60205 --description "Impide trabajar a otro o deja el producto inseguro"
# … (una por etiqueta de §1)

# issues (el cuerpo es la sección correspondiente de §5)
gh issue create --title "F-01 — Identidad, autenticación offline y frontera Firebase" \
  --label P1-alta --label area/identidad --label tipo/contrato --label dev1-firebase \
  --body-file .github/issue-bodies/F-01.md
```
