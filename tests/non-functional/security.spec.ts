import { test, expect } from '@playwright/test';
import { clearCookies, getCsrfToken, loginAsStudent } from '../support/fixtures/helpers';

/**
 * Non-functional suite — security boundaries.
 *
 * Verifies role isolation and auth boundaries that must never regress:
 * guests cannot reach authenticated pages, students cannot drive
 * administrative actions, and CSRF protection stays in place on POSTs.
 */
test.describe('Нефункциональные — границы доступа и безопасности', { tag: ['@non-functional', '@security'] }, () => {
  test('гость с личного кабинета редиректится на вход', async ({ page }) => {
    await page.goto('/profile/');
    await expect(page).toHaveURL(/\/login\//);
  });

  test('гость с дашборда редиректится на вход', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page).toHaveURL(/\/login\//);
  });

  test('студент не может создать занятие через API', async ({ page }) => {
    await loginAsStudent(page);
    const csrf = await getCsrfToken(page);

    const response = await page.request.post('/api/calendar/events/create/', {
      data: {
        class_type_id: 1,
        start: '2030-01-01T10:00',
        duration: 60,
        hall_id: 2,
        tariff_id: 3,
        max_participants_override: 10,
      },
      headers: { 'X-CSRFToken': csrf },
    });

    expect([400, 403]).toContain(response.status());
  });

  test('студент не видит административных элементов управления на календаре', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/calendar/');

    await expect(page.locator('#eventModal')).toBeHidden();
    // Кнопка сохранения существует в разметке модалки, но не должна быть видимой студенту.
    await expect(page.getByTestId('event-save-btn')).toBeHidden();
  });

  test('неавторизованный POST на финансовый эндпоинт отклоняется', async ({ page }) => {
    const response = await page.request.post('/api/purchase-subscription/', {
      data: { tariff_id: 3 },
    });

    // Не важно 400 или 403 — главное, что сервер не обработал запрос без сессии.
    expect([400, 403]).toContain(response.status());
  });

  test('студент не проходит в админ-панель', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/admin/');
    // Студент не staff → Django перенаправляет на страницу входа в админку.
    await expect(page).toHaveURL(/\/admin\/login\/?/);
  });
});