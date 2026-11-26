#!/usr/bin/env bash
# pruebas-ci-ldd.sh — Pruebas de la compuerta de enlace D-CI 2
# EduConect Rural — Plataforma educativa offline
#
# Ejercita DOS cosas por la interfaz pública, sin compilar nada:
#
#   1. scripts/verificar-ldd-default.sh  → códigos de salida y mensajes para
#      clausuras reales (default y línea base con ZIM) y para los casos en que
#      NO se puede concluir nada (binario ausente, ldd roto, salida vacía).
#   2. .github/workflows/ci.yml          → que la matriz y el nombre del job
#      sigan siendo los que exige la branch protection, y que el paso de ldd
#      esté acotado al leg `default`.
#
# No usa la red, ni cargo, ni Docker. El `ldd` se sustituye por un stub en
# PATH cuyo texto de salida viene de un fixture: es la forma de medir el
# contrato de la compuerta sin depender del binario compilado.
#
# Uso: bash scripts/pruebas-ci-ldd.sh

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/.." && pwd)"
COMPUERTA="$AQUI/verificar-ldd-default.sh"
WORKFLOW="$RAIZ/.github/workflows/ci.yml"

# ── Espacio de trabajo temporal ──────────────────────────────────────
# Fuera del árbol de trabajo: las pruebas nunca dejan fixtures en el repo.
TMP="$(mktemp -d "${TMPDIR:-/tmp}/pruebas-ci-ldd.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

STUBS="$TMP/stubs"
mkdir -p "$STUBS"

# ldd falso: imprime el fixture indicado y sale con el código indicado.
cat > "$STUBS/ldd" <<'STUB'
#!/usr/bin/env bash
[[ -n "${LDD_FIXTURE:-}" ]] && cat "$LDD_FIXTURE"
exit "${LDD_ESTADO:-0}"
STUB
chmod +x "$STUBS/ldd"

BINARIO="$TMP/binario-falso"
printf 'no es un ELF de verdad: a la compuerta solo le importa que exista\n' > "$BINARIO"

# ── Fixtures: clausuras reales observadas ────────────────────────────
# Perfil default en la imagen nodev (sin bibliotecas de ZIM), build release.
cat > "$TMP/clausura-default.txt" <<'EOF'
	linux-vdso.so.1 (0x00007eff46df0000)
	libgcc_s.so.1 => /lib/x86_64-linux-gnu/libgcc_s.so.1 (0x00007eff46dc5000)
	libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007eff46320000)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007eff4613e000)
	/lib64/ld-linux-x86-64.so.2 (0x00007eff46df2000)
EOF

# Línea base previa a D-01a (docs/sprint2/ldd-baseline.log): las cuatro
# familias prohibidas enlazadas a la vez.
cat > "$TMP/clausura-baseline.txt" <<'EOF'
	linux-vdso.so.1 (0x00007fe8e862b000)
	libzim.so.8 => /lib/x86_64-linux-gnu/libzim.so.8 (0x00007fe8e7133000)
	libstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6 (0x00007fe8e6f19000)
	libgcc_s.so.1 => /lib/x86_64-linux-gnu/libgcc_s.so.1 (0x00007fe8e8600000)
	libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007fe8e6e39000)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007fe8e6c57000)
	/lib64/ld-linux-x86-64.so.2 (0x00007fe8e862d000)
	liblzma.so.5 => /lib/x86_64-linux-gnu/liblzma.so.5 (0x00007fe8e6c28000)
	libzstd.so.1 => /lib/x86_64-linux-gnu/libzstd.so.1 (0x00007fe8e6b6c000)
	libxapian.so.30 => /lib/x86_64-linux-gnu/libxapian.so.30 (0x00007fe8e693b000)
	libicui18n.so.72 => /lib/x86_64-linux-gnu/libicui18n.so.72 (0x00007fe8e6611000)
	libicuuc.so.72 => /lib/x86_64-linux-gnu/libicuuc.so.72 (0x00007fe8e6413000)
	libuuid.so.1 => /lib/x86_64-linux-gnu/libuuid.so.1 (0x00007fe8e85f2000)
	libz.so.1 => /lib/x86_64-linux-gnu/libz.so.1 (0x00007fe8e85d3000)
	libicudata.so.72 => /lib/x86_64-linux-gnu/libicudata.so.72 (0x00007fe8e4641000)
EOF

clausura_con() {
    local destino="$1"; shift
    : > "$destino"
    local lib
    for lib in "$@"; do
        printf '\t%s => /lib/x86_64-linux-gnu/%s (0x00007f0000000000)\n' "$lib" "$lib" >> "$destino"
    done
    printf '\tlibc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f0000000001)\n' >> "$destino"
}

clausura_con "$TMP/clausura-libzim.txt"   "libzim.so.8"
clausura_con "$TMP/clausura-libxapian.txt" "libxapian.so.30"
clausura_con "$TMP/clausura-libicu.txt"   "libicui18n.so.72"
clausura_con "$TMP/clausura-libstdcxx.txt" "libstdc++.so.6"
: > "$TMP/clausura-vacia.txt"

# Clausura con una biblioteca no prohibida que empieza como «libzim» pero no lo
# es: sirve para fijar que la comparación es por nombre, no por prefijo ciego.
clausura_con "$TMP/clausura-libzug.txt" "libzug.so.1"

# F1 — un `ldd` que sale 0 y solo imprime un diagnóstico no midió clausura
# alguna (`not a dynamic executable` es lo que dice ldd de un objeto estático).
cat > "$TMP/clausura-diagnostico.txt" <<'EOF'
	not a dynamic executable
EOF

# `ldd` que sale 0 sin imprimir una sola entrada: solo espacios.
printf '\n   \n\t\n' > "$TMP/clausura-espacios.txt"

# El caso real del leg default si la cadena ZIM entra sin resolverse: `ldd`
# sale 0 y declara la biblioteca «not found». Sigue siendo infracción.
printf '\tlibzim.so.8 => not found\n' > "$TMP/clausura-libzim-no-encontrada.txt"

# F2 — «libicu» en la RUTA no es «libicu» en el NOMBRE de la biblioteca.
cat > "$TMP/clausura-libicu-en-ruta.txt" <<'EOF'
	libfoo.so.1 => /opt/libicu-legacy/libfoo.so.1 (0x00007f0000000002)
	libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f0000000003)
EOF

# ── Arnés ────────────────────────────────────────────────────────────
pasadas=0
fallidas=0

# Intérprete en ruta absoluta: hay pruebas que reemplazan PATH por completo.
BASH_EJECUTABLE="$(command -v bash)"

pasa()  { pasadas=$((pasadas+1));  echo "  ✅ $1"; }
falla()  { fallidas=$((fallidas+1)); echo "  ❌ $1"; printf '%s\n' "${2:-}" | sed 's/^/       /'; }

# probar <nombre> <fixture> <estado_ldd> <estado_esperado> [requisito...]
# Un requisito es una subcadena obligatoria; si empieza por «!» es una
# subcadena que NO debe aparecer.
probar() {
    local nombre="$1" fixture="$2" estado_ldd="$3" esperado="$4"
    shift 4
    local salida estado requisito detalle=""
    salida="$(LDD_FIXTURE="$fixture" LDD_ESTADO="$estado_ldd" PATH="$STUBS:$PATH" \
        bash "$COMPUERTA" "$BINARIO" 2>&1)"
    estado=$?

    if [[ "$estado" != "$esperado" ]]; then
        falla "$nombre (código de salida $estado, se esperaba $esperado)" "$salida"
        return
    fi
    for requisito in "$@"; do
        if [[ "$requisito" == '!'* ]]; then
            requisito="${requisito#!}"
            if grep -F -q -- "$requisito" <<< "$salida"; then
                falla "$nombre (no debía nombrar «$requisito»)" "$salida"
                return
            fi
        else
            if ! grep -F -q -- "$requisito" <<< "$salida"; then
                falla "$nombre (faltaba «$requisito» en la salida)" "$salida"
                return
            fi
        fi
    done
    pasa "$nombre (código $estado)"
}

echo "== 1. Compuerta de enlace — casos que DEBEN pasar =="
probar "clausura default real (5 entradas) -> válida" \
    "$TMP/clausura-default.txt" 0 0 \
    "RESULTADO: VÁLIDO" "5 entradas" "!INFRACCIÓN"
probar "misma clausura con una biblioteca extra permitida (libz) -> válida" \
    "$TMP/clausura-default.txt" 0 0 "RESULTADO: VÁLIDO"

echo "== 2. Compuerta de enlace — cada familia prohibida falla y se nombra =="
probar "libzim enlazada -> inválido" \
    "$TMP/clausura-libzim.txt" 0 1 \
    "INFRACCIÓN" "enlaza «libzim»" "RESULTADO: INVÁLIDO" "1 de 4"
probar "libxapian enlazada -> inválido" \
    "$TMP/clausura-libxapian.txt" 0 1 \
    "INFRACCIÓN" "enlaza «libxapian»" "1 de 4"
probar "libicu enlazada -> inválido" \
    "$TMP/clausura-libicu.txt" 0 1 \
    "INFRACCIÓN" "enlaza «libicu»" "1 de 4"
probar "libstdc++ enlazada -> inválido (los '+' se comparan literalmente)" \
    "$TMP/clausura-libstdcxx.txt" 0 1 \
    "INFRACCIÓN" "enlaza «libstdc++»" "1 de 4"
probar "línea base con las cuatro familias -> inválido, las nombra todas" \
    "$TMP/clausura-baseline.txt" 0 1 \
    "RESULTADO: INVÁLIDO" "4 de 4" \
    "enlaza «libzim»" "enlaza «libxapian»" "enlaza «libicu»" "enlaza «libstdc++»"

# El caso real del leg default: `ldd` sale 0 y la biblioteca aparece como
# «not found». La compuerta debe fallar igual y nombrarla.
probar "libzim.so.8 => not found (ldd sale 0) -> inválido, nombra libzim" \
    "$TMP/clausura-libzim-no-encontrada.txt" 0 1 \
    "INFRACCIÓN" "enlaza «libzim»" "RESULTADO: INVÁLIDO"

# F2 — la biblioteca se compara por NOMBRE, nunca por subcadena de la línea:
# una ruta que contenga «libicu» no es una infracción.
probar "ruta con «libicu» pero biblioteca libfoo -> válida (no es infracción)" \
    "$TMP/clausura-libicu-en-ruta.txt" 0 0 \
    "RESULTADO: VÁLIDO" "!INFRACCIÓN" "!enlaza «libicu»"

# PRESERVE de F2 — el nombre real de la familia sí se sigue nombrando, y una
# biblioteca distinta no se confunde con la prohibida.
probar "libzug no dispara libzim -> válida" \
    "$TMP/clausura-libzug.txt" 0 0 \
    "RESULTADO: VÁLIDO" "!enlaza «libzim»"

echo "== 3. Compuerta de enlace — casos NO VERIFICABLES (no pueden pasar en silencio) =="
salida="$(PATH="$STUBS:$PATH" bash "$COMPUERTA" "$TMP/no-existe" 2>&1)"
estado=$?
if [[ "$estado" == 2 ]] && grep -F -q -- "no existe el binario" <<< "$salida" \
   && grep -F -q -- "no-existe" <<< "$salida"; then
    pasa "binario ausente -> código 2, nombra la ruta"
else
    falla "binario ausente -> código 2, nombra la ruta (código $estado)" "$salida"
fi

probar "ldd falla (código 1) -> no verificable" \
    "$TMP/clausura-libzim.txt" 1 2 \
    "ldd salió con código 1" "NO VERIFICABLE"
probar "ldd sin salida -> no verificable" \
    "$TMP/clausura-vacia.txt" 0 2 \
    "no devolvió ninguna entrada" "NO VERIFICABLE"

probar "ldd que solo imprime espacios (sale 0) -> no verificable" \
    "$TMP/clausura-espacios.txt" 0 2 \
    "no devolvió ninguna entrada" "NO VERIFICABLE" "!RESULTADO: VÁLIDO"

# F1 — un diagnóstico no es una entrada de la clausura: «not a dynamic
# executable» con código 0 no puede producir un «válido».
probar "ldd sale 0 con solo un diagnóstico -> no verificable" \
    "$TMP/clausura-diagnostico.txt" 0 2 \
    "no devolvió ninguna entrada" "NO VERIFICABLE" "!RESULTADO: VÁLIDO"

# ldd ausente del PATH: la compuerta no puede medir nada.
mkdir -p "$TMP/path-sin-ldd"
salida="$(PATH="$TMP/path-sin-ldd" "$BASH_EJECUTABLE" "$COMPUERTA" "$BINARIO" 2>&1)"
estado=$?
if [[ "$estado" == 2 ]] && grep -F -q -- "ldd no está disponible en PATH" <<< "$salida" \
   && grep -F -q -- "NO VERIFICABLE" <<< "$salida"; then
    pasa "ldd ausente del PATH -> código 2, lo dice (código $estado)"
else
    falla "ldd ausente del PATH -> código 2, lo dice (código $estado)" "$salida"
fi

# PATH con solo el `ldd` falso: sin `ls`, `grep` ni `sed` la compuerta no puede
# verificar el binario, y debe fallar cerrada en vez de aprobar a ciegas.
SIN_UTILES="$TMP/path-solo-ldd"
mkdir -p "$SIN_UTILES"
cp "$STUBS/ldd" "$SIN_UTILES/ldd"
salida="$(LDD_FIXTURE="$TMP/clausura-default.txt" LDD_ESTADO=0 \
    PATH="$SIN_UTILES" "$BASH_EJECUTABLE" "$COMPUERTA" "$BINARIO" 2>&1)"
estado=$?
if [[ "$estado" == 2 ]] && grep -F -q -- "NO VERIFICABLE" <<< "$salida" \
   && ! grep -F -q -- "RESULTADO: VÁLIDO" <<< "$salida"; then
    pasa "PATH sin utilidades (solo ldd) -> código 2, falla cerrada (código $estado)"
else
    falla "PATH sin utilidades (solo ldd) -> código 2, falla cerrada (código $estado)" "$salida"
fi

# El caso silencioso que hay que descartar: ldd que falla y aun así imprime
# una clausura limpia no puede producir un «válido».
probar "ldd falla pero imprime clausura limpia -> no verificable" \
    "$TMP/clausura-default.txt" 2 2 \
    "NO VERIFICABLE" "!RESULTADO: VÁLIDO"

# Ruta por defecto: la que usa el pipeline (target/release/... desde el CWD).
mkdir -p "$TMP/cwd/target/release"
printf 'binario de reemplazo\n' > "$TMP/cwd/target/release/edu-conect-rural-server"
salida="$(cd "$TMP/cwd" && LDD_FIXTURE="$TMP/clausura-default.txt" LDD_ESTADO=0 \
    PATH="$STUBS:$PATH" bash "$COMPUERTA" 2>&1)"
estado=$?
if [[ "$estado" == 0 ]] && grep -F -q -- "target/release/edu-conect-rural-server" <<< "$salida"; then
    pasa "sin argumento usa target/release/edu-conect-rural-server (código 0)"
else
    falla "sin argumento usa target/release/edu-conect-rural-server (código $estado)" "$salida"
fi

# ── 4. Workflow: nombres protegidos y alcance del paso ───────────────
echo "== 4. Workflow — invariantes que no deben romperse (PRESERVE) =="

wfalta() {
    local nombre="$1" patron="$2"
    if grep -F -q -- "$patron" "$WORKFLOW"; then
        pasa "$nombre"
    else
        falla "$nombre (no se encontró «$patron» en .github/workflows/ci.yml)"
    fi
}

wfniega() {
    local nombre="$1" patron="$2"
    if grep -F -q -- "$patron" "$WORKFLOW"; then
        falla "$nombre (apareció «$patron» y no debía)"
    else
        pasa "$nombre"
    fi
}

wfalta "nombre del job: test (\${{ matrix.perfil }})" 'name: test (${{ matrix.perfil }})'
wfalta "matriz: perfil default" '- perfil: default'
wfalta "matriz: perfil con-zim" '- perfil: con-zim'
wfniega "el nombre del job no está hardcodeado como 'test'" '- name: test (default)'

BLOQUE_DEFAULT="$(awk '/- perfil: default/{f=1;next} /- perfil: con-zim/{f=0} f' "$WORKFLOW")"
BLOQUE_ZIM="$(awk '/- perfil: con-zim/{f=1} f' "$WORKFLOW")"

if grep -F -q -- 'paquetes: libssl-dev pkg-config' <<< "$BLOQUE_DEFAULT" \
   && ! grep -F -q -- 'libzim-dev' <<< "$BLOQUE_DEFAULT"; then
    pasa "leg default: paquetes sin bibliotecas de ZIM"
else
    falla "leg default: paquetes sin bibliotecas de ZIM" "$BLOQUE_DEFAULT"
fi

if grep -F -q -- 'libzim-dev' <<< "$BLOQUE_ZIM" \
   && grep -F -q -- '--features zim' <<< "$BLOQUE_ZIM"; then
    pasa "leg con-zim: conserva libzim-dev y --features zim"
else
    falla "leg con-zim: conserva libzim-dev y --features zim" "$BLOQUE_ZIM"
fi

echo "== 5. Workflow — el paso nuevo existe y está acotado al leg default =="
wfalta "paso de ldd presente" 'verificar-ldd-default.sh'
wfalta "paso de ldd acotado a default" "if: matrix.perfil == 'default'"

if grep -B2 -F -- 'scripts/verificar-ldd-default.sh" target/release/edu-conect-rural-server' "$WORKFLOW" \
    | grep -F -q -- "if: matrix.perfil == 'default'"; then
    pasa "el paso de ldd no queda sin condición (con-zim lo ejecutaría)"
else
    falla "el paso de ldd no queda sin condición (con-zim lo ejecutaría)"
fi

# ── Resumen ──────────────────────────────────────────────────────────
echo
echo "─────────────────────────────────────────────"
echo "  PRUEBAS: $pasadas pasadas, $fallidas fallidas"
if [[ "$fallidas" -gt 0 ]]; then
    echo "  RESULTADO: FALLA"
    exit 1
fi
echo "  RESULTADO: OK"
