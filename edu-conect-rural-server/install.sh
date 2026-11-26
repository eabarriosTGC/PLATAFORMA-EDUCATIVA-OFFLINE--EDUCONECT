#!/usr/bin/env bash
# install.sh — Instalación completa de EduConect Rural (Raspberry Pi, PC Linux)
#
# Dos formas de invocación, las dos soportadas y probadas
# (`edu-conect-rural-server/tests/instalador.sh`):
#
#   1. clonar el repositorio:   sudo bash edu-conect-rural-server/install.sh
#   2. por tubería:             curl -sSL https://educonect.co/install | sudo bash
#
# La unidad systemd viaja **dentro de este script** (heredoc), no en un archivo
# vecino: por tubería no hay vecindad, y depender de `deploy/educonect.service`
# en disco rompía la forma 2 a mitad de la instalación (B1 de la verificación de
# D-03). El template toma `DATA_DIR` como marcador porque debe recibir la ruta
# **resuelta a absoluta**, igual que hace `config::cargar`; con una ruta relativa
# `ReadWritePaths` no apuntaría a los datos reales (B2).
#
# `--print-unit` imprime el template sin instalar nada. `deploy/educonect.service`
# es la copia versionada de esa misma salida: `tests/instalador.sh` exige que
# ambas sean idénticas, así no se desincronizan.
set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ️${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1"; }

# ── Template de la unidad systemd (única fuente de verdad) ───────────
# Marcadores: @APP_ROOT@, @BINARIO@, @DATA_DIR@, @ENV_FILE@. Los sustituye
# `renderizar_unidad` con rutas **absolutas**.
unidad_systemd() {
    cat <<'UNITEOF'
[Unit]
Description=EduConect Rural — plataforma educativa offline
Documentation=https://github.com/educonect/educonect
After=network.target
Wants=network.target

[Service]
Type=simple
# Cuenta sin privilegios: `APP_ROOT` es de solo lectura (R-01) y los datos viven
# en `DATA_DIR`, que es el único directorio con escritura.
User=educonect
Group=educonect

# Estructura plana de §D-03.A: el ejecutable está en la RAÍZ de la aplicación,
# junto a `modulos/`, `static/`, `frontend/` y `contenido/`. `APP_ROOT` se deriva
# del ejecutable (`current_exe`), no del directorio de trabajo: por eso
# `WorkingDirectory` no interviene en la resolución de recursos y puede cambiarse
# sin romper `/modulos/*`.
WorkingDirectory=@APP_ROOT@
ExecStart=@BINARIO@

# `DATA_DIR` fuera del paquete: reemplazar la aplicación no toca la base ni el
# contenido generado. Respaldar es copiar un solo directorio.
# En un PC sin privilegios, el mismo binario usa `$XDG_DATA_HOME/educonect`;
# aquí, como servicio, declaramos la ruta explícita. @DATA_DIR@ ya viene
# resuelta a absoluta: una ruta relativa dependería del CWD del servicio.
Environment=DATA_DIR=@DATA_DIR@
Environment=LISTEN_ADDR=0.0.0.0:8080

# Secretos fuera de la unidad y fuera del repositorio (`chmod 600`).
# Formato: JWT_SECRET=... y ADMIN_INITIAL_PASSWORD=...
EnvironmentFile=@ENV_FILE@

Restart=on-failure
RestartSec=5

# Endurecimiento coherente con R-01: el paquete no se escribe en ejecución.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
# Sigue al `DATA_DIR` resuelto por el instalador: con `ProtectSystem=strict`, un
# valor fijo aquí dejaría el directorio real de datos en solo lectura.
ReadWritePaths=@DATA_DIR@

[Install]
WantedBy=multi-user.target
UNITEOF
}

# ── Ayuda / generación del template versionado ───────────────────────
case "${1:-}" in
    --print-unit)
        unidad_systemd
        exit 0
        ;;
    --help|-h)
        echo "Uso: sudo bash install.sh [--print-unit]"
        echo "  (sin argumentos)  instala EduConect Rural en este equipo"
        echo "  --print-unit      imprime el template systemd sin instalar nada"
        echo ""
        echo "Variables: INSTALL_DIR (def. /opt/educonect), DATA_DIR (def. /var/lib/educonect),"
        echo "           ENV_FILE (def. /etc/educonect/educonect.env), SYSTEMD_DIR (def. /etc/systemd/system),"
        echo "           JWT_SECRET, ADMIN_INITIAL_PASSWORD, SSID, PASSWORD, BIN_URL"
        exit 0
        ;;
    "") ;;
    *)
        err "Argumento no reconocido: $1 (ver --help)"
        exit 2
        ;;
esac

# ── Configuración ────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/educonect}"
# Directorio del script, si existe. Por tubería `BASH_SOURCE` no está definido
# (`set -u` abortaría): el CWD solo sirve para el frontend opcional, nunca para
# localizar la unidad.
if [ -n "${BASH_SOURCE[0]:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
    SCRIPT_DIR="$(pwd)"
fi
# DATA_DIR fuera de INSTALL_DIR: actualizar la aplicación no puede tocar los datos
# (R-01). Como servicio Linux, la raíz por defecto es /var/lib/educonect. Una ruta
# relativa se absolutiza en el paso 2, contra el CWD del instalador.
DATA_DIR="${DATA_DIR:-/var/lib/educonect}"
ENV_FILE="${ENV_FILE:-/etc/educonect/educonect.env}"
# Destino de la unidad instalada. Configurable para empaquetado y para entornos
# sin systemd en esa ruta (la prueba del instalador lo apunta a un temporal).
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
BIN_URL="${BIN_URL:-https://github.com/tuusuario/educonect/releases/latest/download/edu-conect-rural-server}"
ZIM_URL="${ZIM_URL:-https://download.kiwix.org/zim/wikipedia}"

# Sustituye los marcadores del template por rutas absolutas.
renderizar_unidad() {
    sed \
        -e "s|@APP_ROOT@|${INSTALL_DIR}|g" \
        -e "s|@BINARIO@|${BIN_PATH}|g" \
        -e "s|@DATA_DIR@|${DATA_DIR}|g" \
        -e "s|@ENV_FILE@|${ENV_FILE}|g"
}

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
# Raíz de aplicación: recursos de solo lectura, junto al ejecutable.
mkdir -p "$INSTALL_DIR"
# La unidad no puede llevar una ruta relativa: el servicio arranca con otro CWD.
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd -P)"
FRONTEND_DIR="${INSTALL_DIR}/frontend"
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/scripts"
mkdir -p "$INSTALL_DIR/modulos" "$INSTALL_DIR/static" "$FRONTEND_DIR"
# Raíz de datos: lo único que el servicio escribe, y lo único que se respalda.
# Mismo criterio que `config::cargar`: una DATA_DIR relativa se resuelve a
# absoluta, aquí contra el CWD del instalador.
mkdir -p "$DATA_DIR"
DATA_DIR="$(cd "$DATA_DIR" && pwd -P)"
CONTENT_DIR="${DATA_DIR}/contenido"
ZIM_DIR="${CONTENT_DIR}/zim"
VIDEO_DIR="${DATA_DIR}/videos"
BIBLIO_DIR="${DATA_DIR}/biblioteca"
mkdir -p "$ZIM_DIR" "$VIDEO_DIR" "$BIBLIO_DIR"

# El servicio no corre como root: APP_ROOT es de solo lectura y solo DATA_DIR
# necesita escritura.
if ! id educonect &>/dev/null; then
    useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin educonect 2>/dev/null \
        || warn "No se pudo crear el usuario educonect; la unidad lo necesita."
fi
chown -R educonect:educonect "$DATA_DIR"
ok "Directorios creados: APP_ROOT=$INSTALL_DIR DATA_DIR=$DATA_DIR"

# ── Paso 3: Descargar binario ────────────────────────────────────────
info "Paso 3/6: Descargando binario principal..."
# Plano: el ejecutable en la raíz de la aplicación (§D-03.A).
BIN_PATH="${INSTALL_DIR}/edu-conect-rural-server"
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

# Un solo template, y viaja dentro de este script (`unidad_systemd`): funciona
# igual por clonación y por tubería. Aquí solo se sustituyen las rutas absolutas
# de esta instalación.
mkdir -p "$(dirname "$ENV_FILE")"
chmod 750 "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << ENVEOF
# EduConect Rural — entorno del servicio. chmod 600: contiene secretos.
DATA_DIR=${DATA_DIR}
LISTEN_ADDR=0.0.0.0:8080
ENVEOF
    ok "Entorno del servicio creado: $ENV_FILE"
fi

# Los secretos se provisionan aquí si el operador los pasó al instalador. Las
# validaciones del servidor NO se relajan: mínimo 12 caracteres en la contraseña
# y 32 en el secreto, con rechazo de los valores conocidos.
if [ -n "${JWT_SECRET:-}" ] && [ -n "${ADMIN_INITIAL_PASSWORD:-}" ]; then
    printf 'JWT_SECRET=%s\nADMIN_INITIAL_PASSWORD=%s\n' \
        "$JWT_SECRET" "$ADMIN_INITIAL_PASSWORD" >> "$ENV_FILE"
    ok "Secretos escritos en $ENV_FILE"
else
    warn "Faltan JWT_SECRET y/o ADMIN_INITIAL_PASSWORD en $ENV_FILE."
    warn "El servicio NO arrancará hasta agregarlos:"
    warn "  openssl rand -base64 48   # JWT_SECRET (mínimo 32 caracteres)"
    warn "  openssl rand -base64 24   # ADMIN_INITIAL_PASSWORD (mínimo 12)"
    warn "Verificá luego con: ${BIN_PATH} --check"
fi
chmod 600 "$ENV_FILE"
chown -R root:educonect "$(dirname "$ENV_FILE")" 2>/dev/null || true

unidad_systemd | renderizar_unidad > "${INSTALL_DIR}/config/educonect.service"
# Un marcador sin sustituir produciría una unidad que systemd rechaza o, peor,
# que apunta a un directorio literal `@DATA_DIR@`.
if grep -q '@[A-Z_]*@' "${INSTALL_DIR}/config/educonect.service"; then
    err "La unidad generada conserva marcadores sin sustituir:"
    grep -n '@[A-Z_]*@' "${INSTALL_DIR}/config/educonect.service" || true
    exit 1
fi
ok "Unidad generada (APP_ROOT=${INSTALL_DIR} DATA_DIR=${DATA_DIR})"

if command -v systemctl &>/dev/null; then
    mkdir -p "$SYSTEMD_DIR"
    cp "${INSTALL_DIR}/config/educonect.service" "${SYSTEMD_DIR}/educonect.service"
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

# Copiar frontend base (Next.js export) si existe. En el paquete vive en
# `APP_ROOT/frontend`, que es el valor por defecto de FRONTEND_PATH (D-03).
if [ -d "${SCRIPT_DIR}/../edu-conect-rural-dashboard/out/" ]; then
    cp -r "${SCRIPT_DIR}/../edu-conect-rural-dashboard/out/." "${FRONTEND_DIR}/"
    ok "Frontend copiado a ${FRONTEND_DIR}"
fi

# ── Resumen final ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 EduConect Rural INSTALADO${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  📂  Instalación: ${INSTALL_DIR}  (APP_ROOT, solo lectura)"
echo "  💾  Datos:       ${DATA_DIR}  (escribible, es lo único a respaldar)"
echo "  🛠️   Binario:    ${BIN_PATH}"
echo "  🔐  Entorno:    ${ENV_FILE}  (secretos, chmod 600)"
echo "  📡  WiFi:        SSID='${SSID}' / Clave='${PASSWORD}'"
echo "  🌐  Plataforma:  http://10.0.0.1"
echo ""
echo -e "  ${YELLOW}Para activar el servidor ahora:${NC}"
echo "    sudo systemctl start educonect"
echo "    sudo systemctl status educonect"
echo ""
echo -e "  ${YELLOW}Hotspot WiFi (opcional, ya no es la vía principal):${NC}"
echo "    sudo ${INSTALL_DIR}/scripts/setup-hotspot.sh"
echo ""
echo -e "  ${YELLOW}Para descargar contenido:${NC}"
echo "    sudo ${INSTALL_DIR}/scripts/download-content.sh mini"
echo ""
echo -e "  ${GREEN}✅ Instalación completada en $(date)${NC}"
