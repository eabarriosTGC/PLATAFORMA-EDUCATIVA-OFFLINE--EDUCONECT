# Inventario de decisiones jurídicas pendientes

- **Estado:** inventario y análisis. **No se crea `LICENSE`** ni se cambia ninguna licencia.
- **Regla:** nada se integra al producto antes de aclarar el régimen de licencia.
- **Separación obligatoria:** código propio · dependencias · contenidos educativos · contenido
  comunitario. Se inventarían por separado porque tienen regímenes distintos y titulares distintos.

---

## Categoría 1 — Código propio

**Qué es:** el servidor Rust/SQLite, el dashboard Next, los módulos educativos y los laboratorios 3D
procedurales escritos para EduConect.

**Hecho verificado:** **no existe `LICENSE`, `COPYING` ni `NOTICE`** en el repositorio, y no hay
ninguno en el historial (el filtro de adiciones/borrados sobre `LICENSE*` está vacío).

**`THIRD_PARTY_NOTICES.md` completo son tres líneas** de agradecimiento de inspiración (Maalfer/quizly,
MIT). No es un conjunto de avisos: no lista dependencias ni acompaña textos de licencia.

**`README.md` dice «Uso educativo libre.»** — es una intención, no una licencia: no identifica
licenciante, alcance de derechos, condiciones ni renuncia.

**Los manifiestos tampoco declaran licencia:** `Cargo.toml` no tiene `license` ni `license-file`;
`package.json` tiene `"private": true` y ningún campo `license`.

### Decisiones pendientes

| # | Decisión | Opciones realistas | Consecuencia |
|---|---|---|---|
| J1 | **¿Quién es el licenciante?** | Persona natural / Universidad de La Guajira / entidad nueva | Define quién puede firmar cualquier cesión; firmante equivocado ⇒ cesión nula |
| J2 | **¿Qué texto?** | Permisiva (MIT/Apache-2.0) / copyleft (GPL-3.0) / propietaria institucional | Permisiva permite despliegue cerrado pero habilita un fork competidor; GPL-3 obliga a publicar fuente; propietaria contradice «uso educativo libre» |
| J3 | **¿Regla de contribución entrante?** | DCO (`Signed-off-by`) / CLA al licenciante / nada | Sin regla, cada desarrollador conserva sus derechos y el proyecto no puede relicenciar ni ceder nada |
| J4 | **¿Mapeo de autoría?** | `CODEOWNERS` + matriz de contribuciones / sólo la revisión de `models.rs` | La autoría sin resolver debilita cualquier auditoría de licencia |

**La titularidad hoy tiene tres candidatos incompatibles, ya escritos en el repositorio:**

1. **Persona natural** — remoto `eabarriosTGC`; autores de commit `LinuxeroGuajiro`; `CONTRIBUTING.md`
   apunta a esa cuenta.
2. **Universidad de La Guajira** — `README.md` la acredita; `docs/propuesta-windpeshi-innova.md`
   clasifica servidor, módulos, laboratorios, diccionario y la investigación curricular como «de la
   Universidad».
3. **Cliente/institución** — la misma propuesta ofrece a **Ecopetrol** una «licencia limitada sobre
   los activos preexistentes… sin transferencia de titularidad salvo acuerdo expreso».

Y explícitamente: `docs/propuesta-windpeshi-innova.md` lista «**Definición de la titularidad jurídica
y régimen de propiedad intelectual**» como **fuera del alcance del software** — decisión institucional
y jurídica.

**Ningún documento nombra persona jurídica, NIT ni cesión.** J1 es la primera decisión y bloquea a
todas las demás.

---

## Categoría 2 — Dependencias

| Grupo | Estado verificado | Obligación |
|---|---|---|
| Crates de Rust | Manifiesto sin `license`; mayoría MIT/Apache | Avisos por crate; expresiones compuestas (`AND`) sin cumplir hoy |
| Paquetes de JS | `package.json` sin `license`; lockfiles presentes | Avisos |
| **libzim** | ver [`libzim.md`](libzim.md) | GPL: texto + fuente correspondiente |
| **kiwix-tools / libkiwix** | `GPL-3.0-or-later` / `GPL-3.0` | GPLv3 §4 y §6 |
| **xapian-core** | `GPL-2.0-or-later` | GPL |
| **PhET** (5 bundles en `modulos/phet/`) | **CC BY-NC 4.0** con cláusula de licencia comercial y marca restringida | Atribución **junto al punto de uso**; prohibición de uso comercial |
| `three.min.js` | MIT, con avisos en 11 de 61 módulos | Avisos por módulo |
| Laboratorios 3D | Procedurales: sin GLB ni texturas de terceros | Sin obligación externa |

**Defecto concreto de atribución:** el aviso de PhET está como **comentario HTML** y la portada del
módulo **no muestra atribución visible**, aunque la propia licencia exige que esté «near point of use».

### Decisiones pendientes

| # | Decisión | Opciones | Consecuencia |
|---|---|---|---|
| J5 | **¿Se conserva el perfil `full` que enlaza GPL en proceso?** | Quitar ZIM del perfil por defecto / publicar ambos / excepción comercial de libzim | Hoy el perfil Full enlaza GPL sin ofrecer fuente ni avisos |
| J6 | **¿Avisos completos?** | Generar `THIRD_PARTY_NOTICES` desde el inventario de crates / avisos por componente | Sin esto, obligaciones `NOTICE` y expresiones `AND` quedan sin cumplir |
| J7 | **¿Se corrige la atribución de PhET?** | Atribución visible junto al punto de uso / quitar los bundles | Es un requisito de la licencia, no una cortesía |

---

## Categoría 3 — Contenidos educativos

| Estado | Contenido | Evidencia |
|---|---|---|
| **Verificable** | Dominio público educativo (Colombia Aprende / MinEducación) ×9; CC BY 4.0 (Maguaré / MinEducación) ×7 | `manifiesto-biblioteca.json` — condición de atribución |
| **No verificable** | El ZIM: `README.md` dice CC BY-SA 4.0 (Wikipedia), pero **los metadatos del ZIM no traen campo de licencia**, sólo un enlace en la página; 11 medios con licencia desconocida | `inventario-licencias.md` |
| **No autorizado** | «1 con autorización de redistribución pendiente»; «Narraciones indígenas del desierto… espera autorización de Norma» (editorial comercial) | `README.md` |

### Decisiones pendientes

| # | Decisión | Opciones | Consecuencia |
|---|---|---|---|
| J8 | **¿Is the bundled ZIM redistributable?** | Publicar / excluir / sustituir por una ZIM verificada | Hoy se documenta una ruta de redistribución no autorizada |
| J9 | **¿Contenido NC en despliegues financiados?** | Mantener PhET / sustituir por simulaciones CC-BY / licencia comercial de PhET | Ver la precisión de abajo: **no se resuelve por asociación** |
| J10 | **¿Los títulos excluidos y el PDF de Norma llegan a publicarse?** | Mantener excluidos / pedir permiso escrito / publicar sin él | La tercera opción es la que hoy está documentada como pendiente |

### Dos precisiones que no se deben dar por sentadas

**1. GPL no prohíbe comercializar.**
GPL-2.0 y GPL-3.0 permiten vender el software, cobrar soporte y desplegarlo en una institución que
cobra por sus servicios. Lo que prohíben es imponer **restricciones adicionales** sobre el software
cubierto y no entregar la **fuente correspondiente**. Decir «no podemos cobrar por esto porque libzim
es GPL» es un error de lectura, y lleva a descartar la migración por una razón falsa.

**2. Un despliegue financiado no implica automáticamente uso comercial de contenido NC.**
`CC BY-NC 4.0` prohíbe el uso «primarily intended for or directed toward commercial advantage or
monetary compensation». Un proyecto financiado por una empresa que se entrega **gratis** a escuelas
**no** es automáticamente comercial. Y al revés: que la entrega sea gratuita no blanquea un uso que
sí persigue ventaja comercial.

**La determinación es caso por caso y es jurídica.** Lo que sí es técnico y ya está decidido: mientras
no haya determinación, el contenido NC **queda fuera de cualquier distribución**.

---

## Categoría 4 — Contenido comunitario

| Elemento | Estado |
|---|---|
| Material, audio o imagen de origen comunitario wayúu | `docs/propuesta-windpeshi-innova.md` exige «consentimiento documentado»; **no existe registro en el repositorio** |
| Diccionario español–wayuunaiki | Se describe como activo «de la Universidad»; el régimen comunitario no está documentado |
| Narraciones indígenas | Pendiente de autorización editorial (categoría 3) **y** de consentimiento comunitario |

### Decisiones pendientes

| # | Decisión | Opciones | Consecuencia |
|---|---|---|---|
| J11 | **¿Régimen del contenido comunitario?** | Protocolo de consentimiento escrito / tratar como propiedad universitaria / excluir de la distribución | Audio e imagen de un pueblo nombrado sin consentimiento es exposición licenciataria **y** ética, no sólo legal |
| J12 | **¿Quién custodia el registro de consentimientos?** | Universidad / entidad nueva / el propio repositorio (sin datos personales) | Sin custodio, el consentimiento no es verificable |

---

## Orden de resolución propuesto

```
J1 (titularidad, jurídico)
  └─► J2 (texto de licencia) ─► J3 (regla de contribución) ─► J4 (autoría)
J8, J10 (contenido no autorizado)  ── independientes, no esperan a J1 para *excluir*
J7 (atribución PhET)               ── independiente, es un defecto actual
J11, J12 (comunitario)             ── independiente y urgente por razones éticas
J5, J6 (GPL y avisos)              ── bloquean cualquier distribución, no el desarrollo
J9                                 ── requiere determinación jurídica caso por caso
```

**Lo único que se puede ejecutar ya sin ninguna decisión jurídica es excluir de la distribución lo que
no tiene autorización suficiente.** Eso no requiere elegir licencia.

---

## Lo que este inventario no hace

- No crea `LICENSE`.
- No cambia ninguno de los tres manifiestos (`Cargo.toml`, `package.json`, `THIRD_PARTY_NOTICES.md`).
- No retira contenido del repositorio: la retirada es una acción de distribución, y requiere tu
  autorización.
- No determina si un despliegue concreto es comercial: eso es jurídico.
