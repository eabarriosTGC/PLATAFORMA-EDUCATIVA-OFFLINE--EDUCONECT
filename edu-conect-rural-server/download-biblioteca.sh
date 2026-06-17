#!/usr/bin/env bash
# download-biblioteca.sh — Descarga libros infantiles gratuitos para EduConect Rural
# Uso:   ./download-biblioteca.sh [colombia|internacional|todo]
# Ej:    ./download-biblioteca.sh colombia    # Solo fuentes colombianas
#        ./download-biblioteca.sh todo         # Todo

set -euo pipefail
BIB_DIR="data/biblioteca"
MODE="${1:-colombia}"

mkdir -p "$BIB_DIR"/{wayuu,cuentos,educativos,ciencias,internacional}

echo "📚 Biblioteca Digital EduConect Rural"
echo "   Modo: $MODE"
echo "   Destino: $BIB_DIR"
echo ""

# ═══════════════════════════════════════════════════════
#  COLOMBIA — Leer es mi cuento + Maguaré + ICBF
# ═══════════════════════════════════════════════════════

download_pdfs_colombia() {
  echo "🇨🇴 Descargando libros colombianos..."

  # Wayuu
  curl -sL -o "$BIB_DIR/wayuu/putunkaa-serruma.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2017/12/493_putunka-serruma.pdf"
  echo "  ✅ Putunkaa Serruma (arrullos wayúu)"

  curl -sL -o "$BIB_DIR/wayuu/narraciones-indigenas-desierto.pdf" \
    "https://www.normainfantilyjuvenil.com/co/uploads/2019/01/9789580007180.pdf"
  echo "  ✅ Narraciones indígenas del desierto"

  curl -sL -o "$BIB_DIR/wayuu/la-voz-de-los-hermanos-mayores.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2025/10/lemc_67_la-voz-de-los-hermanos-mayores-maguare-web.pdf"
  echo "  ✅ La voz de los hermanos mayores"

  # Leer es mi cuento — Maguaré
  curl -sL -o "$BIB_DIR/cuentos/la-muneca-negra.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2025/10/lemc_65_la-muneca-negra-maguare-web.pdf"
  echo "  ✅ La muñeca negra"

  # Leer es mi cuento — Colombia Aprende (13 libros)
  BASE="https://colombiaaprende.edu.co/sites/default/files/files_public/plan-lectura-2021/leer-es-mi-cuento-parte-1"
  BOOKS=(
    "1_De_viva_voz.pdf:01-de-viva-voz.pdf"
    "2_Con_Pombo_y_platillos.pdf:02-con-pombo-y-platillos.pdf"
    "3_Puro_cuento.pdf:03-puro-cuento.pdf"
    "4_Barbas_pelos_y_cenizas.pdf:04-barbas-pelos-cenizas.pdf"
    "5_Canta_palabra.pdf:05-canta-palabra.pdf"
    "6_Bosque_adentro.pdf:06-bosque-adentro.pdf"
    "7_De_animales_y_de_ninos.pdf:07-de-animales-y-de-ninos.pdf"
    "8_En_la_diestra_de_dios_padre.pdf:08-en-la-diestra-de-dios-padre.pdf"
    "9_Abretegranopequeno.pdf:09-abrete-grano-pequeno.pdf"
    "10_Elreydelostoposysuhija.pdf:10-el-rey-de-los-topos.pdf"
    "11_Lospigmeos.pdf:11-los-pigmeos.pdf"
    "12_Elpequeno_escribienteflorentino.pdf:12-el-pequeno-escribiente.pdf"
    "13_Don_Quijote_de_la_Mancha.pdf:13-don-quijote.pdf"
  )
  for pair in "${BOOKS[@]}"; do
    SRC="${pair%%:*}"
    DST="${pair##*:}"
    curl -sL -o "$BIB_DIR/cuentos/$DST" "$BASE/$SRC"
    echo "  ✅ $DST"
  done

  # ICBF / Maguaré — Diversidad cultural
  curl -sL -o "$BIB_DIR/cuentos/arrullos-jaamo.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2018/06/libro_arrullos_jaamo_multilingue.pdf"
  echo "  ✅ Los arrullos de Jáamo"

  curl -sL -o "$BIB_DIR/cuentos/tiki-tiki-tai.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2017/12/511_tiki-tiki-tai.pdf"
  echo "  ✅ Tiki, tiki, tai"

  curl -sL -o "$BIB_DIR/cuentos/una-morena-en-la-ronda.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2017/12/495_Una-Morena-en-la-Ronda.pdf"
  echo "  ✅ Una morena en la ronda"

  curl -sL -o "$BIB_DIR/cuentos/tortuguita-veni-baila.pdf" \
    "https://maguare.gov.co/wp-content/uploads/2017/12/491-tortuguita-veni-baila-antologia-musical.pdf"
  echo "  ✅ Tortuguita, vení bailá"
}

# ═══════════════════════════════════════════════════════
#  INTERNACIONAL — Wikichicos + StoryWeaver + más
# ═══════════════════════════════════════════════════════

download_pdfs_internacional() {
  echo ""
  echo "🌍 Descargando libros internacionales..."

  # Wikichicos (PDFs generados desde Wikilibros)
  WIKI_BASE="https://es.wikibooks.org/wiki/Wikichicos"
  echo "  📖 Wikichicos: $WIKI_BASE (descarga manual desde el navegador)"
  echo "     - El mundo natural, Matemáticas, Mitología, Cuentos"

  # StoryWeaver (requiere búsqueda manual por idioma)
  echo "  📖 StoryWeaver: https://storyweaver.org.in (filtrar idioma=Español)"

  # Free Kids Books — español
  echo "  📖 Free Kids Books: https://freekidsbooks.org/subject/spanish/"

  # InfoLibros
  echo "  📖 InfoLibros: https://infolibros.org/libros-pdf-gratis/infantiles/"

  # African Storybook
  echo "  📖 African Storybook: https://www.africanstorybook.org"

  # Casa de la Literatura Peruana (74 obras)
  echo "  📖 Casa Literatura Peruana: https://www.casadelaliteratura.gob.pe/obras-infantiles-juveniles-puedes-leer-gratis/"
}

# ═══════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════

case "$MODE" in
  colombia)
    download_pdfs_colombia
    ;;
  internacional)
    download_pdfs_internacional
    ;;
  todo)
    download_pdfs_colombia
    download_pdfs_internacional
    ;;
  *)
    echo "❌ Modo desconocido: $MODE"
    echo "   Usa: colombia, internacional, o todo"
    exit 1
    ;;
esac

echo ""
echo "✅ ¡Descarga completada!"
echo "   📂 $BIB_DIR/"
echo "   🌐 Servir desde: http://localhost:8080/biblioteca/"
du -sh "$BIB_DIR/"
find "$BIB_DIR" -name "*.pdf" | wc -l | xargs echo "   📄 Total PDFs:"
