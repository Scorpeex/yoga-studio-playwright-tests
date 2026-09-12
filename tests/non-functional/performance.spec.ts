import { test, expect } from '@playwright/test';
import { loginAsStudent } from '../support/fixtures/helpers';

/**
 * Non-functional suite — performance budgets.
 *
 * Verifies that key pages and API endpoints stay within response-time budgets.
 * Budgets are intentionally generous for a local environment; they act as a
 * regression guard against obvious regressions (extra blocking requests,
 * unbounded queries) rather than as strict SLOs.
 */
test.describe('Нефункциональные — производительность', { tag: ['@non-functional'] }, () => {
  test('гостевые страницы открываются в пределах бюджета', async ({ page }) => {
    const budgets: Array<[string, number]> = [
      ['/login/', 4000],
      ['/register/', 4000],
    ];

    for (const [path, budget] of budgets) {
      const startedAt = Date.now();
      const response = await page.goto(path);
      expect(response, `${path} отвечает 200`).not.toBeNull();
      expect(response!.status()).toBe(200);

      const elapsed = Date.now() - startedAt;
      expect(elapsed, `${path} укладывается в бюджет ${budget} мс`).toBeLessThan(budget);
    }
  });

  test('API календаря отвечает в пределах бюджета', async ({ page }) => {
    await loginAsStudent(page);

    const startedAt = Date.now();
    const response = await page.request.get(
      '/api/calendar/events/?start=2026-01-01&end=2026-12-31',
    );
    expect(response.status()).toBe(200);

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeLessThan(3000);
  });

  test('дашборд авторизованного пользователя рендерится в пределах бюджета', async ({ page }) => {
    await loginAsStudent(page);

    const startedAt = Date.now();
    await page.goto('/dashboard/');
    await expect(page.getByTestId('greeting-text')).toBeVisible();

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeLessThan(5000);
  });

  test('календарь становится интерактивным в пределах бюджета', async ({ page }) => {
    await loginAsStudent(page);

    const startedAt = Date.now();
    await page.goto('/calendar/');
    await expect(page.locator('#calendar')).toBeVisible();

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeLessThan(5000);
  });
});