// @ts-check
// global-setup.js — Precondición de la suite: verifica que el servidor real
// responde /health y /api/modulos ANTES de ejecutar cualquier test, y vuelca
// las rutas del catálogo a reports/modules-routes.json para que el spec pueda
// registrar un test por módulo (el spec se carga antes de beforeAll).
// Este proceso NUNCA inicia ni detiene Docker: la orquestación es de CI.
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const REPORTS_DIR = path.join(__dirname, 'reports');

module.exports = async function globalSetup() {
  const health = await fetch(`${BASE_URL}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `E2E: /health no respondió 2xx (${health ? health.status : 'sin conexión'}). ` +
      `¿Está el servidor arriba en ${BASE_URL}? La suite asume Docker ya corriendo (docker compose up -d).`
    );
  }
  const api = await fetch(`${BASE_URL}/api/modulos`).catch(() => null);
  if (!api || !api.ok) {
    throw new Error(
      `E2E: /api/modulos no respondió 2xx (${api ? api.status : 'sin conexión'}). ` +
      'Sin el catálogo, la suite no puede obtener las rutas a probar.'
    );
  }
  const data = await api.json();
  const routes = (data.modulos || []).map((m) => m.path);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'modules-routes.json'), JSON.stringify(routes, null, 2));
  console.log(`[setup] servidor OK en ${BASE_URL} — ${routes.length} rutas preparadas`);
};
