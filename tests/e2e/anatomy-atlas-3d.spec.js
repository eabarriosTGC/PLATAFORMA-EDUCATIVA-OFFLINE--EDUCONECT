const { test, expect } = require('@playwright/test');
const { createOriginPolicy } = require('./helpers/origin-policy');

const POLICY = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');

test.describe('Atlas del Cuerpo Humano 3D', () => {
  // Ojo: NO usar addInitScript en beforeEach — corre en CADA carga y borraría
  // la clave en el reload del test de persistencia (el módulo guarda bien;
  // el borrado en el reload era del propio spec).

  test('carga offline y permite explorar sistemas y órganos', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('educonect:module:cie-404'));
    const external = [];
    page.on('request', request => {
      if (POLICY.isExternalRequest(request.url())) external.push(request.url());
    });
    await page.goto('/modulos/cie-404/');
    await expect.poll(() => page.evaluate(() => window.anatomyAtlasReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();

    await page.locator('[data-system="circulatory"]').click();
    await expect(page.locator('#viewerTitle')).toHaveText('Sistema circulatorio');
    await page.locator('[data-organ="heart"]').click();
    await expect(page.locator('#organName')).toHaveText('Corazón');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');

    await page.locator('[data-system="digestive"]').click();
    await page.locator('[data-organ="liver"]').click();
    await expect(page.locator('#organName')).toHaveText('Hígado');
    expect(external).toEqual([]);
  });

  test('recorre el camino del oxígeno y guarda el avance', async ({ page }) => {
    await page.goto('/modulos/cie-404/');
    await expect.poll(() => page.evaluate(() => window.anatomyAtlasReady)).toBe(true);
    for (let step = 1; step < 5; step += 1) await page.locator('#journeyNext').click();
    await expect(page.locator('#journeyStep')).toHaveText('5 / 5');
    await page.locator('#journeyNext').click();
    await expect(page.locator('#journeyText')).toContainText('oxígeno llegó');
    await expect(page.locator('#progressText')).not.toHaveText('0%');
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.anatomyAtlasReady)).toBe(true);
    await expect(page.locator('#progressText')).not.toHaveText('0%');
  });

  test('no desborda y conserva controles táctiles en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-404/');
    await expect.poll(() => page.evaluate(() => window.anatomyAtlasReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await expect(page.locator('[data-system="respiratory"]')).toBeVisible();
    await expect(page.locator('#answers button')).toHaveCount(4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('la API lo publica como módulo de Ciencias', async ({ request }) => {
    const response = await request.get('/api/modulos');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const module = data.modulos.find(item => item.id === 'cie-404');
    expect(module).toBeTruthy();
    expect(module.categoria).toBe('Ciencias');
    expect(module.icono).toBe('🫀');
    expect(module.path).toBe('/modulos/cie-404/');
  });
});
