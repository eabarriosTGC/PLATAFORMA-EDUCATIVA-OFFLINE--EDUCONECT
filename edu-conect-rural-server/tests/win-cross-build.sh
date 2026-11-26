#!/usr/bin/env bash
# win-cross-build.sh — Prueba de compilación cruzada y arranque en Windows
# EduConect Rural — D-WIN (T8: arranque reproducible en Linux y Windows).
#
# Qué hace: compila el perfil default (SIN feature `zim`) para
# x86_64-pc-windows-gnu en la imagen de cross-compilación, comprueba que el
# binario resultante sea un PE32+ autocontenido (sin DLL de SQLite ni de
# runtime de GCC/mingw) y lo arranca bajo un prefijo Wine aislado para pedir
# /health.
#
# Uso:
#   edu-conect-rural-server/tests/win-cross-build.sh              # todo
#   SKIP_WINE=1 edu-conect-rural-server/tests/win-cross-build.sh  # sin el punto 6
#
# Contrato de resultado (ningún control puede aprobar sin haber corrido):
#   exit 0   todas las comprobaciones ejecutadas y aprobadas
#   exit 1   al menos una comprobación falló
#   exit 3   ninguna falló, pero alguna no pudo ejecutarse (incompleto)
#   exit 77  omitida: no hay `docker compose` en el equipo (no es un aprobado)
#
# Entorno requerido (el mismo de docs/sprint2/win-cross-build.md):
#   docker compose, imagen de cross-compilación con mingw-w64 y el target
#   x86_64-pc-windows-gnu. Por defecto ese entorno vive en $EDUCONNECT_DEV_ENV
#   (por defecto $HOME/educonect-dev-env), que es donde el proyecto guarda
#   Dockerfile.win y el compose.yaml con el servicio `win`.
#
# Variables opcionales:
#   EDUC               ruta del entorno de compilación (default $HOME/educonect-dev-env)
#   EDUC_COMPOSE_FILE  compose alternativo con el servicio `win`
#   EDUC_DOCKERFILE_WIN  Dockerfile.win alternativo
#   RUST_VERSION       toolchain a exigir (default 1.88.0)
#   WIN_PROBE_PORT     puerto del sondeo HTTP bajo Wine (default: primero libre)
#   SKIP_WINE=1        no ejecuta el punto 6 (se informa como no ejecutado)
#   FRESH=1            borra el target de Windows antes de compilar (build completo)
#   T_DOCKER           timeout de cada operación docker, en segundos (default 1800)

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
DEV_ENV="${EDUCONNECT_DEV_ENV:-$HOME/educonect-dev-env}"
COMPOSE_FILE="${EDUCONNECT_COMPOSE_FILE:-$DEV_ENV/compose.yaml}"
DOCKERFILE_WIN="${EDUCONNECT_DOCKERFILE_WIN:-$DEV_ENV/Dockerfile.win}"
SERVICE="win"
RUST_VERSION="${RUST_VERSION:-1.88.0}"
TARGET="x86_64-pc-windows-gnu"
EXE_NAME="edu-conect-rural-server.exe"
CRATE_DIR="/workspace/edu-conect-rural-server"
ARTIFACT_CT="/opt/target/$TARGET/release/$EXE_NAME"
T_DOCKER="${T_DOCKER:-1800}"
T_WINE="${T_WINE:-180}"
SKIP_WINE="${SKIP_WINE:-0}"
FRESH="${FRESH:-0}"

PASSED=0; FAILED=0; NOTRUN=0
FAIL_DETAIL=()

SCRATCH="$(mktemp -d /tmp/dwin-probe.XXXXXX)" || exit 1
WINE_STARTED=0
cleanup() {
    if [ "$WINE_STARTED" = "1" ]; then
        WINEPREFIX="$SCRATCH/wineprefix" timeout 30 wineserver -k >/dev/null 2>&1 || true
    fi
    rm -rf "$SCRATCH"
}
trap cleanup EXIT INT TERM

say()  { printf '%s\n' "$*"; }
head1() { printf '\n== %s\n' "$*"; }

# record <n> <nombre> <ok|fallo|no-ejecutada> <detalle...>
record() {
    local n="$1" name="$2" state="$3"; shift 3
    local label
    case "$state" in
        ok)           label="PASO";          PASSED=$((PASSED + 1)) ;;
        fallo)        label="FALLO";         FAILED=$((FAILED + 1)) ;;
        no-ejecutada) label="NO EJECUTADA";  NOTRUN=$((NOTRUN + 1)) ;;
    esac
    printf '[%s] %-62s %s\n' "$n" "$name" "$label"
    local d
    for d in "$@"; do printf '        %s\n' "$d"; done
    [ "$state" = "fallo" ] && FAIL_DETAIL+=("$n $name")
    return 0
}

say "win-cross-build — EDUConect Rural D-WIN"
say "repo:      $REPO_ROOT"
say "entorno:   $DEV_ENV"
say "compose:   $COMPOSE_FILE"
say "rust:      $RUST_VERSION · target $TARGET"

# ── Puerta de entrada: sin docker compose no hay nada que medir ───────
if ! command -v docker >/dev/null 2>&1; then
    say ""
    say "OMITIDA: no existe el comando 'docker' en este equipo."
    say "Esta prueba no aprobó nada: no se ejecutó."
    exit 77
fi
if ! timeout 60 docker compose version >/dev/null 2>&1; then
    say ""
    say "OMITIDA: 'docker compose version' no responde (Docker ausente, parado o sin permisos)."
    say "Esta prueba no aprobó nada: no se ejecutó."
    exit 77
fi
COMPOSE_VER="$(timeout 60 docker compose version 2>&1 | head -1)"
say "docker:    $COMPOSE_VER"

HAVE_SERVICE=0
if [ -f "$COMPOSE_FILE" ] && grep -qE "^[[:space:]]{2}${SERVICE}:" "$COMPOSE_FILE"; then
    HAVE_SERVICE=1
fi
COMPOSE_DIR="$(dirname -- "$COMPOSE_FILE")"

compose() { ( cd -- "$COMPOSE_DIR" && timeout "$T_DOCKER" docker compose -f "$COMPOSE_FILE" "$@" ); }

# ── 1. Receta de compilación ──────────────────────────────────────────
# Se miran las INSTRUCCIONES, no los comentarios: el Dockerfile explica en un
# comentario por qué no instala libzim-dev, y esa mención no es un enlace.
CHECK1_NAME="Dockerfile.win usa mingw y no instala libzim (solo instrucciones)"
head1 "1. Dockerfile.win — mingw presente, ZIM ausente"
if [ ! -f "$DOCKERFILE_WIN" ]; then
    record 1 "$CHECK1_NAME" no-ejecutada \
        "no existe $DOCKERFILE_WIN" \
        "defina EDUC o coloque la receta de cross-compilación en esa ruta"
else
    INSTRUCCIONES="$SCRATCH/dockerfile-win.sinstrucciones"
    grep -v '^[[:space:]]*#' "$DOCKERFILE_WIN" > "$INSTRUCCIONES" 2>/dev/null || : > "$INSTRUCCIONES"
    MINGW_HITS="$(grep -ic "mingw" "$INSTRUCCIONES" || true)"
    ZIM_HITS="$(grep -ic "libzim" "$INSTRUCCIONES" || true)"
    ZIM_ANY="$(grep -ic "libzim" "$DOCKERFILE_WIN" || true)"
    if [ "${MINGW_HITS:-0}" -gt 0 ] && [ "${ZIM_HITS:-0}" -eq 0 ]; then
        record 1 "$CHECK1_NAME" ok \
            "instrucciones: mingw=$MINGW_HITS (se exige >0) · libzim=$ZIM_HITS (se exige 0)" \
            "menciones de libzim en todo el archivo (comentarios incluidos): $ZIM_ANY"
    else
        record 1 "$CHECK1_NAME" fallo \
            "instrucciones: mingw=$MINGW_HITS (se exige >0) · libzim=$ZIM_HITS (se exige 0)" \
            "$(grep -in "libzim" "$INSTRUCCIONES" | head -3 | tr '\n' ' ')"
    fi
fi

# ── 2. Compilación cruzada ────────────────────────────────────────────
head1 "2. Compilación cruzada --locked --release --target $TARGET"
BUILD_OK=0
if [ "$HAVE_SERVICE" != "1" ]; then
    record 2 "compilación cruzada termina con exit 0" no-ejecutada \
        "no hay servicio '$SERVICE' en $COMPOSE_FILE" \
        "sin receta no se puede compilar: esto no es un aprobado"
else
    say "  construyendo imagen $SERVICE (RUST_VERSION=$RUST_VERSION)…"
    IMG_LOG="$SCRATCH/image-build.log"
    RUST_VERSION="$RUST_VERSION" EDUCONNECT_REPO="$REPO_ROOT" \
        compose build "$SERVICE" > "$IMG_LOG" 2>&1
    IMG_RC=$?
    if [ "$IMG_RC" -ne 0 ]; then
        record 2 "compilación cruzada termina con exit 0" fallo \
            "docker compose build $SERVICE exit=$IMG_RC" \
            "$(tail -3 "$IMG_LOG" | tr '\n' ' ')"
    else
        say "  imagen construida. Compilando el crate…"
        BUILD_LOG="$SCRATCH/cross-build.log"
        if [ "$FRESH" = "1" ]; then
            say "  FRESH=1: borrando /opt/target/$TARGET antes de compilar"
            RUST_VERSION="$RUST_VERSION" EDUCONNECT_REPO="$REPO_ROOT" \
                compose run -T --rm "$SERVICE" bash -lc "rm -rf /opt/target/$TARGET" \
                >> "$SCRATCH/fresh.log" 2>&1
        fi
        RUST_VERSION="$RUST_VERSION" EDUCONNECT_REPO="$REPO_ROOT" \
            compose run -T --rm "$SERVICE" bash -lc \
            "cd $CRATE_DIR && cargo build --locked --release --target $TARGET" \
            > "$BUILD_LOG" 2>&1
        BUILD_RC=$?
        FINISHED="$(grep -o "Finished .*" "$BUILD_LOG" | tail -1)"
        WARNINGS="$(grep -c "^warning" "$BUILD_LOG")"
        ERRORS="$(grep -c "^error" "$BUILD_LOG")"
        if [ "$BUILD_RC" -eq 0 ]; then
            BUILD_OK=1
            record 2 "compilación cruzada termina con exit 0" ok \
                "cargo exit=0 · ${FINISHED:-sin línea Finished}" \
                "warnings=$WARNINGS · errors=$ERRORS"
        else
            record 2 "compilación cruzada termina con exit 0" fallo \
                "cargo exit=$BUILD_RC · warnings=$WARNINGS · errors=$ERRORS" \
                "$(grep -m3 -E '^error' "$BUILD_LOG" | tr '\n' ' ')"
        fi
    fi
fi

# ── Extracción del artefacto (insumo de 3, 4 y 6) ─────────────────────
EXE="$SCRATCH/$EXE_NAME"
EXE_OK=0
if [ "$BUILD_OK" = "1" ]; then
    RUST_VERSION="$RUST_VERSION" EDUCONNECT_REPO="$REPO_ROOT" \
        compose run -T --rm "$SERVICE" bash -lc "cat $ARTIFACT_CT" \
        > "$EXE" 2> "$SCRATCH/extract.err"
    EXTRACT_RC=$?
    if [ "$EXTRACT_RC" -eq 0 ] && [ -s "$EXE" ]; then
        EXE_OK=1
        say ""
        say "  artefacto: $(stat -c %s "$EXE") bytes"
        say "  sha256:    $(sha256sum "$EXE" | cut -d' ' -f1)"
        say "  ruta en el contenedor: $ARTIFACT_CT (volumen cargo-target-win)"
    else
        say "  no se pudo extraer el artefacto (exit=$EXTRACT_RC): $(tail -2 "$SCRATCH/extract.err" | tr '\n' ' ')"
    fi
fi

# ── 3. Formato PE ─────────────────────────────────────────────────────
head1 "3. Formato del artefacto"
if [ "$EXE_OK" != "1" ]; then
    record 3 "file: PE32+ executable … x86-64" no-ejecutada "no hay artefacto extraído (ver 2)"
elif ! command -v file >/dev/null 2>&1; then
    record 3 "file: PE32+ executable … x86-64" no-ejecutada "el comando 'file' no existe en este equipo"
else
    FILE_OUT="$(file -b "$EXE")"
    if printf '%s' "$FILE_OUT" | grep -q "PE32+ executable" \
       && printf '%s' "$FILE_OUT" | grep -q "x86-64"; then
        record 3 "file: PE32+ executable … x86-64" ok "$FILE_OUT"
    else
        record 3 "file: PE32+ executable … x86-64" fallo "$FILE_OUT"
    fi
fi

# ── 4. Importaciones: sin DLL externas de SQLite ni de runtime ────────
CHECK4_NAME="objdump -p: 0 sqlite3.dll, 0 libgcc_s_seh-1.dll, 0 libwinpthread-1.dll"
head1 "4. Importaciones del PE (objdump -p)"
if [ "$EXE_OK" != "1" ]; then
    record 4 "$CHECK4_NAME" no-ejecutada "no hay artefacto extraído (ver 2)"
elif ! command -v objdump >/dev/null 2>&1; then
    record 4 "$CHECK4_NAME" no-ejecutada "el comando 'objdump' no existe en este equipo"
else
    OBJDUMP_OUT="$SCRATCH/objdump-p.txt"
    timeout 120 objdump -p "$EXE" > "$OBJDUMP_OUT" 2>&1
    OD_RC=$?
    if [ "$OD_RC" -ne 0 ]; then
        record 4 "$CHECK4_NAME" fallo "objdump exit=$OD_RC: $(head -1 "$OBJDUMP_OUT")"
    else
        S3="$(grep -ic "sqlite3\.dll" "$OBJDUMP_OUT")"
        GG="$(grep -ic "libgcc_s_seh-1\.dll" "$OBJDUMP_OUT")"
        WP="$(grep -ic "libwinpthread-1\.dll" "$OBJDUMP_OUT")"
        IMPORTS="$(grep -o "DLL Name: .*" "$OBJDUMP_OUT" | sed 's/DLL Name: //' | sort -u | tr '\n' ' ')"
        if [ "$S3" -eq 0 ] && [ "$GG" -eq 0 ] && [ "$WP" -eq 0 ]; then
            record 4 "$CHECK4_NAME" ok \
                "sqlite3.dll=$S3 · libgcc_s_seh-1.dll=$GG · libwinpthread-1.dll=$WP" \
                "DLL importadas: $IMPORTS"
        else
            record 4 "$CHECK4_NAME" fallo \
                "sqlite3.dll=$S3 · libgcc_s_seh-1.dll=$GG · libwinpthread-1.dll=$WP" \
                "DLL importadas: $IMPORTS"
        fi
    fi
fi

# ── 5. Grafo de dependencias sin la feature zim ───────────────────────
head1 "5. cargo tree --target $TARGET sin crate zim"
if [ "$HAVE_SERVICE" != "1" ]; then
    record 5 "cargo tree no contiene el crate zim" no-ejecutada \
        "no hay servicio '$SERVICE' en $COMPOSE_FILE"
else
    TREE_LOG="$SCRATCH/cargo-tree.txt"
    RUST_VERSION="$RUST_VERSION" EDUCONNECT_REPO="$REPO_ROOT" \
        compose run -T --rm "$SERVICE" bash -lc \
        "cd $CRATE_DIR && cargo tree --locked --target $TARGET" \
        > "$TREE_LOG" 2>&1
    TREE_RC=$?
    TREE_LINES="$(grep -c . "$TREE_LOG")"
    ZIM_LINES="$(grep -E '(^|[[:space:]│├└─])zim v[0-9]' "$TREE_LOG" | sort -u | tr '\n' ' ')"
    N_ZIM="$(grep -cE '(^|[[:space:]│├└─])zim v[0-9]' "$TREE_LOG")"
    if [ "$TREE_RC" -ne 0 ]; then
        record 5 "cargo tree no contiene el crate zim" fallo \
            "cargo tree exit=$TREE_RC: $(grep -m1 -E '^error' "$TREE_LOG")"
    elif [ "$N_ZIM" -eq 0 ]; then
        record 5 "cargo tree no contiene el crate zim" ok \
            "0 coincidencias de 'zim v…' en $TREE_LINES líneas de árbol (target $TARGET)"
    else
        record 5 "cargo tree no contiene el crate zim" fallo "$N_ZIM coincidencias: $ZIM_LINES"
    fi
fi

# ── 6. Arranque real bajo Wine (prefijo aislado, nunca el HOME) ───────
CHECK6_NAME="el .exe arranca bajo Wine y /health responde 200"
head1 "6. Arranque bajo Wine y GET /health"
if [ "$SKIP_WINE" = "1" ]; then
    record 6 "$CHECK6_NAME" no-ejecutada "SKIP_WINE=1: omitido a petición explícita"
elif [ "$EXE_OK" != "1" ]; then
    record 6 "$CHECK6_NAME" no-ejecutada "no hay artefacto extraído (ver 2)"
elif ! command -v wine >/dev/null 2>&1; then
    record 6 "$CHECK6_NAME" no-ejecutada "el comando 'wine' no existe en este equipo"
elif ! command -v curl >/dev/null 2>&1; then
    record 6 "$CHECK6_NAME" no-ejecutada "el comando 'curl' no existe en este equipo"
else
    PORT="${WIN_PROBE_PORT:-}"
    if [ -z "$PORT" ]; then
        for cand in $(seq 18907 18927); do
            if ! ss -ltnH 2>/dev/null | grep -q ":$cand "; then PORT="$cand"; break; fi
        done
    fi
    if [ -z "$PORT" ]; then
        record 6 "$CHECK6_NAME" no-ejecutada \
            "no se encontró un puerto libre entre 18907 y 18927"
    else
        RUN="$SCRATCH/run"
        mkdir -p "$RUN"
        cp "$EXE" "$RUN/$EXE_NAME"
        export WINEPREFIX="$SCRATCH/wineprefix"
        export WINEDEBUG="${WINEDEBUG:--all}"
        export WINEDLLOVERRIDES="mscoree,mshtml="
        export JWT_SECRET="win-probe-jwt-secret-0123456789abcdef0123456789"
        export ADMIN_INITIAL_PASSWORD="win-probe-admin-2026"
        export LISTEN_ADDR="127.0.0.1:$PORT"
        export RUST_LOG=info
        export DATA_DIR="$RUN/data"
        WINE_STARTED=1

        timeout "$T_WINE" wineboot --init > "$SCRATCH/wineboot.log" 2>&1
        WINEBOOT_RC=$?

        ( cd "$RUN" && timeout "$T_WINE" wine "./$EXE_NAME" ) > "$SCRATCH/server.log" 2>&1 &
        WINE_PID=$!
        HEALTH_OK=0
        for _ in $(seq 1 90); do
            if curl -sf --max-time 1 "http://127.0.0.1:$PORT/health" -o "$SCRATCH/health.json" 2>/dev/null; then
                HEALTH_OK=1; break
            fi
            kill -0 "$WINE_PID" 2>/dev/null || break
            sleep 1
        done
        BODY="$(cat "$SCRATCH/health.json" 2>/dev/null | tr -d '\n')"
        DB_BYTES="$(stat -c %s "$RUN/data/educonect.db" 2>/dev/null || echo 0)"
        LISTEN_LINE="$(grep -c "Servidor EduConect Rural escuchando" "$SCRATCH/server.log" 2>/dev/null || true)"
        LISTEN_LINE="${LISTEN_LINE:-0}"

        kill "$WINE_PID" 2>/dev/null
        sleep 2
        timeout 30 wineserver -k >/dev/null 2>&1
        WINE_STARTED=0
        PORT_FREED=0
        for _ in $(seq 1 10); do
            if ! curl -sf --max-time 1 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
                PORT_FREED=1; break
            fi
            sleep 1
        done

        DETAIL1="wineboot exit=$WINEBOOT_RC · /health -> $BODY · db=$DB_BYTES bytes"
        DETAIL2="líneas de escucha en el log: $LISTEN_LINE · puerto $PORT liberado tras kill: $PORT_FREED"
        if [ "$HEALTH_OK" = "1" ] && [ "$LISTEN_LINE" -ge 1 ] \
           && [ "$DB_BYTES" -gt 0 ] && [ "$PORT_FREED" = "1" ]; then
            record 6 "$CHECK6_NAME" ok "$DETAIL1" "$DETAIL2"
        else
            record 6 "$CHECK6_NAME" fallo "$DETAIL1" "$DETAIL2" \
                "últimas líneas del log: $(tail -3 "$SCRATCH/server.log" | tr '\n' ' ')"
        fi
    fi
fi

# ── Resumen ───────────────────────────────────────────────────────────
head1 "Resumen"
say "PASARON:       $PASSED"
say "FALLARON:      $FAILED"
say "NO EJECUTADAS: $NOTRUN"
if [ "$FAILED" -gt 0 ]; then
    say ""
    say "Fallos: ${FAIL_DETAIL[*]}"
    exit 1
fi
if [ "$NOTRUN" -gt 0 ]; then
    say ""
    say "Incompleto: hay comprobaciones que no pudieron ejecutarse."
    say "El resultado NO es un aprobado."
    exit 3
fi
say ""
say "Todos los controles se ejecutaron y pasaron."
say "Esto NO prueba que el .exe funcione en Windows real: solo bajo Wine."
exit 0
