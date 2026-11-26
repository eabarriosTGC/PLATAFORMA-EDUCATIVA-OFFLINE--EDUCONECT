#!/usr/bin/env bash
# verificar-ldd-default.sh — Compuerta de enlace del perfil predeterminado (D-CI 2)
# EduConect Rural — Plataforma educativa offline
#
# Qué demuestra, y qué no:
#   `cargo build` en el leg `default` demuestra INDEPENDENCIA DE COMPILACIÓN:
#   que el perfil compila sin libzim-dev. No demuestra que el binario resultante
#   deje de arrastrar la cadena de ZIM por enlace dinámico. Este script mide eso:
#   la clausura de `ldd` del binario del perfil default debe estar libre de
#   libzim, libxapian, libicu y libstdc++.
#
# Referencia de la medición: docs/sprint2/d01-verificacion.md §3 y
# docs/sprint2/ldd-baseline.log (15 entradas con ZIM, 5 sin ZIM).
#
# Uso:
#   scripts/verificar-ldd-default.sh [RUTA_AL_BINARIO]
#   RUTA_AL_BINARIO por defecto: target/release/edu-conect-rural-server
#   (relativa al CWD: en CI el CWD es edu-conect-rural-server/)
#
# Códigos de salida:
#   0  clausura válida — ninguna biblioteca prohibida
#   1  el binario enlaza al menos una biblioteca prohibida (se nombra cuál)
#   2  NO VERIFICABLE — no se midió nada concluyente: binario ausente, ldd
#      ausente, ldd con código distinto de 0, o clausura sin ninguna entrada
#      reconocible (vacía o solo con diagnósticos)
#
# Dos precisiones que la compuerta hace explícitas:
#   · Una entrada de la clausura es una línea con `=>` o con un nombre de
#     biblioteca terminado en `.so` / `.so.N`. Un diagnóstico como
#     `not a dynamic executable` NO es una entrada, aunque ldd salga con 0:
#     contar cualquier línea no vacía convertía un diagnóstico en «válido».
#   · Las bibliotecas se comparan por NOMBRE (el token de la biblioteca, sin
#     ruta y sin sufijo `.so.N`), nunca por subcadena de la línea: una ruta
#     como /opt/libicu-legacy/libfoo.so.1 no es una infracción de libicu.
#
# El código 2 existe para que un fallo de montaje no se lea como "válido".
# Una compuerta que no midió no puede aprobar.

set -uo pipefail

BINARIO="${1:-target/release/edu-conect-rural-server}"
PROHIBIDAS=(libzim libxapian libicu libstdc++)

no_verificable() {
    echo "ERROR: $1" >&2
    echo "RESULTADO: NO VERIFICABLE — no se midió el enlace; la compuerta no aprueba." >&2
    exit 2
}

command -v ldd >/dev/null 2>&1 || no_verificable "ldd no está disponible en PATH."

echo "── Binario bajo medición ──"
echo "$BINARIO"
[ -f "$BINARIO" ] || no_verificable "no existe el binario: $BINARIO (¿se ejecutó el build antes de esta compuerta?)"
ls -l "$BINARIO" || no_verificable "no se pudo listar el binario: $BINARIO"
command -v file >/dev/null 2>&1 && file "$BINARIO"

echo
echo "── Clausura de enlace (ldd) ──"
clausura="$(ldd "$BINARIO" 2>&1)"
estado_ldd=$?
printf '%s\n' "$clausura"
[ "$estado_ldd" -eq 0 ] || no_verificable "ldd salió con código $estado_ldd sobre $BINARIO."

entradas="$(printf '%s\n' "$clausura" | grep -E -c '=>|[^[:space:]/]+[.]so([.][0-9]+)*([[:space:]]|$)' || true)"
[ "${entradas:-0}" -gt 0 ] || no_verificable "ldd no devolvió ninguna entrada para $BINARIO."

echo
echo "── Bibliotecas prohibidas en la clausura ──"
ofensoras=0
for prohibida in "${PROHIBIDAS[@]}"; do
    # Compara el NOMBRE de cada biblioteca de la línea (basename sin `.so.N`)
    # contra la familia prohibida. Una familia incluye sus variantes reales
    # —libicu → libicuuc, libicui18n, libicudata—, pero no una biblioteca
    # distinta que solo comparta prefijo o que aparezca dentro de una ruta.
    coincidencias="$(printf '%s\n' "$clausura" | awk -v familia="$prohibida" '
        {
            n = split($0, campos, /[ \t]+/)
            for (i = 1; i <= n; i++) {
                token = campos[i]
                sub(/^.*\//, "", token)                # descarta la ruta
                sub(/[.]so([.][0-9]+)*$/, "", token)    # descarta .so / .so.N
                if (token == familia \
                    || (index(token, familia) == 1 \
                        && substr(token, length(familia) + 1, 1) ~ /[A-Za-z0-9+]/)) {
                    print
                    next
                }
            }
        }' || true)"
    if [ -n "$coincidencias" ]; then
        ofensoras=$((ofensoras + 1))
        echo "INFRACCIÓN: el binario del perfil default enlaza «$prohibida»:"
        printf '%s\n' "$coincidencias" | sed 's/^/    /'
    else
        echo "  ausente: $prohibida"
    fi
done

echo
if [ "$ofensoras" -gt 0 ]; then
    echo "RESULTADO: INVÁLIDO — $ofensoras de ${#PROHIBIDAS[@]} bibliotecas prohibidas aparecen en la clausura de $BINARIO."
    echo "El perfil default debe enlazar solo la libc y el runtime de Rust. Si alguna"
    echo "de estas aparece, una dependencia dura de la cadena ZIM volvió al perfil."
    exit 1
fi

echo "RESULTADO: VÁLIDO — $entradas entradas en la clausura; ninguna de: ${PROHIBIDAS[*]}."
exit 0
