#!/usr/bin/env bash
# check-hotspot.sh — Diagnóstico del hotspot WiFi + portal cautivo
# EduConect Rural — Plataforma educativa offline para Raspberry Pi
#
# Uso: sudo ./check-hotspot.sh
# Verifica todos los componentes del hotspot y reporta su estado.
# Útil para depuración en escuelas rurales.

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────
INTERFACE="${INTERFACE:-wlan0}"
GATEWAY="${GATEWAY:-10.0.0.1}"
SUBNET="${SUBNET:-24}"
SERVER_PORT="${SERVER_PORT:-8080}"
INSTALL_DIR="${INSTALL_DIR:-/opt/educonect}"

# ── Colores ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS="${GREEN}✅ PAS${NC}"
FAIL="${RED}❌ FALLO${NC}"
WARN="${YELLOW}⚠️  WARN${NC}"
INFO="${BLUE}ℹ️  INFO${NC}"

total=0
passed=0
failed=0
warnings=0

# ── Función de chequeo ───────────────────────────────────────────────
check() {
    local name="$1"
    local status="$2"  # "pass", "fail", "warn"
    local detail="$3"
    total=$((total + 1))
    case "$status" in
        pass) passed=$((passed + 1)); echo -e "  ${PASS} | $name — $detail" ;;
        fail) failed=$((failed + 1)); echo -e "  ${FAIL} | $name — $detail" ;;
        warn) warnings=$((warnings + 1)); echo -e "  ${WARN} | $name — $detail" ;;
    esac
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     EduConect Rural — Diagnóstico de Hotspot WiFi      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Fecha:    $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  Hostname: $(hostname)"
echo -e "  Kernel:   $(uname -r)"
echo -e "  Modelo:   $(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo 'No detectado')"
echo ""

# ── 1. Verificar permisos ────────────────────────────────────────────
echo -e "${YELLOW}━━━ 1. Permisos ━━━${NC}"
if [ "$EUID" -eq 0 ]; then
    check "Ejecución como root" "pass" "OK (usuario root)"
else
    check "Ejecución como root" "warn" "No root — algunas comprobaciones pueden fallar"
fi

# ── 2. Verificar comandos disponibles ─────────────────────────────────
echo -e "${YELLOW}━━━ 2. Comandos del sistema ─━━${NC}"
for cmd in hostapd dnsmasq iptables ip sysctl pgrep; do
    if command -v "$cmd" &>/dev/null; then
        check "Comando: $cmd" "pass" "Disponible en $(which "$cmd")"
    else
        check "Comando: $cmd" "fail" "NO INSTALADO"
    fi
done

# ── 3. Verificar hostapd ─────────────────────────────────────────────
echo -e "${YELLOW}━━━ 3. hostapd (punto de acceso WiFi) ━━━${NC}"

# Proceso activo
if pgrep -x "hostapd" &>/dev/null; then
    HOSTAPD_PID=$(pgrep -x "hostapd" | head -1)
    HOSTAPD_UPTIME=$(ps -p "$HOSTAPD_PID" -o etime= 2>/dev/null | tr -d ' ')
    check "hostapd en ejecución" "pass" "PID $HOSTAPD_PID, tiempo activo: ${HOSTAPD_UPTIME:-desconocido}"
else
    check "hostapd en ejecución" "fail" "proceso NO encontrado"
fi

# Archivo de configuración
if [ -f /etc/hostapd/hostapd.conf ]; then
    SSID_LINE=$(grep "^ssid=" /etc/hostapd/hostapd.conf 2>/dev/null || echo "ssid=No encontrado")
    CHANNEL_LINE=$(grep "^channel=" /etc/hostapd/hostapd.conf 2>/dev/null || echo "channel=No encontrado")
    check "hostapd config" "pass" "${SSID_LINE}, ${CHANNEL_LINE}"
else
    check "hostapd config" "fail" "/etc/hostapd/hostapd.conf NO EXISTE"
fi

# ── 4. Verificar dnsmasq ─────────────────────────────────────────────
echo -e "${YELLOW}━━━ 4. dnsmasq (DHCP + DNS) ━━━${NC}"

# Proceso activo
if pgrep -x "dnsmasq" &>/dev/null; then
    DNSMASQ_PID=$(pgrep -x "dnsmasq" | head -1)
    check "dnsmasq en ejecución" "pass" "PID $DNSMASQ_PID"
else
    check "dnsmasq en ejecución" "fail" "proceso NO encontrado"
fi

# Archivo de configuración
if [ -f /etc/dnsmasq.conf ]; then
    DHCP_RANGE=$(grep "^dhcp-range=" /etc/dnsmasq.conf 2>/dev/null || echo "dhcp-range=No encontrado")
    ADDRESS_LINE=$(grep "^address=/#/" /etc/dnsmasq.conf 2>/dev/null || echo "address=/#/ -> NO CONFIGURADO")
    check "dnsmasq config" "pass" "${DHCP_RANGE}, ${ADDRESS_LINE}"
else
    check "dnsmasq config" "fail" "/etc/dnsmasq.conf NO EXISTE"
fi

# Verificar que dnsmasq está escuchando en puerto 53
if pgrep -x "dnsmasq" &>/dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":53 "; then
        check "DNS en puerto 53" "pass" "dnsmasq escuchando en :53"
    else
        check "DNS en puerto 53" "fail" "Nadie escucha en puerto 53"
    fi
fi

# ── 5. Verificar IP en wlan0 ─────────────────────────────────────────
echo -e "${YELLOW}━━━ 5. Interfaz de red (${INTERFACE}) ━━━${NC}"

# La interfaz existe
if ip link show "$INTERFACE" &>/dev/null; then
    check "Interfaz $INTERFACE existe" "pass" ""

    # Estado de la interfaz (UP/DOWN)
    STATE=$(ip link show "$INTERFACE" | grep -oP 'state \K\w+' || echo "desconocido")
    if [ "$STATE" = "UP" ]; then
        check "Interfaz $INTERFACE activa" "pass" "Estado: $STATE"
    else
        check "Interfaz $INTERFACE activa" "fail" "Estado: $STATE (debería ser UP)"
    fi

    # IP asignada
    IP_INFO=$(ip -4 addr show "$INTERFACE" 2>/dev/null | grep -oP 'inet \K[\d.]+(/[\d]+)?' || echo "")
    if echo "$IP_INFO" | grep -q "${GATEWAY}"; then
        check "IP ${GATEWAY}/${SUBNET}" "pass" "Configurada correctamente"
    else
        if [ -n "$IP_INFO" ]; then
            check "IP ${GATEWAY}/${SUBNET}" "fail" "Tiene IP diferente: $IP_INFO"
        else
            check "IP ${GATEWAY}/${SUBNET}" "fail" "NO tiene IP asignada"
        fi
    fi

    # Clientes conectados (ARP table)
    CLIENTS_ARP=$(ip neigh show dev "$INTERFACE" 2>/dev/null | grep -c "REACHABLE\|STALE" || true)
    check "Clientes en tabla ARP" "info" "${CLIENTS_ARP} cliente(s) visible(s)"

    # Intentar obtener más info de clients via iw
    if command -v iw &>/dev/null; then
        IW_CLIENTS=$(iw dev "$INTERFACE" station dump 2>/dev/null | grep -c "Station" || true)
        if [ "$IW_CLIENTS" -gt 0 ]; then
            check "Clientes asociados (iw)" "pass" "${IW_CLIENTS} dispositivo(s) conectado(s)"
        fi
    fi
else
    check "Interfaz $INTERFACE existe" "fail" "NO EXISTE"
fi

# ── 6. Verificar iptables NAT ────────────────────────────────────────
echo -e "${YELLOW}━━━ 6. iptables (reglas NAT / portal cautivo) ━━━${NC}"

# Regla 80 -> 8080
if iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null; then
    check "Redirección 80 → ${SERVER_PORT}" "pass" "Regla NAT activa"
else
    # Buscar cualquier redirección a SERVER_PORT
    if iptables -t nat -L PREROUTING -n 2>/dev/null | grep -q "${SERVER_PORT}"; then
        check "Redirección 80 → ${SERVER_PORT}" "warn" "Regla existe pero con formato diferente"
    else
        check "Redirección 80 → ${SERVER_PORT}" "fail" "NO HAY regla NAT para el portal cautivo"
    fi
fi

# Regla 443 -> 8080
if iptables -t nat -C PREROUTING -p tcp --dport 443 -j REDIRECT --to-port "$SERVER_PORT" 2>/dev/null; then
    check "Redirección 443 → ${SERVER_PORT}" "pass" "Regla NAT activa (para HTTPS)"
else
    check "Redirección 443 → ${SERVER_PORT}" "info" "No requerida pero recomendada"
fi

# ── 7. Verificar IP forwarding ───────────────────────────────────────
echo -e "${YELLOW}━━━ 7. IP forwarding ━━━${NC}"
FORWARD=$(sysctl -n net.ipv4.ip_forward 2>/dev/null || echo "0")
if [ "$FORWARD" = "1" ]; then
    check "net.ipv4.ip_forward" "pass" "Habilitado (1)"
else
    check "net.ipv4.ip_forward" "fail" "DESHABILITADO (${FORWARD})"
fi

# ── 8. Verificar servidor web en puerto 8080 ─────────────────────────
echo -e "${YELLOW}━━━ 8. Servidor web (puerto ${SERVER_PORT}) ─━━${NC}"

if ss -tlnp 2>/dev/null | grep -q ":${SERVER_PORT} "; then
    SERVER_PROC=$(ss -tlnp 2>/dev/null | grep ":${SERVER_PORT} " | grep -oP 'users:\(\(\K[^)]+' || echo "desconocido")
    check "Puerto ${SERVER_PORT} abierto" "pass" "Escuchando — ${SERVER_PROCES}"
else
    check "Puerto ${SERVER_PORT} abierto" "fail" "NADIE escucha en puerto ${SERVER_PORT}"
    info "    El servidor Axum debe iniciarse: sudo ${INSTALL_DIR}/bin/edu-conect-rural-server"
fi

# ── 9. Verificar resolución DNS local ────────────────────────────────
echo -e "${YELLOW}━━━ 9. Resolución DNS local ─━━${NC}"

if command -v dig &>/dev/null; then
    DIG_RESULT=$(dig +short educonect.local @127.0.0.1 2>/dev/null || echo "")
    if [ "$DIG_RESULT" = "10.0.0.1" ]; then
        check "Resolución educonect.local" "pass" "Resuelve a ${GATEWAY}"
    else
        check "Resolución educonect.local" "warn" "Resultado: '${DIG_RESULT}' (esperado: ${GATEWAY})"
    fi

    # Probar redirección de dominio externo (portal cautivo)
    DIG_EXT=$(dig +short google.com @127.0.0.1 2>/dev/null || echo "")
    if [ "$DIG_EXT" = "10.0.0.1" ]; then
        check "Redirección portal cautivo" "pass" "google.com → ${GATEWAY} (portal cautivo OK)"
    elif [ -z "$DIG_EXT" ]; then
        check "Redirección portal cautivo" "warn" "google.com no resuelve (dnsmasq puede no estar en 127.0.0.1)"
    else
        check "Redirección portal cautivo" "fail" "google.com → ${DIG_EXT} (debería ser ${GATEWAY})"
    fi
elif command -v nslookup &>/dev/null; then
    NS_RESULT=$(nslookup educonect.local 127.0.0.1 2>/dev/null | grep -oP 'Address: \K[\d.]+' || echo "")
    if [ "$NS_RESULT" = "10.0.0.1" ]; then
        check "Resolución educonect.local" "pass" "Resuelve a ${GATEWAY}"
    else
        check "Resolución educonect.local" "warn" "Resultado: '${NS_RESULT}'"
    fi
else
    check "Resolución DNS" "info" "dig/nslookup no disponibles — salta verificación DNS"
fi

# ── 10. Verificar conectividad HTTP ──────────────────────────────────
echo -e "${YELLOW}━━━ 10. Conectividad HTTP ─━━${NC}"

if command -v curl &>/dev/null; then
    # Probar conexión local al servidor
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://127.0.0.1:${SERVER_PORT}/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ]; then
        check "HTTP 127.0.0.1:${SERVER_PORT}" "pass" "Código de respuesta: ${HTTP_CODE}"
    else
        check "HTTP 127.0.0.1:${SERVER_PORT}" "fail" "No responde (código: ${HTTP_CODE})"
    fi

    # Probar a través del portal cautivo (80 redirigido a 8080)
    HTTP_80_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://127.0.0.1:80/" 2>/dev/null || echo "000")
    if [ "$HTTP_80_CODE" != "000" ]; then
        check "HTTP redirección 80→${SERVER_PORT}" "pass" "Código: ${HTTP_80_CODE}"
    else
        check "HTTP redirección 80→${SERVER_PORT}" "fail" "No responde en puerto 80"
    fi
else
    check "Conectividad HTTP" "info" "curl no disponible — salta verificación HTTP"
fi

# ── 11. Verificar archivos de proyecto ───────────────────────────────
echo -e "${YELLOW}━━━ 11. Archivos del proyecto ─━━${NC}"

FILES=(
    "${INSTALL_DIR}/config/hostapd.conf"
    "${INSTALL_DIR}/config/dnsmasq.conf"
    "${INSTALL_DIR}/scripts/setup-hotspot.sh"
    "${INSTALL_DIR}/scripts/teardown-hotspot.sh"
    "${INSTALL_DIR}/scripts/check-hotspot.sh"
    "${INSTALL_DIR}/bin/edu-conect-rural-server"
)

for f in "${FILES[@]}"; do
    if [ -f "$f" ]; then
        PERMS=$(stat -c "%a" "$f" 2>/dev/null || echo "?")
        SIZE=$(du -h "$f" 2>/dev/null | cut -f1 || echo "?")
        check "Archivo: $(basename "$f")" "pass" "${SIZE}, permisos: ${PERMS}"
    else
        check "Archivo: $(basename "$f")" "warn" "NO ENCONTRADO en ${f}"
    fi
done

# ── Resumen final ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                     RESUMEN FINAL                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$failed" -eq 0 ] && [ "$warnings" -eq 0 ]; then
    echo -e "  ${GREEN}Todos los sistemas operativos correctamente (${passed}/${total})${NC}"
    echo ""
    echo -e "  ${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}║   ✅ Hotspot funcionando correctamente      ║${NC}"
    echo -e "  ${GREEN}╚══════════════════════════════════════════════╝${NC}"
elif [ "$failed" -eq 0 ]; then
    echo -e "  ${YELLOW}${passed} chequeos OK, ${warnings} advertencia(s)${NC}"
    echo ""
    echo -e "  ${YELLOW}⚠️  El hotspot funciona pero hay aspectos a revisar.${NC}"
else
    echo -e "  ${RED}${passed} chequeos OK, ${warnings} advertencia(s), ${failed} FALLO(S)${NC}"
    echo ""
    echo -e "  ${RED}╔══════════════════════════════════════════════╗${NC}"
    echo -e "  ${RED}║   ❌ Hotspot con PROBLEMAS                  ║${NC}"
    echo -e "  ${RED}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}Recomendaciones:${NC}"
    echo "  1. Revisa que la antena WiFi esté conectada"
    echo "  2. sudo journalctl -u hostapd -n 30 --no-pager"
    echo "  3. sudo journalctl -u dnsmasq -n 30 --no-pager"
    echo "  4. Verifica que no haya conflictos: sudo systemctl list-units | grep -E 'hostapd|dnsmasq'"
    echo "  5. Ejecuta nuevamente: sudo setup-hotspot.sh"
fi

echo ""
echo -e "  ${BLUE}ℹ️  Para más ayuda: revisa la documentación en ${INSTALL_DIR}${NC}"
echo ""

exit $(( failed > 0 ? 1 : 0 ))
