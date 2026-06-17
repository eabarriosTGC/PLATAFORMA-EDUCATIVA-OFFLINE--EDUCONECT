# DEPLOY.md — Despliegue de EduConect Rural Server

## Requisitos

- **Hardware:** Raspberry Pi 3B+ o superior (ARMv8 / aarch64)
- **RAM:** 512 MB mínimo (idle ~5-8 MB)
- **Almacenamiento:** 100 MB libres
- **SO:** Raspberry Pi OS Lite (64 bits), Alpine Linux ARM64 o Ubuntu Server ARM64
- **Dependencias:** ninguna (binario estático)

---

## Cross-compilación (recomendado)

Compilar en tu PC y copiar el binario a la Raspberry Pi.

### Con Docker (sin instalar toolchains)

```bash
docker run --rm \
  -v $(pwd):/home/rust/src \
  -w /home/rust/src \
  messense/rust-musl-cross:aarch64-musl \
  cargo build --release

# El binario estará en:
#   target/aarch64-unknown-linux-musl/release/edu-conect-rural-server
```

### Con script nativo (requiere toolchain musl)

```bash
./cross-compile.sh
```

---

## Compilar el frontend

El frontend Next.js debe compilarse a exportación estática:

```bash
cd /home/trabajo/ai-startup/Rust_rural/edu-conect-rural-dashboard
npm install

# Agregar "output: 'export'" a next.config.mjs
npm run build
# → genera carpeta out/
```

---

## Instalación en Raspberry Pi

```bash
# 1. Copiar binario y scripts
scp target/aarch64-unknown-linux-musl/release/edu-conect-rural-server \
    pi@192.168.1.100:/home/pi/educonect/
scp start.sh pi@192.168.1.100:/home/pi/educonect/

# 2. Hacer ejecutables
ssh pi@192.168.1.100
chmod +x /home/pi/educonect/edu-conect-rural-server /home/pi/educonect/start.sh

# 3. Copiar frontend compilado
scp -r ../edu-conect-rural-dashboard/out pi@192.168.1.100:/home/pi/educonect/frontend/

# 4. Iniciar servidor
cd /home/pi/educonect
./start.sh
```

---

## Instalación en Alpine Linux

```bash
# Alpine no tiene Node.js runtime, solo se necesita el binario estático
apk add --no-cache ca-certificates

# Copiar archivos
cp edu-conect-rural-server /opt/educonect/
cp start.sh /opt/educonect/
cp -r frontend /opt/educonect/

# Crear servicio OpenRC
cat > /etc/init.d/educonect << 'EOF'
#!/sbin/openrc-run
name="EduConect Rural"
description="Plataforma educativa offline"
command="/opt/educonect/edu-conect-rural-server"
command_user="nobody:nobody"
pidfile="/run/educonect.pid"
command_background=false

depend() {
    need net
}
EOF
chmod +x /etc/init.d/educonect
rc-update add educonect default
rc-service educonect start
```

---

## systemd (arranque automático, Raspberry Pi OS)

Crear `/etc/systemd/system/educonect.service`:

```ini
[Unit]
Description=EduConect Rural Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/educonect
ExecStart=/home/pi/educonect/edu-conect-rural-server
Restart=on-failure
RestartSec=5
Environment=DB_PATH=/home/pi/educonect/data/educonect.db
Environment=FRONTEND_PATH=/home/pi/educonect/frontend
Environment=LISTEN_ADDR=0.0.0.0:8080

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now educonect.service
sudo systemctl status educonect.service
```

---

## Variables de entorno

| Variable         | Defecto                                      | Descripción                      |
|------------------|----------------------------------------------|----------------------------------|
| `DB_PATH`        | `data/educonect.db`                          | Ruta al archivo SQLite           |
| `FRONTEND_PATH`  | `../edu-conect-rural-dashboard/out/`         | Directorio del frontend estático |
| `LISTEN_ADDR`    | `0.0.0.0:8080`                               | Dirección y puerto de escucha    |
| `RUST_LOG`       | `info`                                       | Nivel de log (debug, info, warn) |

---

## Verificación

```bash
# Ver servidor activo
curl -s http://192.168.1.100:8080/api/cursos

# Obtener detalle de un curso
curl -s http://192.168.1.100:8080/api/cursos/1

# Crear progreso (POST)
curl -s -X POST http://192.168.1.100:8080/api/progreso \
  -H "Content-Type: application/json" \
  -d '{"usuario": "maria_gomez", "curso_id": 1, "porcentaje": 45.5}'

# Ver progreso de un estudiante
curl -s http://192.168.1.100:8080/api/progreso/maria_gomez

# Probar validación (porcentaje inválido)
curl -s -X POST http://192.168.1.100:8080/api/progreso \
  -H "Content-Type: application/json" \
  -d '{"usuario": "test", "curso_id": 1, "porcentaje": 150}'

# El servidor redirige / a /index.html
curl -s -o /dev/null -w "%{http_code}" http://192.168.1.100:8080/
```

---

## Notas técnicas

- **SQLite WAL mode:** permite lecturas concurrentes sin bloqueos.
- **Binario estático:** no requiere librerías compartidas en la Raspberry Pi.
- **Idle RAM:** ~5-8 MB con el perfil release (muy por debajo del límite de 50MB).
- **Tamaño:** ~3.5 MB (compilado con LTO y strip, sin kiwix-serve externo).
- **Migrations y seeds:** se ejecutan automáticamente al arrancar (solo la primera vez).
- **Thread safety:** `Arc<Mutex<Connection>>` para acceso concurrente desde múltiples requests.
- **Compilación ARM:** target `aarch64-unknown-linux-musl` para Alpine Linux.

---

## Wikipedia Offline (lector ZIM puro Rust)

La plataforma incluye un lector de archivos ZIM integrado — **sin necesidad de kiwix-serve**.
El binario lee archivos `.zim` directamente desde `data/contenido/zim/`.

### Instalación

```bash
cd /home/pi/educonect

# Crear directorio para archivos ZIM
mkdir -p data/contenido/zim

# Descargar Wikipedia en español (edición para escuelas, ~3 GB, sin imágenes)
# O un ZIM más pequeño para probar:
./install-zim.sh

# O manualmente:
wget -P data/contenido/zim/ \
  https://download.kiwix.org/zim/wikipedia/wikipedia_es_for_schools_nopic_2024-06.zim

# Reiniciar servidor — detecta automáticamente
sudo systemctl restart educonect
```

### Acceso

| Ruta           | Descripción                                  |
|----------------|----------------------------------------------|
| `/zim/`        | Redirige a la página principal de Wikipedia  |
| `/zim/A/Colombia` | Artículo específico (espacio de nombres A) |

### Características

- **Sin kiwix-serve**: el binario lee `.zim` directamente (crate `zim` v0.4.0)
- **Búsqueda binaria**: O(log n) en el URL list del ZIM
- **Redirecciones**: resuelve cadenas de redirects automáticamente
- **Estilo oscuro**: inyecta CSS modo noche compatible con el tema EduConect
- **Multi-formato**: HTML, CSS, JS, PNG, JPEG, SVG — todo desde el ZIM
- **Mínimo impacto RAM**: el ZIM se mapea en memoria (mmap) sin cargar completo
- **Zero runtime dependencies**: no requiere Node.js, Python, ni binarios auxiliares

### ZIMs recomendados

| Nombre                        | Tamaño | Descripción                              |
|-------------------------------|--------|------------------------------------------|
| `wikipedia_es_for_schools_nopic` | ~3 GB | Wikipedia español educativo, sin imágenes |
| `wikipedia_es_nopic`          | ~8 GB  | Wikipedia español completa, sin imágenes  |
| `wikipedia_es_nopic_2024-06`  | ~12 GB | Wikipedia español reciente, sin imágenes  |
| `wikibooks_es_all_nopic`      | ~300 MB| Wikilibros en español                     |

Descarga desde: https://download.kiwix.org/zim/wikipedia/
