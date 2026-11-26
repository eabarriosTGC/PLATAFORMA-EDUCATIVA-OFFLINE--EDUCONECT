#!/usr/bin/env bash
# download-biblioteca-manifiesto.sh — Descarga la biblioteca incluida según
# manifiesto-biblioteca.json (nombre, URL, SHA-256, tamaño, licencia, ruta).
# Uso:   download-biblioteca-manifiesto.sh /ruta/manifiesto.json /ruta/destino
# Verifica: --fail --location --retry 5, SHA-256 estricta, magic %PDF- (5 bytes).
# El manifiesto es la fuente de verdad: una URL cambiada se detecta por hash.
set -euo pipefail

MANIFIESTO="${1:?manifiesto requerido}"
DEST="${2:?destino requerido}"
UA='EduConectBundle/4B'

command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }

mkdir -p "$DEST"
TOTAL=$(jq -r 'length' "$MANIFIESTO")
i=0

while IFS=$'\t' read -r ruta sha url; do
  i=$((i+1))
  [ -n "$ruta" ] || continue
  mkdir -p "$DEST/$(dirname "$ruta")"
  echo "⟳ [$i/$TOTAL] $ruta"
  # Descarga a archivo temporal: jamás se renombra sin verificar.
  # --retry-all-errors + --continue-at: una conexión cortada se reanuda,
  # no se reinicia ni falla el build por un servidor inestable.
  curl --fail --location --retry 5 --retry-all-errors --continue-at - -sS \
    -H 'Accept-Encoding: identity' -A "$UA" \
    "$url" -o "$DEST/$ruta.download"
  # SHA-256 estricta (el archivo debe coincidir EXACTO con el manifiesto).
  echo "$sha  $DEST/$ruta.download" | sha256sum --check --strict
  # Magic %PDF-: un HTML 404 o una página de error no pasa.
  magic=$(head -c 5 "$DEST/$ruta.download")
  if [ "$magic" != "%PDF-" ]; then
    echo "  ✗ $ruta no es un PDF (magic: $magic)" >&2
    rm -f "$DEST/$ruta.download"
    exit 1
  fi
  mv "$DEST/$ruta.download" "$DEST/$ruta"
  chmod 0444 "$DEST/$ruta"
done < <(jq -r '.[] | [.ruta_final, .sha256, .url] | @tsv' "$MANIFIESTO")

echo "✅ Biblioteca empaquetada: $i/$TOTAL PDFs en $DEST"
