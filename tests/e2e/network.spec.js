// @ts-check
// network.spec.js — Verifica GET /api/network y la sección de red de la portada.
//
// La dirección anunciada depende del despliegue:
//   - con PUBLIC_BASE_URL configurada → source=configured
//   - sin ella, el servidor deriva del Host → source=request_host
//   - sin configuración y sin Host → source=unavailable (access_url null)
// Los tests aceptan los tres estados: el contrato es la FORMA, no el valor.
const { test, expect } = require('@playwright/test');

const SOURCES = ['configured', 'request_host', 'unavailable'];
const FALLBACK = 'Consulta la dirección de red en el equipo servidor';

test.describe('dirección de red', () => {
  test('GET /api/network expone solo los campos del contrato', async ({ request }) => {
    const res = await request.get('/api/network');
    expect(res.status()).toBe(200);

    const body = await res.json();
    // Solo los cuatro campos pactados: nunca JWT, contraseñas ni IP Docker.
    expect(Object.keys(body).sort()).toEqual(['access_url', 'listen_addr', 'request_origin', 'source']);
    expect(SOURCES).toContain(body.source);
    expect(typeof body.listen_addr).toBe('string');
    expect(body.listen_addr.length).toBeGreaterThan(0);

    // Si hay dirección, debe ser una URL http/https sin credenciales ni fragmento.
    if (body.access_url !== null) {
      const parsed = new URL(body.access_url);
      expect(['http:', 'https:']).toContain(parsed.protocol);
      expect(parsed.username).toBe('');
      expect(parsed.password).toBe('');
      expect(parsed.hash).toBe('');
    }
  });

  test('la portada anuncia la dirección o su respaldo textual', async ({ page }) => {
    await page.goto('/');

    const label = page.getByText('Conecta otros dispositivos:');
    await expect(label).toBeVisible();

    const url = page.locator('#network-url');
    await expect(url).toBeVisible();
    const text = (await url.textContent()).trim();

    const ok =
      text === FALLBACK ||
      /^https?:\/\/[^\s]+$/.test(text);
    expect(ok, `texto inesperado: "${text}"`).toBe(true);
  });
});
