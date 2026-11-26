#!/usr/bin/env bash
# start.sh — Arranque del servidor EduConect Rural sin systemd
# Copiar al mismo directorio que el binario compilado (raíz de APP_ROOT, §D-03.A).
#
# Layout plano: el ejecutable, `modulos/`, `static/` y `frontend/` viven en este
# directorio. Los datos van aparte, en `DATA_DIR`: actualizar la aplicación no
# puede tocar la base (R-01).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BIN="${SCRIPT_DIR}/edu-conect-rural-server"
# D-03: la base vive en `DATA_DIR`. `DB_PATH` ya no se usa: el servidor no la lee
# y exportarla solo daba la falsa impresión de cambiar la ubicación de los datos.
# El valor por defecto reproduce el layout de desarrollo (`<APP_ROOT>/data`); en
# una instalación real el servicio fija `/var/lib/educonect` o `%LOCALAPPDATA%`.
DATA_DIR="${DATA_DIR:-${SCRIPT_DIR}/data}"
LISTEN_ADDR="${LISTEN_ADDR:-0.0.0.0:8080}"

echo "========================================"
echo "  EduConect Rural — Servidor Offline"
echo "========================================"
echo "  Escucha:    $LISTEN_ADDR"
echo "  Datos:      $DATA_DIR"
echo "  Frontend:   ${FRONTEND_PATH:-${SCRIPT_DIR}/frontend}  (default: APP_ROOT/frontend)"
echo "========================================"

# Crear el directorio de datos si no existe
mkdir -p "$DATA_DIR"

# Verificar binario
if [ ! -x "$BIN" ]; then
    echo "❌ Binario no encontrado: $BIN"
    echo "   Ejecuta 'cargo build --release' primero."
    exit 1
fi

# Exportar variables
export DATA_DIR LISTEN_ADDR
# `FRONTEND_PATH` solo se exporta si el operador la fijó: su default ya es
# `<APP_ROOT>/frontend` dentro del binario y no depende del CWD.
if [ -n "${FRONTEND_PATH:-}" ]; then
    export FRONTEND_PATH
fi

# Wikipedia Offline (kiwix-serve) — opcional
# Para activar Wikipedia offline:
#   1. Descarga kiwix-serve: https://download.kiwix.org/release/kiwix-tools/kiwix-tools_linux-arm64.tar.gz
#   2. Extrae y coloca el binario en <DATA_DIR>/bin/kiwix-serve
#   3. Descarga un archivo .zim (ej. Wikipedia español):
#      wget -P <DATA_DIR>/contenido/zim/ https://download.kiwix.org/zim/wikipedia/wikipedia_es_for_schools_nopic_2024-06.zim
#   4. Inicia este script — kiwix-serve arranca automáticamente
if [ -f "${DATA_DIR}/bin/kiwix-serve" ]; then
    echo "📖 kiwix-serve encontrado"
fi
if ls "${DATA_DIR}/contenido/zim/"*.zim &>/dev/null 2>&1; then
    echo "   Archivos ZIM: $(ls "${DATA_DIR}/contenido/zim/"*.zim 2>/dev/null | wc -l)"
fi

# Ejecutar servidor
echo "🚀 Iniciando servidor..."
exec "$BIN"
