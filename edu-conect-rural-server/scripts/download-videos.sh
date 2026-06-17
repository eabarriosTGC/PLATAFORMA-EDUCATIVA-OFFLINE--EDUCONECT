#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# EduConect Rural — Descarga Masiva de Videos (yt-dlp + ffmpeg)
# Uso: ./download-videos.sh <URL|archivo> [calidad]
#   calidad: best, 480, 360  (default: 360 para ahorrar espacio)
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VIDEOS_DIR="${PROJECT_DIR}/data/videos"
mkdir -p "$VIDEOS_DIR"

# ── Colores ──
ROJO='\033[0;31m'
VERDE='\033[0;32m'
AMARILLO='\033[1;33m'
AZUL='\033[0;34m'
SIN_COLOR='\033[0m'

info()  { echo -e "${AZUL}[INFO]${SIN_COLOR}  $*"; }
ok()    { echo -e "${VERDE}[OK]${SIN_COLOR}    $*"; }
error() { echo -e "${ROJO}[ERROR]${SIN_COLOR}  $*"; }
warn()  { echo -e "${AMARILLO}[WARN]${SIN_COLOR}  $*"; }

# ── Ayuda ──
mostrar_ayuda() {
    cat <<EOF
EduConect Rural — Descarga Masiva de Videos

USO:
  $0 <URL>              Descarga un video de YouTube
  $0 <archivo.txt>      Descarga múltiples URLs (una por línea)
  $0 <URL> 480          Descarga en 480p
  $0 <URL> best         Descarga en la mejor calidad disponible

CALIDADES DISPONIBLES:
  best   — mejor calidad disponible (mucho espacio)
  480    — 854x480 (recomendado para tablets)
  360    — 640x360 (default — ahorra espacio, ideal para RPi)

EJEMPLOS:
  $0 https://youtube.com/watch?v=abc123
  $0 https://youtube.com/watch?v=abc123 480
  $0 lista_videos.txt
EOF
    exit 0
}

# ── Parsear calidad ──
parse_calidad() {
    local calidad="${1:-360}"
    case "$calidad" in
        best)  echo "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" ;;
        480)   echo "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best" ;;
        360|*) echo "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best" ;;
    esac
}

# ── Verificar herramientas ──
verificar_herramientas() {
    local ok=true
    for cmd in yt-dlp ffmpeg; do
        if ! command -v "$cmd" &>/dev/null; then
            error "$cmd no está instalado. Instalálo con: sudo apt install $cmd"
            ok=false
        fi
    done
    $ok || exit 1
}

# ── Descargar un solo video ──
descargar_video() {
    local url="$1"
    local calidad="$2"
    local format
    format="$(parse_calidad "$calidad")"

    info "Descargando: $url"
    info "Calidad: $calidad"
    info "Destino: $VIDEOS_DIR"

    # Sanitizar título para nombre de archivo
    yt-dlp \
        --output "${VIDEOS_DIR}/%(title)s.%(ext)s" \
        --format "$format" \
        --restrict-filenames \
        --no-playlist \
        --embed-metadata \
        --embed-thumbnail \
        --sub-langs es,en \
        --embed-subs \
        --convert-subs srt \
        --merge-output-format mp4 \
        --compat-options no-youtube-unavailable-videos \
        --progress \
        --console-title \
        --no-warnings \
        "$url" 2>&1 | while IFS= read -r line; do
            # Mostrar progreso compacto
            if [[ "$line" =~ [0-9]+\.[0-9]% ]]; then
                echo -ne "\r${AZUL}[↓]${SIN_COLOR} $line"
            elif [[ "$line" =~ ^\[download ]]; then
                echo -ne "\r${AZUL}[↓]${SIN_COLOR} $line"
            elif [[ -n "$line" ]]; then
                echo -e "\n${AZUL}[yt-dlp]${SIN_COLOR} $line"
            fi
        done
    echo

    # Buscar archivo descargado
    local archivo
    archivo="$(ls -t "${VIDEOS_DIR}"/*.mp4 2>/dev/null | head -1 || true)"
    if [[ -z "$archivo" ]]; then
        error "No se pudo encontrar el archivo descargado"
        return 1
    fi

    ok "Descarga completada: $(basename "$archivo") ($(du -h "$archivo" | cut -f1))"

    # Optimizar para Raspberry Pi
    optimizar_para_rpi "$archivo"
}

# ── Optimizar video para Raspberry Pi ──
optimizar_para_rpi() {
    local input="$1"
    local dir
    dir="$(dirname "$input")"
    local base
    base="$(basename "$input" .mp4)"
    local temp="${dir}/${base}_temp.mp4"
    local output="${dir}/${base}_rpi.mp4"

    info "Optimizando para Raspberry Pi: $(basename "$input")"

    # Detectar si h264_arm está disponible
    local encoder="libx264"
    if ffmpeg -encoders 2>/dev/null | grep -q h264_arm; then
        encoder="h264_arm"
        info "Usando codec h264_arm (aceleración hardware RPi)"
    else
        info "Usando codec libx264 (software — compatible con todos los dispositivos)"
    fi

    ffmpeg -i "$input" \
        -c:v "$encoder" \
        -preset medium \
        -crf 30 \
        -c:a aac \
        -b:a 64k \
        -ac 1 \
        -vf "scale='min(640,iw)':'min(360,ih)':force_original_aspect_ratio=decrease" \
        -movflags +faststart \
        -threads 2 \
        -y \
        "$temp" 2>&1 | tail -5

    # Reemplazar archivo original por el optimizado
    mv "$temp" "$output"
    ok "Optimización completada: $(basename "$output") ($(du -h "$output" | cut -f1))"
}

# ── MAIN ──
main() {
    if [[ $# -eq 0 ]]; then
        mostrar_ayuda
    fi

    verificar_herramientas

    local fuente="$1"
    local calidad="${2:-360}"

    echo ""
    echo "╔══════════════════════════════════════╗"
    echo "║  📺 EduConect — Descarga de Videos  ║"
    echo "╚══════════════════════════════════════╝"
    echo ""

    if [[ -f "$fuente" ]]; then
        # Es un archivo con URLs
        info "Leyendo URLs desde: $fuente"
        while IFS= read -r url; do
            [[ -z "$url" || "$url" =~ ^[[:space:]]*# ]] && continue
            url="$(echo "$url" | xargs)"  # trim
            echo ""
            info "═══════════════════════════════════"
            descargar_video "$url" "$calidad" || warn "Falló: $url (continuando...)"
        done < "$fuente"
    else
        # Es una URL directa
        descargar_video "$fuente" "$calidad"
    fi

    echo ""
    ok "Proceso completado. Videos en: $VIDEOS_DIR"
}

main "$@"
