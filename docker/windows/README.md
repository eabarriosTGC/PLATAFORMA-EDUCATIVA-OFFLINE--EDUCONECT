# Receta de compilación cruzada para Windows

Aquí vive, **versionada**, la receta que produce
`edu-conect-rural-server.exe` para `x86_64-pc-windows-gnu`. Antes estaba solo en
`$HOME/educonect-dev-env/` de una máquina; un clon del repositorio no la tenía.

| Archivo | Qué aporta |
|---|---|
| `Dockerfile.win` | `debian:bookworm-slim` + Rust 1.88.0 + `gcc-mingw-w64-x86-64` + target `x86_64-pc-windows-gnu`. **No** instala `libzim-dev`, `libxapian-dev` ni `libicu-dev`: si el perfil default volviera a necesitarlas, el build falla en vez de producir un binario dependiente |
| `compose.yaml` | servicio `win`: monta el repositorio en `/workspace` en **solo lectura** y usa volúmenes de caché propios |

## Uso

```bash
export RUST_VERSION=1.88.0
export EDUCONNECT_REPO=/ruta/al/repo     # opcional: por omisión `../..`, la raíz del repo

timeout 900 docker compose -f docker/windows/compose.yaml build win
timeout 900 docker compose -f docker/windows/compose.yaml run -T --rm win bash -lc \
  'cd /workspace/edu-conect-rural-server &&
   cargo build --locked --release --target x86_64-pc-windows-gnu'
```

El artefacto queda en el volumen `cargo-target-win`, en
`/opt/target/x86_64-pc-windows-gnu/release/edu-conect-rural-server.exe`. Para
sacarlo: agregue `bash -lc 'cat /opt/target/x86_64-pc-windows-gnu/release/edu-conect-rural-server.exe'`
y redirija a un archivo del host.

Los seis controles (receta, compilación, formato PE, importaciones, `cargo tree`
y arranque bajo Wine) los ejecuta la prueba durable:

```bash
timeout 1500 ./edu-conect-rural-server/tests/win-cross-build.sh
```

Hace falta `docker compose` (si falta, la prueba sale 77 y **no** aprueba), más
`file`, `objdump`, `wine` y `curl` en el host para los controles 3, 4 y 6.

## Qué no es

Es una imagen de **compilación**, no de prueba: no trae Wine, así que no puede
ejecutar su propio artefacto. El arranque se mide en el host. Detalles,
evidencia y lo que sigue sin verificar: `docs/sprint2/win-cross-build.md` y
`docs/sprint2/entorno-compilacion.md`.
