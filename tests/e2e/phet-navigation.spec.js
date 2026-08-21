const { test, expect } = require('@playwright/test');

const PHET_MODULES = [
  'build-a-molecule',
  'balloons-and-static-electricity',
  'states-of-matter',
  'gravity-and-orbits',
  'natural-selection',
];

test.describe('Navegación de regreso en PhET', () => {
  test('los cinco laboratorios declaran un único regreso al dashboard actual', async ({ request }) => {
    for (const id of PHET_MODULES) {
      const wrapper = await request.get(`/modulos/phet/${id}/`);
      expect(wrapper.status(), id).toBe(200);
      const wrapperHtml = await wrapper.text();
      expect(wrapperHtml.match(/href="\/app\/"/g)?.length, id).toBe(1);
      expect(wrapperHtml, id).not.toContain('../menu.html');
      expect(wrapperHtml, id).not.toContain('comun/volver.js');

      const embedded = await request.get(`/modulos/phet/${id}/${id}_es.html`);
      expect(embedded.status(), id).toBe(200);
      const embeddedHtml = await embedded.text();
      expect(embeddedHtml.endsWith('\n</body>\n</html>\n'), id).toBe(true);
      expect(embeddedHtml.slice(-160), id).not.toContain('comun/volver.js');
    }
  });

  test('el único botón visible vuelve a /app/', async ({ page }) => {
    await page.goto('/modulos/phet/build-a-molecule/');
    const back = page.getByRole('link', { name: /Volver al inicio/ });
    await expect(back).toHaveCount(1);
    await expect(back).toHaveAttribute('href', '/app/');
    await expect(page.frameLocator('#simFrame').getByText('Volver', { exact: true })).toHaveCount(0);
    await back.click();
    await expect(page).toHaveURL(/\/app\/$/);
  });
});
