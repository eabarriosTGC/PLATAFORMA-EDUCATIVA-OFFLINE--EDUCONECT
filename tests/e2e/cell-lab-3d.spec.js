const { test, expect } = require('@playwright/test');
const { createOriginPolicy } = require('./helpers/origin-policy');

const ORIGIN_POLICY = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');

test.describe('Laboratorio de la Célula 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('educonect:module:cie-403'));
  });

  test('carga offline, identifica orgánulos y compara los dos tipos de célula', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      if (ORIGIN_POLICY.isExternalRequest(request.url())) external.push(request.url());
    });

    await page.goto('/modulos/cie-403/');
    await expect.poll(() => page.evaluate(() => window.cellLabReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();

    await page.locator('button[data-organelle="nucleus"]').click();
    await expect(page.locator('#organelleName')).toHaveText('Núcleo');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');

    await page.locator('[data-cell="plant"]').click();
    await expect(page.locator('#viewerTitle')).toHaveText('Célula vegetal');
    await page.locator('button[data-organelle="chloroplast"]').click();
    await expect(page.locator('#organelleName')).toHaveText('Cloroplasto');
    await expect(page.locator('button[data-organelle="wall"]')).toBeVisible();
    expect(external).toEqual([]);
  });

  test('mantiene controles y contenido sin desbordamiento en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-403/');
    await expect.poll(() => page.evaluate(() => window.cellLabReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('#rotateButton')).toBeVisible();
    await expect(page.locator('#assemblyOptions button')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('la API publica el módulo con metadatos de Ciencias', async ({ request }) => {
    const response = await request.get('/api/modulos');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const module = data.modulos.find(item => item.id === 'cie-403');
    expect(module).toBeTruthy();
    expect(module.categoria).toBe('Ciencias');
    expect(module.icono).toBe('🧫');
    expect(module.path).toBe('/modulos/cie-403/');
  });
});
