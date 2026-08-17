// @ts-check
// Configuración E2E del catálogo EduConect.
// - Chromium headless, 1 worker (resultados deterministas)
// - Trazas y capturas solo al fallar
// - Reporte HTML + JSON
// - Sin reintentos locales
// - Servidor real vía E2E_BASE_URL (default http://localhost:8080)
// - Este proceso NUNCA inicia ni detiene Docker: la orquestación es de CI.
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  globalSetup: require.resolve('./global-setup.js'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/json/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  outputDir: 'reports/test-results',
});
