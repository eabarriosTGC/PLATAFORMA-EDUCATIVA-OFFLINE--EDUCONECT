# Compuertas técnicas — estado real al 2026-11-27

Documento de corte. **No describe intenciones: describe lo verificado.** Donde algo no se midió, dice
«no medido» y no se estima.

Referencia: `educonect-baseline-v1` → commit `28584049de888db82aaa9ba9e1aeee55014b85bb` (`origin/main`),
CI 6/6 en verde.

---

## Resumen

| Compuerta | Qué exige | Estado | Bloquea a |
|---|---|---|---|
| **T8** | Ejecutar el `.exe` en Windows real | **ABIERTA** | Soporte Windows; precondición 4 de RD-02C |
| **G1** | Ledger de migraciones | **ABIERTA** — unidad D-04b | **Todo** esquema nuevo |
| **G0** | Aprobación arquitectónica del modelo educativo | **ABIERTA** | `usuarios`, `colecciones`, `intentos` |
| **G2** | Contrato de identidad | **ABIERTA** — depende de F-01 | Login, roles, membresías |
| **G3** | Contrato de contenido | **ABIERTA** | Contenido, asignaciones |
| **D-05d** | Contrato de `/api/capacidades` | **CONTRATO APROBADO, SIN IMPLEMENTAR** | D-05e |
| **RD-02C** | Decisión sobre el lector | **ESTUDIO, DIRECCIÓN ACEPTADA, SUSTITUCIÓN NO AUTORIZADA** | — |
| **H3** | Aislamiento de origen del contenido | **POR CONFIRMAR** | Seguridad del contenido de terceros |
| **Licencia** | `LICENSE` + titularidad | **ABIERTA** | Distribución e integración de contribuciones |
| **DEV4-002** | Revisión de Codex | **APROBADA A NIVEL DE REVISIÓN, NO INTEGRADA** | Nada de esta fase |

---

## T8 — ejecución en Windows real

**Estado: ABIERTA.** El `.exe` nunca se ejecutó en Windows.

Lo que sí se verificó: el artefacto oficial `kiwix-tools_win-x86_64-3.8.1.zip` (18 301 924 B) con **md5
coincidente** con el editor (`95f953f7…`), ejecutado bajo **Wine 11.22**, reporta
`kiwix-tools 3.8.1 / libkiwix 14.1.1 / libzim 9.4.0` y sirve el fixture de D-05b (`/` → 200, catálogo →
200, contenido → 302).

**Wine no es Windows.** Falta un solo paso, y requiere la máquina virtual.

**Diferencia con lo que suele decirse:** la descarga ya no está pendiente de autorización, y el binario
ya no es un desconocido. Lo que falta es la ejecución en el sistema operativo real.

---

## G1 — ledger de migraciones

**Estado: ABIERTA.** Es la compuerta más subestimada y la que bloquea todo lo demás.

Hecho verificado: **no existe tabla de registro**. Cada migración se `include_str!` y se re-ejecuta en
cada arranque dentro de su propia transacción; la idempotencia depende de `IF NOT EXISTS`. Una
migración nueva sobre ese mecanismo **no tiene orden garantizado ni es reproducible**, y con tres
desarrolladores escribiendo migraciones en paralelo el orden importa.

**Corrección documental registrada:** T10 cerró la deduplicación del diccionario (`UNIQUE(palabra,
tipo, categoria)`, migración `008`). Eso **no** implica ledger, y **no** implica que la persistencia esté
resuelta. Los pendientes de D-04 siguen listados en `odd/tasks/fase0-estabilizacion.md`.

**Unidad asignada: D-04b.** Diseño antes de implementar.

---

## G0, G2, G3 — modelo educativo

**Estado de las tres: ABIERTAS.** Ninguna tabla de `usuarios`, `colecciones`, `membresias`,
`asignaciones`, `intentos` ni `resultados` existe en el repositorio.

| Gate | Contenido | Depende de |
|---|---|---|
| G0 | Aprobación de `MODELO-DOMINIO`, `IDENTIDAD-Y-PERMISOS`, `PROPUESTA-ESQUEMA` | G1 |
| G2 | Formato de ID, `nodo`, JWT v2, rol en token o en BD | F-01 (DEV1) |
| G3 | Licencia, hash y versión de contenido, mapeo del legado | Decisión jurídica |

**Conflicto vivo que hay que resolver antes de G0:** `docs/contratos-integracion.md:54` (`I1`) manda
**UUIDv7 en texto**; el modelo propuesto pide **id opaco sin versión impuesta**. Los dos no pueden
seguir escritos a la vez.

---

## D-05d — contrato de capacidades

**Estado: CONTRATO APROBADO Y PUBLICADO, SIN IMPLEMENTAR.**

Publicado en `docs/equipo/contratos/api-capacidades-v1.md` + `.schema.json`. Las seis invariantes son
ejecutables: verificado con `Draft202012Validator` → **6 válidos aceptados, 12 inválidos rechazados,
0 fallos**.

**No se tocó el router ni `src/models.rs`.** D-05e no empezó.

---

## RD-02C — lector ZIM

**Estado: estudio reportado, dirección arquitectónica aceptada, sustitución NO autorizada.**

Lo que la evidencia sostiene y lo que no, ya corregido:

- **Sostiene:** sin migración no hay búsqueda real (1 resultado frente a 20); el `.exe` con lector
  integrado **no es producible** desde aquí; sin supervisor, el lector muere sin reinicio y falla hacia
  adelante (anuncia un libro que no puede abrir).
- **No sostiene:** ninguna ventaja de rendimiento. Los rangos de latencia **se solapan**, el arranque no
  distingue, y el delta de memoria tiene **n=1** por arquitectura.

**Consecuencia:** la migración se justifica por función, portabilidad y operación. Presentarla como
«más rápida» sería falso.

---

## H3 — aislamiento de origen

**Estado: POR CONFIRMAR.**

El contenido ZIM se sirve **bajo el mismo origen** que la aplicación (`/zim/{*path}` en el mismo puerto
que `/api/*`), puede ejecutar JavaScript, y el CSP presente combina `sandbox` con `allow-same-origin`.
En `src/` no hay CSP, `sandbox` ni `nosniff` propios.

**Es el hallazgo de mayor severidad y el único que no depende de ninguna decisión de arquitectura.**
Registrado como tarea independiente en `odd/tasks/proteger-lector-actual.md`, con cierre posible como
«no aplicable» si la confirmación falla.

---

## Licencia y titularidad

**Estado: ABIERTA.** No existe `LICENSE`, y la titularidad tiene **tres candidatos incompatibles** ya
escritos en el repositorio (persona natural, Universidad de La Guajira, cliente institucional).

**Consecuencia operativa:** sin regla de entrada, cada desarrollador conserva sus derechos y el proyecto
no puede relicenciar ni ceder nada. Es la razón de que las contribuciones de DEV1 y DEV2 no se integren
todavía.

Discrepancia de libzim: resuelta por fuentes primarias. Denominador común seguro:
**`GPL-3.0-or-later`**.

---

## DEV4-002 — Codex

**Estado: aprobada a nivel de revisión (`APPROVED_WITH_FOLLOWUPS`), NO integrada.**

0 bloqueantes; 5 avisos nuevos y 2 heredados, todos con dueño Codex. Sus worktrees tienen trabajo sin
commitear y **no se tocan**.

---

## Lo que esta tabla no afirma

- No afirma que la plataforma sea distribuible.
- No afirma que el contenido de terceros sea redistribuible.
- No afirma que el sistema tenga identidad, roles ni intentos persistidos.
- No afirma nada sobre producir con esto.
