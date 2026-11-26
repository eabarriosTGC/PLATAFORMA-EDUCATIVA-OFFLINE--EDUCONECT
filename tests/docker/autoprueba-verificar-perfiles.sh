#!/usr/bin/env bash
# Control negativo de verificar-perfiles.sh (D-05a). Cubre S3/S4/S6/S10:
# el verificador DEBE fallar cuando las dos patas son el mismo artefacto y
# DEBE salir 2 (no verificable) cuando falta un insumo. Un verificador que no
# puede fallar no prueba ningún perfil.
#
# Origen: propuesta del verificador independiente de D-05a, que reprodujo a mano
# los cuatro casos (dos copias del mismo perfil, artefacto core en ambos huecos,
# imagen con un .zim falso, y ausencia de argumentos). Esta sonda deja el control
# negativo en el repositorio para que no dependa de que alguien lo repita.
#
# Uso: tests/docker/autoprueba-verificar-perfiles.sh <imagen-ya-construida>
#
# Códigos: 0 = el verificador se comporta; 1 = el verificador no discrimina; 2 = no verificable.
set -uo pipefail

V="$(dirname "$0")/verificar-perfiles.sh"
IMG="${1:-}"
fallos=0

[[ -x "$V" && -n "$IMG" ]] || { echo "uso: $0 <imagen>"; exit 2; }

# 1. Sin argumentos el verificador no puede medir nada: 2, nunca 0.
"$V" >/dev/null 2>&1
[[ $? -eq 2 ]] || { echo "FALLA: sin argumentos debía salir 2"; fallos=$((fallos + 1)); }

# 2. Una imagen que no existe es un insumo faltante: 2.
"$V" "$IMG" no-existe-d05a >/dev/null 2>&1
[[ $? -eq 2 ]] || { echo "FALLA: imagen inexistente debía salir 2"; fallos=$((fallos + 1)); }

# 3. La misma ruta en los dos huecos no es una comparación: 2.
"$V" "$IMG" "$IMG" >/dev/null 2>&1
[[ $? -eq 2 ]] || { echo "FALLA: misma ruta debía salir 2"; fallos=$((fallos + 1)); }

# 4. El mismo artefacto bajo dos etiquetas: el contraste está roto, 1.
docker tag "$IMG" autoprueba-d05a-a:latest && docker tag "$IMG" autoprueba-d05a-b:latest || {
    echo "no se pudo etiquetar la imagen"
    exit 2
}
salida="$("$V" autoprueba-d05a-a:latest autoprueba-d05a-b:latest 2>&1)"
estado=$?
docker rmi autoprueba-d05a-a:latest autoprueba-d05a-b:latest >/dev/null 2>&1

[[ $estado -eq 1 ]] || {
    echo "FALLA: dos copias del mismo perfil debían dar 1 (dieron $estado)"
    fallos=$((fallos + 1))
}
grep -q 'contraste está roto' <<<"$salida" || {
    echo "FALLA: no se reportó el contraste roto"
    fallos=$((fallos + 1))
}

if [[ $fallos -gt 0 ]]; then
    echo "RESULTADO: FALLA ($fallos)"
    exit 1
fi
echo "RESULTADO: OK — el verificador falla cuando debe y reserva 2 para «no verificable»"
