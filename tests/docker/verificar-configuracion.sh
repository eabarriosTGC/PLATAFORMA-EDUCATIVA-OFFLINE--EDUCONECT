#!/usr/bin/env bash
# verificar-configuracion.sh — Configuración inválida debe fallar nombrando la variable (D-05c)
# EduConect Rural — Plataforma educativa offline
#
# Qué mide. Que la imagen se NIEGUE a arrancar con configuración inválida y que
# el rechazo nombre la variable culpable, para cada una de las tres formas en
# que CI podía enviar configuración mala:
#
#   1. `JWT_SECRET` demasiado corto (20 caracteres, mínimo 32 — D-02).
#   2. `JWT_SECRET` ausente.
#   3. `ADMIN_INITIAL_PASSWORD` vacía, con un `JWT_SECRET` válido.
#
# Por qué es una comprobación y no un detalle del arranque: el job de CI original
# mandaba `JWT_SECRET=test-secreto-para-ci` (20 caracteres) y ninguna
# `ADMIN_INITIAL_PASSWORD`. El contenedor moría en el acto y CI no lo mostraba.
# La lección no es «aflojar la validación» sino que CI debe enviar configuración
# válida (lo hacen `esperar-salud.sh` y `verificar-perfiles.sh`); esta sonda deja
# probado, además, que la validación sigue rechazando lo que debe rechazar. Si
# alguien relajara el mínimo de 32 bytes para «hacer pasar CI», esta prueba falla.
#
# Cada caso corre en su propio contenedor con volumen nuevo y plazo acotado
# (`timeout`). El contenedor debe terminar solo: si se cuelga, `timeout` lo corta
# y el estado 124 se informa como falla, porque colgarse no es «rechazar».
# `--rm` es correcto acá precisamente porque el caso espera una salida: el log se
# captura en la misma corrida, antes de que el contenedor se borre.
#
# Uso:
#   tests/docker/verificar-configuracion.sh <imagen> [imagen...]
#
# Códigos de salida:
#   0  los tres casos fallan con código distinto de cero nombrando la variable
#   1  al menos un caso se comportó mal (arrancó, se colgó o no nombró la variable)
#   2  NO VERIFICABLE — falta docker/openssl o alguna imagen no existe

set -uo pipefail

PLAZO_CASO=180

no_verificable() {
    echo "ERROR: $1" >&2
    echo "RESULTADO: NO VERIFICABLE — no se midió el rechazo de configuración." >&2
    exit 2
}

command -v docker >/dev/null 2>&1 || no_verificable "docker no está disponible en PATH."
command -v openssl >/dev/null 2>&1 || no_verificable "openssl no está disponible para los secretos válidos de contraste."
[[ $# -ge 1 ]] || no_verificable "faltan imágenes. Uso: $0 <imagen> [imagen...]"
for imagen in "$@"; do
    docker image inspect "$imagen" >/dev/null 2>&1 \
        || no_verificable "no existe la imagen «$imagen»."
done

# Secretos válidos de contraste: en cada caso se rompe UNA sola cosa, así el
# rechazo no puede atribuirse a otra variable.
JWT_VALIDO="$(openssl rand -hex 32)"
PASSWORD_VALIDA="$(openssl rand -base64 24)"
[[ ${#JWT_VALIDO} -ge 32 && ${#PASSWORD_VALIDA} -ge 12 ]] \
    || no_verificable "los secretos de contraste no alcanzan la longitud mínima."

pasadas=0
fallidas=0

pasa() { pasadas=$((pasadas + 1)); echo "  ✅ $1"; }
falla() {
    fallidas=$((fallidas + 1))
    echo "  ❌ $1"
    [[ -n "${2:-}" ]] && printf '%s\n' "$2" | sed 's/^/       /'
    return 0
}

# Un caso: descripción, subcadena que debe aparecer (nombre de la variable),
# y fragmento del motivo con el que el producto explica el rechazo. Se exige el
# motivo para que un fallo por otra causa (por ejemplo una variable distinta) no
# se lea como el rechazo esperado.
probar_caso() {
    local imagen="$1" descripcion="$2" variable="$3" motivo="$4"
    shift 4
    local salida estado
    salida="$(timeout "$PLAZO_CASO" docker run --rm --label "${D05C_ETIQUETA:-educonect-d05c=1}" \
        -v /data "$@" "$imagen" 2>&1)"
    estado=$?

    if [[ "$estado" -eq 124 ]]; then
        falla "$imagen · $descripcion: se colgó en vez de rechazar la configuración (timeout ${PLAZO_CASO}s)" "$salida"
        return
    fi
    if [[ "$estado" -eq 0 ]]; then
        falla "$imagen · $descripcion: arrancó con configuración inválida (código 0)" "$salida"
        return
    fi
    if ! grep -F -- "$variable" <<< "$salida" | grep -F -q -- "$motivo"; then
        falla "$imagen · $descripcion: falló con código $estado nombrando $variable pero sin el motivo esperado en la misma línea («$motivo»)" "$salida"
        return
    fi
    pasa "$imagen · $descripcion: código $estado, mensaje que nombra $variable"
    grep -F -- "$variable" <<< "$salida" | head -n 2 | sed 's/^/       /'
}

for imagen in "$@"; do
    echo "== Imagen: $imagen =="

    # 1. JWT_SECRET demasiado corto (el valor exacto que enviaba CI: 20 chars).
    probar_caso "$imagen" "JWT_SECRET de 20 caracteres" "JWT_SECRET" "demasiado corta" \
        -e "JWT_SECRET=test-secreto-para-ci" \
        -e "ADMIN_INITIAL_PASSWORD=$PASSWORD_VALIDA"

    # 2. JWT_SECRET ausente: sin `-e JWT_SECRET`, docker no la inyecta.
    probar_caso "$imagen" "JWT_SECRET ausente" "JWT_SECRET" "ausente" \
        -e "ADMIN_INITIAL_PASSWORD=$PASSWORD_VALIDA"

    # 3. ADMIN_INITIAL_PASSWORD vacía con JWT_SECRET válido. El rechazo ocurre al
    #    abrir la base (el bootstrap del administrador exige la contraseña), así
    #    que el mensaje nombra la variable y la base queda sin crear en silencio.
    probar_caso "$imagen" "ADMIN_INITIAL_PASSWORD vacía" "ADMIN_INITIAL_PASSWORD" "vacía" \
        -e "JWT_SECRET=$JWT_VALIDO" \
        -e "ADMIN_INITIAL_PASSWORD="
done

echo
echo "─────────────────────────────────────────────"
echo "  COMPROBACIONES: $pasadas pasadas, $fallidas fallidas"
if [[ "$fallidas" -gt 0 ]]; then
    echo "  RESULTADO: FALLA — la imagen aceptó configuración inválida o falló por otra causa"
    exit 1
fi
echo "  RESULTADO: OK — la configuración inválida se rechaza nombrando la variable"
exit 0
