# Ficha del fixture ZIM mínimo (D-05b)

Unidad **D-05b** de `odd/tasks/d05-perfiles-docker.md` (T2). Este material vive
en el repositorio, en **`tests/fixtures/zim/`**: el paquete, sus cuatro fuentes
HTML, la licencia, el generador que lo reproduce y esta ficha. Es el único
binario versionado del repositorio (`.gitignore` lo exceptúa con nombre y
apellido en `tests/fixtures/zim/.gitignore`).

Sirve para lo que D-05a sólo pudo verificar a mano: montar el **mismo** archivo
en los perfiles `full` y `core` y exigir resultados **opuestos** (200 / 503). Un
ZIM enciclopédico de 24 MB no es un insumo aceptable para una prueba de CI; este
paquete pesa 36,9 KiB.

Cómo se verifica dentro del repositorio (sin red, sin `pip`, sin
python-libzim):

```bash
tests/docker/verificar-fixture-zim.sh          # integridad: tamaño, sha256 y fuentes (exit 0/1/2)
tests/docker/verificar-perfiles.sh <core> <full>   # lo monta en las dos patas y exige 200/503
```

---

## 1. Qué contiene

Cuatro páginas HTML propias, sin imágenes ni binarios, en el espacio de nombres
`A/` que usan los lectores:

| Archivo fuente | Ruta ZIM | Título | Rasgo que ejercita |
|---|---|---|---|
| `paginas/portada.html` | `A/Portada` | Portada | página principal, **enlaces** a las otras tres, **script en línea** |
| `paginas/observatorio-del-rio.html` | `A/Observatorio_del_Río` | Observatorio del Río | **acentos en la ruta y en el texto**, enlace al glosario |
| `paginas/estacion-la-esperanza.html` | `A/Estación_La_Esperanza` | Estación La Esperanza | **acentos** (á é í ó ú ñ ü), enlace a la portada |
| `paginas/glosario.html` | `A/Glosario` | Glosario | definiciones, enlaces a dos artículos |

Los enlaces son **relativos** (`href="Glosario"`): funcionan servidos por este
producto en `/zim/A/…` y también por `kiwix-serve` en `/content/<libro>/A/…`.

Cada página lleva un marcador de texto visible que la verificación busca en el
cuerpo servido: `FIXTURE-D05B-PORTADA`, `FIXTURE-D05B-OBSERVATORIO`,
`FIXTURE-D05B-ESTACION`, `FIXTURE-D05B-GLOSARIO`; la portada además contiene el
literal `FIXTURE-D05B-SCRIPT` dentro de su script en línea.

## 2. Procedencia y licencia

- **Autoría:** equipo de EduConect Rural, texto original escrito el **27/11/2026**
  para esta unidad. No hay texto de terceros ni material enciclopédico.
- **Licencia del contenido:** **CC0-1.0** (dominio público). Ver `LICENCIA.md`.
- **Herramienta que lo generó:** `python-libzim` **4.1.0** (GPL-3.0-or-later,
  declarado por la propia rueda) sobre `libzim` **9.8.2**. La licencia de la
  herramienta no alcanza a los datos que produce; el paquete contiene sólo el
  contenido CC0.

## 3. Herramienta y entorno de generación

| Dato | Valor |
|---|---|
| Paquete Python | `python-libzim` 4.1.0 (única descarga de la unidad) |
| Rueda | `libzim-4.1.0-cp311-abi3-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` |
| URL | `https://files.pythonhosted.org/packages/52/bd/a87402490110377c1411ef83b802f64ac1cc76ab7654ce1802a8b42ac9a7/` |
| Tamaño de la rueda | **20 020 495 bytes** (coincide con el `size` publicado por PyPI) |
| **sha256 de la rueda** | **`cd26c60e90a2d7f619a6db98e89892d1f429cdbb80d47a4318a659b1d985db1f`** |
| libzim (C++) que trae la rueda | 9.8.2 · libzstd 1.5.7 · liblzma 5.2.6 · libxapian 1.4.23 · libicu 73.2.0 |
| Intérprete | CPython **3.11.2** (Debian 12) |
| Imagen usada para generar | `educonetv2-educonect:latest` (ya presente en la máquina), ejecutada como `--user $(id -u):$(id -g)` |
| Contenedor nombrado por el encargo | `educonect-dev-env-dev:latest` — **no tiene Python** (ver §9.1) |

La rueda se verificó contra el `sha256` que publica PyPI para 4.1.0; los dos
valores coinciden (`evidencia/01-entorno-y-rueda.txt`).

## 4. Identidad del artefacto

| Campo | Valor |
|---|---|
| Archivo | `fixture_d05b.zim` |
| Tamaño | **37 777 bytes** (36,9 KiB) |
| **sha256** | **`16c061a95a897967fc92e690a4702f12f90178998092fcf51a916f3f95b9893b`** |
| Artículos (`articleCount`) | **4** |
| Entradas multimedia | 0 |
| Entradas totales | 16 según `all_entry_count`: 4 artículos + 9 metadatos + las entradas internas de libzim (redirección `mainPage` e índice de títulos) |
| Página principal declarada | `A/Portada` (libzim la representa con la entrada de redirección `mainPage`, que es lo que devuelve `mainEntry`) |
| UUID de la cabecera | `d05b0000-0000-4000-8000-0000000d05b0` |
| Metadatos | `Counter, Creator, Date, Description, Language, Name, Publisher, Tags, Title` |
| `Date` | `2026-11-27` |
| Compresión | zstd (clústeres) |
| Índice de títulos | sí (lo escribe libzim siempre) |
| Índice de texto completo | **no** (`config_indexing(False)`): mantiene el paquete chico y con un solo UUID aleatorio interno |
| Versión de formato | ZIM **6.3** |

## 5. Determinismo: qué varía y cómo se fija

**libzim no produce una salida determinista por sí solo.** Dos corridas con los
mismos insumos dan el mismo tamaño pero **tres campos aleatorios distintos**:

| # | Campo | Dónde | Tamaño |
|---|---|---|---|
| 1 | UUID de la cabecera ZIM | desplazamiento **8..23** (fijo en la especificación) | 16 B |
| 2 | UUID interno de la base Xapian del índice de títulos | 16 B que siguen a la cadena `Xapian Glass` (en este paquete, `4339..4354`; se localiza por búsqueda, no por desplazamiento fijo) | 16 B |
| 3 | MD5 de verificación | **últimos 16 bytes**; depende de 1 y 2 | 16 B |

Medido en `evidencia/02-determinismo.txt` (dos corridas con `--crudo`): entre 47
y 48 bytes distintos, siempre en esas tres regiones. El número exacto varía
porque dos UUID aleatorios pueden coincidir en un byte.

`generar-fixture.py` normaliza los tres: fija (1) y (2) con los argumentos
`--uuid` y `--uuid-xapian` (valores por defecto fijos, ver §4) y recalcula (3)
como `md5(archivo[0 : tamaño-16])`. Es un parche de campos, no una reescritura:
los desplazamientos, los clústeres y el resto de la estructura quedan intactos.

Comprobado que el paquete normalizado sigue siendo válido (`evidencia/02`):

- `libzim.Archive.check()` → `True` (el MD5 interno verifica);
- el índice de títulos sigue funcionando: la búsqueda por título `«Observ»`
  devuelve `A/Observatorio_del_Río`;
- el lector 3.8.2 (libkiwix 14.2 / libzim 9) lo abre y cuenta 4 artículos.

Resultado: dos corridas con los valores por defecto son **idénticas byte a byte**
(`cmp` sin diferencias, mismo `sha256`). Con `--crudo` se obtiene la salida cruda
de libzim, que es la que conviene usar para comparar y ver qué campos varían.

La **fecha** también es argumento (`--fecha`, por defecto `2026-11-27`, nunca el
reloj): con `--fecha 2026-01-01` el paquete cambia de `sha256`
(`8a5cbcab29a5…`) porque cambia el metadato `Date`.

## 6. Resultado HTTP (mismo montaje, dos perfiles)

Montaje idéntico en las dos patas: `tests/fixtures/zim/` → `/data/contenido/zim` en
**sólo lectura**. Es exactamente lo que hace hoy
`tests/docker/verificar-perfiles.sh` en su sección 3-4. Medido dentro del contenedor con `curl`; evidencia completa en
`evidencia/04-verificacion-http.txt` (`21/21` comprobaciones, exit 0).

| Petición | `educonect-rural:d05a-full` | `educonect-rural:d05a-core` |
|---|---|---|
| `GET /health` | 200 (`healthy`) | 200 (`healthy`) |
| `GET /api/wikipedia/zims` | **200** `{"default":"fixture_d05b","zims":[{"articles":4,"icon":"📦","nombre":"ZIM Desconocido","slug":"fixture_d05b","source":"persistent"}]}` | **503** `{"error":"capacidad zim no incluida en esta compilación","capacidad":"zim"}` |
| `GET /zim/` | **307** → `/zim/A/Portada` | 503 (página HTML de degradación) |
| `GET /zim/A/Portada` | **200**, 2 860 bytes, contiene `FIXTURE-D05B-PORTADA`, `FIXTURE-D05B-SCRIPT` y «Escuela Rural La Esperanza» | **503** y **sin** contenido del fixture |
| `GET /zim/A/Observatorio_del_R%C3%ADo` | **200**, 2 568 bytes, contiene `FIXTURE-D05B-OBSERVATORIO`, «Río Grande», «temperatura» | 503 |
| `GET /zim/A/Estaci%C3%B3n_La_Esperanza` | **200**, 2 593 bytes, contiene `FIXTURE-D05B-ESTACION`, «pingüino», «doce kilómetros» | 503 |
| `GET /zim/A/Glosario` | **200**, 2 316 bytes, contiene `FIXTURE-D05B-GLOSARIO`, «Acequia», «Terraplén» | 503 |

Contraste: **full 200 ≠ core 503 sobre el mismo archivo**. Es el chequeo que
D-05a sólo tenía en la forma «sin contenido» y que este fixture vuelve medible
con contenido real.

Notas de lectura de la tabla:

- `nombre`/`icon` salen de la clasificación por nombre de archivo del servidor
  (`zim_proxy.rs`). `fixture_d05b` no coincide con ningún patrón conocido, así
  que cae en la rama genérica («ZIM Desconocido» / 📦). No es un defecto del
  fixture; el `slug` es el esperado.
- `size: 36864 KB` que imprime `kiwix-manage` es el tamaño en KiB truncado
  (36 × 1024), no bytes.
- `tags` que imprime `kiwix-manage` agrega `_ftindex:no;_pictures:yes;…`: lo
  agrega el lector al mostrar, no está guardado así en el paquete.

## 7. Autovalidación del paquete

`zimcheck` **no está disponible** en esta máquina (zim-tools no está instalado),
así que no se invoca ni se simula. La validación se hace con lectores reales:

1. **`kiwix-manage` 3.8.2** (`libkiwix 14.2.0`) — `add` + `show`:

   ```
   id:            d05b0000-0000-4000-8000-0000000d05b0
   title:         Fixture mínimo D-05b — EduConect Rural
   name:          fixture_d05b
   description:   Fixture propio de cuatro páginas (CC0-1.0) para verificar el lector ZIM.
   creator:       Equipo EduConect Rural
   date:          2026-11-27
   articleCount:  4
   mediaCount:    0
   ```

2. **libzim 9.8.2** (el de la rueda) — `Archive.check()` → `True`.
3. **Página servida** — el producto sirve las cuatro rutas con 200 y el texto
   esperado (§6), y el perfil `core` no sirve ninguna.

Lectores reales no hay en CI (ni `zimcheck`, ni `kiwix-manage`, ni
python-libzim), así que la comprobación **permanente** en el repositorio es la
integridad byte a byte —`tests/docker/verificar-fixture-zim.sh`, tamaño y
sha256— y la lectura la hace el producto: si el paquete no fuera legible, `full`
no respondería 200 en las cuatro páginas y la sonda de perfiles fallaría. La
medición con lector real queda como evidencia de la unidad
(`evidencia/05-lectura-kiwix-manage.txt`), no como paso de CI.

## 8. Reproducción

Requisitos: `docker` y red (una sola descarga). Todo lo demás ya está en la
máquina: el lector 3.8.2 en
`/var/tmp/educonect-rd02c/bin/tools/kiwix-tools_linux-x86_64-3.8.2/` y las
imágenes `educonect-rural:d05a-full` y `educonect-rural:d05a-core`.

```bash
# 0. Espacio de trabajo (fuera del repositorio). El generador y las páginas se
#    copian desde tests/fixtures/zim/ del repositorio: son las fuentes de verdad.
mkdir -p /var/tmp/d05b && cd /var/tmp/d05b
cp /ruta/al/repo/tests/fixtures/zim/generar-fixture.py .
cp -r /ruta/al/repo/tests/fixtures/zim/paginas .

# 1. La única descarga: la rueda de python-libzim 4.1.0
curl -sSLo libzim-4.1.0-cp311-abi3-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl \
  'https://files.pythonhosted.org/packages/52/bd/a87402490110377c1411ef83b802f64ac1cc76ab7654ce1802a8b42ac9a7/libzim-4.1.0-cp311-abi3-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl'
sha256sum libzim-4.1.0-cp311-abi3-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl
# esperado: cd26c60e90a2d7f619a6db98e89892d1f429cdbb80d47a4318a659b1d985db1f
#           20020495 bytes

# 2. Descomprimir la rueda dentro de un contenedor con Python 3.11 (sin pip,
#    ver §9.1) y dejar el módulo importable en ./trabajo/sitio
#    (el nombre del directorio es arbitrario; lo que importa es PYTHONPATH)
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/w" \
  -e PYTHONPATH=/w/trabajo/sitio \
  --entrypoint python3 educonetv2-educonect:latest -c \
  'import zipfile; zipfile.ZipFile("/w/libzim-4.1.0-cp311-abi3-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl").extractall("/w/trabajo/sitio")'

# 3. Generar el paquete (esta es literalmente la corrida de evidencia/03)
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/w" \
  -e PYTHONPATH=/w/trabajo/sitio --entrypoint python3 \
  educonetv2-educonect:latest /w/generar-fixture.py \
  --out /w/fixture_d05b.zim --paginas /w/paginas
# esperado: bytes: 37777
#           sha256: 16c061a95a897967fc92e690a4702f12f90178998092fcf51a916f3f95b9893b
#           artículos: 4   principal: mainPage   check: True

# 4. Verificar sin red lo ya versionado (esto sí está en el repositorio)
tests/docker/verificar-fixture-zim.sh                 # integridad del paquete, 0/1/2
tests/docker/verificar-perfiles.sh <core> <full>      # lo monta en las dos patas: 200/503
```

La verificación original de esta unidad (21 comprobaciones, con `kiwix-manage`
3.8.2 y las imágenes `d05a-*`) queda como evidencia en
`evidencia/04-verificacion-http.txt`; **no se versiona como sonda** porque
depende de un lector de ZIM del host (`kiwix-manage`) y el encargo exige que la
comprobación del repositorio funcione sin él, sin `pip` y sin red.

En un entorno **con `pip`** el paso 2 se reemplaza por el camino previsto por el
encargo, dentro del contenedor:

```bash
pip install --no-cache-dir libzim==4.1.0     # rueda de 20020495 bytes, sha256 cd26c60e…
python3 generar-fixture.py --out fixture_d05b.zim --paginas paginas
```

**Ese camino no se ejecutó en esta máquina** (ningún contenedor local trae pip y
descargarlo no estaba autorizado); ver §9.1.

### Resultados esperados

- `tests/fixtures/zim/fixture_d05b.zim`, **37 777 bytes**, `sha256`
  `16c061a95a897967fc92e690a4702f12f90178998092fcf51a916f3f95b9893b`.
- **4 artículos**, 0 multimedia, principal `A/Portada`.
- HTTP: `full` 200 en el listado, 307 en `/zim/`, 200 en las cuatro páginas;
  `core` 503 en las mismas rutas con el mismo montaje.
- `tests/docker/verificar-perfiles.sh` → `24 pasadas, 0 fallidas`, exit 0 (D-05b
  integra el fixture en esa sonda; ver `odd/tasks/d05-perfiles-docker.md`, L4).

### Opciones del generador

| Opción | Por defecto | Para qué |
|---|---|---|
| `--out` | `fixture_d05b.zim` | ruta del paquete |
| `--paginas` | `paginas/` | directorio de fuentes HTML |
| `--fecha` | `2026-11-27` | metadato `Date`; nunca el reloj |
| `--uuid` | `d05b0000-0000-4000-8000-0000000d05b0` | UUID de la cabecera |
| `--uuid-xapian` | `d05b0000-0000-4000-8000-0000d05b0a91` | UUID del índice de títulos |
| `--crudo` | — | no normalizar: salida tal cual la escribe libzim |

No usa red. Falla con código 1 y un mensaje concreto si falta una página, si la
cabecera del ZIM no es la esperada o si no encuentra la base Xapian.

En el repositorio los valores por defecto apuntan al propio directorio
(`fixture_d05b.zim`, `paginas/`); en el material original vivían bajo un
subdirectorio `fixture/`. Ese cambio de ruta es lo único que se adaptó del
generador al integrarlo: el contenido del paquete y su `sha256` no cambian.

## 9. Lo que no se verificó (y por qué)

### 9.1 La instalación no se hizo en el contenedor nombrado, ni con `pip`

`educonect-dev-env-dev:latest` **no trae intérprete de Python**:

```
$ docker run --rm --entrypoint sh educonect-dev-env-dev:latest -c 'python3 -V'
sh: 1: python3: not found
$ docker run --rm --entrypoint sh educonect-dev-env-dev:latest -c 'pip3 --version'
sh: 1: pip3: not found
```

Se revisaron **todas** las imágenes que ya estaban en la máquina: ninguna trae
`pip` (las de este producto traen Python 3.11.2 sin pip; las de desarrollo, ni
Python). Instalar `pip` habría sido una segunda descarga, no autorizada.

Lo que se hizo, sin descargar nada más que la rueda autorizada: se usó el
intérprete **Python 3.11.2 ya presente** en `educonetv2-educonect:latest`
(Debian 12) y la rueda se descomprimió con `zipfile` de la biblioteca estándar,
dejando el módulo importable por `PYTHONPATH`. Es el mismo `libzim` 9.8.2, la
misma rueda con el mismo `sha256`, y el producto no gana ninguna dependencia de
Python. **La decisión de aceptar esta procedencia o de autorizar la descarga de
`pip` queda para quien revise esta unidad.**

### 9.2 Otros límites

- **`kiwix-serve` no se ejerció.** La validación con el lector 3.8.2 es
  `kiwix-manage show` (más `Archive.check()` y las páginas servidas por el
  producto). Servir el paquete con `kiwix-serve` no se midió.
- **`zimcheck` no existe en esta máquina**; no se simuló su salida.
- **`/api/wikipedia/search` no se midió.** El paquete no tiene índice de texto
  completo a propósito; la búsqueda del producto es por ruta y no se ejercitó.
- **Imágenes medidas:** `educonect-rural:d05a-core` y `:d05a-full`, las que
  verificó D-05a. El fixture ya está integrado en el repositorio (ver L4 de
  `odd/tasks/d05-perfiles-docker.md`), pero las imágenes no se reconstruyeron
  desde esa rama: se midió sobre las existentes, que son las mismas que la
  sonda usa en este host.
- El montaje usado expone `tests/fixtures/zim/` completo (incluye `paginas/` y
  `LICENCIA.md`); el servidor sólo escanea `*.zim`, así que el resto no influye.
  Si se prefiere un montaje con un único archivo, alcanza con apuntar el volumen
  a un directorio que contenga sólo el `.zim`.

## 10. Archivos

Versionados en `tests/fixtures/zim/`:

| Ruta | Qué es |
|---|---|
| `generar-fixture.py` | generador (sin red, argumentos explícitos, `--out`) |
| `fixture_d05b.zim` | el paquete (37 777 B, `sha256` 16c061a9…) — único binario versionado |
| `paginas/*.html` | las cuatro fuentes que producen el paquete |
| `LICENCIA.md` | CC0-1.0 del contenido y licencias de la herramienta |
| `FICHA.md` | esta ficha |
| `.gitignore` | exceptúa `fixture_d05b.zim` de la regla `*.zim` del `.gitignore` raíz |

En `tests/docker/`, que es donde se mide:

| Ruta | Qué es |
|---|---|
| `verificar-fixture-zim.sh` | integridad del paquete en el repositorio; exit 0 / 1 / 2 |
| `verificar-perfiles.sh` | sonda de perfiles: monta este fixture en las dos patas y exige 200/503 |
| `autoprueba-d05c.sh` | control negativo: incluye una copia alterada del paquete y un `core` que sirve el fixture |

Evidencia de la unidad (en `/var/tmp/educonect-rd02c/d05b/evidencia/`, **no**
versionada: reproduce la medición, no la reemplaza):

| Ruta | Qué es |
|---|---|
| `01-entorno-y-rueda.txt` | imágenes, Python, rueda y su `sha256`, licencias, `zimcheck` |
| `02-determinismo.txt` | dos corridas normalizadas, dos crudas, fecha |
| `03-generacion.txt` | corrida del generador y artefactos |
| `04-verificacion-http.txt` | `verificar-fixture.sh` completo (21/21) |
| `05-lectura-kiwix-manage.txt` | `kiwix-manage show` + `--sin-docker` |
| `06-controles-negativos.txt` | la verificación puede fallar (exit 1 y 2) |
