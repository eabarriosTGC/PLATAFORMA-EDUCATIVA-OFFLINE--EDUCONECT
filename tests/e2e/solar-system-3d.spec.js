const { test, expect } = require('@playwright/test');

test.describe('Explorador del Sistema Solar 3D', () => {
  test('carga offline, dibuja la escena y permite aprender', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== new URL(process.env.E2E_BASE_URL || 'http://localhost:8080').origin) external.push(request.url());
    });
    await page.goto('/modulos/cie-402/');
    await expect.poll(() => page.evaluate(() => window.solarLabReady)).toBe(true);
    await expect(page.locator('#scene canvas')).toBeVisible();
    await page.locator('[data-planet="mars"]').click();
    await expect(page.locator('#planetName')).toHaveText('Marte');
    await expect(page.locator('#missionStatus')).toContainText('Misión cumplida');
    await expect(page.locator('#playButton')).toBeVisible();
    expect(external).toEqual([]);
  });

  test('no produce desbordamiento horizontal en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/modulos/cie-402/');
    await expect.poll(() => page.evaluate(() => window.solarLabReady)).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
