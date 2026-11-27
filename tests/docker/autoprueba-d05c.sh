#!/usr/bin/env bash
# autoprueba-d05c.sh — Control negativo de las sondas de D-05c (sin demonio)
# EduConect Rural — Plataforma educativa offline
#
# Qué demuestra. Que cada sonda nueva del job `docker` PUEDE FALLAR, y que
# reserva el código 2 para «no verificable» en vez de aprobar en silencio:
#
#   · tests/docker/verificar-aislamiento-buildkit.sh
#       logs sintéticos: BuildKit aislado (0), core con etapa `[full …]` (1),
#       full sin su etapa (1), constructor clásico (2), archivo ajeno (2).
#   · tests/docker/verificar-configuracion.sh
#       `docker` falso: imagen que arranca igual (1), que falla sin nombrar la
#       variable (1), que falla por otro motivo (1), que se cuelga (1), que
#       rechaza nombrando la variable y el motivo (0), sin argumentos (2).
#   · tests/docker/esperar-salud.sh
#       `docker` falso: contenedor que nunca responde (1, con su log adjunto),
#       que muere antes de responder (1), sin argumentos (2), imagen inexistente (2).
#   · tests/docker/verificar-fixture-zim.sh (D-05b / T2)
#       el paquete del repositorio (0), una copia alterada en un byte (1, y
#       nombra el sha256), un directorio sin el paquete (1).
#   · tests/docker/verificar-perfiles.sh, la parte del fixture (D-05b / T2)
#       `docker` falso: las dos patas montando el MISMO paquete (0), core
#       sirviendo el fixture que debía ignorar (1), y un paquete alterado
#       deteniendo la sonda antes de que mida nada (1).
#
# No necesita demonio de Docker ni imágenes construidas: los logs son texto y
# `docker` se reemplaza por un guion en un PATH temporal. Todo el estado vive en
# `mktemp -d`, fuera del árbol de trabajo, y se borra al terminar.
#
# Uso: tests/docker/autoprueba-d05c.sh
# Códigos: 0 = todas las sondas se comportan; 1 = alguna no discrimina.

set -uo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
AISLAMIENTO="$AQUI/verificar-aislamiento-buildkit.sh"
CONFIGURACION="$AQUI/verificar-configuracion.sh"
FIXTURE_ZIM="$AQUI/verificar-fixture-zim.sh"
PERFILES="$AQUI/verificar-perfiles.sh"
FIXTURE="$(cd "$AQUI/.." && pwd)/fixtures/zim"
SALUD="$AQUI/esperar-salud.sh"

TMP="$(mktemp -d)" || { echo "no se pudo crear el directorio temporal"; exit 1; }
trap 'rm -rf "$TMP"' EXIT

FALSA="$TMP/bin"
LOGSDIR="$TMP/logs"
mkdir -p "$FALSA" "$LOGSDIR"

# ── `docker` falso: responde según variables de entorno ──────────────
cat >"$FALSA/docker" <<'FALSO'
#!/usr/bin/env bash
case "${1:-}" in
    image)
        [[ "${FAKE_INSPECCION_FALLA:-0}" == "1" ]] && exit 1
        exit 0 ;;
    run)
        for arg in "$@"; do
            if [[ "$arg" == "-d" ]]; then
                printf '%s\n' "${FAKE_LOG:-}"
                exit "${FAKE_ESTADO_ARRANQUE:-0}"
            fi
        done
        printf '%s\n' "${FAKE_SALIDA:-}"
        exit "${FAKE_ESTADO:-0}" ;;
    port)  printf '%s\n' "${FAKE_MAPEO:-0.0.0.0:1}" ;;
    inspect) printf '%s\n' "${FAKE_INSPECCION:-true}" ;;
    logs)  printf '%s\n' "${FAKE_LOG:-}" ;;
    *) exit 0 ;;
esac
exit 0
FALSO
chmod +x "$FALSA/docker"

fallos=0
comprobar() {
    local descripcion="$1" esperado="$2" obtenido="$3" salida="${4:-}"
    if [[ "$obtenido" -eq "$esperado" ]]; then
        echo "  ✅ $descripcion → $obtenido"
        return 0
    fi
    fallos=$((fallos + 1))
    echo "  ❌ $descripcion → esperaba $esperado y dio $obtenido"
    [[ -n "$salida" ]] && printf '%s\n' "$salida" | sed 's/^/       /'
    return 0
}

# Ejecuta una sonda con el `docker` falso delante en PATH.
correr_con_falso() {
    PATH="$FALSA:$PATH" bash "$@"
}

# ── Logs sintéticos con formato de `--progress=plain` ───────────────
log_base() {
    cat <<'LOG'
#1 [internal] load build definition from Dockerfile
#4 [rust-builder 1/3] RUN apt-get update && apt-get install -y pkg-config libssl-dev g++ libzim-dev
#9 [binario-core 1/1] RUN cargo build --release && strip target/release/edu-conect-rural-server
#12 [runtime-base 3/5] RUN apt-get update && apt-get install -y curl ffmpeg
#30 [core 2/3] COPY --from=binario-core /build/target/release/edu-conect-rural-server /app/server
LOG
}
log_full() {
    cat <<'LOG'
#1 [internal] load build definition from Dockerfile
#4 [rust-builder 1/3] RUN apt-get update && apt-get install -y pkg-config libssl-dev g++ libzim-dev
#9 [binario-full 1/1] RUN cargo build --release --features zim && strip target/release/edu-conect-rural-server
#12 [runtime-base 3/5] RUN apt-get update && apt-get install -y curl ffmpeg
#40 [full 3/6] RUN apt-get update && apt-get install -y --no-install-recommends libzim8 libxapian30 libicu72
#45 [full 6/6] ENTRYPOINT ["/app/server"]
LOG
}

log_base >"$LOGSDIR/core.log"
log_full >"$LOGSDIR/full.log"
# core contaminado con la etapa exclusiva de full (el defecto que hay que detectar)
{ log_base; echo '#40 [full 3/6] RUN apt-get update && apt-get install -y libzim8'; } >"$LOGSDIR/core-contaminado.log"
# full al que le falta su propia etapa final (el build no produjo el perfil)
grep -v '\[full ' "$LOGSDIR/full.log" >"$LOGSDIR/full-sin-etapa.log"
# log del constructor clásico: sin grafo de etapas
cat >"$LOGSDIR/clasico.log" <<'CLASICO'
Step 1/31 : FROM rust:1.88-slim-bookworm AS rust-builder
 ---> 1234abcd
Step 2/31 : RUN apt-get update && apt-get install -y libzim-dev
 ---> Running in 5678efgh
CLASICO
# log de otro build: BuildKit, pero sin las etapas de estos targets
cat >"$LOGSDIR/ajeno.log" <<'AJENO'
#1 [internal] load build definition from Dockerfile
#5 [otra-etapa 1/1] RUN echo hola
AJENO

echo "== verificar-aislamiento-buildkit.sh =="
correr_con_falso "$AISLAMIENTO" >/dev/null 2>&1
comprobar "sin argumentos" 2 $?
correr_con_falso "$AISLAMIENTO" "$LOGSDIR/no-existe.log" "$LOGSDIR/full.log" >/dev/null 2>&1
comprobar "log inexistente" 2 $?
correr_con_falso "$AISLAMIENTO" "$LOGSDIR/clasico.log" "$LOGSDIR/full.log" >/dev/null 2>&1
comprobar "constructor clásico (sin grafo de etapas)" 2 $?
correr_con_falso "$AISLAMIENTO" "$LOGSDIR/ajeno.log" "$LOGSDIR/full.log" >/dev/null 2>&1
comprobar "log que no es de estos targets" 2 $?
correr_con_falso "$AISLAMIENTO" "$LOGSDIR/core.log" "$LOGSDIR/full.log" >/dev/null 2>&1
comprobar "par aislado y correcto" 0 $?
salida="$(correr_con_falso "$AISLAMIENTO" "$LOGSDIR/core-contaminado.log" "$LOGSDIR/full.log" 2>&1)"
comprobar "core que ejecutó la etapa «full»" 1 $? "$salida"
grep -F -q 'core ejecutó la etapa «full»' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se nombró la etapa infractora"; }
salida="$(correr_con_falso "$AISLAMIENTO" "$LOGSDIR/core.log" "$LOGSDIR/full-sin-etapa.log" 2>&1)"
comprobar "full sin la etapa «full»" 1 $? "$salida"
grep -F -q 'no ejecutó la etapa «full»' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se reportó la etapa faltante"; }

echo "== verificar-configuracion.sh =="
correr_con_falso "$CONFIGURACION" >/dev/null 2>&1
comprobar "sin argumentos" 2 $?
FAKE_INSPECCION_FALLA=1 correr_con_falso "$CONFIGURACION" imagen-inexistente >/dev/null 2>&1
comprobar "imagen inexistente" 2 $?
FAKE_ESTADO=0 correr_con_falso "$CONFIGURACION" imagen-falsa >/dev/null 2>&1
comprobar "imagen que arranca con configuración mala" 1 $?
FAKE_ESTADO=1 FAKE_SALIDA='error genérico sin nombres de variable' \
    correr_con_falso "$CONFIGURACION" imagen-falsa >/dev/null 2>&1
comprobar "falla sin nombrar la variable" 1 $?
FAKE_ESTADO=1 FAKE_SALIDA='JWT_SECRET: algo salió mal' \
    correr_con_falso "$CONFIGURACION" imagen-falsa >/dev/null 2>&1
comprobar "nombra la variable pero sin el motivo esperado" 1 $?
FAKE_ESTADO=124 correr_con_falso "$CONFIGURACION" imagen-falsa >/dev/null 2>&1
comprobar "se cuelga en vez de rechazar" 1 $?
FAKE_ESTADO=1 FAKE_SALIDA='[ERROR] JWT_SECRET: demasiado corta (20 chars, mínimo 32)
[ERROR] JWT_SECRET: variable ausente
[ERROR] ADMIN_INITIAL_PASSWORD no está definida o está vacía' \
    correr_con_falso "$CONFIGURACION" imagen-falsa >/dev/null 2>&1
comprobar "rechaza nombrando la variable y el motivo" 0 $?

echo "== esperar-salud.sh =="
correr_con_falso "$SALUD" >/dev/null 2>&1
comprobar "sin argumentos" 2 $?
FAKE_INSPECCION_FALLA=1 correr_con_falso "$SALUD" imagen-inexistente >/dev/null 2>&1
comprobar "imagen inexistente" 2 $?
salida="$(D05C_PLAZO=2 FAKE_MAPEO='0.0.0.0:1' FAKE_INSPECCION=true \
    FAKE_LOG='[ERROR] JWT_SECRET: demasiado corta (20 chars, mínimo 32)' \
    correr_con_falso "$SALUD" imagen-falsa 2>&1)"
comprobar "contenedor que nunca responde /health" 1 $? "$salida"
grep -F -q 'JWT_SECRET: demasiado corta' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se adjuntó el log del contenedor"; }
salida="$(D05C_PLAZO=5 FAKE_INSPECCION=false FAKE_LOG='el contenedor murió' \
    correr_con_falso "$SALUD" imagen-falsa 2>&1)"
comprobar "contenedor que muere antes de responder" 1 $? "$salida"
grep -F -q 'terminó antes de responder' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se informó la muerte del contenedor"; }

# ── Fixture D-05b: el paquete montado es el declarado ───────────────
# Una copia alterada en un byte prueba que el sha256 no es decorativo; el
# directorio vacío prueba que la ausencia del paquete tampoco se aprueba. Las
# dos copias viven en $TMP, nunca en el árbol de trabajo.
echo "== verificar-fixture-zim.sh (D-05b / T2) =="
bash "$FIXTURE_ZIM" >/dev/null 2>&1
comprobar "paquete del repositorio (ruta por defecto)" 0 $?

CORRUPTO="$TMP/fixture-alterado"
mkdir -p "$CORRUPTO/paginas"
cp "$FIXTURE/fixture_d05b.zim" "$CORRUPTO/"
cp "$FIXTURE"/paginas/*.html "$CORRUPTO/paginas/"
cp "$FIXTURE/LICENCIA.md" "$FIXTURE/generar-fixture.py" "$CORRUPTO/"
printf 'X' | dd of="$CORRUPTO/fixture_d05b.zim" bs=1 seek=1024 count=1 conv=notrunc status=none
salida="$(bash "$FIXTURE_ZIM" "$CORRUPTO" 2>&1)"
comprobar "copia alterada en un solo byte" 1 $? "$salida"
grep -F -q 'sha256' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ la falla no nombra el sha256"; }

VACIO="$TMP/fixture-sin-paquete"
mkdir -p "$VACIO"
salida="$(bash "$FIXTURE_ZIM" "$VACIO" 2>&1)"
comprobar "directorio sin el paquete" 1 $? "$salida"

# ── verificar-perfiles.sh con el fixture montado, sin demonio ────────
# El `docker` falso modela los dos perfiles por el nombre del contenedor y, con
# FAKE_CORE_SIRVE_FIXTURE=1, hace que `core` sirva el paquete: exactamente la
# simetría rota (una imagen que distribuye contenido que no puede leer) que la
# sonda tiene que rechazar. Sin esta prueba, las comprobaciones nuevas del
# fixture podrían estar aprobando siempre y nadie lo notaría.
echo "== verificar-perfiles.sh: fixture montado en las dos patas =="
FALSO_PERFILES="$TMP/falso-perfiles"
mkdir -p "$FALSO_PERFILES"
cat >"$FALSO_PERFILES/docker" <<'FALSO_PERFILES'
#!/usr/bin/env bash
# `docker` falso: corre verificar-perfiles.sh sin demonio ni imágenes.
set -u
CUERPO_ZIM='{"default":"fixture_d05b","zims":[{"articles":4,"icon":"📦","nombre":"ZIM Desconocido","slug":"fixture_d05b","source":"persistent"}]}'
CUERPO_503='{"error":"capacidad zim no incluida en esta compilación","capacidad":"zim"}'
es_core() { [[ "$1" == *core* ]]; }
sub="${1:-}"
shift || true
case "$sub" in
    image|rm) exit 0 ;;
    logs) exit 0 ;;
    inspect) printf 'healthy\n'; exit 0 ;;
    run)
        modo_d=0 cont="" entrypoint="" admin_vacia=0 imagen=""
        args=("$@") n=${#args[@]} i=0
        while (( i < n )); do
            case "${args[i]}" in
                -d) modo_d=1 ;;
                --name) i=$((i + 1)); cont="${args[i]}" ;;
                --entrypoint) i=$((i + 1)); entrypoint="${args[i]}" ;;
                -e)
                    i=$((i + 1))
                    [[ "${args[i]}" == "ADMIN_INITIAL_PASSWORD=" ]] && admin_vacia=1 ;;
                -v|-w|--label|--user|-p) i=$((i + 1)) ;;
                -*) : ;;
                *) [[ -z "$imagen" ]] && imagen="${args[i]}" ;;
            esac
            i=$((i + 1))
        done
        if (( modo_d )); then printf 'falso-%s\n' "$cont"; exit 0; fi
        if (( admin_vacia )); then
            printf '[ERROR] ADMIN_INITIAL_PASSWORD no está definida o está vacía.\n'
            exit 1
        fi
        case "$entrypoint" in
            sh) printf -- '--FIN-DE-RECORRIDO--\n' ;;
            ldd)
                if es_core "$imagen"; then
                    printf '\tlibgcc_s.so.1 => /lib/x86_64-linux-gnu/libgcc_s.so.1 (0x0)\n'
                    printf '\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x0)\n'
                else
                    printf '\tlibzim.so.8 => /lib/x86_64-linux-gnu/libzim.so.8 (0x0)\n'
                    printf '\tlibxapian.so.30 => /lib/x86_64-linux-gnu/libxapian.so.30 (0x0)\n'
                    printf '\tlibicuuc.so.72 => /lib/x86_64-linux-gnu/libicuuc.so.72 (0x0)\n'
                    printf '\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x0)\n'
                fi ;;
        esac
        exit 0 ;;
    exec)
        cont="${1:-}"; shift || true
        url="" pide_codigo=0 pide_cabeceras=0
        for a in "$@"; do
            case "$a" in
                http://*) url="$a" ;;
                *%{http_code}*) pide_codigo=1 ;;
                -D) pide_cabeceras=1 ;;
            esac
        done
        perfil=full
        if es_core "$cont"; then perfil=core; fi
        if es_core "$cont" && [[ "${FAKE_CORE_SIRVE_FIXTURE:-0}" == "1" ]]; then perfil=full; fi
        codigo=404 cuerpo='no encontrado' cabeceras='HTTP/1.1 404 Not Found\r'
        articulo() {
            if [[ "$perfil" == "full" ]]; then
                codigo=200 cuerpo="<html><h1>FIXTURE-D05B</h1> $1</html>"
            else
                codigo=503 cuerpo='<html>capacidad zim no incluida en esta compilación</html>'
            fi
        }
        case "$url" in
            */health) codigo=200 cuerpo='{"status":"ok","version":"0.1.0"}' ;;
            */api/wikipedia/zims)
                if [[ "$perfil" == "full" ]]; then codigo=200 cuerpo="$CUERPO_ZIM"
                else codigo=503 cuerpo="$CUERPO_503"; fi ;;
            */zim/)
                if [[ "$perfil" == "full" ]]; then
                    codigo=307 cabeceras=$'HTTP/1.1 307 Temporary Redirect\r\nLocation: /zim/A/Portada\r'
                else
                    codigo=503 cuerpo='<html>capacidad zim no incluida en esta compilación</html>'
                fi ;;
            */zim/A/Portada) articulo 'FIXTURE-D05B-PORTADA FIXTURE-D05B-SCRIPT Escuela Rural La Esperanza' ;;
            */Observatorio_del_R%C3%ADo) articulo 'FIXTURE-D05B-OBSERVATORIO Río Grande temperatura' ;;
            */Estaci%C3%B3n_La_Esperanza) articulo 'FIXTURE-D05B-ESTACION pingüino doce kilómetros' ;;
            */zim/A/Glosario) articulo 'FIXTURE-D05B-GLOSARIO Acequia Terraplén' ;;
            */zim/A/*) articulo 'FIXTURE-D05B-ARTICULO' ;;
        esac
        if (( pide_cabeceras )); then printf '%s\n' "$cabeceras"; exit 0; fi
        if (( pide_codigo )); then printf '%s' "$codigo"; exit 0; fi
        printf '%s\n' "$cuerpo"
        exit 0 ;;
esac
exit 0
FALSO_PERFILES
chmod +x "$FALSO_PERFILES/docker"

salida="$(PATH="$FALSO_PERFILES:$PATH" bash "$PERFILES" perfil-core:falso perfil-full:falso 2>&1)"
comprobar "las dos patas con el MISMO fixture montado" 0 $? "$salida"
grep -F -q 'contraste con el fixture montado' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se reportó el contraste con el fixture"; }

salida="$(FAKE_CORE_SIRVE_FIXTURE=1 PATH="$FALSO_PERFILES:$PATH" \
    bash "$PERFILES" perfil-core:falso perfil-full:falso 2>&1)"
comprobar "core sirviendo el fixture que debía ignorar" 1 $? "$salida"
grep -F -q 'core: /api/wikipedia/zims debía responder 503' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ no se nombró la pata core infractora"; }

salida="$(D05B_FIXTURE_DIR="$CORRUPTO" PATH="$FALSO_PERFILES:$PATH" \
    bash "$PERFILES" perfil-core:falso perfil-full:falso 2>&1)"
comprobar "fixture alterado: la sonda no mide nada más" 1 $? "$salida"
grep -F -q 'sha256' <<<"$salida" \
    || { fallos=$((fallos + 1)); echo "  ❌ la falla no nombra el sha256"; }

echo
echo "─────────────────────────────────────────────"
if [[ "$fallos" -gt 0 ]]; then
    echo "  RESULTADO: FALLA ($fallos comprobaciones) — alguna sonda no discrimina"
    exit 1
fi
echo "  RESULTADO: OK — las sondas de D-05c fallan cuando deben y no aprueban sin medir"
exit 0
