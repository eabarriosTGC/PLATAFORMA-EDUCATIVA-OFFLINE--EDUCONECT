// sw.js — Service Worker de EduConect Rural
// Cachea contenido offline para que funcione aunque el RPi esté ocupado
// Estrategia: Cache First para assets, Network First para API

const CACHE_NAME = 'educonect-v2';
const CACHE_ACL = [
  '/',
  '/diccionario/',
  '/videos-page/',
  '/manifest.json',
  '/app-icon.svg',
];

// ── INSTALL: Precargar app shell ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Intentar precargar, ignorar errores (todo es offline)
      await Promise.allSettled(
        CACHE_ACL.map((url) =>
          cache.add(url).catch(() => {
            // Fallback: crear entrada vacía si la URL no responde
            // (útil durante desarrollo cuando el servidor no corre)
          })
        )
      );
      // Forzar activación inmediata sin esperar a que se cierren las pestañas
      self.skipWaiting();
    })()
  );
});

// ── ACTIVATE: Limpiar caches viejos ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      // Tomar control de todas las pestañas abiertas
      self.clients.claim();
    })()
  );
});

// ── FETCH: Estrategia de caché inteligente ───────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // 1. Assets estáticos (excepto /static/ JS que debe ser fresco) → Cache First
  if (path.startsWith('/static/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (esAssetEstatico(path)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 2. API REST → Network First con fallback a caché
  if (path.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 3. ZIM y videos → Network Only (demasiado grandes para cachear)
  if (path.startsWith('/zim/') || path.startsWith('/videos/')) {
    return; // comportamiento normal del navegador
  }

  // 4. Módulos interactivos → Cache First (¡la joya!)
  if (path.startsWith('/modulos/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 5. Frontend Next.js → Cache First
  if (path.startsWith('/app/') || path.startsWith('/_next/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 6. Biblioteca PDF → Network Only (archivos grandes)
  if (path.startsWith('/biblioteca/')) {
    return;
  }

  // 7. Todo lo demás → Network First
  event.respondWith(networkFirst(event.request));
});

// ── ESTRATEGIAS ─────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Solo cachear respuestas exitosas
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // Si falla la red y no hay caché, devolver página offline
    if (request.destination === 'document') {
      return caches.match('/');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sin conexión', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── HELPERS ─────────────────────────────────────────────────────────

function esAssetEstatico(path) {
  // Extensiones de archivos estáticos
  const ext = path.split('.').pop().toLowerCase();
  return [
    'html', 'css', 'js', 'json', 'svg', 'png', 'jpg',
    'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf',
  ].includes(ext);
}
