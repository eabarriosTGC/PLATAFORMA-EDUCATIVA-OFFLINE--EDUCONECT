#!/usr/bin/env python3
"""Auditoría de clausura de dependencias sobre un par de Cargo.lock.

Objetivo: demostrar que un conjunto de paquetes retirados de un lockfile
pertenece íntegramente a la clausura transitiva de un paquete raíz, y que
ningún paquete ajeno cambió de versión.

Uso:
    git show HEAD:edu-conect-rural-server/Cargo.lock > /tmp/lock-antes.toml
    python3 docs/sprint2/auditar-clausura.py \
        /tmp/lock-antes.toml edu-conect-rural-server/Cargo.lock zim 0.4.0

Identidad de paquete
--------------------
La identidad de un paquete en Cargo.lock es la terna (name, version, source).
El script indexa por esa terna: dos paquetes con igual nombre y versión pero
distinto origen son claves distintas y no se sobrescriben.

Resolución de referencias
-------------------------
Cargo escribe las dependencias con 1, 2 o 3 campos:

    1 campo   "nombre"                -> debe haber UNA sola candidata por nombre
    2 campos  "nombre version"        -> debe haber UNA sola candidata por (nombre, version)
    3 campos  "nombre version (src)"  -> coincidencia exacta por la terna

En ningún caso se adivina: si una referencia admite más de una candidata, se
cuenta como AMBIGUA; si no admite ninguna, como IRRESOLUBLE.

Códigos de salida
-----------------
    0  auditoría válida
    1  auditoría INVÁLIDA: hay ambigüedades, referencias irresolubles, o algún
       paquete retirado quedó fuera de la clausura

La invalidez es una condición de máquina, no una convención de lectura.
"""

import re
import sys


def parsear_lock(ruta):
    """Devuelve {(nombre, version, source): [refs_de_dependencias]}."""
    paquetes = {}
    actual = None
    en_deps = False

    def cerrar():
        if actual and actual["name"]:
            clave = (actual["name"], actual["version"], actual["source"])
            paquetes[clave] = actual["deps"]

    for linea in open(ruta, encoding="utf-8"):
        s = linea.strip()

        if s == "[[package]]":
            cerrar()
            actual = {"name": None, "version": None, "source": None, "deps": []}
            en_deps = False
            continue
        if actual is None:
            continue

        m = re.match(r'name = "(.+)"', s)
        if m:
            actual["name"] = m.group(1)
            continue
        m = re.match(r'version = "(.+)"', s)
        if m:
            actual["version"] = m.group(1)
            continue
        m = re.match(r'source = "(.+)"', s)
        if m:
            actual["source"] = m.group(1)
            continue

        if s.startswith("dependencies = ["):
            resto = s[len("dependencies = ["):].strip()
            if resto.startswith("]"):
                en_deps = False
                continue
            en_deps = True
            _acumular(actual, resto)
            continue

        if en_deps:
            if s.startswith("]"):
                en_deps = False
                continue
            _acumular(actual, s)

    cerrar()
    return paquetes


def _acumular(actual, texto):
    for trozo in texto.split(","):
        d = trozo.strip().strip('"').strip("]").strip()
        if d:
            actual["deps"].append(d)


def resolver(ref, tabla):
    """Devuelve (clave, motivo). clave es None si no se puede resolver sin adivinar.

    motivo: 'exacta' | 'por_nombre' | 'ambigua:<n>' | 'irresoluble'
    """
    nombre = ref.split()[0]
    campos = len(ref.split())

    if campos == 1:
        candidatas = [k for k in tabla if k[0] == nombre]
        if len(candidatas) == 1:
            return candidatas[0], "por_nombre"
        if len(candidatas) > 1:
            return None, f"ambigua:{len(candidatas)}"
        return None, "irresoluble"

    if campos == 2:
        version = ref.split()[1]
        candidatas = [k for k in tabla if k[0] == nombre and k[1] == version]
        if len(candidatas) == 1:
            return candidatas[0], "exacta"
        if len(candidatas) > 1:
            return None, f"ambigua:{len(candidatas)}"
        return None, "irresoluble"

    # 3+ campos: la fuente forma parte de la referencia.
    resto = ref[len(nombre):].strip()
    m = re.match(r'(\S+)\s+\((.+)\)', resto)
    if m:
        version, source = m.group(1), m.group(2)
        candidatas = [k for k in tabla if k == (nombre, version, source)]
        if len(candidatas) == 1:
            return candidatas[0], "exacta"
        return None, "irresoluble"

    return None, "irresoluble"


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)

    ruta_antes, ruta_despues, raiz_nombre, raiz_version = sys.argv[1:5]

    antes = parsear_lock(ruta_antes)
    despues = parsear_lock(ruta_despues)

    print(f"lock anterior : {ruta_antes}  ({len(antes)} paquetes)")
    print(f"lock posterior: {ruta_despues}  ({len(despues)} paquetes)")

    duplicados = {}
    for (n, v, _src) in antes:
        duplicados.setdefault((n, v), []).append(_src)
    repetidos = {k: s for k, s in duplicados.items() if len(s) > 1}
    print(f"pares (nombre, versión) con más de una fuente: {len(repetidos)}")
    for k, fuentes in repetidos.items():
        print(f"  {k[0]} {k[1]}: {fuentes}")
    print()

    raiz = next((k for k in antes if k[0] == raiz_nombre and k[1] == raiz_version), None)
    if raiz is None:
        sys.exit(f"ERROR: {raiz_nombre} {raiz_version} no está en el lock anterior")

    clausura = {raiz}
    pila = [raiz]
    ambiguas = 0
    irresolubles = 0
    exactas = 0
    por_nombre = 0

    while pila:
        actual = pila.pop()
        for ref in antes.get(actual, []):
            destino, motivo = resolver(ref, antes)
            if motivo == "exacta":
                exactas += 1
            elif motivo == "por_nombre":
                por_nombre += 1
            elif motivo.startswith("ambigua"):
                ambiguas += 1
                print(f"  AMBIGUA: {actual[0]} {actual[1]} -> {ref} ({motivo})")
                continue
            else:
                irresolubles += 1
                print(f"  IRRESOLUBLE: {actual[0]} {actual[1]} -> {ref}")
                continue
            if destino in antes and destino not in clausura:
                clausura.add(destino)
                pila.append(destino)

    retirados = sorted(set(antes) - set(despues))
    agregados = sorted(set(despues) - set(antes))

    print("=== RESUMEN ===")
    print(f"clausura de {raiz_nombre} {raiz_version}: {len(clausura)} paquetes")
    print(f"retirados: {len(retirados)}   agregados: {len(agregados)}")
    print()
    print("=== RESOLUCIÓN DE REFERENCIAS ===")
    print(f"  exactas (versión explícita)     : {exactas}")
    print(f"  por nombre (una sola candidata) : {por_nombre}")
    print(f"  ambiguas                        : {ambiguas}")
    print(f"  irresolubles                    : {irresolubles}")
    print()

    fuera = [k for k in retirados if k not in clausura]
    print("=== CONTROL: retirados fuera de la clausura ===")
    print(f"  {len(fuera)}  {fuera if fuera else ''}")
    print()

    versiones_despues = {}
    for (n, v, _src) in despues:
        versiones_despues.setdefault(n, []).append(v)

    print("=== CAMBIOS DE VERSIÓN EN SUPERVIVIENTES ===")
    cambios = []
    for n in sorted(versiones_despues):
        v_antes = sorted(set(v for (n2, v, _s) in antes if n2 == n))
        v_desp = sorted(set(versiones_despues[n]))
        if v_antes != v_desp:
            perdidas = [v for v in v_antes if v not in v_desp]
            ganadas = [v for v in v_desp if v not in v_antes]
            cambios.append((n, perdidas, ganadas, v_desp))
    if not cambios:
        print("  ninguno")
    for n, perdidas, ganadas, quedan in cambios:
        estado = "SOLO PIERDE DUPLICADO" if perdidas and not ganadas else "CAMBIO REAL"
        print(f"  {n:<20} pierde={perdidas} gana={ganadas} quedan={quedan}  -> {estado}")
    print()

    print("=== MIEMBROS DE LA CLAUSURA ===")
    print(f"  {'paquete':<30}{'versión':<24}{'estado'}")
    for (n, v, _src) in sorted(clausura, key=lambda k: (k[0], k[1])):
        estado = "RETIRADO" if (n, v, _src) in retirados else "conservado"
        print(f"  {n:<30}{v:<24}{estado}")
    print()

    hay_cambio_real = any(ganadas for _n, _p, ganadas, _q in cambios)
    invalida = (
        ambiguas > 0
        or irresolubles > 0
        or len(fuera) > 0
        or len(agregados) > 0
        or hay_cambio_real
    )
    print("=== VEREDICTO ===")
    print("  AUDITORÍA VÁLIDA" if not invalida else "  AUDITORÍA INVÁLIDA")
    sys.exit(0 if not invalida else 1)


if __name__ == "__main__":
    main()
