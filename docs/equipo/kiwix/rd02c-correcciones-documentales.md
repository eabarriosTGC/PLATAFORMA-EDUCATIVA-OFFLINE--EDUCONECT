# RD-02C — Corrección de las seis inconsistencias documentales

- **Origen:** revisión solicitada el 2026-11-27. Se detectaron seis inconsistencias en la evidencia
  de RD-02C (`evidencias/RD-02C/`).
- **Regla aplicada:** distinguir **mediciones de contextos diferentes** y **no declarar diferencias
  de rendimiento significativas sin evidencia suficiente**.
- **Estado:** las seis están corregidas en este documento. Los ficheros de evidencia originales viven
  en `.git/coordinacion/`, que no se versiona; este documento es la referencia versionada.

---

## Síntesis: qué se puede afirmar y qué no

| Afirmación | ¿Evidencia suficiente? | Lectura defendible |
|---|---|---|
| C es más rápido sirviendo artículos en caliente | **No** | 0,25 ms `[0,18–7,77]` (n=75) frente a 0,52 ms `[0,36–7,12]`: **los rangos se solapan**. No se declara diferencia. |
| C es más lento buscando | **Parcialmente** | 28,27 ms frente a 0,87 ms, pero **devolviendo 20 resultados frente a 1**. No es comparable como rendimiento. Se afirma la diferencia de *función*, no de velocidad. |
| C consume más memoria con el tiempo | **No concluyente** | +73,6 MB en 30 min, con **n=1 por arquitectura**. Se registra como observación, no como resultado. |
| El arranque distingue las arquitecturas | **No** | 3128 / 3245 / 3135 ms con dispersión de ±200 ms: se solapan. El arranque **no** distingue. |
| C necesita supervisión | **Sí** | Caso 5: sin reinicio automático; caso 7: indisponibilidad ≈ 0,1 s; caso 9: SIGBUS exit 135. |
| Sin migración no hay búsqueda real | **Sí** | 1 resultado frente a 20, de forma reproducible en caliente. |

**Consecuencia para la decisión:** la migración se justifica por **función** (búsqueda real, portabilidad
del `.exe`, imagen un orden de magnitud menor) y por **operación** (supervisión, aislamiento), **no por
rendimiento**. Presentarla como «más rápida» sería falso.

---

## I1 — Licencia de libzim: `GPL-2.0-or-later` frente a `GPL-3+`

- **Dónde:** `propuesta-decision.md:46` afirma «GPL-2.0-or-later»; `inventario-licencias.md` §3.2
  registra para Debian 8.1.1 «GPL-3+».
- **Naturaleza:** no es un error de ninguno de los dos. **Describen objetos distintos.**
- **Resolución:** ambas son correctas para su fuente. El *grant* de aguas arriba es `GPL-2.0-or-later`
  (cabeceras de fichero y `README`); el registro de empaquetado de Debian es `GPL-3+` en `Files: *`.
  Como `GPL-2.0-or-later` permite v3, el denominador común seguro para redistribuir es
  **`GPL-3.0-or-later`**.
- **Corrección aplicada:** `propuesta-decision.md:46` no debe citar un identificador único. Donde
  aparezca una sola cadena, debe decir `GPL-2.0-or-later` (aguas arriba) con nota de que Debian
  registra `GPL-3+`, y la obligación práctica se calcula sobre `GPL-3.0-or-later`.
- **Detalle y fuentes primarias:** [`../licencias/libzim.md`](../licencias/libzim.md).

---

## I2 — 0,25 ms frente a 0,34 ms: filas mezcladas

- **Dónde:** `informe-comparativo.md:30` cita «0,25 ms» como el artículo en caliente de la
  arquitectura C; `matriz-rendimiento.md:42` da 0,34 ms `[0,24–7,77]` para `articulo-Amor` y
  `matriz-rendimiento.md:47` da 0,25 ms `[0,18–7,77]` para el **agregado de todas las ZIM** (n=75).
- **Naturaleza:** dos mediciones de **contextos distintos** — un artículo concreto frente a un
  conjunto de 75.
- **Corrección aplicada:** las filas no se mezclan. `articulo-Amor` = 0,34 ms; agregado n=75 =
  0,25 ms. Cuando el informe quiera una sola cifra, debe decir cuál de las dos y con su contexto.
- **Y una consecuencia:** al solaparse los rangos con los de B, **no se declara diferencia**.

---

## I3 — Conteo de casos de portabilidad: «siete» frente a ocho

- **Dónde:** `evaluacion-portabilidad.md:54` afirma «los siete casos … quedan cerrados y sólo uno
  —Windows limpio— no se puede cerrar»; la matriz de `:45-52` tiene **8 filas**;
  `informe-comparativo.md:67` dice «Siete de ocho casos verificados».
- **Naturaleza:** error aritmético en `evaluacion-portabilidad.md:54`. La formulación de `:54` es
  internamente inconsistente: si siete estuvieran cerrados y uno no, el total sería ocho, pero la
  frase presenta el «sólo uno» como si el total fuera siete.
- **Corrección aplicada:** la lectura correcta es la de `informe-comparativo.md:67`:
  **8 casos en la matriz, 7 verificados, 1 sólo investigado (Windows limpio).**
- **Por qué importa:** el caso no cerrado es justamente la precondición 4 de migración. Un conteo
  mal escrito en la fila que decide la migración es un defecto material, no de estilo.

---

## I4 — Arranque de kiwix: 73 ms frente a 36–48 ms

- **Dónde:** `matriz-rendimiento.md:22` mide 73 ms `[69–84]` para el arranque de kiwix dentro de la
  arquitectura C; `evaluacion-portabilidad.md:45` y §5.3 miden 36–48 ms y 38–39 ms para el binario
  estático nativo.
- **Naturaleza:** **contextos distintos**, no discrepancia de medición. La primera cifra es el
  arranque dentro de un contenedor, con el resto del sistema cargado y el arranque de Rust en curso;
  la segunda es el binario estático en reposo, medido aislado. La propia evidencia declara presión
  del anfitrión.
- **Corrección aplicada:** no se comparan. Cada cifra se cita con su contexto y no se usa ninguna de
  las dos para afirmar nada sobre el tiempo de arranque total de la arquitectura C, que es lo que
  importa al usuario (3135 ms `[3009–3330]`, que **se solapa** con las otras dos arquitecturas).
- **Pendiente honesto:** ninguna de las dos se reconcilió experimentalmente. Queda como medición
  abierta, no como resultado.

---

## I5 — «El arranque no distingue» como afirmación de orden

- **Dónde:** `informe-comparativo.md:37` afirma que el arranque «no distingue» entre arquitecturas,
  mientras `matriz-rendimiento.md:20` da a C-Rust 3064 ms, el **menor** de los tres.
- **Naturaleza:** la frase es correcta en su intención y defectuosa en su forma. Con 3128 / 3245 /
  3135 ms y dispersiones de ±200 ms, lo verdadero es que **las tres se solapan dentro de la
  dispersión**, no que sean iguales ni que una gane.
- **Corrección aplicada:** se prohíbe presentar 3064 ms como «el más rápido». La formulación
  admitida es: «las tres arquitecturas se solapan dentro de la dispersión; el arranque no es un
  criterio de decisión».
- **Por qué importa:** si alguien cita 3064 ms como ventaja, la próxima medición lo desmiente y la
  credibilidad de todo el informe cae con él.

---

## I6 — `tareas/RD-02C.md:73` dice «Resultado Pendiente»

- **Dónde:** `tareas/RD-02C.md:73` conserva «Resultado Pendiente» mientras `:105+` reporta siete
  fases cerradas.
- **Naturaleza:** sección obsoleta que no se actualizó al cerrarse las fases.
- **Corrección aplicada:** el estado de la tarea es **REPORTADA, espera decisión del humano**
  (`tareas/RD-02C.md:9`). El «Resultado Pendiente» de `:73` describe una fase concreta ya cerrada y
  debe retirarse o fecharse como histórico.
- **Y lo que sí sigue pendiente es otra cosa**, que no conviene confundir con un documento viejo:
  la verificación en Windows real, la ZIM representativa, el experimento SIGBUS-contra-B y la
  licencia.

---

## Lo que esta corrección **no** hace

- No reemplaza el lector integrado. La dirección arquitectónica está aceptada; la sustitución **no**
  está autorizada.
- No re-ejecuta ninguna medición. Todas las cifras son las registradas; lo que cambia es su lectura.
- No convierte en «significativa» ninguna diferencia que no lo sea, ni al revés.

## Pendientes que esta corrección deja explícitos

| # | Pendiente | Por qué no se cierra aquí |
|---|---|---|
| 1 | Reconciliar 73 ms y 36–48 ms con una medición única y controlada | Requiere el entorno experimental y una medición nueva |
| 2 | Repetir la ventana de 30 min con n≥3 por arquitectura | La observación de +73,6 MB tiene n=1 |
| 3 | Experimento SIGBUS en la arquitectura B | Nunca se hizo; el riesgo de B está declarado pero no medido |
| 4 | ZIM representativa | Condicionada; el fixture de D-05b no sustituye a una ZIM real |
| 5 | Verificación en Windows real | Precondición 4; ver `rd02c-propuesta-implementacion.md` |
