#!/usr/bin/env bash
# verificar-perfiles.sh — Aceptación de los perfiles Docker `core` y `full` (D-05a)
# EduConect Rural — Plataforma educativa offline
#
# Qué mide. Recibe DOS imágenes ya construidas con el mismo Dockerfile
# (`--target core` y `--target full`) y les exige resultados DISTINTOS donde el
# perfil importa, e idénticos donde no:
#
#   1. (S3, S8)  Ningún archivo .zim dentro de ninguna de las dos imágenes.
#   2. (S2, S6, S7) `ldd /app/server` dentro de la imagen: `core` sin la cadena
#      nativa de ZIM (libzim, libxapian, libicu, libstdc++) y `full` CON ella.
#   3. (S5)      Arranque `healthy` sobre un volumen NUEVO con secretos
#      efímeros generados en esta corrida (nunca versionados).
#   4. (S4, S10) El MISMO chequeo ZIM dependiente da resultados OPUESTOS:
#      `core` → 503 con el cuerpo canónico de degradación;
#      `full` → 200 con el listado de ZIM (vacío sobre volumen nuevo: estado
#      legítimo, distinto de «roto»). Si los dos perfiles respondieran lo mismo,
#      este chequeo estaría roto y el script falla: esa simetría es la que
#      evita repetir el defecto que D-05 corrige (una imagen que distribuye
#      contenido que su propio binario no puede leer).
#   5. (S5)      `ADMIN_INITIAL_PASSWORD` vacía → fallo ruidoso: código de salida
#      distinto de cero y un mensaje que nombra la variable.
#
# Requiere en el host: docker (con el daemon accesible), openssl (secretos
# efímeros) y python3 (validar el JSON del listado). `curl` y `find` se usan
# DENTRO de la imagen, no en el host.
#
# Es idempotente: cada corrida crea sus propios contenedores con nombre único,
# usa volúmenes anónimos nuevos (se descartan con `--rm`) y no deja nada
# corriendo ni temporales en el árbol de trabajo. No construye imágenes: eso lo
# decide quien invoca (CI en D-05c).
#
# Uso:
#   tests/docker/verificar-perfiles.sh <imagen-core> <imagen-full>
#
# Ejemplo:
#   docker build --target core -t educonect-rural:core .
#   docker build --target full -t educonect-rural:full .
#   tests/docker/verificar-perfiles.sh educonect-rural:core educonect-rural:full
#
# Códigos de salida:
#   0  las dos imágenes cumplen lo que su perfil declara
#   1  al menos una comprobación falló (se informa cuál y por qué)
#   2  NO VERIFICABLE — falta docker, falta una imagen, o un contenedor no
#      llegó a responder dentro del plazo (un fallo de entorno no se lee como
#      aprobación)

set -uo pipefail

IMAGEN_CORE="${1:-}"
IMAGEN_FULL="${2:-}"

PROHIBIDAS_CORE=(libzim libxapian libicu libstdc++)
ESPERADAS_FULL=(libzim libxapian libicu)
MENSAJE_CORE='capacidad zim no incluida en esta compilación'
PLAZO_SALUD=180

no_verificable() {
    echo "ERROR: $1" >&2
    echo "RESULTADO: NO VERIFICABLE — no se midió la aceptación de los perfiles." >&2
    exit 2
}

command -v docker >/dev/null 2>&1 || no_verificable "docker no está disponible en PATH."
if [[ -z "$IMAGEN_CORE" || -z "$IMAGEN_FULL" ]]; then
    no_verificable "faltan las imágenes. Uso: $0 <imagen-core> <imagen-full>"
fi
for imagen in "$IMAGEN_CORE" "$IMAGEN_FULL"; do
    docker image inspect "$imagen" >/dev/null 2>&1 \
        || no_verificable "no existe la imagen «$imagen» (¿se construyó con --target core/full?)"
done
if [[ "$IMAGEN_CORE" == "$IMAGEN_FULL" ]]; then
    no_verificable "las dos rutas apuntan a la misma imagen: no hay perfiles que contrastar."
fi

# ── Espacio de trabajo temporal, fuera del árbol de trabajo ──────────
# `mktemp -d` sin plantilla: usa el temporal del sistema (nunca el repo) y se
# borra en el trap, también cuando el script falla a mitad de camino.
TMP="$(mktemp -d)" || no_verificable "no se pudo crear el directorio temporal."
SUFIJO="$$"
CONTENEDOR_CORE="d05a-core-$SUFIJO"
CONTENEDOR_FULL="d05a-full-$SUFIJO"

limpiar() {
    docker rm -f "$CONTENEDOR_CORE" "$CONTENEDOR_FULL" >/dev/null 2>&1
    rm -rf "$TMP"
}
trap limpiar EXIT

pasadas=0
fallidas=0

pasa() { pasadas=$((pasadas + 1)); echo "  ✅ $1"; }
falla() {
    fallidas=$((fallidas + 1))
    echo "  ❌ $1"
    [[ -n "${2:-}" ]] && printf '%s\n' "$2" | sed 's/^/       /'
    return 0
}

# ── Secretos efímeros: se generan acá y no se escriben en ningún archivo ──
command -v openssl >/dev/null 2>&1 || no_verificable "openssl no está disponible para generar secretos efímeros."
JWT_EFIMERO="$(openssl rand -hex 32)"
PASSWORD_EFIMERA="$(openssl rand -base64 18)"
[[ ${#PASSWORD_EFIMERA} -ge 12 ]] || no_verificable "el secreto efímero no alcanza el mínimo de 12 caracteres."

# ── 1. Ningún .zim dentro de la imagen (S3, S8) ─────────────────────
# Se busca en todo el sistema de archivos de la imagen, con `find` real: una
# imagen que embebería contenido ZIM aparecería acá sin importar en qué capa.
echo "== 1. Contenido ZIM embebido (S3, S8) =="
# `-xdev` evita cruzar a /proc, /sys y /dev (ahí find siempre sale distinto de
# cero), y el centinela distingue «no encontré nada» de «no pude recorrer».
# El centinela se busca como línea completa y se descarta del resultado.
for imagen in "$IMAGEN_CORE" "$IMAGEN_FULL"; do
    salida="$(docker run --rm --user 0:0 --entrypoint sh "$imagen" -c \
        "find / -xdev -name '*.zim' -print 2>/dev/null; echo --FIN-DE-RECORRIDO--" 2>/dev/null)"
    if ! grep -F -q -x -- "--FIN-DE-RECORRIDO--" <<< "$salida"; then
        falla "$imagen: no se pudo recorrer el sistema de archivos de la imagen"
    else
        archivos="$(grep -F -v -x -- "--FIN-DE-RECORRIDO--" <<< "$salida")"
        if [[ -n "$archivos" ]]; then
            falla "$imagen: la imagen contiene archivos .zim" "$archivos"
        else
            pasa "$imagen: ningún archivo .zim en la imagen"
        fi
    fi
done

# ── 2. Cadena nativa de ZIM en el binario (S2, S6, S7) ──────────────
# Mismo comando para las dos imágenes; lo que cambia es la expectativa.
echo "== 2. Cadena de enlace del binario (S2, S6, S7) =="
clausura_de() {
    docker run --rm --entrypoint ldd "$1" /app/server 2>&1
}

# Familias presentes en la clausura, comparando el NOMBRE de cada biblioteca
# (basename sin `.so.N`), nunca una subcadena de la línea: una ruta que
# contenga «libicu» no es una infracción. Misma regla que la compuerta de
# scripts/verificar-ldd-default.sh (D-CI 2).
familias_presentes() {
    local clausura="$1"
    shift
    local familia
    for familia in "$@"; do
        printf '%s\n' "$clausura" | awk -v familia="$familia" '
            {
                n = split($0, campos, /[ \t]+/)
                for (i = 1; i <= n; i++) {
                    token = campos[i]
                    sub(/^.*\//, "", token)
                    sub(/[.]so([.][0-9]+)*$/, "", token)
                    if (token == familia \
                        || (index(token, familia) == 1 \
                            && substr(token, length(familia) + 1, 1) ~ /[A-Za-z0-9+]/)) {
                        print familia
                        exit
                    }
                }
            }' || true
    done
}

clausura_core="$(clausura_de "$IMAGEN_CORE")"
estado=$?
if [[ "$estado" -ne 0 || -z "$clausura_core" ]]; then
    falla "$IMAGEN_CORE: ldd no devolvió la clausura de /app/server (código $estado)"
else
    echo "  ── core ldd /app/server ──"
    printf '%s\n' "$clausura_core" | sed 's/^/     /'
    ofensoras="$(familias_presentes "$clausura_core" "${PROHIBIDAS_CORE[@]}")"
    if [[ -n "$ofensoras" ]]; then
        falla "$IMAGEN_CORE: el perfil core enlaza bibliotecas prohibidas: $(tr '\n' ' ' <<< "$ofensoras")"
    else
        pasa "$IMAGEN_CORE: core sin ${PROHIBIDAS_CORE[*]} en la clausura"
    fi
fi

clausura_full="$(clausura_de "$IMAGEN_FULL")"
estado=$?
if [[ "$estado" -ne 0 || -z "$clausura_full" ]]; then
    falla "$IMAGEN_FULL: ldd no devolvió la clausura de /app/server (código $estado)"
else
    echo "  ── full ldd /app/server ──"
    printf '%s\n' "$clausura_full" | sed 's/^/     /'
    presentes="$(familias_presentes "$clausura_full" "${ESPERADAS_FULL[@]}")"
    faltantes=()
    for esperada in "${ESPERADAS_FULL[@]}"; do
        grep -F -q -x -- "$esperada" <<< "$presentes" || faltantes+=("$esperada")
    done
    if [[ ${#faltantes[@]} -gt 0 ]]; then
        falla "$IMAGEN_FULL: el perfil full NO enlaza: ${faltantes[*]} (¿se compiló sin --features zim?)"
    else
        pasa "$IMAGEN_FULL: full enlaza ${ESPERADAS_FULL[*]}"
    fi
fi

# ── 3-4. Arranque, salud y el chequeo ZIM que debe dar resultados opuestos ──
# Arranca el perfil sobre un volumen anónimo NUEVO (base de datos vacía) con
# los secretos efímeros. Devuelve el estado HTTP de /api/wikipedia/zims y deja
# el cuerpo en $TMP/<perfil>-zims.json y el de /health en $TMP/<perfil>-health.json.
arrancar_y_sondear() {
    local perfil="$1" imagen="$2" contenedor="$3"
    docker run -d --rm --name "$contenedor" \
        -v /data \
        -e "JWT_SECRET=$JWT_EFIMERO" \
        -e "ADMIN_INITIAL_PASSWORD=$PASSWORD_EFIMERA" \
        "$imagen" >/dev/null || return 1

    local limite=$((SECONDS + PLAZO_SALUD))
    local codigo="" salud=""
    while ((SECONDS < limite)); do
        codigo="$(docker exec "$contenedor" curl -s -o /dev/null -w '%{http_code}' \
            http://localhost:8080/health 2>/dev/null)"
        [[ "$codigo" == "200" ]] && break
        sleep 2
    done
    if [[ "$codigo" != "200" ]]; then
        echo "  log del contenedor $contenedor:"
        docker logs --tail 40 "$contenedor" 2>&1 | sed 's/^/     /'
        return 1
    fi
    docker exec "$contenedor" curl -s http://localhost:8080/health \
        >"$TMP/$perfil-health.json" 2>/dev/null

    # Salud declarada por el HEALTHCHECK de la imagen (no sólo el 200 puntual).
    while ((SECONDS < limite)); do
        salud="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' \
            "$contenedor" 2>/dev/null)"
        [[ "$salud" == "healthy" || "$salud" == "unhealthy" ]] && break
        sleep 2
    done
    if [[ "$salud" != "healthy" ]]; then
        echo "  estado de salud del contenedor $contenedor: ${salud:-desconocido}"
        docker logs --tail 40 "$contenedor" 2>&1 | sed 's/^/     /'
        return 1
    fi

    # El MISMO chequeo en las dos patas: sólo cambia lo que se espera de él.
    docker exec "$contenedor" curl -s 'http://localhost:8080/api/wikipedia/zims' \
        >"$TMP/$perfil-zims.json" 2>/dev/null
    docker exec "$contenedor" curl -s -o /dev/null -w '%{http_code}' \
        'http://localhost:8080/api/wikipedia/zims'
}

echo "== 3. Arranque sobre volumen nuevo con secretos efímeros (S5) =="
estado_core="$(arrancar_y_sondear core "$IMAGEN_CORE" "$CONTENEDOR_CORE")"
estado_core="$(printf '%s' "$estado_core" | tail -n1)"
if [[ "$estado_core" == "200" || "$estado_core" == "503" ]]; then
    pasa "$IMAGEN_CORE: healthy sobre volumen nuevo; /health $(cat "$TMP/core-health.json" 2>/dev/null)"
    pasa "$IMAGEN_CORE: /api/wikipedia/zims → $estado_core"
else
    falla "$IMAGEN_CORE: no llegó a healthy sobre un volumen nuevo"
fi

estado_full="$(arrancar_y_sondear full "$IMAGEN_FULL" "$CONTENEDOR_FULL")"
estado_full="$(printf '%s' "$estado_full" | tail -n1)"
if [[ "$estado_full" == "200" || "$estado_full" == "503" ]]; then
    pasa "$IMAGEN_FULL: healthy sobre volumen nuevo; /health $(cat "$TMP/full-health.json" 2>/dev/null)"
    pasa "$IMAGEN_FULL: /api/wikipedia/zims → $estado_full"
else
    falla "$IMAGEN_FULL: no llegó a healthy sobre un volumen nuevo"
fi

echo "== 4. El mismo chequeo ZIM exige resultados OPUESTOS (S4, S6, S10) =="
if [[ "$estado_core" != "503" ]]; then
    falla "core: /api/wikipedia/zims debía responder 503 y respondió «${estado_core:-nada}»" \
        "$(cat "$TMP/core-zims.json" 2>/dev/null)"
else
    pasa "core: /api/wikipedia/zims → 503 (capacidad no compilada)"
    if grep -F -q -- "$MENSAJE_CORE" "$TMP/core-zims.json"; then
        pasa "core: el 503 trae el cuerpo canónico de degradación"
    else
        falla "core: el 503 no trae el mensaje canónico «$MENSAJE_CORE»" \
            "$(cat "$TMP/core-zims.json" 2>/dev/null)"
    fi
fi

if [[ "$estado_full" != "200" ]]; then
    falla "full: /api/wikipedia/zims debía responder 200 y respondió «${estado_full:-nada}»" \
        "$(cat "$TMP/full-zims.json" 2>/dev/null)"
else
    pasa "full: /api/wikipedia/zims → 200 (capacidad compilada)"
    if python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if isinstance(d.get("zims"), list) else 1)' \
        "$TMP/full-zims.json" 2>/dev/null; then
        pasa "full: el 200 trae el listado de ZIM (vacío es estado legítimo sobre volumen nuevo): $(cat "$TMP/full-zims.json")"
    else
        falla "full: el 200 no trae un listado «zims» válido" "$(cat "$TMP/full-zims.json" 2>/dev/null)"
    fi
fi

if [[ "$estado_core" == "$estado_full" ]]; then
    falla "los dos perfiles respondieron lo MISMO (${estado_core:-nada}) al mismo chequeo: el contraste está roto" \
        "Un chequeo que no distingue core de full no prueba ningún perfil."
else
    # Un contraste sólo vale sobre estados medidos. Dos cadenas cualesquiera distintas no son
    # evidencia: `docker` devolviendo un error de demonio en una pata y 200 en la otra satisface
    # la desigualdad sin medir nada, y esta comprobación pasaba en falso (hallazgo del verificador).
    estado_medible() { case "$1" in 200|503) return 0 ;; *) return 1 ;; esac }
    if estado_medible "$estado_core" && estado_medible "$estado_full"; then
        pasa "contraste: core $estado_core ≠ full $estado_full"
    else
        falla "el contraste no es medible: core «${estado_core:-nada}», full «${estado_full:-nada}» (sólo 200 o 503 cuentan)" \
            "Un error del demonio o una respuesta truncada no es una medición: el contraste no se declara."
    fi
fi

# ── 5. ADMIN_INITIAL_PASSWORD vacía → fallo ruidoso (S5) ────────────
echo "== 5. Fallo ruidoso con ADMIN_INITIAL_PASSWORD vacía (S5) =="
for imagen in "$IMAGEN_CORE" "$IMAGEN_FULL"; do
    salida="$(timeout 300 docker run --rm -v /data \
        -e "JWT_SECRET=$JWT_EFIMERO" \
        -e "ADMIN_INITIAL_PASSWORD=" \
        "$imagen" 2>&1)"
    estado=$?
    if [[ "$estado" -eq 0 ]]; then
        falla "$imagen: arrancó con ADMIN_INITIAL_PASSWORD vacía (debía fallar)"
    elif [[ "$estado" -eq 124 ]]; then
        falla "$imagen: se colgó con ADMIN_INITIAL_PASSWORD vacía en vez de fallar"
    elif ! grep -F -q -- "ADMIN_INITIAL_PASSWORD" <<< "$salida"; then
        falla "$imagen: falló con código $estado pero sin nombrar la variable" "$salida"
    else
        pasa "$imagen: código $estado y un mensaje que nombra ADMIN_INITIAL_PASSWORD"
        grep -F -- "ADMIN_INITIAL_PASSWORD" <<< "$salida" | sed 's/^/       /'
    fi
done

# ── Resumen ─────────────────────────────────────────────────────────
echo
echo "─────────────────────────────────────────────"
echo "  COMPROBACIONES: $pasadas pasadas, $fallidas fallidas"
if [[ "$fallidas" -gt 0 ]]; then
    echo "  RESULTADO: FALLA"
    exit 1
fi
echo "  RESULTADO: OK — core y full cumplen lo que declaran"
exit 0
