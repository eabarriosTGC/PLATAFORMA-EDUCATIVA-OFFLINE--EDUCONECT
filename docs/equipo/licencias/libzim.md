# libzim — resolución de la discrepancia por fuentes primarias

- **Motivo:** la evidencia del proyecto se contradice. `propuesta-decision.md:46` afirma
  «GPL-2.0-or-later»; `inventario-licencias.md` §3.2 registra para Debian 8.1.1 «GPL-3+».
- **Método:** sólo fuentes primarias — repositorios de aguas arriba, fuentes y metadatos de Debian, y
  el servidor oficial de descargas de Kiwix. Sin blogs ni enciclopedias.
- **Conclusión:** **no hay error en ninguna de las dos.** Describen objetos distintos. El denominador
  común seguro para redistribuir es **`GPL-3.0-or-later`**.

---

## 1. Qué versiones distribuimos realmente

| Componente | Versión | Dónde |
|---|---|---|
| `libzim8` (Debian) | **8.1.1** (paquete `8.1.1-0.2`) | enlazado en proceso por el perfil `full` dentro de la imagen Docker |
| libzim | **9.4.0** | dentro del `kiwix-tools 3.8.1` **Windows x86_64** oficial (verificado ejecutando `kiwix-serve --version`) |
| libzim | **9.5.0** | dentro del `kiwix-tools 3.8.2` **Linux** oficial usado en las mediciones de RD-02C |
| kiwix-tools | **3.8.1** / **3.8.2** | binarios oficiales |
| libkiwix | 14.1.1 / 14.2.0 | incluido en los binarios de kiwix-tools |
| libxapian | 1.4.23 | incluido |

---

## 2. Aguas arriba: `GPL-2.0-or-later`

**Fichero de licencia.** `https://api.github.com/repos/openzim/libzim/contents?ref=9.4.0` lista
`COPYING` (15 132 B) y **ningún `LICENSE`**; `.../8.1.1/LICENSE` devuelve 404.

`https://raw.githubusercontent.com/openzim/libzim/9.4.0/COPYING` contiene el texto **GNU GPL versión 2,
junio de 1991**, terminando en «END OF TERMS AND CONDITIONS». Es texto de GPLv2 **sin** apéndice de
aplicación: el fichero por sí solo **no** contiene la cláusula «o cualquier versión posterior».

**La cláusula «o posterior» está en las cabeceras de cada fichero.**
`https://raw.githubusercontent.com/openzim/libzim/9.4.0/include/zim/zim.h`:

> «GNU General Public License as published by the Free Software Foundation; either version 2 of the
> License, or (at your option) any later version.»

La misma cláusula, idéntica, en `.../8.1.1/include/zim/zim.h`. Eso hace la licencia efectiva
**`GPL-2.0-or-later`**.

**Metadatos de aguas arriba, coincidentes:**

- `https://raw.githubusercontent.com/openzim/libzim/9.4.0/README.md`:
  > «License ------- GPLv2 (https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html) or later, see
  > COPYING for more details.»
- `https://raw.githubusercontent.com/openzim/libzim/9.4.0/meson.build`:
  `project('libzim', […], version : '9.4.0', license : 'GPL2', …)`; idéntico en 8.1.1.
- La misma línea de `README` aparece en 9.5.0 y hacia atrás hasta 4.0.0/5.0.0/6.3.0.

**No existe una «era GPLv3» de aguas arriba** que explique el registro de Debian.

---

## 3. Debian: `GPL-3+` en `Files: *`

`https://packages.debian.org/search?keywords=libzim8&searchon=names&suite=all` → `libzim8` bookworm
**8.1.1-0.2**; bookworm-backports `8.2.1-2~bpo12+1`; sid 8.2.x. Es decir: **`libzim8` = aguas arriba
8.1.1**.

`https://sources.debian.org/data/main/libz/libzim/8.2.1-2~bpo12+1/debian/copyright` (y el de 9.7.0-0.4,
casi idéntico):

- `Files: *` → `License: GPL-3+` con `License-Grant:` «…either version 3 of the License, or (at your
  option) any later version.»
- `Files: src/xapian/htmlparse.*, … namedentities.h` → `License: GPL-2+`
- `Files: src/md5.c, src/md5.h` → `License: RSA`
- `Files: src/lrucache.h, test/lrucache.cpp` → `BSD-3-Clause`
- `debian/copyright-check` → `GPL-3+`

**Limitación declarada:** el `debian/copyright` de **`8.1.1-0.2`** no fue recuperable —
`https://sources.debian.org/data/main/libz/libzim/8.1.1-0.2/debian/copyright`,
`https://sources.debian.org/api/src/libzim/8.1.1-0.2/` y
`https://metadata.ftp-master.debian.org/changelogs/main/libz/libzim/libzim_8.1.1-0.2_copyright`
devolvieron **HTTP 404**. `https://sources.debian.org/api/src/libzim/` lista 9.7.0-0.4 (sid/forky),
9.2.3-1.1 (trixie) y 8.2.1-2~bpo12+1. Por tanto el `GPL-3+` está verificado para el empaquetado
**adyacente** 8.2.x/9.x, **no literalmente** para 8.1.1-0.2. Se registra como no verificado, no como
cerrado.

---

## 4. Por qué las dos afirmaciones del proyecto son correctas a la vez

No hubo cambio de licencia. Aguas arriba, `README`, `meson.build` (`GPL2`) y las cabeceras
(v2-o-posterior) son **estables desde 4.0.0 hasta 9.5.0**. El propio fichero de Debian registra
`GPL-2+` para los ficheros derivados de xapian. La concesión genérica `Files: *` → `GPL-3+` es un
**registro de empaquetado** de Debian, no un hallazgo fichero a fichero.

Entonces:

- **`GPL-2.0-or-later`** es la concesión de **aguas arriba**.
- **`GPL-3+`** es lo que el **copyright de Debian** afirma.
- Como `GPL-2.0-or-later` permite v3, **ambas son compatibles** y el denominador común seguro para
  redistribuir es **`GPL-3.0-or-later`**.

**Corrección aplicada a la evidencia:** donde se cite un identificador único debe citarse
`GPL-2.0-or-later` con nota del registro de Debian; y la obligación práctica se calcula sobre
`GPL-3.0-or-later`.

---

## 5. El binario estático de kiwix-tools: `GPL-3.0-or-later`

- `https://raw.githubusercontent.com/kiwix/kiwix-tools/main/COPYING` = texto **GPLv3** completo
  («Version 3, 29 June 2007», 35 068 B).
- `.../main/meson.build`: `license : 'GPL'`.
- `.../main/src/server/kiwix-serve.cpp`, cabecera: «either version 3 of the License, or any later
  version» ⇒ **`GPL-3.0-or-later`**.

**Sobre la redistribución del zip:** `https://download.kiwix.org/release/kiwix-tools/` lista los
archivos y sus `.md5` y **no contiene** `COPYING` ni `LICENSE` visibles en el índice. **No verificado**
si los zip/tar de plataforma incluyen los textos de licencia por componente: no se pudieron listar los
contenidos de los archivos con las herramientas disponibles. Esto es un **pendiente**, no una
conclusión: hay que abrir el zip y mirar.

**Obligación** (`https://www.gnu.org/licenses/gpl-3.0.txt`, §4 y §6): entregar el texto de la licencia
junto con el programa y, al transmitir en forma de código objeto, entregar también la **fuente
correspondiente** (§6d permite, para un servidor de red, dar instrucciones claras junto al objeto sobre
dónde encontrarla).

Para un `kiwix-serve` enlazado estáticamente: texto GPLv3 + oferta o puntero a las fuentes de
kiwix-tools, libkiwix, libzim y xapian. Que libzim sea además `GPL-2.0-or-later` hace compatible su
transmisión bajo v3.

---

## 6. libkiwix y xapian

- **libkiwix** — `https://raw.githubusercontent.com/kiwix/libkiwix/main/COPYING` es texto GPLv3
  (35 065 B) ⇒ **`GPL-3.0`**. Si es «o posterior» **no verificado**: `meson.build` y las cabeceras de
  `include/kiwix/*` no se recuperaron.
- **xapian-core** — `https://raw.githubusercontent.com/xapian/xapian/master/xapian-core/README`:
  > «Xapian is free software, licensed under the GNU General Public License (version 2 or later)»
  y `COPYING` es texto GPLv2 ⇒ **`GPL-2.0-or-later`**.

---

## 7. Tabla final

| Componente | Versión | Licencia efectiva (SPDX) | Fuente primaria | Obligación al redistribuir |
|---|---|---|---|---|
| libzim | 9.4.0 | `GPL-2.0-or-later` | `raw.githubusercontent.com/openzim/libzim/9.4.0/include/zim/zim.h` + `/README.md` | Texto de licencia + fuente correspondiente |
| libzim | 9.5.0 | `GPL-2.0-or-later` | `…/9.5.0/README.md` | Igual |
| libzim8 (Debian) | 8.1.1-0.2 | aguas arriba `GPL-2.0-or-later`; Debian registra `GPL-3+` | `…/8.1.1/include/zim/zim.h`; copyright de 8.2.1/9.7.0 en `sources.debian.org` | `debian/copyright` + texto GPL-3 + fuente |
| kiwix-tools | 3.8.1 / 3.8.2 | `GPL-3.0-or-later` | `…/kiwix/kiwix-tools/main/src/server/kiwix-serve.cpp` | GPLv3 §4 y §6 |
| libkiwix | 14.1.1 / 14.2.0 | `GPL-3.0` (or-later **NO VERIFICADO**) | `…/kiwix/libkiwix/main/COPYING` | Términos de GPLv3 |
| xapian-core | 1.4.23 | `GPL-2.0-or-later` | `…/xapian/xapian/master/xapian-core/README` | GPL |

**Denominador común seguro: `GPL-3.0-or-later`.**

---

## 8. Pendientes que esta resolución deja abiertos

| # | Pendiente | Por qué no se cierra |
|---|---|---|
| 1 | `debian/copyright` de **8.1.1-0.2** | HTTP 404 en las tres rutas probadas |
| 2 | ¿El zip de kiwix-tools 3.8.1 incluye los textos de licencia? | Hay zip descargado en el espacio experimental; falta abrirlo e inspeccionarlo |
| 3 | libkiwix «o posterior» | `meson.build`/cabeceras no recuperados |
| 4 | Postura de enlace de xapian | No verificado en esta pasada |
| 5 | Texto de licencia del proyecto EduConect | **No se crea** sin autorización; depende de la titularidad (J1) |

**Ningún pendiente impide la conclusión operativa:** si se distribuye kiwix-tools o se enlaza libzim,
se hace bajo **GPL-3.0-or-later** con texto y camino a la fuente. Y como no hay `LICENSE` de proyecto
ni titularidad definida, **hoy no se distribuye nada**.
