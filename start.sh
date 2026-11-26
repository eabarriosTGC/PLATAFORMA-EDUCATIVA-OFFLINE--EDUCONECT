#!/bin/bash
# start.sh — EduConect Rural: arranque completo (sin Python)
# El servidor Rust incluye TTS nativo. Cero dependencias externas.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/edu-conect-rural-server"

echo "🎓 EduConect Rural — Arranque completo"
echo "============================================"

# 1. Verificar binario compilado
BIN="$PROJECT_DIR/target/release/edu-conect-rural-server"
if [ ! -x "$BIN" ]; then
    echo "🔧 Compilando servidor..."
    cd "$PROJECT_DIR"
    cargo build --release
fi

# 2. Verificar espeak-ng (TTS)
if command -v espeak-ng &>/dev/null; then
    echo "🎤 TTS: espeak-ng disponible (vía Rust, sin Python)"
else
    echo "⚠️  TTS: espeak-ng no instalado. Opcional: dnf install espeak-ng"
fi

# 3. Verificar contenido (al menos ZIMs)
if ls "$PROJECT_DIR/data/contenido/zim/"*.zim &>/dev/null 2>&1; then
    echo "📖 Wikipedia: $(ls "$PROJECT_DIR/data/contenido/zim/"*.zim 2>/dev/null | wc -l) ZIMs"
fi

# 4. Iniciar servidor
echo ""
echo "🚀 Iniciando servidor..."
cd "$PROJECT_DIR"
exec ./target/release/edu-conect-rural-server
