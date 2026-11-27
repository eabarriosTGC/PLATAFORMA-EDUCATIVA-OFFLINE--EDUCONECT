#!/usr/bin/env bash
# verificar-aislamiento-buildkit.sh — Aislamiento de etapas por target (D-05c)
# EduConect Rural — Plataforma educativa offline
#
# Qué mide. Que `--target core` NO ejecute las etapas que sólo `full` necesita,
# y que `--target full` SÍ las ejecute. Se mide sobre los logs de build con
# `--progress=plain`, donde BuildKit escribe un encabezado por paso:
#
#     #8 [full 3/6] RUN apt-get update && apt-get install -y ... libzim8 ...
#
# El marcador exclusivo de la pata ZIM es el encabezado de etapa `[full …]` y el
# de su binario `[binario-full …]`. Se usa el ENCABEZADO y no el nombre del
# paquete `libzim8` porque `libzim-dev` se instala en `rust-builder` (etapa
# compartida) y arrastra `libzim8` como dependencia: buscar el paquete daría
# falsos positivos también en el build de `core`.
#
# Por qué hace falta una sonda y no basta con mirar la imagen: la imagen `core`
# queda correcta incluso con el constructor clásico, que compila TODAS las
# etapas anteriores al target (`binario-full` y `full` van antes de `core` en el
# Dockerfile). Lo que se pierde ahí no es el artefacto, es el aislamiento: `core`
# pagaría la compilación ZIM en cada build. Eso sólo se ve en el grafo de etapas,
# es decir en el log de BuildKit.
#
# Límite de esta máquina: no tiene `docker buildx` ni constructor BuildKit
# utilizable desde scripts, así que este chequeo sólo puede ejecutarse en CI. En
# un log del constructor clásico (líneas `Step 7/31 : …`) la sonda sale con 2
# («no verificable») y NUNCA con 0: no medir no puede leerse como aprobación.
#
# Uso:
#   tests/docker/verificar-aislamiento-buildkit.sh <log-core> <log-full>
#
# Cómo se producen los logs:
#   docker build --progress=plain --target core -t educonect-rural:core . 2>&1 | tee core.log
#   docker build --progress=plain --target full -t educonect-rural:full . 2>&1 | tee full.log
#
# Códigos de salida:
#   0  aislado: el log de core no muestra ninguna etapa exclusiva de full y el
#      de full sí las muestra
#   1  el aislamiento está roto o falta un marcador esperado en el log de full
#   2  NO VERIFICABLE — falta un log, está vacío, no es un log de BuildKit o no
#      corresponde al target que dice (no se midió nada concluyente)

set -uo pipefail

LOG_CORE="${1:-}"
LOG_FULL="${2:-}"

no_verificable() {
    echo "ERROR: $1" >&2
    echo "RESULTADO: NO VERIFICABLE — no se midió el aislamiento de etapas." >&2
    exit 2
}

[[ -n "$LOG_CORE" && -n "$LOG_FULL" ]] \
    || no_verificable "faltan los logs. Uso: $0 <log-core> <log-full>"
for log in "$LOG_CORE" "$LOG_FULL"; do
    [[ -f "$log" ]] || no_verificable "no existe el log «$log»."
    [[ -s "$log" ]] || no_verificable "el log «$log» está vacío."
done

# Un encabezado de paso de BuildKit en `--progress=plain` es `#<n> [<etapa> i/n]`.
# El constructor clásico escribe `Step 7/31 : …` y no tiene este formato.
es_buildkit() { grep -Eq '^#[0-9]+ \[' "$1"; }

# Encabezados de una etapa concreta. El nombre se delimita con espacio para que
# `[full …]` no coincida con `[binario-full …]`.
encabezados_de() {
    grep -E "^#[0-9]+ \\[$2 " "$1" || true
}

etapas_de() {
    grep -Eo '^#[0-9]+ \[[A-Za-z0-9._-]+' "$1" | sed 's/.*\[//' | sort -u | tr '\n' ' ' || true
}

# ── Qué NO es medible, y por qué se distingue de una falla ──────────
# Un log del constructor clásico, o un archivo que no es el log de este build,
# no autoriza ninguna conclusión: sale 2. En cambio un log de build correcto al
# que le falta una etapa esperada SÍ es una falla (1): el build no produjo el
# perfil. Por eso la comprobación de «es un log de build» se apoya en
# `runtime-base`, que es dependencia de los DOS targets.
es_buildkit "$LOG_CORE" \
    || no_verificable "el log de core no tiene encabezados de BuildKit (¿constructor clásico?). Sin grafo de etapas no hay aislamiento que medir: $LOG_CORE"
es_buildkit "$LOG_FULL" \
    || no_verificable "el log de full no tiene encabezados de BuildKit (¿constructor clásico?). Sin grafo de etapas no hay aislamiento que medir: $LOG_FULL"
for par in "$LOG_CORE" "$LOG_FULL"; do
    [[ -n "$(encabezados_de "$par" runtime-base)" ]] \
        || no_verificable "el log «$par» no muestra la etapa compartida «runtime-base»: no es un log de build de estos targets."
done
[[ -n "$(encabezados_de "$LOG_CORE" binario-core)" ]] \
    || no_verificable "el log de core no muestra la etapa «binario-core»: no es un log de --target core."
[[ -n "$(encabezados_de "$LOG_FULL" binario-full)" ]] \
    || no_verificable "el log de full no muestra la etapa «binario-full»: no es un log de --target full."

echo "== Etapas ejecutadas en cada build =="
echo "  core: $(etapas_de "$LOG_CORE")"
echo "  full: $(etapas_de "$LOG_FULL")"
echo

fallidas=0
pasa() { echo "  ✅ $1"; }
falla() {
    fallidas=$((fallidas + 1))
    echo "  ❌ $1"
    [[ -n "${2:-}" ]] && printf '%s\n' "$2" | sed 's/^/       /'
    return 0
}

echo "== core NO debe ejecutar las etapas exclusivas de full (S1, S2, S6) =="
for exclusiva in full binario-full; do
    lineas="$(encabezados_de "$LOG_CORE" "$exclusiva")"
    if [[ -n "$lineas" ]]; then
        falla "el build de core ejecutó la etapa «$exclusiva»: el target no está aislando el grafo" \
            "$(printf '%s\n' "$lineas" | head -n 10)"
    else
        pasa "core: ninguna etapa «$exclusiva» en el log"
    fi
done

echo "== full SÍ debe ejecutar las etapas exclusivas de full (S6, S7) =="
for exclusiva in full binario-full; do
    lineas="$(encabezados_de "$LOG_FULL" "$exclusiva")"
    if [[ -n "$lineas" ]]; then
        pasa "full: la etapa «$exclusiva» aparece en el log ($(printf '%s\n' "$lineas" | grep -c . ) pasos)"
    else
        falla "el build de full no ejecutó la etapa «$exclusiva»: el perfil full no se construyó" \
            "Sin esa etapa, el binario con --features zim o sus bibliotecas nativas no existen."
    fi
done

echo
echo "─────────────────────────────────────────────"
if [[ "$fallidas" -gt 0 ]]; then
    echo "  RESULTADO: FALLA — aislamiento de etapas roto ($fallidas comprobaciones)"
    exit 1
fi
echo "  RESULTADO: OK — core omite las etapas exclusivas de full y full las ejecuta"
exit 0
