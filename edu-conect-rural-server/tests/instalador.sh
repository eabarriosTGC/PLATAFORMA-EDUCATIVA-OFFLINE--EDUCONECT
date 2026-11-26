#!/usr/bin/env bash
# tests/instalador.sh — sonda del instalador de Linux (D-03 / T3).
#
# Comprueba las dos formas de invocación que el propio instalador documenta, que
# la unidad systemd generada sea coherente con el `DATA_DIR` elegido (también si
# se declara relativo) y que el template versionado no se desincronice del que
# lleva dentro `install.sh`:
#
#   1. clonar y ejecutar (`sudo bash edu-conect-rural-server/install.sh`).
#   2. `curl … | sudo bash` (aquí `cat install.sh | bash`) desde un directorio
#      limpio, sin `deploy/` al lado: la unidad viaja en el script.
#   3. `DATA_DIR` relativa: la unidad debe llevar la ruta **absoluta**.
#   4. `install.sh --print-unit` debe coincidir con las copias versionadas
#      (`deploy/educonect.service` y `edu-conect-rural-server/deploy/…`).
#
# No toca nada fuera de un directorio temporal: `apt`, `apk`, `dnf`, `wget`,
# `useradd`, `chown` y `systemctl` se sustituyen por stubs en PATH, y
# `SYSTEMD_DIR` apunta al temporal.
#
# Uso:  sudo bash edu-conect-rural-server/tests/instalador.sh
# Sale 0 si todo se cumple; 1 con el detalle de cada fallo. Sin root se omite
# (install.sh exige `EUID == 0` por diseño y eso no se relaja para la prueba).
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALADOR="$REPO/install.sh"

if [ ! -f "$INSTALADOR" ]; then
    echo "FALLO: no se encontró $INSTALADOR" >&2
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "OMITIDA: install.sh exige root por diseño. Ejecutar: sudo bash $0"
    exit 0
fi

fallos=0
fallo() {
    echo "FALLO: $*" >&2
    fallos=$((fallos + 1))
}

# Scratch fuera del árbol de trabajo: `--tmpdir` usa el temporal del sistema
# (`$TMPDIR` o `/tmp`), nunca el directorio actual, que puede ser de solo
# lectura. Si no se puede crear, se aborta: sin scratch no hay prueba válida.
base="$(mktemp -d --tmpdir educonect-instalador.XXXXXX)" || base=""
if [ -z "$base" ] || [ ! -d "$base" ]; then
    echo "FALLO: no se pudo crear el directorio temporal de la prueba" >&2
    exit 1
fi
trap 'rm -rf "$base"' EXIT

# ── stubs: ningún comando real fuera del temporal ────────────────────
stubs="$base/bin"
mkdir -p "$stubs"
stub() {
    printf '#!/bin/sh\nexit 0\n' >"$stubs/$1"
    chmod +x "$stubs/$1"
}
for nombre in apt apk dnf wget useradd chown systemctl; do
    stub "$nombre"
done

install_dir="$base/opt/educonect"
data_dir="$base/var/educonect-datos"
env_file="$base/etc/educonect/educonect.env"
systemd_dir="$base/etc/systemd/system"
unidad="$install_dir/config/educonect.service"

mkdir -p "$install_dir" "$systemd_dir"
# Binario ficticio: evita la descarga y hace verificable el ExecStart.
printf '#!/bin/sh\nexit 0\n' >"$install_dir/edu-conect-rural-server"
chmod +x "$install_dir/edu-conect-rural-server"

entorno_comun=(
    PATH="$stubs:$PATH"
    INSTALL_DIR="$install_dir"
    ENV_FILE="$env_file"
    SYSTEMD_DIR="$systemd_dir"
    SSID="Aula-Prueba"
    PASSWORD="clave-de-prueba"
)

# ── comprobaciones sobre la unidad generada ──────────────────────────
comprobar_unidad() { # etiqueta, archivo, DATA_DIR esperado
    local etiqueta="$1" archivo="$2" esperada="$3"
    local data_unidad rw exec_start

    if [ ! -f "$archivo" ]; then
        fallo "$etiqueta: no se generó la unidad ($archivo)"
        return
    fi

    data_unidad="$(sed -n 's/^Environment=DATA_DIR=//p' "$archivo" | head -n1)"
    rw="$(sed -n 's/^ReadWritePaths=//p' "$archivo" | head -n1)"
    exec_start="$(sed -n 's/^ExecStart=//p' "$archivo" | head -n1)"

    [ "$data_unidad" = "$esperada" ] \
        || fallo "$etiqueta: Environment=DATA_DIR es '$data_unidad', se esperaba '$esperada'"
    # ProtectSystem=strict: si ReadWritePaths no sigue al DATA_DIR declarado, el
    # servicio no puede escribir la base donde el operador dijo.
    [ "$rw" = "$data_unidad" ] \
        || fallo "$etiqueta: ReadWritePaths es '$rw' y Environment=DATA_DIR es '$data_unidad': con ProtectSystem=strict el servicio no podría escribir sus datos"
    case "$data_unidad" in
        /*) ;;
        *) fallo "$etiqueta: Environment=DATA_DIR quedó relativo ('$data_unidad'); el servicio arranca con otro CWD" ;;
    esac
    [ "$exec_start" = "$install_dir/edu-conect-rural-server" ] \
        || fallo "$etiqueta: ExecStart es '$exec_start', se esperaba el binario en la raíz de APP_ROOT"
    if [ ! -x "$exec_start" ]; then
        fallo "$etiqueta: ExecStart no apunta a un ejecutable ($exec_start)"
    fi
    if grep -q '^Environment=DB_PATH=' "$archivo"; then
        fallo "$etiqueta: la unidad exporta DB_PATH, que el servidor no lee"
    fi
    if grep -q '@[A-Z_]*@' "$archivo"; then
        fallo "$etiqueta: la unidad conserva marcadores sin sustituir: $(grep -o '@[A-Z_]*@' "$archivo" | sort -u | tr '\n' ' ')"
    fi
    [ -f "$systemd_dir/educonect.service" ] \
        || fallo "$etiqueta: la unidad no se instaló en SYSTEMD_DIR ($systemd_dir)"
    if [ -f "$env_file" ]; then
        case "$(stat -c '%a' "$env_file")" in
            600) ;;
            *) fallo "$etiqueta: $env_file quedó con permisos $(stat -c '%a' "$env_file"), se esperaba 600" ;;
        esac
    else
        fallo "$etiqueta: no se creó el EnvironmentFile $env_file"
    fi
}

# ── 1. invocación documentada «clonar y ejecutar» ────────────────────
if ! env "${entorno_comun[@]}" DATA_DIR="$data_dir" bash "$INSTALADOR" \
    >"$base/clon.log" 2>&1; then
    fallo "la invocación documentada «bash install.sh» (clon) salió ≠ 0"
    sed -n '1,160p' "$base/clon.log" >&2
fi
if [ -f "$unidad" ]; then
    cp "$unidad" "$base/unidad-clon"
fi
comprobar_unidad "clon" "$base/unidad-clon" "$data_dir"

# ── 2. invocación documentada «curl … | bash» ────────────────────────
# Directorio limpio: no hay `deploy/` al lado, así que el template que se usa es
# el que lleva dentro el script.
mkdir -p "$base/cwd-limpio"
if ! (cd "$base/cwd-limpio" && env "${entorno_comun[@]}" DATA_DIR="$data_dir" \
    bash -c "cat '$INSTALADOR' | bash") >"$base/tubo.log" 2>&1; then
    fallo "la invocación documentada «cat install.sh | bash» salió ≠ 0"
    sed -n '1,160p' "$base/tubo.log" >&2
fi
if [ -f "$unidad" ]; then
    cp "$unidad" "$base/unidad-tubo"
fi
comprobar_unidad "tubería" "$base/unidad-tubo" "$data_dir"

# Misma instalación, misma unidad: la tubería no cambia nada.
if [ -f "$base/unidad-clon" ] && [ -f "$base/unidad-tubo" ]; then
    if ! cmp -s "$base/unidad-clon" "$base/unidad-tubo"; then
        fallo "la unidad generada por tubería difiere de la de la clonación"
        diff -u "$base/unidad-clon" "$base/unidad-tubo" >&2
    fi
fi

# ── 3. DATA_DIR relativa: la unidad debe llevar la absoluta ──────────
mkdir -p "$base/cwd-relativo"
absoluta_relativa="$(cd "$base/cwd-relativo" && pwd -P)/datos"
if ! (cd "$base/cwd-relativo" && env "${entorno_comun[@]}" DATA_DIR="./datos" \
    bash "$INSTALADOR") >"$base/relativo.log" 2>&1; then
    fallo "la instalación con DATA_DIR relativa salió ≠ 0"
    sed -n '1,160p' "$base/relativo.log" >&2
fi
if [ -f "$unidad" ]; then
    cp "$unidad" "$base/unidad-relativa"
fi
comprobar_unidad "relativa" "$base/unidad-relativa" "$absoluta_relativa"

# ── 4. el template versionado == el que lleva el instalador ──────────
if ! bash "$INSTALADOR" --print-unit >"$base/unidad-print" 2>&1; then
    fallo "«install.sh --print-unit» salió ≠ 0"
else
    for copia in "$REPO/../deploy/educonect.service" "$REPO/deploy/educonect.service"; do
        if [ ! -f "$copia" ]; then
            fallo "falta la copia versionada del template: $copia"
            continue
        fi
        if ! cmp -s "$base/unidad-print" "$copia"; then
            fallo "$copia no coincide con «install.sh --print-unit» (template desincronizado)"
            diff -u "$base/unidad-print" "$copia" >&2
        fi
    done
fi

# ── resumen ──────────────────────────────────────────────────────────
if [ "$fallos" -eq 0 ]; then
    echo "OK: instalador — clon y tubería salen 0; DATA_DIR (absoluta y relativa) coherente con ReadWritePaths; template versionado sincronizado"
    exit 0
fi

echo "" >&2
echo "$fallos comprobación(es) fallida(s) del instalador" >&2
exit 1
