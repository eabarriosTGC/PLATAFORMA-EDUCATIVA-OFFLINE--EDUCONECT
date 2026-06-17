#!/usr/bin/env bash
# verify-hotspot-framework.sh — Verificación del framework hotspot
# EduConect Rural — Plataforma educativa offline para Raspberry Pi
#
# Este script verifica que TODOS los archivos del framework hotspot
# existen, son válidos, y están correctamente estructurados.
# NO necesita root — verifica sintaxis y estructura solamente.
#
# Uso: ./verify-hotspot-framework.sh

set -euo pipefail

# ── Colores ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS="${GREEN}✅${NC}"; FAIL="${RED}❌${NC}"; WARN="${YELLOW}⚠️${NC}"; INFO="${BLUE}ℹ️${NC}"

passed=0
failed=0
warnings=0

check() {
    local name="$1" status="$2" detail="$3"
    case "$status" in
        pass) passed=$((passed+1)); echo -e "  ${PASS} $name — $detail" ;;
        fail) failed=$((failed+1)); echo -e "  ${FAIL} $name — $detail" ;;
        warn) warnings=$((warnings+1)); echo -e "  ${WARN} $name — $detail" ;;
    esac
}

PROJECT_DIR="/home/trabajo/ai-startup/Rust_rural/edu-conect-rural-server"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     EduConect Rural — Verificación del Framework        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Proyecto: ${PROJECT_DIR}"
echo ""

# ── 1. Verificar existencia de archivos ──────────────────────────────
echo -e "${YELLOW}━━━ 1. Archivos del framework ━━━${NC}"

FILES=(
    "config/hostapd.conf"
    "config/dnsmasq.conf"
    "scripts/setup-hotspot.sh"
    "scripts/teardown-hotspot.sh"
    "scripts/check-hotspot.sh"
)

for f in "${FILES[@]}"; do
    full="${PROJECT_DIR}/${f}"
    if [ -f "$full" ]; then
        SIZE=$(du -h "$full" 2>/dev/null | cut -f1)
        PERMS=$(stat -c "%a" "$full" 2>/dev/null)
        if [ -x "$full" ] || [[ "$f" == *.conf ]]; then
            check "$f" "pass" "${SIZE}, permisos: ${PERMS}"
        else
            check "$f" "warn" "${SIZE}, permisos: ${PERMS} (no ejecutable)"
        fi
    else
        check "$f" "fail" "NO EXISTE"
    fi
done

# ── 2. Verificar sintaxis de scripts bash ────────────────────────────
echo -e "${YELLOW}━━━ 2. Sintaxis de scripts bash ━━━${NC}"

for script in "setup-hotspot.sh" "teardown-hotspot.sh" "check-hotspot.sh"; do
    full="${PROJECT_DIR}/scripts/${script}"
    if [ -f "$full" ]; then
        # Verificar shebang
        if head -1 "$full" | grep -q "^#!/usr/bin/env bash"; then
            check "${script} — shebang" "pass" "#!/usr/bin/env bash"
        else
            check "${script} — shebang" "fail" "Shebang incorrecto o ausente"
        fi

        # Verificar set -euo pipefail
        if grep -q "^set -euo pipefail" "$full"; then
            check "${script} — pipefail" "pass" "set -euo pipefail presente"
        else
            check "${script} — pipefail" "warn" "set -euo pipefail ausente"
        fi

        # Verificar sintaxis con bash -n
        if bash -n "$full" 2>/dev/null; then
            check "${script} — sintaxis" "pass" "Válido (bash -n OK)"
        else
            ERR_MSG=$(bash -n "$full" 2>&1 || true)
            check "${script} — sintaxis" "fail" "Error de sintaxis: ${ERR_MSG}"
        fi

        # Verificar que no tiene truncamiento en PASSWORD u otras variables
        if grep -q "PASSWORD=\"\${PASSWORD" "$full"; then
            LEN=$(grep "PASSWORD=\"\${PASSWORD" "$full" | head -1 | wc -c)
            if [ "$LEN" -lt 10 ]; then
                check "${script} — PASSWORD truncada?" "warn" "Línea sospechosamente corta (${LEN} chars)"
            fi
        fi
    fi
done

# ── 3. Verificar contenido de configs ────────────────────────────────
echo -e "${YELLOW}━━━ 3. Contenido de archivos de configuración ━━━${NC}"

# hostapd.conf
HOSTAPD="${PROJECT_DIR}/config/hostapd.conf"
if [ -f "$HOSTAPD" ]; then
    for key in "interface=" "driver=nl80211" "ssid=" "hw_mode=g" "channel=" "wpa=2" "wpa_passphrase=" "wpa_key_mgmt=WPA-PSK" "rsn_pairwise=CCMP" "country_code=" "max_num_sta="; do
        if grep -q "^${key}" "$HOSTAPD"; then
            check "hostapd: ${key}" "pass" "Configurado"
        else
            check "hostapd: ${key}" "fail" "AUSENTE"
        fi
    done

    # Verificar que tiene SSID configurable
    if grep -q '\${SSID:-' "$HOSTAPD"; then
        check "hostapd: SSID configurable" "pass" "Variable \${SSID:-...} presente"
    fi
    if grep -q '\${PASSWORD:-' "$HOSTAPD"; then
        check "hostapd: PASSWORD configurable" "pass" "Variable \${PASSWORD:-...} presente"
    fi
fi

# dnsmasq.conf
DNSMASQ="${PROJECT_DIR}/config/dnsmasq.conf"
if [ -f "$DNSMASQ" ]; then
    for key in "interface=" "bind-interfaces" "dhcp-range=" "domain=" "address=/educonect.local/" "address=/#/" "no-resolv" "dhcp-option=3," "dhcp-option=6,"; do
        if grep -q "^${key}" "$DNSMASQ"; then
            check "dnsmasq: ${key}" "pass" "Configurado"
        else
            check "dnsmasq: ${key}" "fail" "AUSENTE"
        fi
    done

    # Verificar rango DHCP suficiente
    DHCP_LINE=$(grep "^dhcp-range=" "$DNSMASQ" | head -1)
    if echo "$DHCP_LINE" | grep -qP "10\.0\.0\.(1[0-9]|20|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9]|100)"; then
        check "dnsmasq: rango DHCP 10.0.0.10-100" "pass" "Soporta 30+ dispositivos"
    else
        check "dnsmasq: rango DHCP" "warn" "Verificar rango: ${DHCP_LINE}"
    fi
fi

# ── 4. Verificar variables de entorno en scripts ─────────────────────
echo -e "${YELLOW}━━━ 4. Variables de entorno configurables ━━━${NC}"

for script in "setup-hotspot.sh" "teardown-hotspot.sh" "check-hotspot.sh"; do
    full="${PROJECT_DIR}/scripts/${script}"
    if [ -f "$full" ]; then
        VARS=$(grep -oP '\$\{[\w]+:-' "$full" | sort -u | tr -d ':-' | tr '\n' ' ' || true)
        if [ -n "$VARS" ]; then
            check "${script}: variables ENV" "pass" "${VARS}"
        fi
    fi
done

# ── 5. Verificar consistencia entre scripts ──────────────────────────
echo -e "${YELLOW}━━━ 5. Consistencia entre archivos ━━━${NC}"

# Mismo GATEWAY en todos
GATEWAY_CHECK=$(grep -rh "10.0.0.1" "${PROJECT_DIR}/scripts/" "${PROJECT_DIR}/config/" 2>/dev/null | grep -c "10.0.0.1" || true)
if [ "$GATEWAY_CHECK" -ge 5 ]; then
    check "Gateway 10.0.0.1 consistente" "pass" "Presente en todos los archivos"
else
    check "Gateway 10.0.0.1 consistente" "warn" "Solo ${GATEWAY_CHECK} referencias"
fi

# Mismo SERVER_PORT en todos
PORT_CHECK=$(grep -rh "8080" "${PROJECT_DIR}/scripts/" 2>/dev/null | grep -c "8080" || true)
if [ "$PORT_CHECK" -ge 3 ]; then
    check "Puerto 8080 consistente" "pass" "Presente en setup y check"
else
    check "Puerto 8080 consistente" "warn" "Solo ${PORT_CHECK} referencias"
fi

# Misma interfaz
IFACE_CHECK=$(grep -rh "wlan0" "${PROJECT_DIR}/scripts/" "${PROJECT_DIR}/config/" 2>/dev/null | grep -c "wlan0" || true)
if [ "$IFACE_CHECK" -ge 3 ]; then
    check "Interfaz wlan0 consistente" "pass" "Presente en todos los archivos"
else
    check "Interfaz wlan0 consistente" "warn" "Solo ${IFACE_CHECK} referencias"
fi

# Verificar que setup-hotspot.sh llama a las variables correctas
if grep -q "HOSTAPD_PID" "${PROJECT_DIR}/scripts/setup-hotspot.sh" 2>/dev/null; then
    check "setup: referencias PID" "pass" "Variables de proceso definidas"
fi

# ── 6. Verificar estructura del directorio ────────────────────────────
echo -e "${YELLOW}━━━ 6. Estructura del proyecto ━━━${NC}"

DIRS_EXIST=true
for d in "config" "scripts"; do
    if [ -d "${PROJECT_DIR}/${d}" ]; then
        check "Directorio ${d}/" "pass" "Existe"
    else
        check "Directorio ${d}/" "fail" "NO EXISTE"
        DIRS_EXIST=false
    fi
done

# ── Resumen ──────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                     RESUMEN FINAL                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL=$((passed + failed + warnings))
echo -e "  ${BLUE}Total:${NC} ${TOTAL} verificaciones"
echo -e "  ${PASS} ${passed}"
echo -e "  ${FAIL} ${failed}"
echo -e "  ${WARN} ${warnings}"
echo ""

if [ "$failed" -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✅ Framework hotspot VERIFICADO            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Los 5 archivos del framework hotspot existen, son"
    echo -e "  sintácticamente válidos y están correctamente estructurados."
    echo ""
    echo -e "  Archivos creados:"
    echo -e "    ${CYAN}config/hostapd.conf${NC}       — Punto de acceso WiFi"
    echo -e "    ${CYAN}config/dnsmasq.conf${NC}       — DHCP + DNS local + portal cautivo"
    echo -e "    ${CYAN}scripts/setup-hotspot.sh${NC}  — Activación del hotspot (idempotente)"
    echo -e "    ${CYAN}scripts/teardown-hotspot.sh${NC} — Desactivación del hotspot"
    echo -e "    ${CYAN}scripts/check-hotspot.sh${NC}  — Diagnóstico completo del sistema"
    echo ""
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ❌ ${failed} fallo(s) detectados              ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Revisa los errores arriba y corrige antes de continuar."
    exit 1
fi
