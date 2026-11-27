#!/usr/bin/env python3
"""generar-fixture.py — Fixture ZIM mínimo, reproducible y propio (D-05b).

Genera un paquete ZIM con cuatro páginas escritas para EduConect Rural y
dedicadas al dominio público (CC0-1.0). No descarga nada: lee las páginas de
`paginas/` y escribe el `.zim` donde se le indique.

Requiere python-libzim 4.1.0 (`libzim` importable). La receta completa, con el
sha256 de la rueda, está en FICHA.md.

Determinismo. libzim no escribe una salida determinista por sí solo: aleatoriza
tres cosas en cada corrida.

  1. El UUID de la cabecera ZIM (16 bytes en el desplazamiento 8).
  2. El UUID interno de la base Xapian del índice de títulos (16 bytes que
     siguen a la cadena «Xapian Glass»).
  3. El MD5 de verificación de los últimos 16 bytes, que depende de 1 y 2.

Este programa deja (1) y (2) como argumentos explícitos con valores fijos y
recalcula (3) al final, de modo que dos corridas producen el mismo sha256. La
normalización es un parche de campos, no una reescritura: los desplazamientos,
los clústeres y el resto de la estructura quedan intactos, y el paquete sigue
pasando `Archive.check()` y la búsqueda de títulos.

Con `--crudo` no se normaliza nada: se obtiene exactamente lo que libzim
escribió, que es lo útil para comparar dos corridas y ver qué campos varían.
"""

from __future__ import annotations

import argparse
import hashlib
import struct
import sys
import uuid as uuidlib
from pathlib import Path

BASE = Path(__file__).resolve().parent

# En el repositorio el generador vive junto a lo que genera (tests/fixtures/zim/):
# el paquete y las páginas son hermanos suyos. La ruta no afecta al contenido ni
# al sha256 del paquete.
DESTINO_POR_DEFECTO = BASE / "fixture_d05b.zim"
PAGINAS_POR_DEFECTO = BASE / "paginas"

# Orden explícito: la lista es la fuente de verdad de qué entra y con qué ruta.
# La ruta ZIM conserva el espacio de nombres «A/» que usan los lectores: el
# servidor la resuelve tanto en `/zim/A/<ruta>` como en `/zim/<ruta>`.
PAGINAS = (
    ("portada.html", "A/Portada", "Portada"),
    ("estacion-la-esperanza.html", "A/Estación_La_Esperanza", "Estación La Esperanza"),
    ("observatorio-del-rio.html", "A/Observatorio_del_Río", "Observatorio del Río"),
    ("glosario.html", "A/Glosario", "Glosario"),
)

RUTA_PRINCIPAL = "A/Portada"

# Fecha de los metadatos: argumento explícito, nunca la del reloj.
FECHA_POR_DEFECTO = "2026-11-27"

# UUIDs fijos. El de la cabecera lo elige quien genera; el de Xapian sólo
# identifica la base del índice de títulos y no se usa para nada más.
UUID_POR_DEFECTO = "d05b0000-0000-4000-8000-0000000d05b0"
UUID_XAPIAN_POR_DEFECTO = "d05b0000-0000-4000-8000-0000d05b0a91"

METADATOS = (
    ("Title", "Fixture mínimo D-05b — EduConect Rural"),
    ("Language", "spa"),
    ("Creator", "Equipo EduConect Rural"),
    ("Publisher", "EduConect Rural"),
    ("Description", "Fixture propio de cuatro páginas (CC0-1.0) para verificar el lector ZIM."),
    ("Name", "fixture_d05b"),
    ("Tags", "educonect;fixture;d05b"),
)

MAGIC_ZIM = 0x44D495A
VERSION_ESPERADA = (6, 3)
MAGIC_XAPIAN = b"Xapian Glass"


class ErrorFixture(Exception):
    """Fallo previsto: se informa y se sale con código 1."""


# ── Lectura de las páginas ────────────────────────────────────────────


def cargar_paginas(directorio: Path) -> list[tuple[str, str, str]]:
    """Devuelve [(ruta_zim, título, html)] en el orden de PAGINAS."""
    if not directorio.is_dir():
        raise ErrorFixture(f"no existe el directorio de páginas: {directorio}")
    paginas = []
    for archivo, ruta, titulo in PAGINAS:
        origen = directorio / archivo
        if not origen.is_file():
            raise ErrorFixture(f"falta la página {origen}")
        html = origen.read_text(encoding="utf-8")
        if not html.strip():
            raise ErrorFixture(f"la página {origen} está vacía")
        paginas.append((ruta, titulo, html))
    return paginas


# ── Escritura del ZIM ─────────────────────────────────────────────────


def generar_zim(
    destino: Path,
    paginas: list[tuple[str, str, str]],
    fecha: str,
) -> None:
    from libzim.writer import Compression, Creator, Hint, Item, StringProvider

    class Pagina(Item):
        """Una página HTML del paquete, marcada como artículo de portada."""

        def __init__(self, ruta: str, titulo: str, html: str) -> None:
            self._ruta = ruta
            self._titulo = titulo
            self._html = html

        def get_path(self) -> str:
            return self._ruta

        def get_title(self) -> str:
            return self._titulo

        def get_mimetype(self) -> str:
            return "text/html"

        def get_contentprovider(self) -> StringProvider:
            return StringProvider(self._html)

        def get_hints(self) -> dict:
            return {Hint.FRONT_ARTICLE: 1}

    destino.parent.mkdir(parents=True, exist_ok=True)

    # La configuración va ANTES del `with`: `__enter__` arranca el escritor y
    # después de eso `config_*` responde «Creator started».
    creador = Creator(destino)
    creador.config_compression(Compression.zstd)
    # Sin índice de texto completo: el paquete queda más chico y con un solo
    # UUID aleatorio dentro (el del índice de títulos, que libzim siempre crea).
    creador.config_indexing(False, "spa")
    # Un solo hilo: el orden de escritura no depende del planificador.
    creador.config_nbworkers(1)
    creador.config_verbose(False)
    creador.set_mainpath(RUTA_PRINCIPAL)

    with creador as c:
        for nombre, valor in METADATOS:
            c.add_metadata(nombre, valor)
        c.add_metadata("Date", fecha)
        for ruta, titulo, html in paginas:
            c.add_item(Pagina(ruta, titulo, html))


# ── Normalización de los campos aleatorios ────────────────────────────


def _bytes_uuid(texto: str) -> bytes:
    try:
        return uuidlib.UUID(texto).bytes
    except ValueError as exc:
        raise ErrorFixture(f"UUID inválido «{texto}»: {exc}") from exc


def normalizar(datos: bytes, uuid_zim: str, uuid_xapian: str) -> tuple[bytes, dict]:
    """Fija los dos UUID aleatorios y recalcula el MD5 de verificación.

    Devuelve (bytes_normalizados, informe) donde el informe dice qué se cambió
    y qué no. Falla si el archivo no tiene la forma esperada: preferimos no
    producir un paquete raro antes que uno silenciosamente distinto.
    """
    buf = bytearray(datos)
    if len(buf) < 80:
        raise ErrorFixture("el archivo es demasiado corto para ser un ZIM")

    magic, = struct.unpack("<I", buf[0:4])
    major, minor = struct.unpack("<HH", buf[4:8])
    if magic != MAGIC_ZIM or (major, minor) != VERSION_ESPERADA:
        raise ErrorFixture(
            f"cabecera inesperada: magic={magic:#x} versión={major}.{minor} "
            f"(se esperaba {MAGIC_ZIM:#x} y {VERSION_ESPERADA[0]}.{VERSION_ESPERADA[1]})"
        )

    checksum_pos, = struct.unpack("<Q", buf[72:80])
    if checksum_pos != len(buf) - 16:
        raise ErrorFixture(
            f"checksumPos={checksum_pos} no coincide con tamaño-16={len(buf) - 16}"
        )

    informe = {
        "uuid_zim_original": str(uuidlib.UUID(bytes=bytes(buf[8:24]))),
        "uuid_xapian_original": None,
        "md5_recalculado": False,
    }

    # 1. UUID de la cabecera (desplazamiento fijo de la especificación).
    buf[8:24] = _bytes_uuid(uuid_zim)

    # 2. UUID interno de la base Xapian del índice de títulos. Se localiza por
    #    la cadena mágica en vez de por un desplazamiento fijo: depende del
    #    tamaño de las páginas.
    pos = buf.find(MAGIC_XAPIAN)
    if pos < 0:
        raise ErrorFixture(
            "no se encontró la base Xapian del índice de títulos; "
            "sin ella no se puede fijar el segundo UUID (¿libzim cambió el formato?)"
        )
    inicio = pos + 14
    informe["uuid_xapian_original"] = str(
        uuidlib.UUID(bytes=bytes(buf[inicio:inicio + 16]))
    )
    buf[inicio:inicio + 16] = _bytes_uuid(uuid_xapian)

    # 3. MD5 de verificación: cubre todo el archivo salvo sus propios 16 bytes.
    buf[checksum_pos:] = hashlib.md5(bytes(buf[:checksum_pos])).digest()
    informe["md5_recalculado"] = True
    return bytes(buf), informe


# ── Lectura de vuelta (informe y comprobación) ────────────────────────


def inspeccionar(ruta: Path) -> dict:
    from libzim.reader import Archive

    if not ruta.is_file():
        raise ErrorFixture(f"no se escribió el paquete esperado: {ruta}")
    archivo = Archive(ruta)
    entradas = sorted(e.path for e in archivo.iter_by_path())
    return {
        "bytes": ruta.stat().st_size,
        "sha256": hashlib.sha256(ruta.read_bytes()).hexdigest(),
        "articulos": archivo.article_count,
        "entradas": len(entradas),
        "rutas": entradas,
        "principal": archivo.main_entry.path if archivo.has_main_entry else "(sin principal)",
        "metadatos": sorted(archivo.metadata_keys),
        "indice_titulos": bool(archivo.has_title_index),
        "indice_texto": bool(archivo.has_fulltext_index),
        "check": bool(archivo.check()),
        "uuid": str(archivo.uuid),
    }


# ── CLI ───────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="generar-fixture.py",
        description=(
            "Genera el fixture ZIM mínimo de D-05b (cuatro páginas propias, CC0-1.0). "
            "Sin red: lee las páginas de paginas/."
        ),
    )
    parser.add_argument("--out", type=Path, default=DESTINO_POR_DEFECTO,
                        help=f"ruta del .zim a escribir (por defecto: {DESTINO_POR_DEFECTO})")
    parser.add_argument("--paginas", type=Path, default=PAGINAS_POR_DEFECTO,
                        help=f"directorio con las fuentes (por defecto: {PAGINAS_POR_DEFECTO})")
    parser.add_argument("--fecha", default=FECHA_POR_DEFECTO,
                        help=f"metadato Date, AAAA-MM-DD (por defecto: {FECHA_POR_DEFECTO})")
    parser.add_argument("--uuid", default=UUID_POR_DEFECTO,
                        help=f"UUID de la cabecera ZIM (por defecto: {UUID_POR_DEFECTO})")
    parser.add_argument("--uuid-xapian", default=UUID_XAPIAN_POR_DEFECTO,
                        help="UUID interno del índice de títulos "
                             f"(por defecto: {UUID_XAPIAN_POR_DEFECTO})")
    parser.add_argument("--crudo", action="store_true",
                        help="no normalizar: deja la salida exactamente como la escribe libzim "
                             "(UUIDs aleatorios y MD5 de libzim); útil para comparar corridas")
    args = parser.parse_args(argv)

    try:
        for etiqueta, valor in (("--uuid", args.uuid), ("--uuid-xapian", args.uuid_xapian)):
            _bytes_uuid(valor)  # valida antes de generar nada
            if args.crudo:
                print(f"aviso: con --crudo no se aplica {etiqueta}", file=sys.stderr)

        paginas = cargar_paginas(args.paginas)
        generar_zim(args.out, paginas, args.fecha)

        detalle = {}
        if not args.crudo:
            original = args.out.read_bytes()
            normalizado, detalle = normalizar(original, args.uuid, args.uuid_xapian)
            args.out.write_bytes(normalizado)

        info = inspeccionar(args.out)
    except ErrorFixture as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"paquete:   {args.out}")
    print(f"bytes:     {info['bytes']}")
    print(f"sha256:    {info['sha256']}")
    print(f"artículos: {info['articulos']}  entradas: {info['entradas']}  "
          f"principal: {info['principal']}")
    print(f"rutas:     {', '.join(info['rutas'])}")
    print(f"metadatos: {', '.join(info['metadatos'])}")
    print(f"índices:   títulos={info['indice_titulos']} texto_completo={info['indice_texto']}")
    print(f"check:     {info['check']}  uuid: {info['uuid']}")
    if args.crudo:
        print("normalización: ninguna (--crudo)")
    else:
        print(f"normalización: uuid_zim={args.uuid} "
              f"(libzim: {detalle['uuid_zim_original']})")
        print(f"               uuid_xapian={args.uuid_xapian} "
              f"(libzim: {detalle['uuid_xapian_original']})")
        print(f"               md5 recalculado: {detalle['md5_recalculado']}")
    return 0 if info["check"] else 1


if __name__ == "__main__":
    sys.exit(main())
