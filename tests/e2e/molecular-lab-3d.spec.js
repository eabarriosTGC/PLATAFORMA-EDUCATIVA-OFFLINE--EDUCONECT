const { test, expect } = require('@playwright/test');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

test('laboratorio molecular funciona completamente offline', async ({ page }) => {
  const externas=[];
  page.on('request',request=>{if(new URL(request.url()).origin!==new URL(BASE).origin) externas.push(request.url());});
  await page.goto(`${BASE}/modulos/qui-401/`);
  await page.waitForFunction(()=>window.molecularLabReady===true);
  await expect(page.locator('#scene canvas')).toBeVisible();
  await page.locator('[data-id="carbon"]').click();
  await expect(page.locator('#moleculeName')).toHaveText('Dióxido de carbono');
  await page.locator('[data-answer="carbon"]').click();
  await expect(page.locator('#quizFeedback')).toContainText('Correcto');
  expect(externas).toEqual([]);
});

test('laboratorio molecular no desborda en móvil', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}/modulos/qui-401/`);
  await page.waitForFunction(()=>window.molecularLabReady===true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('la API publica el módulo con metadatos de Química', async ({ request }) => {
  const response = await request.get('/api/modulos');
  expect(response.status()).toBe(200);
  const data = await response.json();
  const module = data.modulos.find(item => item.id === 'qui-401');
  expect(module).toBeTruthy();
  expect(module.categoria).toBe('Química');
  expect(module.icono).toBe('⚗️');
  expect(module.path).toBe('/modulos/qui-401/');
});
