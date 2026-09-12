import { test, expect } from '@playwright/test';

/**
 * Non-functional suite — baseline accessibility checks.
 *
 * Dependency-free semantic checks: form controls must be programmatically
 * associated with labels, pages must expose a heading structure. These are
 * the cheapest guards for screen-reader usability and keyboard navigation.
 */
test.describe('Нефункциональные — доступность (базовые проверки)', { tag: ['@non-functional'] }, () => {
  test('поля формы входа имеют связанные label-элементы', async ({ page }) => {
    await page.goto('/login/');

    for (const testId of ['login-username', 'login-password']) {
      const input = page.getByTestId(testId);
      const id = await input.getAttribute('id');
      expect(id, `${testId} имеет id`).toBeTruthy();
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('поля формы регистрации имеют связанные label-элементы', async ({ page }) => {
    await page.goto('/register/');

    for (const testId of [
      'register-first-name',
      'register-last-name',
      'register-phone',
      'register-password1',
      'register-password2',
    ]) {
      const input = page.getByTestId(testId);
      const id = await input.getAttribute('id');
      expect(id, `${testId} имеет id`).toBeTruthy();
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('ключевые страницы имеют заголовок верхнего уровня', async ({ page }) => {
    const pages: Array<[string, RegExp]> = [
      ['/login/', /Вход|вход/],
      ['/register/', /Регистрац|регистрац/],
    ];

    for (const [path] of pages) {
      await page.goto(path);
      const headings = page.locator('h1, h2');
      const count = await headings.count();
      expect(count, `${path} содержит заголовок`).toBeGreaterThan(0);
    }
  });

  test('точки фокуса клавиатуры присутствуют на форме входа', async ({ page }) => {
    await page.goto('/login/');

    // Поля и кнопка должны быть фокусируемыми (TabStop) для клавиатурной навигации.
    const fields = page.locator('[data-test-id="login-username"], [data-test-id="login-password"], [data-test-id="login-submit"]');
    const count = await fields.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const tabIndex = await fields.nth(i).getAttribute('tabindex');
      const disabled = await fields.nth(i).isDisabled();
      expect(tabIndex !== '-1' && !disabled, `элемент #${i} фокусируем`).toBeTruthy();
    }
  });
});