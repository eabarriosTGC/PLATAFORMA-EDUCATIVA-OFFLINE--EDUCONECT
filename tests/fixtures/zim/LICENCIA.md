# Licencia del contenido del fixture D-05b

## Contenido: dominio público (CC0-1.0)

Las cuatro páginas HTML de `paginas/` y el paquete `fixture_d05b.zim` que se genera
a partir de ellas son obra original del equipo de EduConect Rural, escrita el
27 de noviembre de 2026 para la unidad D-05b.

Se dedican al **dominio público** bajo **CC0-1.0** — *Creative Commons Zero v1.0
Universal* — <https://creativecommons.org/publicdomain/zero/1.0/>.

En la medida en que la ley lo permite, quien las escribió renuncia a todos los
derechos de autor y derechos conexos sobre este contenido. Se puede copiar,
modificar, distribuir y usar sin pedir permiso ni atribución.

Este contenido **no** reproduce ni adapta artículos de Wikipedia, Vikidia ni de
ninguna otra enciclopedia: no hay texto de terceros dentro del paquete.

## Herramienta que lo generó (no es contenido)

- `python-libzim` 4.1.0 — **GPL-3.0-or-later** (lo declara la propia rueda en
  `libzim-4.1.0.dist-info/METADATA`, campo `License-Expression`).
- `libzim` — la biblioteca que la rueda incluye y con la que se escribe el
  paquete. Su proyecto la publica bajo GPL-2.0-or-later; dentro de la rueda no
  viene un archivo de licencia propio de libzim, así que esto **no se verificó
  localmente**, se cita de su procedencia.

La licencia de la herramienta cubre la herramienta, no su salida: el `.zim` es
un archivo de datos que contiene únicamente el contenido CC0 de arriba. El
generador (`../generar-fixture.py`) se distribuye junto con el resto del
repositorio y queda bajo la licencia del proyecto, no bajo CC0.
