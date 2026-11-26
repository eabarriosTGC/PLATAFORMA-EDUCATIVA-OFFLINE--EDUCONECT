#!/usr/bin/env bash
# deploy/install.sh — compatibilidad: delega en el instalador único.
#
# Este archivo copiaba a mano `${SCRIPT_DIR}/educonect.service`, una unidad con el
# layout viejo (`User=pi`, `ExecStart=/opt/educonect/server/…`, `DB_PATH`,
# `FRONTEND_PATH=/opt/educonect/dashboard/out`). Contradecía la estructura plana
# de §D-03.A y el `ENVIRONMENT_FILE` con secretos que hoy exige el servidor.
#
# La unidad ya no vive en un archivo suelto: la genera `install.sh` desde su
# template embebido y la instala en `SYSTEMD_DIR`. Se conserva este nombre para
# no romper atajos ni documentación previos; el destino real es el mismo
# instalador, con las mismas variables (INSTALL_DIR, DATA_DIR, ENV_FILE,
# SYSTEMD_DIR, JWT_SECRET, ADMIN_INITIAL_PASSWORD).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec bash "${SCRIPT_DIR}/../install.sh" "$@"
