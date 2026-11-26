const { test, expect } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

test('quizzes exige autenticación', async ({ request }) => {
  expect((await request.get(`${BASE}/api/profesor/quizzes`)).status()).toBe(401);
});

test('interfaz local y móvil', async ({ page }) => {
  const externas = [];
  const fallidas = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(BASE).origin) externas.push(request.url());
  });
  page.on('requestfailed', request => fallidas.push(`${request.url()} (${request.failure()?.errorText})`));
  await page.addInitScript(() => sessionStorage.setItem('educonect_profesor_token', 'token-de-prueba'));
  await page.route('**/api/profesor/quizzes', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 1, titulo: 'Prueba', tema: 'Ciencias', total_preguntas: 2 }]),
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/profesor/quizzes/`);
  await expect(page).toHaveTitle(/Cuestionarios/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(externas).toEqual([]);
  expect(fallidas).toEqual([]);
});

test('editor protege atributos y permite respuestas múltiples', async ({ page }) => {
  const ataque = '\" autofocus onfocus=\"window.__quizXss=1';
  await page.addInitScript(() => sessionStorage.setItem('educonect_profesor_token', 'token-de-prueba'));
  await page.route('**/api/profesor/quizzes', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 7, titulo: 'Prueba segura', tema: 'Ciencias', total_preguntas: 1 }]),
  }));
  await page.route('**/api/profesor/quizzes/7', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      id: 7,
      titulo: 'Prueba segura',
      tema: 'Ciencias',
      descripcion: '',
      preguntas: [{ type: 'multi', text: ataque, options: [ataque, 'Segura'], answers: [1], time: 20 }],
    }),
  }));

  await page.goto(`${BASE}/profesor/quizzes/`);
  await page.locator('[data-id="7"]').click();
  await expect(page.locator('[data-text]')).toHaveValue(ataque);
  await expect(page.locator('[data-option="0"]')).toHaveValue(ataque);
  await expect(page.locator('[data-multi-correct]')).toHaveCount(2);
  await expect(page.locator('[data-multi-correct="1"]')).toBeChecked();
  expect(await page.evaluate(() => window.__quizXss)).toBeUndefined();

  await page.locator('[data-multi-correct="0"]').check();
  await expect(page.locator('[data-multi-correct="0"]')).toBeChecked();
});

test('cuestionarios aparecen en la plataforma estudiantil sin soluciones', async ({ request, page }) => {
  const lista = await request.get(BASE + '/api/quizzes');
  expect(lista.status()).toBe(200);
  const quizzes = await lista.json();
  await page.goto(BASE + '/app/#cuestionarios');
  await expect(page.getByText('Cuestionarios', { exact: true }).first()).toBeVisible();
  if (quizzes.length) {
    const jugar = await request.get(BASE + '/api/quizzes/' + quizzes[0].id + '/jugar');
    expect(jugar.status()).toBe(200);
    const raw = JSON.stringify(await jugar.json());
    expect(raw).not.toContain('"answer"');
    expect(raw).not.toContain('"answers"');
    expect(raw).not.toContain('"accepted"');
    expect(raw).not.toContain('"tol"');
  }
});
