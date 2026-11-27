#!/usr/bin/env bash
# verificar-fixture-zim.sh — El paquete ZIM montado es el declarado (D-05b / T2)
# EduConect Rural — Plataforma educativa offline
#
# Qué mide. Que el paquete que la sonda de perfiles va a montar en las dos patas
# sea EXACTAMENTE el que el repositorio declara, sin red y sin herramientas de
# ZIM: tamaño y sha256 del binario, y que sus fuentes (las cuatro páginas, la
# licencia y el generador) sigan junto a él.
#
# Por qué importa. La sonda `verificar-perfiles.sh` exige resultados OPUESTOS
# (full 200 / core 503) sobre el MISMO archivo. Si ese archivo cambiara —una
# regeneración con otra fecha, un byte alterado al copiarlo— el contraste
# seguiría dando 200/503 y la prueba pasaría sin probar lo que dice probar. El
# sha256 es el contrato del fixture: si no coincide, la sonda falla en voz alta
# en lugar de medir sobre un insumo desconocido.
#
# Qué NO mide. No abre el paquete ni lo valida estructuralmente: eso exige un
# lector de ZIM (`zimcheck`, `kiwix-manage`, python-libzim) que no está en el
# host ni en CI, y el encargo prohíbe depender de él. Lo que aquí se verifica es
# integridad byte a byte, que es lo que se puede comprobar siempre y en todas
# partes. La lectura real la hace el producto: si el paquete no fuera legible,
# `full` no respondería 200 a los artículos y la sonda lo cazaría.
#
# Uso:
#   tests/docker/verificar-fixture-zim.sh                # tests/fixtures/zim
#   tests/docker/verificar-fixture-zim.sh <directorio>
#
# Códigos de salida:
#   0  el paquete es el declarado y sus fuentes están completas
#   1  falta el paquete, sus fuentes, o el paquete no es el declarado
#   2  NO VERIFICABLE — no hay con qué medir (`sha256sum` ausente)

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Identidad declarada del fixture (FICHA.md §4). Si el paquete se regenera a
# propósito, se actualizan estos tres valores y la ficha en el mismo cambio.
NOMBRE="fixture_d05b.zim"
TAMANO_ESPERADO=37777
SHA256_ESPERADO="16c061a95a897967fc92e690a4702f12f90178998092fcf51a916f3f95b9893b"
PAGINAS_ESPERADAS=(portada.html estacion-la-esperanza.html observatorio-del-rio.html glosario.html)

DIR="${1:-$(cd "$AQUI/.." && pwd)/fixtures/zim}"

command -v sha256sum >/dev/null 2>&1 \
    || { echo "ERROR: falta sha256sum (coreutils): no se puede autenticar el paquete." >&2; exit 2; }

fallos=0
falla() {
    fallos=$((fallos + 1))
    echo "ERROR: $1" >&2
    [[ -n "${2:-}" ]] && printf '%s\n' "$2" | sed 's/^/       /' >&2
    return 0
}

[[ -d "$DIR" ]] || falla "no existe el directorio del fixture: $DIR"
PAQUETE="$DIR/$NOMBRE"
if [[ ! -f "$PAQUETE" ]]; then
    falla "no existe el paquete: $PAQUETE" \
        "El fixture D-05b se versiona en tests/fixtures/zim/ con su ficha y su sha256."
else
    tamano="$(stat -c %s "$PAQUETE")"
    sha="$(sha256sum "$PAQUETE" | cut -d' ' -f1)"
    [[ "$tamano" == "$TAMANO_ESPERADO" ]] \
        || falla "tamaño del paquete: $tamano bytes (se declaran $TAMANO_ESPERADO)"
    [[ "$sha" == "$SHA256_ESPERADO" ]] || falla "sha256 del paquete NO coincide" \
        "declarado: $SHA256_ESPERADO
real:      $sha"
fi

faltantes=()
for pagina in "${PAGINAS_ESPERADAS[@]}"; do
    [[ -f "$DIR/paginas/$pagina" ]] || faltantes+=("paginas/$pagina")
done
for fuente in LICENCIA.md generar-fixture.py; do
    [[ -f "$DIR/$fuente" ]] || faltantes+=("$fuente")
done
if [[ ${#faltantes[@]} -gt 0 ]]; then
    falla "faltan fuentes del fixture en $DIR: ${faltantes[*]}" \
        "Sin fuentes no hay procedencia que auditar: el binario quedaría huérfano."
fi

if [[ "$fallos" -gt 0 ]]; then
    echo "RESULTADO: FALLA — el fixture no es el declarado." >&2
    exit 1
fi

echo "$NOMBRE: $TAMANO_ESPERADO bytes, sha256 $SHA256_ESPERADO (${#PAGINAS_ESPERADAS[@]} páginas, licencia y generador)"
exit 0
