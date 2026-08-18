// @ts-check
// module-catalog.spec.js — Barrido E2E de todas las rutas anunciadas por /api/modulos.
//
// Las rutas las prepara global-setup.js en reports/modules-routes.json (el spec
// se carga antes de beforeAll, así que no puede consultar la API directamente).
// Genera un test por módulo y escribe UNA FILA POR TEST en reports/modules.csv
// (append incremental: sobrevive a reinicios del worker).
//   route, desktop_load, mobile_load, console_errors, page_errors,
//   failed_requests, external_requests, back_navigation,
//   interactive_controls, horizontal_overflow, offline_load, result
//
// No pulsa botones de juego: solo detecta que la página carga sana en
// escritorio y móvil, sin errores JS, sin recursos fallidos, sin requests
// externos, con regreso al catálogo y sin desbordamiento horizontal.
// La interacción profunda se agrupa por patrones en una fase posterior.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { auditModule } = require('./helpers/module-audit');

const REPORTS_DIR = path.join(__dirname, 'reports');
const CSV_PATH = path.join(REPORTS_DIR, 'modules.csv');
const ROUTES_FILE = path.join(REPORTS_DIR, 'modules-routes.json');
const HEADER = [
  'route', 'desktop_load', 'mobile_load', 'console_errors', 'page_errors',
  'failed_requests', 'external_requests', 'back_navigation',
  'interactive_controls', 'horizontal_overflow', 'offline_load', 'result',
].join(',');

// Cargadas por globalSetup antes de cargar los specs.
const routes = fs.existsSync(ROUTES_FILE)
  ? JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'))
  : [];

// Reinicia el CSV en la primera escritura del proceso; cada test hace append.
function writeRow(row) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const exists = fs.existsSync(CSV_PATH) && fs.readFileSync(CSV_PATH, 'utf8').includes(HEADER);
  if (!exists) {
    fs.writeFileSync(CSV_PATH, HEADER + '\n');
  }
  fs.appendFileSync(CSV_PATH, [
    row.route, row.desktop_load, row.mobile_load, row.console_errors, row.page_errors,
    row.failed_requests, row.external_requests, row.back_navigation,
    row.interactive_controls, row.horizontal_overflow, row.offline_load, row.result,
  ].join(',') + '\n');
}

test.describe('catálogo de módulos', () => {
  for (const route of routes) {
    test(`carga sana: ${route}`, async ({ browser, request }, testInfo) => {
      test.setTimeout(120_000);

      // Contexto limpio por módulo (sin estado compartido entre páginas)
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        const row = await auditModule(page, request, route);
        writeRow(row);

        expect.soft(row.desktop_load, `desktop_load ${route}`).toBe('ok');
        expect.soft(row.mobile_load, `mobile_load ${route}`).toBe('ok');
        expect.soft(row.offline_load, `offline_load ${route}`).toBe('ok');
        expect.soft(row.failed_requests, `failed_requests ${route}`).toBe(0);
        expect.soft(row.page_errors, `page_errors ${route}`).toBe(0);
        expect.soft(row.external_requests, `external_requests ${route}`).toBe(0);

        testInfo.annotations.push({
          type: 'result',
          description: `result=${row.result} controls=${row.interactive_controls} back=${row.back_navigation} overflow=${row.horizontal_overflow}px`,
        });
        if (row.console_errors > 0) {
          testInfo.annotations.push({ type: 'console', description: row._detail.consoleErrors.join(' | ') });
        }
        if (row.page_errors > 0) {
          testInfo.annotations.push({ type: 'pageerror', description: row._detail.pageErrors.join(' | ') });
        }
        if (row.failed_requests > 0) {
          testInfo.annotations.push({ type: 'failed', description: row._detail.failedRequests.join(' | ') });
        }
        if (row.external_requests > 0) {
          testInfo.annotations.push({ type: 'external', description: row._detail.externalRequests.join(' | ') });
        }
      } finally {
        await context.close();
      }
    });
  }
});
