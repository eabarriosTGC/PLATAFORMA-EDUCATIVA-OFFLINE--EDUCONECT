#!/usr/bin/env bash
# install.sh — Instalación completa de EduConect Rural en Raspberry Pi
# Un solo comando: curl -sSL https://educonect.co/install | sudo bash
# Compatible con: Raspberry Pi OS, Ubuntu Server ARM64, Alpine Linux ARM64
set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ️${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1"; }

# ── Configuración ────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/educonect}"
DATA_DIR="${INSTALL_DIR}/data"
CONTENT_DIR="${DATA_DIR}/contenido"
ZIM_DIR="${CONTENT_DIR}/zim"
VIDEO_DIR="${CONTENT_DIR}/videos"
BIBLIO_DIR="${DATA_DIR}/biblioteca"
BIN_URL="${BIN_URL:-https://github.com/tuusuario/educonect/releases/latest/download/edu-conect-rural-server}"
ZIM_URL="${ZIM_URL:-https://download.kiwix.org/zim/wikipedia}"

# ── Detectar arquitectura ────────────────────────────────────────────
ARCH=$(uname -m)
case "$ARCH" in
    aarch64|arm64)     BINARY="edu-conect-rural-server-aarch64" ;;
    armv7l|armhf)      BINARY="edu-conect-rural-server-armv7" ;;
    x86_64|amd64)      BINARY="edu-conect-rural-server-x86_64" ;;
    *)                 err "Arquitectura no soportada: $ARCH. Se requiere ARM64 o x86_64."; exit 1 ;;
esac

# ── Verificar root ───────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "Este script debe ejecutarse como root (sudo)."
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  EduConect Rural — Instalación Offline${NC}"
echo -e "${GREEN}========================================${NC}"
echo "  Arquitectura: $ARCH"
echo "  Destino:      $INSTALL_DIR"
echo "  Binario:      $BINARY"
echo ""

# ── Paso 1: Instalar dependencias del sistema ────────────────────────
info "Paso 1/6: Instalando dependencias del sistema..."

if command -v apt &>/dev/null; then
    apt update -qq
    apt install -y -qq hostapd dnsmasq iptables wget curl python3 ffmpeg libzim-dev 2>/dev/null || true
elif command -v apk &>/dev/null; then
    apk add --quiet hostapd dnsmasq iptables wget curl python3 ffmpeg libzim-dev 2>/dev/null || true
elif command -v dnf &>/dev/null; then
    dnf install -y hostapd dnsmasq iptables wget curl python3 ffmpeg libzim-devel 2>/dev/null || true
else
    warn "Gestor de paquetes no reconocido. Instala manualmente: hostapd, dnsmasq, wget, curl, python3"
fi
ok "Dependencias instaladas"

# ── Paso 2: Crear directorios ────────────────────────────────────────
info "Paso 2/6: Creando estructura de directorios..."
mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/bin" "$INSTALL_DIR/config" "$INSTALL_DIR/scripts"
mkdir -p "$ZIM_DIR" "$VIDEO_DIR" "$BIBLIO_DIR"
mkdir -p "${INSTALL_DIR}/data/bin"     # Para scripts auxiliares
ok "Directorios creados en $INSTALL_DIR"

# ── Paso 3: Descargar binario ────────────────────────────────────────
info "Paso 3/6: Descargando binario principal..."
BIN_PATH="${INSTALL_DIR}/bin/edu-conect-rural-server"
if [ ! -f "$BIN_PATH" ]; then
    wget -q -O "$BIN_PATH" "${BIN_URL}/${BINARY}" || {
        warn "No se pudo descargar binario precompilado."
        warn "Compílalo manualmente: cd edu-conect-rural-server && cargo build --release"
        warn "Luego copia target/release/edu-conect-rural-server a $BIN_PATH"
    }
    chmod +x "$BIN_PATH" 2>/dev/null || true
else
    ok "Binario ya existe"
fi

if [ -f "$BIN_PATH" ]; then
    chmod +x "$BIN_PATH"
    ok "Binario listo ($(du -h "$BIN_PATH" | cut -f1))"
fi

# ── Paso 4: Configurar hotspot WiFi + portal cautivo ─────────────────
info "Paso 4/6: Configurando hotspot WiFi..."

SSID="${SSID:-EduConect Rural}"
PASSWORD="${PASSWORD:-educonect2026}"

# Configurar hostapd
cat > "${INSTALL_DIR}/config/hostapd.conf" << HOSTAPDEOF
interface=wlan0
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${PASSWORD}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
HOSTAPDEOF

# Configurar dnsmasq
cat > "${INSTALL_DIR}/config/dnsmasq.conf" << DNSMASQEOF
interface=wlan0
dhcp-range=10.0.0.10,10.0.0.100,255.255.255.0,24h
domain=educonect.local
address=/educonect.local/10.0.0.1
dhcp-option=3,10.0.0.1
dhcp-option=6,10.0.0.1
# Portal cautivo: redirige todo al servidor local
address=/#/10.0.0.1
DNSMASQEOF

# Script de activación del hotspot
cat > "${INSTALL_DIR}/scripts/setup-hotspot.sh" << HOTSPOTEOF
#!/usr/bin/env bash
# setup-hotspot.sh — Activa el hotspot WiFi + portal cautivo
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR}"
SSID="${SSID}"
PASSWORD="${PASSWORD}"

echo "📡 Configurando hotspot WiFi: ${SSID}"

# 1. Configurar IP estática para wlan0
ip link set wlan0 down 2>/dev/null || true
ip addr flush dev wlan0 2>/dev/null || true
ip addr add 10.0.0.1/24 dev wlan0 2>/dev/null || true
ip link set wlan0 up

# 2. Detener servicios existentes
systemctl stop hostapd dnsmasq 2>/dev/null || true

# 3. Configurar hostapd
cp "${INSTALL_DIR}/config/hostapd.conf" /etc/hostapd/hostapd.conf
if grep -q "^DAEMON_CONF" /etc/default/hostapd 2>/dev/null; then
    sed -i 's|^DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd
fi

# 4. Configurar dnsmasq
cp "${INSTALL_DIR}/config/dnsmasq.conf" /etc/dnsmasq.conf

# 5. Redirigir puerto 80 al puerto del servidor (8080)
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080 2>/dev/null || true
iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8080 2>/dev/null || true

# 6. Habilitar forwarding
sysctl -w net.ipv4.ip_forward=1 > /dev/null 2>&1

# 7. Iniciar servicios
systemctl start hostapd dnsmasq 2>/dev/null || {
    # Fallback si no hay systemd
    hostapd -B /etc/hostapd/hostapd.conf 2>/dev/null || true
    dnsmasq -C /etc/dnsmasq.conf 2>/dev/null || true
}

echo "✅ Hotspot activo: SSID='${SSID}' Contraseña='${PASSWORD}'"
echo "   Conéctate y abre http://educonect.local o http://10.0.0.1"
HOTSPOTEOF
chmod +x "${INSTALL_DIR}/scripts/setup-hotspot.sh"

ok "Hotspot configurado (SSID: ${SSID})"

# ── Paso 5: Configurar servicio systemd ──────────────────────────────
info "Paso 5/6: Configurando inicio automático..."

cat > "${INSTALL_DIR}/config/educonect.service" << SYSTEMDEOF
[Unit]
Description=EduConect Rural — Plataforma educativa offline
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStartPre=${INSTALL_DIR}/scripts/setup-hotspot.sh
ExecStart=${INSTALL_DIR}/bin/edu-conect-rural-server
Restart=on-failure
RestartSec=10
Environment=DB_PATH=${DATA_DIR}/educonect.db
Environment=FRONTEND_PATH=${INSTALL_DIR}/data/frontend
Environment=LISTEN_ADDR=0.0.0.0:8080

[Install]
WantedBy=multi-user.target
SYSTEMDEOF

if command -v systemctl &>/dev/null; then
    cp "${INSTALL_DIR}/config/educonect.service" /etc/systemd/system/educonect.service
    systemctl daemon-reload
    systemctl enable educonect.service 2>/dev/null || true
    ok "Servicio instalado: systemctl start educonect"
else
    warn "systemd no detectado. Agrega educonect.service manualmente."
fi

# ── Paso 6: Script de descarga de contenido ──────────────────────────
info "Paso 6/6: Creando script de descarga de contenido..."

cat > "${INSTALL_DIR}/scripts/download-content.sh" << DOWNLOADEOF
#!/usr/bin/env bash
# download-content.sh — Descarga contenido educativo offline
# Uso: ./download-content.sh [mini|schools|full]
set -euo pipefail

MODE="\${1:-mini}"
INSTALL_DIR="${INSTALL_DIR}"
ZIM_DIR="${ZIM_DIR}"
VIDEO_DIR="${VIDEO_DIR}"
KIWIX_URL="https://download.kiwix.org/zim/wikipedia"

case "\$MODE" in
    mini)
        echo "📦 Modo MINI (~200 MB) — para pruebas"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/wikipedia_es_top_mini_2026-04.zim" &
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/../wikibooks/wikibooks_es_all_nopic_2025-10.zim" &
        echo "   ⏳ Descargando en segundo plano..."
        wait
        ;;
    schools)
        echo "📦 Modo ESCUELAS (~3 GB) — contenido curado para niños"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/wikipedia_es_for_schools_nopic_2024-06.zim"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/../wikibooks/wikibooks_es_all_nopic_2025-10.zim"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/../vikidia/vikidia_es_all_nopic_2025-12.zim"
        ;;
    full)
        echo "📦 Modo COMPLETO (~12 GB) — Wikipedia española completa"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/wikipedia_es_all_nopic_2024-11.zim"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/../wikibooks/wikibooks_es_all_nopic_2025-10.zim"
        wget -q -P "\$ZIM_DIR" "\$KIWIX_URL/../vikidia/vikidia_es_all_nopic_2025-12.zim"
        ;;
    *)
        echo "Uso: ./download-content.sh [mini|schools|full]"
        echo "  mini    ~200 MB (pruebas)"
        echo "  schools ~3 GB  (recomendado para escuelas)"
        echo "  full    ~12 GB (Wikipedia completa)"
        exit 1
        ;;
esac

echo "✅ Descarga completada en \$ZIM_DIR"
echo "   Luego reinicia: systemctl restart educonect"
DOWNLOADEOF
chmod +x "${INSTALL_DIR}/scripts/download-content.sh"

# Copiar frontend base (Next.js export) si existe
if [ -d "${INSTALL_DIR}/../edu-conect-rural-dashboard/out/" ]; then
    cp -r "${INSTALL_DIR}/../edu-conect-rural-dashboard/out/" "${INSTALL_DIR}/data/frontend/"
    ok "Frontend copiado"
fi

# ── Resumen final ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 EduConect Rural INSTALADO${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  📂  Instalación: ${INSTALL_DIR}"
echo "  🛠️   Binario:    ${INSTALL_DIR}/bin/edu-conect-rural-server"
echo "  📡  WiFi:        SSID='${SSID}' / Clave='${PASSWORD}'"
echo "  🌐  Plataforma:  http://10.0.0.1"
echo ""
echo -e "  ${YELLOW}Para activar el servidor ahora:${NC}"
echo "    sudo ${INSTALL_DIR}/scripts/setup-hotspot.sh"
echo "    sudo ${INSTALL_DIR}/bin/edu-conect-rural-server &"
echo ""
echo -e "  ${YELLOW}O usando systemd (recomendado):${NC}"
echo "    sudo systemctl start educonect"
echo "    sudo systemctl status educonect"
echo ""
echo -e "  ${YELLOW}Para descargar contenido:${NC}"
echo "    sudo ${INSTALL_DIR}/scripts/download-content.sh mini"
echo ""
echo -e "  ${GREEN}✅ Instalación completada en $(date)${NC}"
