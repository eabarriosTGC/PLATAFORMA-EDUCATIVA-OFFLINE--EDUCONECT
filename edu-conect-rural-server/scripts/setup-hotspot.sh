#!/usr/bin/env bash
# setup-hotspot.sh — Activa el hotspot WiFi + portal cautivo
# EduConect Rural — Plataforma educativa offline para Raspberry Pi
#
# IDEMPOTENTE: se puede ejecutar múltiples veces sin causar problemas.
# Uso: sudo ./setup-hotspot.sh
#
# Variables de entorno:
#   SSID       (default: "EduConect Rural")
#   PASSWORD   (default: "educonect2026")
#   INSTALL_DIR (default: /opt/educonect)
#   CHANNEL    (default: 6)
#
# Funcionamiento:
#   1. Configura IP estática 10.0.0.1 en wlan0
#   2. Configura reglas iptables para redirigir puerto 80 → 8080
#   3. Habilita IP forwarding
#   4. Copia configs a /etc/ y lanza hostapd + dnsmasq
#   5. Verifica que los servicios estén funcionando correctamente

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/educonect}"
SSID="${SSID:-EduConect Rural}"
PASSWORD="${PASSWORD:-educonect2026}"
CHANNEL="${CHANNEL:-6}"
INTERFACE="${INTERFACE:-wlan0}"
GATEWAY="${GATEWAY:-10.0.0.1}"
SUBNET="${SUBNET:-24}"
SERVER_PORT="${SERVER_PORT:-8080}"

# ── Colores y logging ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ️${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1"; }
step()  { echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

# ── Verificaciones previas ───────────────────────────────────────────
step "Verificando requisitos"

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
    err "Este script debe ejecutarse como root (sudo)."
    exit 1
fi

# Verificar comandos necesarios
REQUIRED_CMDS=("ip" "iptables" "sysctl" "hostapd" "dnsmasq" "cp" "pgrep")
MISSING=()
for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v "$cmd" &>/dev/null; then
        MISSING+=("$cmd")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    err "Faltan comandos requeridos: ${MISSING[*]}"
    warn "Instálalos con: sudo apt install -y hostapd dnsmasq iptables"
    exit 1
fi
ok "Todos los comandos requeridos están disponibles"

# Verificar que la interfaz wlan0 existe
if ! ip link show "$INTERFACE" &>/dev/null; then
    err "La interfaz $INTERFACE no existe. Verifica tu hardware WiFi."
    warn "Interfaces disponibles:"
    ip link show | grep -E "^[0-9]+:" | awk -F': ' '{print "  - " $2}' | awk '{print $1}'
    exit 1
fi
ok "Interfaz $INTERFACE detectada"

# Verificar archivos de configuración
CONFIG_HOSTAPD="${INSTALL_DIR}/config/hostapd.conf"
CONFIG_DNSMASQ="${INSTALL_DIR}/config/dnsmasq.conf"
if [ ! -f "$CONFIG_HOSTAPD" ]; then
    err "No se encuentra $CONFIG_HOSTAPD"
    exit 1
fi
if [ ! -f "$CONFIG_DNSMASQ" ]; then
    err "No se encuentra $CONFIG_DNSMASQ"
    exit 1
fi
ok "Archivos de configuración encontrados"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Configurando hotspot WiFi${NC}"
echo -e "${GREEN}  SSID:      ${SSID}${NC}"
echo -e "${GREEN}  Red:       ${GATEWAY}/${SUBNET}${NC}"
echo -e "${GREEN}  Canal:     ${CHANNEL} (2.4GHz)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ── Paso 1: Configurar IP estática ───────────────────────────────────
step "1/6: Configurando IP estática en $INTERFACE"

# Bajar interfaz, limpiar IPs anteriores, asignar nueva IP, subir
ip link set "$INTERFACE" down 2>/dev/null || true
ip addr flush dev "$INTERFACE" 2>/dev/null || true
sleep 1

# Asignar IP estática
ip addr add "${GATEWAY}/${SUBNET}" dev "$INTERFACE" 2>/dev/null || {
    warn "La IP ${GATEWAY} ya estaba asignada (comportamiento esperado en ejecución idempotente)"
}

# Activar la interfaz
ip link set "$INTERFACE" up
ok "IP ${GATEWAY}/${SUBNET} asignada a $INTERFACE"

# ── Paso 2: Configurar hostapd ───────────────────────────────────────
step "2/6: Configurando hostapd"

# Detener servicio existente para evitar conflictos
systemctl stop hostapd 2>/dev/null || true
pkill -f "hostapd" 2>/dev/null || true
sleep 1

# Copiar configuración reemplazando variables
cp "$CONFIG_HOSTAPD" /etc/hostapd/hostapd.conf

# Reemplazar variables de shell en el archivo de configuración
sed -i "s/\${SSID:-EduConect Rural}/$SSID/g" /etc/hostapd/hostapd.conf
sed -i "s/\${PASSWORD:-educonect2026}/$PASSWORD/g" /etc/hostapd/hostapd.conf
sed -i "s/^channel=.*/channel=${CHANNEL}/" /etc/hostapd/hostapd.conf

# Configurar hostapd para usar nuestro archivo
if [ -f /etc/default/hostapd ]; then
    sed -i 's|^#DAEMON_CONF=|DAEMON_CONF=|' /etc/default/hostapd 2>/dev/null || true
    if grep -q "^DAEMON_CONF=" /etc/default/hostapd; then
        sed -i "s|^DAEMON_CONF=.*|DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"|" /etc/default/hostapd
    else
        echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
    fi
fi

# También en el archivo de hostapd de Ubuntu/Debian
if [ -f /etc/init.d/hostapd ]; then
    sed -i 's|^DAEMON_CONF=|#DAEMON_CONF=|' /etc/init.d/hostapd 2>/dev/null || true
fi

ok "hostapd configurado"

# ── Paso 3: Configurar dnsmasq ───────────────────────────────────────
step "3/6: Configurando dnsmasq"

systemctl stop dnsmasq 2>/dev/null || true
pkill -f "dnsmasq" 2>/dev/null || true
sleep 1

cp "$CONFIG_DNSMASQ" /etc/dnsmasq.conf

ok "dnsmasq configurado"

# ── Paso 4: Redirección de puertos (portal cautivo) ──────────────────
step "4/6: Configurando iptables para portal cautivo"

# Limpiar reglas previas de EduConect para ser idempotentes
iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null || true
iptables -t nat -D PREROUTING -p tcp --dport 443 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null || true

# Redirigir puerto 80 (HTTP) al puerto del servidor Axum (8080)
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT"

# Redirigir puerto 443 (HTTPS) al servidor por si acaso
iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port "$SERVER_PORT"

ok "Puerto 80 → ${SERVER_PORT} redirigido (portal cautivo activo)"

# ── Paso 5: Habilitar IP forwarding ──────────────────────────────────
step "5/6: Habilitando IP forwarding"

# Habilitar forwarding para que los paquetes fluyan entre interfaces
sysctl -w net.ipv4.ip_forward=1 > /dev/null 2>&1

# Hacerlo persistente
if [ -f /etc/sysctl.conf ]; then
    if grep -q "^net.ipv4.ip_forward" /etc/sysctl.conf; then
        sed -i 's/^net.ipv4.ip_forward=.*/net.ipv4.ip_forward=1/' /etc/sysctl.conf
    else
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    fi
fi

ok "IP forwarding habilitado"

# ── Paso 6: Iniciar servicios ────────────────────────────────────────
step "6/6: Iniciando servicios"

# Iniciar hostapd
info "Iniciando hostapd..."
if systemctl list-units --type=service --all 2>/dev/null | grep -q hostapd; then
    systemctl start hostapd 2>/dev/null || {
        warn "systemctl hostapd falló, intentando ejecución directa..."
        hostapd -B /etc/hostapd/hostapd.conf 2>/dev/null || true
    }
else
    hostapd -B /etc/hostapd/hostapd.conf 2>/dev/null || true
fi

# Iniciar dnsmasq
info "Iniciando dnsmasq..."
if systemctl list-units --type=service --all 2>/dev/null | grep -q dnsmasq; then
    systemctl start dnsmasq 2>/dev/null || {
        warn "systemctl dnsmasq falló, intentando ejecución directa..."
        dnsmasq -C /etc/dnsmasq.conf 2>/dev/null || true
    }
else
    dnsmasq -C /etc/dnsmasq.conf 2>/dev/null || true
fi

sleep 2

# ── Verificación final ───────────────────────────────────────────────
step "Verificando servicios"

ERRORS=0

# Verificar hostapd
if pgrep -x "hostapd" &>/dev/null; then
    ok "hostapd está corriendo"
else
    err "hostapd NO está corriendo"
    warn "Revisa los logs: journalctl -u hostapd -n 20 (systemd) o /var/log/syslog"
    ERRORS=$((ERRORS + 1))
fi

# Verificar dnsmasq
if pgrep -x "dnsmasq" &>/dev/null; then
    ok "dnsmasq está corriendo"
else
    err "dnsmasq NO está corriendo"
    warn "Revisa los logs: journalctl -u dnsmasq -n 20 (systemd) o /var/log/syslog"
    ERRORS=$((ERRORS + 1))
fi

# Verificar IP
IP_OK=$(ip addr show "$INTERFACE" 2>/dev/null | grep -c "${GATEWAY}/" || true)
if [ "$IP_OK" -ge 1 ]; then
    ok "IP ${GATEWAY}/${SUBNET} verificada en $INTERFACE"
else
    err "La IP ${GATEWAY} no está configurada en $INTERFACE"
    ERRORS=$((ERRORS + 1))
fi

# Verificar regla iptables
if iptables -t nat -L PREROUTING -n 2>/dev/null | grep -q "${SERVER_PORT}"; then
    ok "Regla iptables NAT activa (80 → ${SERVER_PORT})"
else
    warn "Regla iptables NAT no encontrada (puede que ya esté activa)"
fi

# Mostrar estado de la interfaz
echo ""
info "Estado de la interfaz $INTERFACE:"
ip -4 addr show "$INTERFACE" 2>/dev/null | grep -oP 'inet \K[\d.]+(/[\d]+)?' || warn "No se pudo leer la IP"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Hotspot WiFi ACTIVO correctamente      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  📡  SSID:       ${SSID}"
    echo -e "  🔑  Contraseña: ${YELLOW}${PASSWORD}${NC}"
    echo "  🌐  Portal:     http://${GATEWAY}"
    echo "  🌐  Portal:     http://educonect.local"
    echo ""
    echo -e "  ${YELLOW}Para verificar el estado:${NC}"
    echo "    ${INSTALL_DIR}/scripts/check-hotspot.sh"
    echo ""
    echo -e "  ${YELLOW}Para desactivar el hotspot:${NC}"
    echo "    ${INSTALL_DIR}/scripts/teardown-hotspot.sh"
    echo ""
else
    echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ❌ Hotspot con ${ERRORS} error(es)         ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    warn "Revisa los logs del sistema para más detalles:"
    echo "  journalctl -u hostapd -n 30 --no-pager"
    echo "  journalctl -u dnsmasq -n 30 --no-pager"
    exit 1
fi
