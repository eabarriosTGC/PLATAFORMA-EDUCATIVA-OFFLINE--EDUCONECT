const { test, expect } = require('@playwright/test');

test.describe('Panel del profesor', () => {
  test('separa el progreso mediante una identidad local de estudiante', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('#student-profile-modal')).toHaveClass(/visible/);
    await page.locator('#student-profile-name').fill('María Pérez');
    await page.getByRole('button', { name: 'Guardar nombre' }).click();
    await expect(page.locator('#greeting-text')).toContainText('María Pérez');
    expect(await page.evaluate(() => localStorage.getItem('educonect_estudiante'))).toBe('María Pérez');

    await page.reload();
    await expect(page.locator('#student-profile-modal')).not.toHaveClass(/visible/);
    await expect(page.locator('#greeting-text')).toContainText('María Pérez');
  });

  test('muestra login y protege los datos docentes', async ({ page, request }) => {
    const response = await request.get('/api/profesor/reporte');
    expect(response.status()).toBe(401);

    await page.goto('/profesor/');
    await expect(page.getByRole('heading', { name: 'Acceso docente' })).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  });

  test('permite entrar, consultar y cerrar sesión con credenciales configuradas', async ({ page }) => {
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!password, 'Defina E2E_ADMIN_PASSWORD para validar el flujo autenticado');

    await page.goto('/profesor/');
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Entrar al panel' }).click();

    await expect(page.getByRole('heading', { name: '📊 Panel del Profesor' })).toBeVisible();
    await expect(page.locator('#stats-grid .stat-card')).toHaveCount(4);

    const api = await page.evaluate(() => fetch('/api/profesor/reporte', {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('educonect_profesor_token')}` }
    }).then(r => r.status));
    expect(api).toBe(200);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Acceso docente' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('educonect_profesor_token'))).toBeNull();
  });
});
