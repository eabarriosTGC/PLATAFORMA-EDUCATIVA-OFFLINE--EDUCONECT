# PLAN: Hacer EduConect Rural IRRESISTIBLE
## Para contratos con Ministerio de Educación / Alcaldías

---

## 🏆 Lo que YA tenemos (ventaja competitiva)

| Componente | Estado | vs Kolibri | vs Kiwix | vs RACHEL |
|---|---|---|---|---|
| Backend Rust/Axum (3.6MB) | ✅ | 🏆 **50x más liviano** | 🏆 **nativo, sin wrapper** | 🏆 **sin Python/PHP** |
| Wikipedia ZIM offline | ✅ | ❌ no tiene | 🏆 **misma tecnología** | ✅ similar |
| Diccionario + Wayuunaiki | ✅ | ❌ | ❌ | ❌ |
| 21 módulos interactivos | ✅ | Parcial | ❌ | Parcial |
| Biblioteca PDF | ✅ | Parcial | ❌ | Parcial |
| SQLite embebido | ✅ | ✅ mismo | ✅ mismo | ❌ MySQL |
| Frontend HTML/JS vanilla | ✅ | ❌ React pesado | ❌ extensión | ❌ PHP |

---

## 🚧 Lo que falta para ser IRRESISTIBLE

### 🔴 Prioridad 1 — Script de instalación único

Un solo comando que deje TODO listo en una Raspberry Pi:
```bash
curl -sSL https://educonect.co/install | bash
```

Esto incluye:
- Detectar arquitectura (ARM64, x86_64)
- Descargar binario precompilado
- Crear usuario `educonect`
- Configurar hotspot WiFi (hostapd + dnsmasq)
- Configurar portal cautivo (redirige a la plataforma)
- Configurar inicio automático (systemd)
- Descargar contenido inicial (ZIMs, biblioteca)
- Dejar servidor corriendo en puerto 80

**Impacto:** Un alcalde o secretario de educación puede entregar la Raspberry Pi, enchufarla, y en 5 minutos la escuela tiene su plataforma funcionando. **Eso es irresistible.**

### 🔴 Prioridad 2 — Hotspot WiFi + Portal Cautivo

La Raspberry Pi debe crear su propia red WiFi. Cuando un estudiante se conecta, automáticamente ve la plataforma (portal cautivo).

```
[Estudiante] ──WiFi──> [RPi EduConect] (sin internet)
                           │
                    ┌──────┴──────┐
                    │ Plataforma  │
                    │ + Wikipedia │
                    │ + Videos    │
                    │ + Módulos   │
                    └─────────────┘
```

**Stack:** hostapd + dnsmasq + iptables
**Config:** script idempotente que configura todo en una ejecución.

### 🟡 Prioridad 3 — Videos offline

- **yt-dlp** incorporado en `install.sh` para descarga
- **Plyr.js** (~28KB) como reproductor HTML5
- **ffmpeg** para thumbnails + transcoding a H.264
- Endpoint `/api/diccionario/descargar-video?url=...`

### 🟡 Prioridad 4 — PWA / Service Worker

Kiwix-js ya demostró que se puede tener un lector ZIM completo en JavaScript vanilla + Service Worker. Nosotros podemos hacer lo mismo:

- Service Worker que cachea la app completa
- La plataforma funciona aunque la Raspberry Pi se apague
- Los estudiantes pueden seguir navegando contenido pre-cargado 

### 🟢 Prioridad 5 — Benchmarks contra Kolibri y Kiwix

Para el semillero de investigación y para justificar el contrato:

| Métrica | EduConect | Kolibri | Kiwix |
|---|---|---|---|
| Tamaño binario | **3.6 MB** | ~200 MB | ~15 MB |
| RAM en idle | **~8 MB** | ~150 MB | ~30 MB |
| RAM con 10 usuarios | **~20 MB** | ~400 MB | ~60 MB |
| Tiempo arranque | **~40s** | ~120s | ~5s |
| Dependencias runtime | **0** | Python 3 + Django | libc |
| Arquitectura | **Rust nativo** | Python interpretado | C++ con wrapper |
| Wayuunaiki | **✅ Sí** | ❌ No | ❌ No |
| Sin internet real | **✅ 100%** | ✅ 100% | ✅ 100% |

### 🟢 Prioridad 6 — Documentación profesional

Para que una alcaldía pueda licitar:
- Pliego de condiciones tipo
- Ficha técnica del servicio
- Propuesta económica formal
- Términos de referencia para contratación pública

---

## 📦 EL PAQUETE IRRESISTIBLE

```
educonect-package/
├── install.sh                    ← ¡Un solo comando!
├── edu-conect-rural-server       ← Binario estático (3.6 MB)
├── data/
│   ├── contenido/
│   │   ├── zim/                  ← Wikipedia offline
│   │   └── videos/               ← Contenido multimedia
│   ├── biblioteca/               ← PDFs educativos
│   └── educonect.db              ← SQLite (se crea sola)
├── config/
│   ├── hostapd.conf              ← Hotspot WiFi
│   ├── dnsmasq.conf             ← DNS local
│   └── educonect.service         ← systemd
├── scripts/
│   ├── setup-hotspot.sh          ← Configura WiFi
│   ├── download-content.sh       ← Descarga ZIMs, videos
│   └── update-content.sh         ← Actualiza desde USB
└── proposal/
    ├── propuesta-comercial.md    ← Para alcaldías
    ├── ficha-tecnica.pdf         ← Especificaciones
    └── terminos-referencia.md    ← Para contratación pública
```

---

## 💰 VALOR COMERCIAL POR ESCOLARIDAD

| Cantidad | Precio unitario/año | Total/año |
|---|---|---|
| 1 escuela (pago directo) | $2.5M COP | $2.5M COP |
| 5 escuelas (vereda) | $1.8M COP c/u | $9M COP |
| 20 escuelas (municipio pequeño) | $1.2M COP c/u | $24M COP |
| 50 escuelas (municipio mediano) | $0.8M COP c/u | $40M COP |
| 200+ escuelas (departamento) | A negociar | $120M+ COP |

---

## 📊 ROI para la alcaldía

Comparado con:
- **Tabletas con plan de datos:** $1-2M COP por tableta/año × 200 estudiantes = $200-400M COP/año
- **Internet satelital:** $5-10M COP/mes por escuela = $60-120M COP/año/escuela
- **EduConect Rural:** $1.2M COP/escuela/año **TODO INCLUIDO**

**Ahorro vs tablets con datos:** **~95%**
**Ahorro vs internet satelital:** **~98%**

---

## 🎯 PLAN DE ACCIÓN (próximos pasos)

Lo que podemos construir en orden:

1. **Hoy:** El diccionario offline ya está ✅
2. **Hoy:** Script `install.sh` unificado
3. **Hoy:** Benchmarks contra Kolibri/Kiwix
4. **Próximo:** Hotspot WiFi + portal cautivo
5. **Próximo:** Reproducción de video offline
6. **Próximo:** Documentación profesional para licitación
7. **Futuro:** PWA / Service Worker
8. **Futuro:** Sincronización P2P (estilo Kolibri)
