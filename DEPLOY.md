# EduConect Rural — Guía de Despliegue

Plataforma educativa offline para escuelas rurales. Corre en Raspberry Pi / Orange Pi con Alpine Linux headless.

---

## Requisitos del sistema

| Componente | Mínimo | Recomendado |
|---|---|---|
| RAM | 512 MB | 1 GB |
| Almacenamiento | 8 GB SD | 32 GB SD |
| SO | Alpine Linux 3.20+ | Alpine Linux 3.21 |
| Software | `yt-dlp`, `ffmpeg`, `espeak-ng` | — |

---

## 1. Instalación de dependencias del sistema

```bash
# Alpine Linux
apk add yt-dlp ffmpeg espeak-ng

# Fedora / Ubuntu
dnf install -y yt-dlp ffmpeg espeak-ng
# o: apt install -y yt-dlp ffmpeg espeak-ng
```

---

## 2. Compilación del servidor

```bash
cd edu-conect-rural-server

# Compilación optimizada para ARM (o x86_64)
cargo build --release

# El binario queda en:
ls -lh target/release/edu-conect-rural-server
# ~12 MB comprimido con strip + LTO + opt-level="z"
```

**Nota para Raspberry Pi:** si compilás directo en el Pi y tenés poca RAM, usá:
```bash
CARGO_BUILD_JOBS=1 cargo build --release
```

---

## 3. Configuración del entorno

Todas las variables de entorno son opcionales (tienen defaults de desarrollo):

| Variable | Default | Descripción |
|---|---|---|
| `DB_PATH` | `data/educonect.db` | Ruta a la base de datos SQLite |
| `FRONTEND_PATH` | `../edu-conect-rural-dashboard/out/` | Ruta al frontend estático compilado |
| `LISTEN_ADDR` | `0.0.0.0:8080` | Dirección y puerto donde escucha |
| `JWT_SECRET` | `educonect-rural-dev-secret` | ⚠️ **CAMBIAR EN PRODUCCIÓN** |
| `RUST_LOG` | `info` | Nivel de logs (error, warn, info, debug, trace) |

---

## 4. ⚠️ JWT_SECRET — Obligatorio en producción

El token JWT protege el panel de administración (`/admin/*`). Si no configurás `JWT_SECRET`, el servidor usa un valor por defecto de desarrollo y **cualquiera que conozca ese valor puede generar tokens válidos**.

### Generar un secreto seguro:

```bash
# Opción 1: aleatorio de 64 bytes en base64
openssl rand -base64 64

# Opción 2: UUID + fecha (más legible pero menos seguro)
echo "educonect-$(uuidgen)-$(date +%s)"
```

### Configurarlo:

```bash
# Temporal (solo esta sesión)
export JWT_SECRET="TU_SECRETO_AQUI"

# Permanente (systemd — ver sección 7)
# Se define en el archivo .service como Environment=
```

**Verificación:** al arrancar el servidor, si ves este warning en los logs, es que NO lo configuraste:
```
⚠️  JWT_SECRET no configurado. Usando secreto de DESARROLLO (cambiarlo en producción)
```
Si NO ves ese warning, el secreto se leyó correctamente del entorno.

---

## 5. Ejecución manual (desarrollo / prueba)

```bash
cd edu-conect-rural-server

# Asegurate de que el frontend esté compilado:
cd ../edu-conect-rural-dashboard && npm run build && cd -

# Crear directorios necesarios
mkdir -p data/videos data/contenido data/contenido/zim data/biblioteca

# Arrancar
JWT_SECRET="mi-secreto-produccion" \
RUST_LOG=info \
./target/release/edu-conect-rural-server
```

Salida esperada:
```
🚀 Servidor EduConect Rural escuchando en http://0.0.0.0:8080
📁 Frontend estático servido desde: ../edu-conect-rural-dashboard/out/
🎥 Encoder H.264 seleccionado: h264_v4l2m2m   (o libx264 en x86)
Base de datos lista: data/educonect.db (pool r2d2, max_size=8)
```

---

## 6. Contenido offline

### Videos educativos
```bash
# Descargar desde YouTube (requiere yt-dlp instalado)
curl -X POST http://localhost:8080/api/videos/descargar \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://youtube.com/watch?v=...", "quality": "720"}'

# Convertir video existente a H.264 optimizado
curl -X POST http://localhost:8080/api/videos/convertir \
  -H 'Content-Type: application/json' \
  -d '{"filename": "mi_video.mp4"}'
```

### Wikipedia offline (ZIM)
```bash
mkdir -p data/contenido/zim

# Descargar ZIM de Vikidia en español (~12 MB, ideal para primaria)
wget -P data/contenido/zim/ \
  https://download.kiwix.org/zim/vikidia/vikidia_es_all_nopic_2025-12.zim

# Reiniciar el servidor para que detecte el ZIM
```

---

## 7. Instalación como servicio systemd

Crear `/etc/systemd/system/educonect.service`:

```ini
[Unit]
Description=EduConect Rural — Plataforma Educativa Offline
Documentation=https://github.com/tu-org/educonect-rural
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/educonect/edu-conect-rural-server
ExecStart=/home/pi/educonect/edu-conect-rural-server/target/release/edu-conect-rural-server

# Variables de entorno
Environment=DB_PATH=/home/pi/educonect/data/educonect.db
Environment=FRONTEND_PATH=/home/pi/educonect/edu-conect-rural-dashboard/out
Environment=LISTEN_ADDR=0.0.0.0:8080
Environment=JWT_SECRET=CAMBIA_ESTO_POR_TU_SECRETO_REAL
Environment=RUST_LOG=info

# Resiliencia
Restart=always
RestartSec=10

# Límites de recursos (Pi tiene poca RAM)
MemoryMax=256M
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

Activar e iniciar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable educonect
sudo systemctl start educonect
sudo systemctl status educonect   # verificar que arrancó
```

---

## 8. Acceso desde la LAN

Una vez arrancado, el servidor escucha en `0.0.0.0:8080`. Los dispositivos en la misma red WiFi acceden vía:

```
http://<IP_DEL_PI>:8080/
```

Para encontrar la IP del Pi:
```bash
ip addr show wlan0 | grep 'inet ' | awk '{print $2}'
# o
hostname -I
```

---

## 9. Monitoreo básico

```bash
# Health check
curl http://localhost:8080/health
# {"status":"ok","version":"0.1.0"}

# Logs en tiempo real
sudo journalctl -u educonect -f

# Uso de memoria
ps aux | grep edu-conect-rural-server

# Espacio en disco
du -sh data/
```

---

## 10. Solución de problemas comunes

| Problema | Causa probable | Solución |
|---|---|---|
| `⚠️ JWT_SECRET no configurado` | Secreto de desarrollo en uso | Configurar `JWT_SECRET` en el archivo `.service` |
| `Error al abrir la base de datos` | `data/` no existe o sin permisos | `mkdir -p data && chmod 755 data` |
| `No hay archivos .zim` | Wikipedia offline no configurada | Descargar ZIM (sección 6) |
| `ffmpeg: command not found` | ffmpeg no instalado | `apk add ffmpeg` |
| Server no arranca tras apagón | systemd no configurado | Instalar el `.service` (sección 7) |
| Videos no se ven en celulares | Codec no soportado | Convertir con endpoint `/api/videos/convertir` |
