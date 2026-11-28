# Agenda de decisiones conjuntas — convocatoria DEV1 / DEV2 / DEV3

- **Convocada por:** autorización del propietario del 2026-11-27 («Convoca la revisión conjunta de
  DEV1, DEV2 y DEV3»).
- **Objeto:** desbloquear el desarrollo educativo paralelo sin que tres personas escriban el mismo
  esquema tres veces.
- **Estado:** agenda **preparada, sin convocar formalmente**. Las fechas las fija el propietario.
- **Regla de la sesión:** se decide o se aplaza con fecha. No se decide «implícitamente» por haber
  empezado a codificar.

---

## Por qué esta sesión no puede ser una conversación suelta

Tres hechos, todos verificados en el repositorio:

1. **El esquema no admite iteración paralela.** `src/models.rs` y toda migración requieren revisión de
   los tres (S3). Si DEV1 y DEV2 escriben tablas distintas en paralelo, el conflicto aparece en el
   momento en que ambas necesitan `usuarios`.
2. **No hay ledger de migraciones (G1).** Hoy cada migración se re-ejecuta en cada arranque y la
   idempotencia depende de `IF NOT EXISTS`. Tres migraciones nuevas sobre ese mecanismo no tienen orden
   garantizado ni son reproducibles.
3. **Hay un conflicto de contrato ya escrito.** `docs/contratos-integracion.md:54` manda UUIDv7;
   `MODELO-DOMINIO.md` propone id opaco sin versión impuesta. Los dos no pueden seguir vivos.

Sin esta sesión, el trabajo paralelo produce modelos duplicados. Con ella, produce dos paquetes que se
encuentran.

---

## Sesión 1 — Preparación (sin decisión)

**Objetivo:** que los tres lean lo mismo. Duración corta, sin acuerdos.

| # | Qué se lee | Quién lo explica |
|---|---|---|
| 1 | [`contratos/modelo-educativo.md`](contratos/modelo-educativo.md) — E1–E12 como base, no como esquema | DEV3 |
| 2 | [`../docs/contratos-integracion.md`](../contratos-integracion.md) — contrato vigente y sus decisiones abiertas #1–#6 | DEV3 |
| 3 | [`onboarding/dev1-firebase.md`](onboarding/dev1-firebase.md) — estado real de identidad y persistencia | DEV1 |
| 4 | [`onboarding/dev2-profesor-alumno.md`](onboarding/dev2-profesor-alumno.md) — estado real de los flujos | DEV2 |

**Salida esperada:** lista de discrepancias entre lo documentado y lo real. Sin decisiones.

---

## Sesión 2 — Gates G0 y G1 (bloqueantes)

### G1 — Ledger de migraciones

**Es el primero, aunque parezca infraestructura.** Sin ledger, ninguna decisión de esquema es
implementable.

| Aspecto | Propuesta base | Alternativas |
|---|---|---|
| Registro | tabla `migraciones(version, nombre, aplicada_en, checksum)` | fichero de estado fuera de la base |
| Orden | entero monotónico, aplicado en orden, sin huecos | fecha-versionado (`20261127_01`) |
| Migración ya aplicada con checksum distinto | **falla el arranque** | se ignora (peligroso: no lo recomiendo) |
| Migración futura detectada (base más nueva que el binario) | **falla el arranque** | se ignora |
| Qué pasa con las cinco migraciones actuales | se registran como aplicadas en la primera ejecución con ledger | se re-ejecutan para siempre (statu quo) |

**Decide:** DEV3 propone, los tres revisan. **Bloquea:** todo.

### G0 — Aprobación arquitectónica del modelo

Sólo puede cerrarse **después** de G1, porque la forma del ledger condiciona cómo se escriben las
migraciones de `usuarios`, `colecciones`, etc.

**Decide:** humano + DEV3 + DEV2.

---

## Sesión 3 — Identidad (G2)

**Es la sesión donde DEV1 tiene la palabra y DEV2 tiene el veto práctico:** sin identidad no hay
«mi aula», y un modelo de identidad que no contemple aula es inútil para DEV2.

| # | Decisión | Entrada necesaria | Decide |
|---|---|---|---|
| G2.1 | **Firebase Auth para administradores, para todos, o para nadie** | Decisión abierta #2 del contrato + restricciones offline | Humano, a propuesta de DEV1 |
| G2.2 | **Formato de ID**: opaco con UUIDv7 recomendado (relajar `I1`) vs UUIDv7 obligatorio | Conflicto §3.2 | Humano + los tres |
| G2.3 | **Rol: atributo del usuario o de la membresía** | ¿Docente en un aula y estudiante en otra? | Los tres |
| G2.4 | **Verificación offline de token**: qué secreto/clave, dónde vive, cómo se rota en un aula sin administrador | Restricciones §5 del paquete DEV1 | DEV1 propone |
| G2.5 | **Revalidación de rol en BD (E11)**: por petición, por request-context, o cacheada | Coste vs escalada | DEV1 propone, DEV3 revisa |
| G2.6 | **Ventana de invalidación de los tokens actuales** | Cambiar claims invalida todo | Los tres |
| G2.7 | **`node_id`**: quién lo asigna, cuándo, y qué pasa si un nodo se renumera | Contrato §3 | Los tres |

**Salida:** contrato de identidad escrito, con forma y pruebas de aceptación (patrón `S4`).

---

## Sesión 4 — Dominio educativo (G3 parcial)

| # | Decisión | Entrada necesaria | Decide |
|---|---|---|---|
| E.1 | **Jerarquía aula/grupo**: ¿contención o dos ejes? profundidad máxima, ciclos, borrado | §3.3 | DEV2 propone |
| E.2 | **Asignación con excepciones**: ¿exclusión explícita, grupo ad-hoc, o alumno por alumno? | §3.4 | Humano + DEV2 |
| E.3 | **Progreso monotónico**: ¿sube al repetir aunque el intento sea peor? | §3.5 | Humano (es pedagógico) |
| E.4 | **Nota del período**: derivada de intentos, agregación, o campo que escribe el docente | §3.4 | Humano + DEV2 |
| E.5 | **Idempotencia**: ¿clave del cliente o del servidor? formato, longitud, conflicto entre dispositivos | §3.5 | DEV1 + DEV2 |
| E.6 | **Autorización**: qué se comprueba por petición y cómo se garantiza que ninguna consulta se olvide de filtrar | §3.6 | DEV1 + DEV3 |
| E.7 | **Rutas públicas heredadas**: convivencia o corte; qué pasa con las filas de `progreso` con nombre libre | §3.7 | Humano + los tres |
| E.8 | **Taxonomía y metadatos de contenido** | RD-01B + G3 | DEV2 |

---

## Sesión 5 — Contenido y licencias (G3)

| # | Decisión | Entrada | Decide |
|---|---|---|---|
| L.1 | Qué contenido sin autorización suficiente **sale de la distribución** (PhET NC, títulos pendientes, PDF de Norma) | [`licencias/inventario-decisiones.md`](licencias/inventario-decisiones.md) | Humano (jurídico) |
| L.2 | Atribución visible de PhET junto al punto de uso | Licitación de la propia licencia | DEV2 ejecuta |
| L.3 | ¿Se conserva el perfil `full` con GPL en proceso? | [`licencias/libzim.md`](licencias/libzim.md) | Humano |
| L.4 | Avisos de terceros completos | J6 | DEV3 |
| L.5 | Régimen del contenido comunitario wayúu | J11, J12 | Humano (jurídico y ético) |

---

## Sesión 6 — Seguridad del lector

| # | Decisión | Entrada | Decide |
|---|---|---|---|
| S.1 | Resultado de confirmar H3: ¿el defecto existe? | `odd/tasks/proteger-lector-actual.md` T1 | DEV3 ejecuta |
| S.2 | Si existe: qué opción de aislamiento (origen separado / sandbox / CSP / sin JS) | [`kiwix/backlog-seguridad.md`](kiwix/backlog-seguridad.md) | Humano + los tres |
| S.3 | ¿Se autoriza la migración de RD-02C, o queda sólo el estudio? | [`kiwix/rd02c-propuesta-implementacion.md`](kiwix/rd02c-propuesta-implementacion.md) | Humano |

**S.1 y S.2 no esperan a S.3.** El defecto, si existe, está activo hoy.

---

## Orden de dependencias

```
Sesión 1 (leer)
   └─► G1 ledger  ─►  G0 modelo
                         ├─► G2 identidad ──┬─► E.5, E.6
                         │                  └─► F-01 (DEV1)
                         └─► G3 contenido ──┬─► E.1–E.4, E.8
                                            └─► E-01 (DEV2)
S.1 H3 ─► S.2 aislamiento        (independiente de todo lo anterior)
L.1 exclusión de contenido       (independiente; no requiere elegir licencia)
```

**Lo que puede empezar ya, sin ninguna decisión previa:**

- DEV1: **F-01** (diseño de la frontera Firebase) — es propuesta, no implementación.
- DEV2: **E-01** (validación del dominio contra flujos reales) — es propuesta, no implementación.
- DEV3: **G1** (ledger) y **S.1** (confirmar H3).

---

## Reglas de la sesión

1. **Cada decisión se escribe en el repositorio**, no en el acta de una reunión. El documento que se
   actualiza es el del contrato correspondiente.
2. **Una decisión aplazada lleva fecha.** «Lo vemos después» no es una decisión.
3. **Nadie implementa un esquema antes de que su gate esté cerrado.** Si alguien lo hace, la unidad se
   descarta, aunque funcione: el problema no es el código, es que fija una decisión que no se tomó.
4. **Las decisiones que son jurídicas no se votan por mayoría.** Titularidad, licencia y contenido
   comunitario las decide el propietario con asesoría.
5. **Lo que no se midió se declara no medido.** Vale para esta sesión igual que para la evidencia.

---

## Estado de la convocatoria

| Sesión | Contenido | Estado |
|---|---|---|
| 1 | Preparación y lectura común | **Lista para convocar** |
| 2 | G0 (modelo) y G1 (ledger) | **Lista para convocar** — bloqueante |
| 3 | G2 identidad | Espera propuesta de DEV1 (**F-01**) |
| 4 | Dominio educativo | Espera validación de DEV2 (**E-01**) |
| 5 | Contenido y licencias | Espera decisión jurídica del propietario |
| 6 | Seguridad del lector | Espera confirmación de H3 (DEV3) |

**Ninguna sesión puede celebrarse sin que los tres hayan leído la Sesión 1.** No es formalismo: la
mitad de los desacuerdos previsibles desaparecen cuando los tres ven el mismo `archivo:línea`.
