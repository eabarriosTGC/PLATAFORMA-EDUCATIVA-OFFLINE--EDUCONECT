const { test, expect } = require('@playwright/test');
const { createOriginPolicy } = require('./helpers/origin-policy');

const ORIGIN_POLICY = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');

test.describe('Clase de Geometría 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('educonect:module:cie-405'));
  });

  test('carga offline, identifica cuerpos geométricos y completa una misión', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      if (ORIGIN_POLICY.isExternalRequest(request.url())) external.push(request.url());
    });

    await page.goto('/modulos/cie-405/');
    await expect.poll(() => page.evaluate(() => window.geometryLabReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();

    await page.locator('button[data-solid="cubo"]').click();
    await expect(page.locator('#solidName')).toHaveText('Cubo');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');

    await page.locator('button[data-solid="cilindro"]').click();
    await expect(page.locator('#solidName')).toHaveText('Cilindro');
    await expect(page.locator('#solidFaces')).toHaveText('2');
    expect(external).toEqual([]);
  });

  test('mantiene controles y contenido sin desbordamiento en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-405/');
    await expect.poll(() => page.evaluate(() => window.geometryLabReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('#rotateButton')).toBeVisible();
    await expect(page.locator('#solidButtons button')).toHaveCount(5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('la API publica el módulo con metadatos', async ({ request }) => {
    const response = await request.get('/api/modulos');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const module = data.modulos.find(item => item.id === 'cie-405');
    expect(module).toBeTruthy();
    expect(module.categoria).toBe('Ciencias');
    expect(module.icono).toBe('📐');
    expect(module.path).toBe('/modulos/cie-405/');
  });
});
