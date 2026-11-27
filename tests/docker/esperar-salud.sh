#!/usr/bin/env bash
# esperar-salud.sh — Espera ACOTADA de disponibilidad por el puerto publicado (D-05c)
# EduConect Rural — Plataforma educativa offline
#
# Qué corrige. El paso «Verify image starts» del job `docker` de CI hacía:
#
#     docker run -d -p 8080:8080 -e JWT_SECRET=test-secreto-para-ci educonect-rural
#     sleep 10
#     curl -sf http://localhost:8080/health || exit 1
#
# Tres defectos en tres líneas:
#   · `test-secreto-para-ci` mide 20 caracteres y la configuración exige 32
#     (D-02): el contenedor se negaba a arrancar en el acto.
#   · `sleep 10` no esperaba nada: era tiempo muerto, no una espera. Si el
#     servicio tarda más (o el contenedor muere en el primer segundo) el
#     resultado era el mismo, sin distinguir «tardó» de «murió».
#   · Ante el fallo, `curl` no mostraba POR QUÉ: el log del contenedor se perdía
#     y el diagnóstico había que adivinarlo.
#
# Qué hace este script:
#   · Genera secretos EFÍMEROS por corrida (`openssl rand`), nunca versionados y
#     nunca los valores débiles de antes. Un secreto corto no se «arregla»
#     aflojando la validación del producto: se envía configuración válida.
#   · Arranca sobre un volumen anónimo NUEVO (base de datos vacía), con `-P`
#     para que el puerto publicado lo elija el demonio: un 8080 fijo hace que la
#     prueba dependa de lo que ya esté corriendo en la máquina (en este host hay
#     otro servicio en 8080, y `curl` respondería 200 por el contenedor
#     equivocado: un falso verde).
#   · Sondea /health con PLAZO, sin `sleep` fijo, y corta antes si el contenedor
#     deja de correr.
#   · Si no llega a healthy, adjunta el log y el estado del contenedor.
#   · No usa `--rm`: con `--rm` el contenedor desaparece al morir y `docker logs`
#     ya no tiene qué mostrar, que es justo el caso que hay que diagnosticar.
#
# Uso:
#   tests/docker/esperar-salud.sh <imagen> [plazo-segundos]
#
# Variables de entorno:
#   D05C_PLAZO     plazo en segundos (por defecto 180)
#   D05C_ETIQUETA  etiqueta de limpieza que llevan los contenedores que crea
#                  (por defecto `educonect-d05c=1`); el job de CI la reemplaza
#                  por una por corrida para poder borrar sólo lo suyo.
#
# Códigos de salida:
#   0  /health respondió 200 dentro del plazo
#   1  no respondió 200 dentro del plazo (o el contenedor murió): es una FALLA
#   2  NO VERIFICABLE — falta docker/curl/openssl, la imagen no existe o no se
#      pudo publicar el puerto (un fallo de entorno no se lee como aprobación)

set -uo pipefail

IMAGEN="${1:-}"
PLAZO="${2:-${D05C_PLAZO:-180}}"
ETIQUETA="${D05C_ETIQUETA:-educonect-d05c=1}"

no_verificable() {
    echo "ERROR: $1" >&2
    echo "RESULTADO: NO VERIFICABLE — no se midió la disponibilidad." >&2
    exit 2
}

for herramienta in docker curl openssl; do
    command -v "$herramienta" >/dev/null 2>&1 \
        || no_verificable "$herramienta no está disponible en PATH."
done
[[ -n "$IMAGEN" ]] || no_verificable "falta la imagen. Uso: $0 <imagen> [plazo-segundos]"
docker image inspect "$IMAGEN" >/dev/null 2>&1 \
    || no_verificable "no existe la imagen «$IMAGEN»."

CONTENEDOR="d05c-salud-$$"

limpiar() { docker rm -f -v "$CONTENEDOR" >/dev/null 2>&1; }
trap limpiar EXIT

# ── Secretos efímeros, generados en esta corrida ────────────────────
JWT_SECRET_EFIMERO="$(openssl rand -hex 32)"
ADMIN_PASSWORD_EFIMERA="$(openssl rand -base64 24)"
[[ ${#JWT_SECRET_EFIMERO} -ge 32 ]] || no_verificable "el JWT_SECRET efímero no alcanza 32 caracteres."
[[ ${#ADMIN_PASSWORD_EFIMERA} -ge 12 ]] || no_verificable "la contraseña efímera no alcanza 12 caracteres."

echo "== Arranque con secretos efímeros y volumen nuevo: $IMAGEN =="
echo "   JWT_SECRET: ${#JWT_SECRET_EFIMERO} caracteres (efímero); ADMIN_INITIAL_PASSWORD: ${#ADMIN_PASSWORD_EFIMERA} (efímera)"

docker run -d --name "$CONTENEDOR" \
    --label "$ETIQUETA" \
    -P -v /data \
    -e "JWT_SECRET=$JWT_SECRET_EFIMERO" \
    -e "ADMIN_INITIAL_PASSWORD=$ADMIN_PASSWORD_EFIMERA" \
    "$IMAGEN" >/dev/null || no_verificable "docker run no pudo arrancar el contenedor."

mapeo="$(docker port "$CONTENEDOR" 8080/tcp 2>/dev/null | head -n1)"
PUERTO="${mapeo##*:}"
[[ "$PUERTO" =~ ^[0-9]+$ ]] \
    || no_verificable "no se pudo publicar el puerto 8080 (mapeo: «${mapeo:-ninguno}»)."
echo "   puerto publicado: 127.0.0.1:$PUERTO → 8080/tcp"

diagnostico() {
    echo "── Estado del contenedor ──" >&2
    docker inspect --format \
        'Status={{.State.Status}} ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Error={{.State.Error}}' \
        "$CONTENEDOR" >&2 2>/dev/null || echo "(sin inspección posible)" >&2
    echo "── Log del contenedor (completo) ──" >&2
    docker logs "$CONTENEDOR" >&2 2>&1 || echo "(sin log: el contenedor no dejó ninguno)" >&2
    echo "── Fin del log ──" >&2
}

limite=$((SECONDS + PLAZO))
cuerpo=""
while ((SECONDS < limite)); do
    if [[ "$(docker inspect --format '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null)" != "true" ]]; then
        echo "FALLA: el contenedor terminó antes de responder /health." >&2
        diagnostico
        exit 1
    fi
    if cuerpo="$(curl -sf --max-time 5 "http://127.0.0.1:$PUERTO/health" 2>/dev/null)"; then
        echo "   /health → 200 tras $((PLAZO - (limite - SECONDS)))s: $cuerpo"
        echo "RESULTADO: OK — $IMAGEN responde /health por el puerto publicado."
        exit 0
    fi
    sleep 2
done

echo "FALLA: /health no respondió 200 en ${PLAZO}s." >&2
diagnostico
exit 1
