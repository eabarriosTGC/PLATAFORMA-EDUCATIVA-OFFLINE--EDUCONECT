#!/usr/bin/env bash
# deploy/install.sh
# Instala y habilita el servicio systemd de EduConect Rural.
# Ejecutar con sudo en la Raspberry Pi de destino.

set -euo pipefail

SERVICE_NAME="educonect.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "❌ Este script debe ejecutarse como root (sudo $0)"
  exit 1
fi

echo "📦 Copiando ${SERVICE_NAME} a /etc/systemd/system/ ..."
install -m 0644 "${SCRIPT_DIR}/${SERVICE_NAME}" "/etc/systemd/system/${SERVICE_NAME}"

echo "🔄 Recargando daemon de systemd ..."
systemctl daemon-reload

echo "✅ Habilitando e iniciando ${SERVICE_NAME} ..."
systemctl enable --now "${SERVICE_NAME}"

echo ""
echo "═══════════════════════════════════════════"
echo " Servicio EduConect instalado y en ejecución"
echo "═══════════════════════════════════════════"
echo ""
echo " Comandos útiles:"
echo "   systemctl status ${SERVICE_NAME}   # ver estado"
echo "   journalctl -u ${SERVICE_NAME} -f   # ver logs en vivo"
echo "   systemctl restart ${SERVICE_NAME}  # reiniciar"
echo "   systemctl stop ${SERVICE_NAME}     # detener"
echo ""
