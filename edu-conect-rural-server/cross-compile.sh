#!/usr/bin/env bash
# cross-compile.sh — Compila binario estático para ARM (Raspberry Pi)
# Uso: ./cross-compile.sh [release|debug]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-release}"

echo "🔧 Cross-compilando edu-conect-rural-server para aarch64-unknown-linux-musl..."

# Verificar target
if ! rustup target list --installed | grep -q "aarch64-unknown-linux-musl"; then
    echo "📦 Instalando target aarch64-unknown-linux-musl..."
    rustup target add aarch64-unknown-linux-musl
fi

# Verificar toolchain cross-compilador (aarch64-linux-musl-*)
MUSL_CC="aarch64-linux-musl-gcc"
if ! command -v "$MUSL_CC" &>/dev/null; then
    echo "⚠️  No se encontró $MUSL_CC"
    echo "   Instala musl-cross-make o el toolchain de tu distribución:"
    echo "   - Fedora: dnf install musl-cross-aarch64"
    echo "   - Ubuntu: apt install musl-tools gcc-aarch64-linux-gnu"
    echo ""
    echo "   O usa Docker multi-arch:"
    echo "     docker run --rm -v \$PWD:/src -w /src messense/rust-musl-cross:aarch64-musl \\"
    echo "       cargo build --release --target aarch64-unknown-linux-musl"
    exit 1
fi

export CC_aarch64_unknown_linux_musl="$MUSL_CC"
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER="$MUSL_CC"

CARGO_ARGS="--target aarch64-unknown-linux-musl"
if [ "$MODE" = "release" ]; then
    CARGO_ARGS="$CARGO_ARGS --release"
fi

cargo build $CARGO_ARGS

echo ""
echo "✅ Compilación exitosa"
echo "   Binario: target/aarch64-unknown-linux-musl/${MODE}/edu-conect-rural-server"
echo "   Tamaño:"
ls -lh "target/aarch64-unknown-linux-musl/${MODE}/edu-conect-rural-server"
