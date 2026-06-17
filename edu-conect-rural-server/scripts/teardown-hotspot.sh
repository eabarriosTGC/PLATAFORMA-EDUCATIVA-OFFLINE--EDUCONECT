#!/usr/bin/env bash
# teardown-hotspot.sh — Desactiva el hotspot WiFi + portal cautivo
# EduConect Rural — Plataforma educativa offline para Raspberry Pi
#
# Uso: sudo ./teardown-hotspot.sh
# Restaura la configuración de red y detiene los servicios.
# Es IDEMPOTENTE: se puede ejecutar múltiples veces sin errores.

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────
INTERFACE="${INTERFACE:-wlan0}"
GATEWAY="${GATEWAY:-10.0.0.1}"
SERVER_PORT="${SERVER_PORT:-8080}"

# ── Colores y logging ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ️${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
err()   { echo -e "${RED}❌${NC} $1"; }
step()  { echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

# ── Verificar root ───────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    err "Este script debe ejecutarse como root (sudo)."
    exit 1
fi

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Desactivando hotspot WiFi + portal cautivo║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Paso 1: Detener servicios ───────────────────────────────────────
step "1/4: Deteniendo servicios"

# Detener hostapd por systemd
if systemctl is-active --quiet hostapd 2>/dev/null; then
    systemctl stop hostapd
    ok "hostapd detenido (systemd)"
else
    info "hostapd no estaba activo en systemd"
fi

# Detener hostapd por proceso directo
if pgrep -x "hostapd" &>/dev/null; then
    pkill -x "hostapd" 2>/dev/null || true
    ok "hostapd detenido (proceso directo)"
fi

# Detener dnsmasq por systemd
if systemctl is-active --quiet dnsmasq 2>/dev/null; then
    systemctl stop dnsmasq
    ok "dnsmasq detenido (systemd)"
else
    info "dnsmasq no estaba activo en systemd"
fi

# Detener dnsmasq por proceso directo
if pgrep -x "dnsmasq" &>/dev/null; then
    pkill -x "dnsmasq" 2>/dev/null || true
    ok "dnsmasq detenido (proceso directo)"
fi

# ── Paso 2: Limpiar reglas iptables ─────────────────────────────────
step "2/4: Limpiando reglas iptables"

# Eliminar reglas de redirección del portal cautivo
if iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null; then
    iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT"
    ok "Regla iptables (80 → ${SERVER_PORT}) eliminada"
else
    info "Regla iptables (80 → ${SERVER_PORT}) no existía"
fi

if iptables -t nat -C PREROUTING -p tcp --dport 443 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null; then
    iptables -t nat -D PREROUTING -p tcp --dport 443 -j REDIRECT --to-port "$SERVER_PORT"
    ok "Regla iptables (443 → ${SERVER_PORT}) eliminada"
else
    info "Regla iptables (443 → ${SERVER_PORT}) no existía"
fi

# ── Paso 3: Liberar IP estática ──────────────────────────────────────
step "3/4: Liberando IP estática"

if ip addr show "$INTERFACE" 2>/dev/null | grep -q "${GATEWAY}/"; then
    ip addr del "${GATEWAY}/24" dev "$INTERFACE" 2>/dev/null || true
    ok "IP ${GATEWAY} liberada de $INTERFACE"
else
    info "La IP ${GATEWAY} no estaba configurada en $INTERFACE"
fi

# Opcional: pedir a DHCP que tome el control (si hay router conectado)
# Nota: Esto solo tiene sentido si la Raspberry Pi está conectada a
# un router por cable Ethernet que pueda darle IP.
if command -v dhclient &>/dev/null; then
    info "Liberando concesión DHCP en $INTERFACE..."
    dhclient -r "$INTERFACE" 2>/dev/null || true
elif command -v dhcpcd &>/dev/null; then
    info "Liberando concesión DHCP en $INTERFACE..."
    dhcpcd -k "$INTERFACE" 2>/dev/null || true
fi

# Bajar la interfaz
ip link set "$INTERFACE" down 2>/dev/null || true
ok "Interfaz $INTERFACE desactivada"

# ── Paso 4: Verificar limpieza ──────────────────────────────────────
step "4/4: Verificando que todo esté limpio"

ERRORS=0

if pgrep -x "hostapd" &>/dev/null; then
    err "hostapd sigue corriendo"
    ERRORS=$((ERRORS + 1))
else
    ok "hostapd detenido"
fi

if pgrep -x "dnsmasq" &>/dev/null; then
    err "dnsmasq sigue corriendo"
    ERRORS=$((ERRORS + 1))
else
    ok "dnsmasq detenido"
fi

if iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null; then
    err "Regla iptables 80→${SERVER_PORT} aún presente"
    ERRORS=$((ERRORS + 1))
else
    ok "Reglas iptables limpias"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Hotspot desactivado correctamente      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    info "La red ${INTERFACE} está libre."
    info "Para reactivar: ${INSTALL_DIR:-/opt/educonect}/scripts/setup-hotspot.sh"
else
    echo -e "${RED}║   ❌ ${ERRORS} problema(s) durante la limpieza     ║${NC}"
    exit 1
fi
