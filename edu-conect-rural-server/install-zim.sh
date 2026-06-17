#!/usr/bin/env bash
# install-zim.sh — Descarga e instala Wikipedia offline para EduConect Rural
# Uso:   ./install-zim.sh [categoria] [idioma]
#        ./install-zim.sh schools es        # Wikipedia escuelas español (3 GB)
#        ./install-zim.sh mini es           # ZIM pequeño para pruebas (~30 MB)
#        ./install-zim.sh list              # Lista ZIMs disponibles
set -euo pipefail

BASE_URL="https://download.kiwix.org/zim/wikipedia"
ZIM_DIR="data/contenido/zim"
LANG="${2:-es}"
CATEGORY="${1:-schools}"

mkdir -p "$ZIM_DIR"

show_list() {
    echo "Categorías disponibles:"
    echo "  mini          ZIM de pruebas pequeño (~5-30 MB)"
    echo "  schools       Wikipedia para escuelas (sin imágenes)"
    echo "  nopic         Wikipedia completa (sin imágenes)"
    echo "  full          Wikipedia completa (con imágenes)"
    echo ""
    echo "Idiomas comunes: es (español), en (inglés), fr, pt, etc."
    exit 0
}

case "$CATEGORY" in
    list|--list|-l)
        show_list
        ;;
    mini)
        # ZIM diminuto de Wikilibros para pruebas rápidas
        FILE="wikibooks_${LANG}_all_nopic_2024-11.zim"
        ;;
    schools)
        FILE="wikipedia_${LANG}_for_schools_nopic_2024-06.zim"
        ;;
    nopic)
        FILE="wikipedia_${LANG}_nopic_2024-11.zim"
        ;;
    full)
        FILE="wikipedia_${LANG}_all_2024-11.zim"
        ;;
    *)
        echo "❌ Categoría desconocida: $CATEGORY"
        echo "   Usa: ./install-zim.sh list"
        exit 1
        ;;
esac

URL="${BASE_URL}/${FILE}"
DEST="${ZIM_DIR}/${FILE}"

echo "=============================================="
echo "  EduConect Rural — Instalador Wikipedia"
echo "=============================================="
echo "  Archivo:  $FILE"
echo "  Destino:  $DEST"
echo "  Servidor: $URL"
echo "=============================================="
echo ""

# Verificar espacio
if [ -f "$DEST" ]; then
    echo "✅ Ya existe: $DEST ($(du -h "$DEST" | cut -f1))"
    echo "   Para reinstalar, bórralo primero: rm $DEST"
    exit 0
fi

# Calcular espacio necesario (estimado)
if command -v curl &>/dev/null; then
    DL_CMD="curl -L -o"
    echo "📥 Descargando con curl..."
    $DL_CMD "$DEST" "$URL"
elif command -v wget &>/dev/null; then
    DL_CMD="wget -O"
    echo "📥 Descargando con wget..."
    $DL_CMD "$DEST" "$URL"
else
    echo "❌ Necesitas curl o wget instalado."
    exit 1
fi

echo ""
if [ -f "$DEST" ]; then
    echo "✅ Descarga completa:"
    echo "   $(du -h "$DEST" | cut -f1) en $DEST"
    echo ""
    echo "Reinicia el servidor para que detecte el ZIM:"
    echo "   sudo systemctl restart educonect"
    echo ""
    echo "O si lo corres manualmente:"
    echo "   ./start.sh"
else
    echo "❌ Error: el archivo no se descargó."
    exit 1
fi
