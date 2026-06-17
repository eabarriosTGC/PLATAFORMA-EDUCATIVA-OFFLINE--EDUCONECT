#!/usr/bin/env bash
# pregenerar-audios.sh — Genera TODOS los audios TTS por adelantado
# Elimina la dependencia de Python. Los WAV se sirven como estáticos.
set -euo pipefail

AUDIO_DIR="${1:-data/audio}"
mkdir -p "$AUDIO_DIR"

# Voz: femenina española con mbrola
VOICE="es-es+mbrola-3"
RATE=155
PITCH=40

# ── Frases de módulos educativos ─────────────────────────────────────
declare -a FRASES=(
  # Ciencias 303 — Plantas del desierto
  "Cardón, yotojoro. El cardón es un cactus gigante del desierto guajiro."
  "Trupillo, aipia. El trupillo o algarrobo da vainas dulces que alimentan al pueblo wayuu."
  "Dividivi, kouula. El dividivi es un árbol torcido por el viento que sirve para curtir cueros."
  "Sábila, jaliasü. La sábila es una planta medicinal que cura heridas y quemaduras."
  "Paico, pashü. El paico es una hierba medicinal usada para el dolor de estómago."
  # Wayuunaiki
  "Jamaya. ¿Cómo estás en wayuunaiki?"
  "A'yatawaa. Gracias en wayuunaiki."
  "Wayuu. Pueblo indígena de La Guajira."
  # Matemáticas
  "Uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez."
  "Vamos a contar con los chivos de la comunidad wayuu."
  # Generales
  "Bienvenidos a EduConect Rural. Plataforma educativa offline."
  "Haz clic en el botón para escuchar la pronunciación."
  "¡Correcto! Muy bien."
  "Intenta de nuevo. Tú puedes."
  "Sigue así, vas muy bien."
)

echo "🎤 Pregenerando audios TTS..."
echo "   Voz: $VOICE (Velocidad: $RATE, Tono: $PITCH)"
echo "   Destino: $AUDIO_DIR"
echo ""

total=${#FRASES[@]}
count=0

for frase in "${FRASES[@]}"; do
  # Generar nombre de archivo a partir de la frase (primeras palabras)
  slug=$(echo "$frase" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | cut -c1-60)
  filename="${AUDIO_DIR}/${slug}.wav"

  if [ -f "$filename" ]; then
    echo "   [${count}/${total}] ⏭️  Ya existe: ${slug}.wav"
  else
    echo -n "   [${count}/${total}] 🔊 Generando: ${slug}.wav... "
    if espeak-ng -v "$VOICE" -s "$RATE" -p "$PITCH" -w "$filename" -- "$frase" 2>/dev/null; then
      size=$(stat -c%s "$filename" 2>/dev/null || stat -f%z "$filename" 2>/dev/null)
      echo "✅ ${size} bytes"
    else
      echo "❌ Falló"
    fi
  fi
  ((count++))
done

echo ""
echo "✅ Audios pregenerados: ${count} archivos en $AUDIO_DIR"
echo "   Tamaño total: $(du -sh "$AUDIO_DIR" | cut -f1)"
echo ""
echo "📝 Para servir estos audios desde Rust, están en /api/tts?text=..."
echo "   O puedes servirlos como estáticos agregando:"
echo "   .nest_service(\"/audio\", ServeDir::new(\"$AUDIO_DIR\"))"
echo ""
echo "💡 Los módulos usan speechSynthesis del navegador (nativo)."
echo "   Este script solo precarga frases comunes para respaldo offline."
