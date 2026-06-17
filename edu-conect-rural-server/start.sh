#!/usr/bin/env bash
# start.sh — Arranque del servidor EduConect Rural para Raspberry Pi
# Copiar al mismo directorio que el binario compilado.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BIN="${SCRIPT_DIR}/edu-conect-rural-server"
DB_PATH="${DB_PATH:-${SCRIPT_DIR}/data/educonect.db}"
FRONTEND_PATH="${FRONTEND_PATH:-${SCRIPT_DIR}/../edu-conect-rural-dashboard/out/}"
LISTEN_ADDR="${LISTEN_ADDR:-0.0.0.0:8080}"

echo "========================================"
echo "  EduConect Rural — Servidor Offline"
echo "========================================"
echo "  Escucha:    $LISTEN_ADDR"
echo "  DB:         $DB_PATH"
echo "  Frontend:   $FRONTEND_PATH"
echo "========================================"

# Crear directorio data si no existe
mkdir -p "$(dirname "$DB_PATH")"

# Verificar binario
if [ ! -x "$BIN" ]; then
    echo "❌ Binario no encontrado: $BIN"
    echo "   Ejecuta 'cargo build --release' primero."
    exit 1
fi

# Exportar variables
export DB_PATH="$DB_PATH"
export FRONTEND_PATH="$FRONTEND_PATH"
export LISTEN_ADDR="$LISTEN_ADDR"

# Wikipedia Offline (kiwix-serve) — opcional
# Para activar Wikipedia offline:
#   1. Descarga kiwix-serve: https://download.kiwix.org/release/kiwix-tools/kiwix-tools_linux-arm64.tar.gz
#   2. Extrae y coloca el binario en data/bin/kiwix-serve
#   3. Descarga un archivo .zim (ej. Wikipedia español):
#      wget -P data/contenido/zim/ https://download.kiwix.org/zim/wikipedia/wikipedia_es_for_schools_nopic_2024-06.zim
#   4. Inicia este script — kiwix-serve arranca automáticamente
if [ -f "${SCRIPT_DIR}/data/bin/kiwix-serve" ]; then
    echo "📖 kiwix-serve encontrado"
fi
if ls "${SCRIPT_DIR}/data/contenido/zim/"*.zim &>/dev/null 2>&1; then
    echo "   Archivos ZIM: $(ls "${SCRIPT_DIR}/data/contenido/zim/"*.zim 2>/dev/null | wc -l)"
fi

# Ejecutar servidor
echo "🚀 Iniciando servidor..."
exec "$BIN"
