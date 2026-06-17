# 📚 Módulos Interactivos EduConect Rural
## Matemáticas Grado 1 — Gamificación Offline

> **Peso total:** ~45KB (HTML/CSS/JS puro, sin dependencias externas)
> **Compatible:** Cualquier navegador moderno, tablets, celulares
> **Contexto:** La Guajira, Colombia — Comunidades Wayuu

---

## 🗂️ Estructura de archivos

```
modulos-matematicas-grado1/
├── index.html              ← Menú principal (4 módulos)
├── estilos-globales.css    ← Tema desierto Guajiro + componentes
│
├── conteo-wayuu/
│   ├── index.html
│   ├── style.css
│   └── app.js              ← Canvas 2D + animación de objetos flotantes
│
├── sumas-concreto/
│   ├── index.html
│   ├── style.css
│   └── app.js              ← Drag & Drop táctil/ratón con semillas
│
├── formas-entorno/
│   ├── index.html
│   ├── style.css
│   └── app.js              ← SVG interactivo, click/táctil
│
└── secuencias-chinchorro/
    ├── index.html
    ├── style.css
    └── app.js              ← Secuencias de colores Wayuu
```

---

## 🔌 Integración con EduConect Rural (Backend Rust/Axum)

### Opción A: Copiar a carpeta estática del frontend

Después de compilar el frontend Next.js (`npm run build`), copia esta carpeta dentro de `out/`:

```bash
cd edu-conect-rural-dashboard
cp -r ../modulos-matematicas-grado1 out/modulos/
```

El backend ya sirve todo `out/` con `ServeDir`, así que los módulos quedarán accesibles en:
- `http://192.168.x.1:8080/modulos/index.html`

### Opción B: Servir como carpeta independiente

En `main.rs` del backend, agrega una ruta adicional:

```rust
// En tu router de Axum:
let modulos_dir = std::env::var("MODULOS_PATH")
    .unwrap_or_else(|_| "modulos/".to_string());

let app = Router::new()
    .route("/", get(redirigir_index))
    .route("/api/cursos", get(listar_cursos))
    // ... tus rutas actuales ...
    .nest_service("/modulos", ServeDir::new(modulos_dir))
    .nest_service("/", ServeDir::new(frontend_path));
```

### Opción C: Enlace desde el frontend Next.js

Agrega un botón en `components/quick-access-grid.tsx`:

```tsx
<a href="/modulos/index.html" className="tarjeta-modulo">
    <div className="icono">🎮</div>
    <h3>Módulos Interactivos</h3>
    <p>Juegos de matemáticas para grado 1</p>
</a>
```

---

## 📱 Compatibilidad táctil

Todos los módulos están optimizados para **touch events**:
- **Conteo Wayuu:** Canvas con animación automática (no requiere interacción táctil en canvas)
- **Sumas con Manipulativos:** Drag & Drop nativo con `touchstart/touchmove/touchend`
- **Formas en mi Entorno:** Click + `touchend` con `preventDefault`
- **Patrones Wayuu:** Botones grandes (70x70px), fáciles de tocar

---

## 🎨 Personalización

### Cambiar objetos del canvas (Conteo Wayuu)

Edita `conteo-wayuu/app.js`:

```javascript
const niveles = [
    {
        pregunta: "¿Cuántos ___ hay?",
        cantidad: 5,
        tipo: 'chivo',  // ← cambia por: chivo, cesta, chinchorro, iguaraya, cactus
        opciones: [4, 5, 6, 7],
        fondo: 'dia'    // ← dia, tarde, atardecer
    }
];
```

### Agregar más niveles

Cada módulo tiene un array `niveles` o `nivelesFormas` o `nivelesPatrones`. Solo duplica un objeto y ajusta los valores.

### Cambiar paleta de colores Wayuu

Edita las variables CSS en `estilos-globales.css`:

```css
:root {
    --color-wayuu-rojo: #C41E3A;
    --color-wayuu-azul: #1E6091;
    --color-wayuu-amarillo: #F4D03F;
}
```

---

## 📊 Métricas de aprendizaje (futuro)

Para conectar con el backend y guardar progreso, puedes agregar al final de cada `app.js`:

```javascript
// Al completar un módulo:
fetch('/api/progreso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        usuario: localStorage.getItem('usuario') || 'anonimo',
        curso_id: 1,  // ID del curso de matemáticas
        porcentaje: (estrellas / niveles.length) * 100
    })
});
```

---

## 🚀 Despliegue en Raspberry Pi

```bash
# 1. Copiar al Pi
scp -r modulos-matematicas-grado1 pi@192.168.x.1:/opt/educonect/frontend/modulos/

# 2. Reiniciar servidor (si usas Opción A)
ssh pi@192.168.x.1
sudo systemctl restart educonect

# 3. Acceder desde cualquier dispositivo conectado al WiFi:
# http://192.168.x.1:8080/modulos/index.html
```

---

## 📝 Licencia

MIT — Proyecto EduConect Rural para comunidades de La Guajira, Colombia.
