const { test, expect } = require('@playwright/test');
const { createOriginPolicy } = require('./helpers/origin-policy');

const ORIGIN_POLICY = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');

test.describe('Molécula de Agua 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('educonect:module:cie-406'));
  });

  test('carga offline, identifica átomos y completa una misión', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      if (ORIGIN_POLICY.isExternalRequest(request.url())) external.push(request.url());
    });

    await page.goto('/modulos/cie-406/');
    await expect.poll(() => page.evaluate(() => window.agua3dReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();

    await page.locator('button[data-part="oxigeno"]').click();
    await expect(page.locator('#atomName')).toHaveText('Oxígeno');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');

    await page.locator('button[data-part="hidrogeno"]').click();
    await expect(page.locator('#atomName')).toHaveText('Hidrógeno');
    expect(external).toEqual([]);
  });

  test('mantiene controles y contenido sin desbordamiento en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-406/');
    await expect.poll(() => page.evaluate(() => window.agua3dReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('#rotateButton')).toBeVisible();
    await expect(page.locator('#atomButtons button')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('la API publica el módulo con metadatos', async ({ request }) => {
    const response = await request.get('/api/modulos');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const module = data.modulos.find(item => item.id === 'cie-406');
    expect(module).toBeTruthy();
    expect(module.categoria).toBe('Ciencias');
    expect(module.icono).toBe('⚗️');
    expect(module.path).toBe('/modulos/cie-406/');
  });
});
