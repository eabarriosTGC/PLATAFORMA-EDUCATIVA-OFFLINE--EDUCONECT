const { test, expect } = require('@playwright/test');
const { createOriginPolicy } = require('./helpers/origin-policy');

const ORIGIN_POLICY = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');

test.describe('Campo Magnético 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('educonect:module:cie-410'));
  });

  test('carga offline, identifica polos y completa una misión', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      if (ORIGIN_POLICY.isExternalRequest(request.url())) external.push(request.url());
    });

    await page.goto('/modulos/cie-410/');
    await expect.poll(() => page.evaluate(() => window.magnetismo3dReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();

    await page.locator('button[data-part="norte"]').click();
    await expect(page.locator('#partName')).toHaveText('Polo norte');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');

    await page.locator('button[data-part="sur"]').click();
    await expect(page.locator('#partName')).toHaveText('Polo sur');
    expect(external).toEqual([]);
  });

  test('mantiene controles y contenido sin desbordamiento en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-410/');
    await expect.poll(() => page.evaluate(() => window.magnetismo3dReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('#rotateButton')).toBeVisible();
    await expect(page.locator('#partButtons button')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('la API publica el módulo con metadatos', async ({ request }) => {
    const response = await request.get('/api/modulos');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const module = data.modulos.find(item => item.id === 'cie-410');
    expect(module).toBeTruthy();
    expect(module.categoria).toBe('Ciencias');
    expect(module.icono).toBe('🧲');
    expect(module.path).toBe('/modulos/cie-410/');
  });
});
