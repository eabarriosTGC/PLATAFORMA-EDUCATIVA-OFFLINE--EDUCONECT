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

  test('GET /api/network/qr.svg entrega SVG local sin caché', async ({ request }) => {
    const res = await request.get('/api/network/qr.svg');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
    expect(res.headers()['cache-control']).toContain('no-store');

    const body = await res.text();
    expect(body.trimStart().startsWith('<?xml')).toBe(true);
    expect(body).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(body).toContain('viewBox');
    expect(body).toContain('<path');
    expect(body.trimEnd().endsWith('</svg>')).toBe(true);
  });

  test('la portada muestra QR y botón copiar cuando hay dirección', async ({ page, request }) => {
    const net = await (await request.get('/api/network')).json();
    test.skip(net.access_url === null, 'sin dirección no hay QR que mostrar');

    await page.goto('/');

    const qr = page.locator('#network-qr');
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute('src', '/api/network/qr.svg');

    const copy = page.locator('#network-copy');
    await expect(copy).toBeVisible();
    await expect(copy).toHaveText('Copiar dirección');
  });
});
