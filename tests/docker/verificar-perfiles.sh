#!/usr/bin/env bash
# verificar-perfiles.sh — Aceptación de los perfiles Docker `core` y `full` (D-05a)
# EduConect Rural — Plataforma educativa offline
#
# Qué mide. Recibe DOS imágenes ya construidas con el mismo Dockerfile
# (`--target core` y `--target full`) y les exige resultados DISTINTOS donde el
# perfil importa, e idénticos donde no:
#
#   0. (T2, D-05b) Antes de medir: el paquete que se va a montar es EXACTAMENTE
#      el declarado (`tests/fixtures/zim/fixture_d05b.zim`, tamaño y sha256).
#      Un fixture alterado se reporta como falla y no se monta: exigir 200/503
#      sobre un archivo desconocido no probaría nada.
#   1. (S3, S8)  Ningún archivo .zim dentro de ninguna de las dos imágenes.
#   2. (S2, S6, S7) `ldd /app/server` dentro de la imagen: `core` sin la cadena
#      nativa de ZIM (libzim, libxapian, libicu, libstdc++) y `full` CON ella.
#   3. (S5)      Arranque `healthy` sobre un volumen NUEVO con secretos
#      efímeros generados en esta corrida (nunca versionados).
#   4. (S4, S8, S10) El MISMO insumo montado en las dos patas da resultados
#      OPUESTOS: el fixture D-05b se monta read-only en /data/contenido/zim en
#      `full` Y en `core`; `full` lista el paquete (200) y sirve sus cuatro
#      artículos (200 con su texto), y `core` responde 503 con el cuerpo
#      canónico de degradación y sin una sola línea del contenido. Si los dos
#      perfiles respondieran lo mismo, este chequeo estaría roto y el script
#      falla: esa asimetría es la que evita repetir el defecto que D-05 corrige
#      (una imagen que distribuye contenido que su propio binario no puede
#      leer).
#   5. (S5)      `ADMIN_INITIAL_PASSWORD` vacía → fallo ruidoso: código de salida
#      distinto de cero y un mensaje que nombra la variable.
#
# Requiere en el host: docker (con el daemon accesible), openssl (secretos
# efímeros), python3 (validar el JSON del listado) y sha256sum (coreutils,
# autenticar el fixture). Ningún lector de ZIM: ni python-libzim, ni pip, ni red.
# `curl` y `find` se usan DENTRO de la imagen, no en el host.
#
# Es idempotente: cada corrida crea sus propios contenedores con nombre único,
# usa volúmenes anónimos nuevos (se descartan con `--rm`) y no deja nada
# corriendo ni temporales en el árbol de trabajo. No construye imágenes: eso lo
# decide quien invoca (D-05c).
#
# Etiqueta de limpieza (D-05c): los contenedores que sobreviven más de un paso
# se crean con `--label ${D05C_ETIQUETA:-educonect-d05c=1}`. El `trap` los borra
# igual, pero si el script muere sin ejecutarlo (paso cancelado, timeout del
# job), el job de CI puede borrar exactamente los suyos por etiqueta en lugar de
# recurrir a un `prune` a ciegas sobre la máquina.
#
# Uso:
#   tests/docker/verificar-perfiles.sh <imagen-core> <imagen-full>
#
# Ejemplo:
#   docker build --target core -t educonect-rural:core .
#   docker build --target full -t educonect-rural:full .
#   tests/docker/verificar-perfiles.sh educonect-rural:core educonect-rural:full
#
# Variables de entorno:
#   D05C_ETIQUETA        etiqueta de limpieza de los contenedores (D-05c).
#   D05B_FIXTURE_DIR     directorio del fixture a montar (por defecto
#                        `tests/fixtures/zim`, relativo a este script). Sólo se
#                        usa en el control negativo: apuntarlo a otra cosa no
#                        salta la comprobación de sha256, la hace fallar.
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

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Fixture D-05b (T2). El MISMO paquete se monta en las dos patas, read-only,
# donde el producto busca el contenido del docente: el contenido es idéntico y
# lo único que cambia es lo que cada binario puede hacer con él. Sin fixture
# verificado no hay contraste con contenido: es el insumo que D-05a sólo pudo
# medir a mano con un ZIM enciclopédico de 24 MB.
FIXTURE_DIR="${D05B_FIXTURE_DIR:-$(cd "$AQUI/.." && pwd)/fixtures/zim}"
MONTAJE_DESTINO="/data/contenido/zim"
SLUG_FIXTURE="fixture_d05b"
ARTICULOS_FIXTURE=4

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

# ── 0. El paquete que se va a montar es el declarado (T2, D-05b) ────
# Esto no depende del demonio: se mide antes y, si falla, las comprobaciones
# que necesitan el fixture no se ejecutan (no se monta un paquete desconocido).
echo "== 0. Fixture D-05b: el paquete es el declarado (T2) =="
FIXTURE_VERIFICADO=0
if [[ ! -x "$AQUI/verificar-fixture-zim.sh" ]]; then
    falla "falta tests/docker/verificar-fixture-zim.sh: no hay con qué autenticar el fixture"
else
    salida_fixture="$(bash "$AQUI/verificar-fixture-zim.sh" "$FIXTURE_DIR" 2>&1)"
    estado_fixture=$?
    if [[ "$estado_fixture" -eq 0 ]]; then
        FIXTURE_VERIFICADO=1
        pasa "$FIXTURE_DIR: $salida_fixture"
    elif [[ "$estado_fixture" -eq 2 ]]; then
        no_verificable "no se puede medir la integridad del fixture: $(printf '%s' "$salida_fixture" | tr '\n' ' ')"
    else
        falla "el fixture NO es el declarado: no se monta ni se contrasta con él" "$salida_fixture"
    fi
fi

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
# los secretos efímeros y, si el fixture está verificado, con el MISMO paquete
# montado read-only en /data/contenido/zim. Devuelve el estado HTTP de
# /api/wikipedia/zims y deja el cuerpo en $TMP/<perfil>-zims.json y el de
# /health en $TMP/<perfil>-health.json. Los contenedores siguen vivos al volver
# (los borra el trap): las páginas del fixture se piden después, al mismo
# contenedor, sin reiniciar nada.
arrancar_y_sondear() {
    local perfil="$1" imagen="$2" contenedor="$3"
    local montaje=()
    if [[ "$FIXTURE_VERIFICADO" -eq 1 ]]; then
        montaje=(-v "$FIXTURE_DIR:$MONTAJE_DESTINO:ro")
    fi
    docker run -d --rm --name "$contenedor" \
        --label "${D05C_ETIQUETA:-educonect-d05c=1}" \
        -v /data \
        "${montaje[@]}" \
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

# Código HTTP de una ruta, medido DENTRO del contenedor.
http_codigo() { docker exec "$1" curl -s -o /dev/null -w '%{http_code}' "http://localhost:8080$2" 2>/dev/null; }

# Cuerpo de una ruta, medido DENTRO del contenedor.
http_cuerpo() { docker exec "$1" curl -s "http://localhost:8080$2" 2>/dev/null; }

# Un artículo del fixture se sirve (200) y con el texto declarado. Se exige el
# marcador propio de cada página además del texto: un cajón genérico que
# devolviera cualquier HTML con 200 no pasaría.
comprobar_articulo() { # <contenedor> <ruta> <marcador> [texto esperado...]
    local contenedor="$1" ruta="$2" marcador="$3"
    shift 3
    local codigo cuerpo
    codigo="$(http_codigo "$contenedor" "$ruta")"
    cuerpo="$(http_cuerpo "$contenedor" "$ruta")"
    if [[ "$codigo" != "200" ]]; then
        falla "$ruta → «${codigo:-nada}» (se esperaba 200)" \
            "$(printf '%s' "$cuerpo" | head -c 400)"
        return 0
    fi
    if ! grep -F -q -- "$marcador" <<< "$cuerpo"; then
        falla "$ruta → 200 pero sin el marcador «$marcador»" \
            "$(printf '%s' "$cuerpo" | head -c 400)"
        return 0
    fi
    local texto faltantes=()
    for texto in "$@"; do
        grep -F -q -- "$texto" <<< "$cuerpo" || faltantes+=("$texto")
    done
    if [[ ${#faltantes[@]} -gt 0 ]]; then
        falla "$ruta → 200 y con marcador, pero falta el texto: ${faltantes[*]}"
    else
        pasa "$ruta → 200 (${#cuerpo} bytes) con «$marcador» y el texto declarado"
    fi
}

echo "== 3. Arranque sobre volumen nuevo con secretos efímeros (S5) =="
if [[ "$FIXTURE_VERIFICADO" -eq 1 ]]; then
    echo "   montaje en las DOS patas: $FIXTURE_DIR → $MONTAJE_DESTINO (ro)"
fi
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

echo "== 4. El mismo insumo montado exige resultados OPUESTOS (S4, S8, S10) =="
# Un contraste sólo vale sobre estados medidos. Dos cadenas cualesquiera distintas no son
# evidencia: `docker` devolviendo un error de demonio en una pata y 200 en la otra satisface
# la desigualdad sin medir nada, y esta comprobación pasaba en falso (hallazgo del verificador).
estado_medible() { case "$1" in 200|503) return 0 ;; *) return 1 ;; esac; }
codigo_pagina_core=""
codigo_raiz_full=""

# 4.1 core: la capacidad no está compilada, y el montaje no cambia eso.
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

# 4.2 full: el 200 lista el MISMO paquete que está montado.
if [[ "$estado_full" != "200" ]]; then
    falla "full: /api/wikipedia/zims debía responder 200 y respondió «${estado_full:-nada}»" \
        "$(cat "$TMP/full-zims.json" 2>/dev/null)"
else
    pasa "full: /api/wikipedia/zims → 200 (capacidad compilada)"
    if [[ "$FIXTURE_VERIFICADO" -ne 1 ]]; then
        echo "   (omitido: el listado no se compara con el fixture, que no es el declarado)"
    elif python3 - "$TMP/full-zims.json" "$SLUG_FIXTURE" "$ARTICULOS_FIXTURE" \
        >/dev/null 2>"$TMP/error-listado.txt" <<'PY'
import json, sys

datos = json.load(open(sys.argv[1], encoding="utf-8"))
slug, articulos = sys.argv[2], int(sys.argv[3])
zims = datos.get("zims")
assert isinstance(zims, list), "el cuerpo no trae una lista «zims»: %r" % (zims,)
entrada = [z for z in zims if isinstance(z, dict) and z.get("slug") == slug]
assert entrada, "«%s» no está en el listado: %r" % (
    slug, [z.get("slug") for z in zims if isinstance(z, dict)])
assert entrada[0].get("articles") == articulos, \
    "articles = %r (se declaran %d)" % (entrada[0].get("articles"), articulos)
assert datos.get("default") == slug, \
    "default = %r (se esperaba %r)" % (datos.get("default"), slug)
PY
    then
        pasa "full: el listado trae el fixture montado (slug=$SLUG_FIXTURE, articles=$ARTICULOS_FIXTURE) y es el predeterminado: $(cat "$TMP/full-zims.json")"
    else
        falla "full: el 200 no lista el fixture montado como se declara" \
            "$(cat "$TMP/error-listado.txt" 2>/dev/null)
$(cat "$TMP/full-zims.json" 2>/dev/null)"
    fi
fi

if [[ "$FIXTURE_VERIFICADO" -eq 1 ]]; then
    # 4.3 full sirve el paquete: la raíz redirige a la portada y las cuatro páginas se leen.
    codigo_raiz_full="$(http_codigo "$CONTENEDOR_FULL" /zim/)"
    ubicacion="$(docker exec "$CONTENEDOR_FULL" curl -s -D - -o /dev/null \
        http://localhost:8080/zim/ 2>/dev/null \
        | awk -F': ' 'tolower($1) == "location" {print $2}' | tr -d '\r')"
    if [[ "$codigo_raiz_full" == "307" && "$ubicacion" == "/zim/A/Portada" ]]; then
        pasa "full: /zim/ → 307 a $ubicacion"
    else
        falla "full: /zim/ → «${codigo_raiz_full:-nada}» con Location «${ubicacion:-ninguno}» (se esperaba 307 a /zim/A/Portada)"
    fi

    comprobar_articulo "$CONTENEDOR_FULL" "/zim/A/Portada" "FIXTURE-D05B-PORTADA" \
        "FIXTURE-D05B-SCRIPT" "Escuela Rural La Esperanza"
    comprobar_articulo "$CONTENEDOR_FULL" "/zim/A/Observatorio_del_R%C3%ADo" "FIXTURE-D05B-OBSERVATORIO" \
        "Río Grande" "temperatura"
    comprobar_articulo "$CONTENEDOR_FULL" "/zim/A/Estaci%C3%B3n_La_Esperanza" "FIXTURE-D05B-ESTACION" \
        "pingüino" "doce kilómetros"
    comprobar_articulo "$CONTENEDOR_FULL" "/zim/A/Glosario" "FIXTURE-D05B-GLOSARIO" \
        "Acequia" "Terraplén"

    # 4.4 core con el MISMO montaje: 503 en la página y sin una línea del contenido.
    codigo_pagina_core="$(http_codigo "$CONTENEDOR_CORE" /zim/A/Portada)"
    cuerpo_pagina_core="$(http_cuerpo "$CONTENEDOR_CORE" /zim/A/Portada)"
    if [[ "$codigo_pagina_core" != "503" ]]; then
        falla "core: /zim/A/Portada debía responder 503 con el fixture montado y respondió «${codigo_pagina_core:-nada}»" \
            "$(printf '%s' "$cuerpo_pagina_core" | head -c 400)"
    else
        pasa "core: /zim/A/Portada → 503 con el fixture montado (no lo lee)"
        if grep -F -q -- "FIXTURE-D05B" <<< "$cuerpo_pagina_core"; then
            falla "core: el 503 contiene texto del fixture: el perfil estaría leyendo el montaje" \
                "$(printf '%s' "$cuerpo_pagina_core" | head -c 400)"
        else
            pasa "core: el 503 no contiene una sola línea del fixture"
        fi
    fi
else
    echo "   (omitido: las páginas del fixture no se piden, el paquete no es el declarado)"
fi

# 4.5 El contraste, exigido sobre estados medidos.
if [[ "$estado_core" == "$estado_full" ]]; then
    falla "los dos perfiles respondieron lo MISMO (${estado_core:-nada}) al mismo chequeo: el contraste está roto" \
        "Un chequeo que no distingue core de full no prueba ningún perfil."
else
    if estado_medible "$estado_core" && estado_medible "$estado_full"; then
        pasa "contraste: core $estado_core ≠ full $estado_full"
    else
        falla "el contraste no es medible: core «${estado_core:-nada}», full «${estado_full:-nada}» (sólo 200 o 503 cuentan)" \
            "Un error del demonio o una respuesta truncada no es una medición: el contraste no se declara."
    fi
fi

# 4.6 El contraste con contenido: el MISMO archivo, servido en full y negado en core.
if [[ "$FIXTURE_VERIFICADO" -eq 1 ]]; then
    if [[ "$estado_full" == "200" && "$estado_core" == "503" && "$codigo_pagina_core" == "503" ]]; then
        pasa "contraste con el fixture montado: full 200 sirviendo el paquete ($ARTICULOS_FIXTURE artículos) y core 503 sobre el MISMO archivo"
    else
        falla "el contraste con el fixture no es el declarado: full «${estado_full:-nada}», core «${estado_core:-nada}», core página «${codigo_pagina_core:-nada}»" \
            "Se esperaba full 200 sirviendo el paquete montado y core 503 sin leerlo."
    fi
fi

# ── 5. ADMIN_INITIAL_PASSWORD vacía → fallo ruidoso (S5) ────────────
echo "== 5. Fallo ruidoso con ADMIN_INITIAL_PASSWORD vacía (S5) =="
for imagen in "$IMAGEN_CORE" "$IMAGEN_FULL"; do
    salida="$(timeout 300 docker run --rm --label "${D05C_ETIQUETA:-educonect-d05c=1}" -v /data \
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
