import { expect, test, type Page } from '@playwright/test';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { LoginPage } from '../support/pages/LoginPage';

/**
 * Self-contained demo suite used by CI (`npx playwright test tests/demo`).
 *
 * Does NOT depend on the real application: Playwright starts a tiny local
 * server that emulates a "login + pricing" screen, and the tests exercise it
 * with the same tooling as the application suite:
 *   - Page Object Model (LoginPage),
 *   - API mocking via page.route,
 *   - console-error guard,
 *   - semantic assertions.
 *
 * This keeps the CI pipeline green (and honest) without a live backend.
 */

let server: http.Server;
let demoUrl = '';

const DEMO_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Yoga studio — demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; }
    .auth-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
    .auth-card h2 { margin-top: 0; }
    input { display: block; width: 100%; margin: 8px 0 16px; padding: 8px; }
    button { padding: 8px 16px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="auth-card">
    <h2>Вход в систему</h2>
    <label for="username">Телефон</label>
    <input id="username" data-test-id="login-username" type="tel">
    <label for="password">Пароль</label>
    <input id="password" data-test-id="login-password" type="password">
    <button data-test-id="login-submit">Войти</button>
  </div>

  <section>
    <h3>Тариф месяца</h3>
    <div class="plan-card" data-test-id="plan-price">загрузка…</div>
    <button id="buy-btn" data-test-id="buy-btn">Купить</button>
  </section>

  <script>
    document.getElementById('buy-btn').addEventListener('click', () => {
      fetch('/api/plan')
        .then((r) => r.json())
        .then((plan) => {
          document.querySelector('[data-test-id="plan-price"]').textContent =
            plan.price + ' ₽ / ' + plan.seats + ' занятий';
        });
    });
  </script>
</body>
</html>`;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.url === '/api/plan') {
      res.end(JSON.stringify({ price: '2900', seats: 12 }));
      return;
    }
    res.end(DEMO_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  demoUrl = `http://127.0.0.1:${port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe('CI demo — самодостаточные проверки', { tag: ['@demo'] }, () => {
  test('страница рендерится и доступна через Page Object', async ({ page }) => {
    await page.goto(demoUrl);
    const loginPage = new LoginPage(page);
    await loginPage.expectVisible();
  });

  test('API-ответ приложения подменяется моком', async ({ page }) => {
    await page.route('**/api/plan', (route) =>
      route.fulfill({ json: { price: '1990', seats: 8 } }),
    );

    await page.goto(demoUrl);
    await page.getByTestId('buy-btn').click();
    await expect(page.getByTestId('plan-price')).toHaveText('1990 ₽ / 8 занятий');
  });

  test('в консоли браузера не появляется ошибок', async ({ page }: { page: Page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(demoUrl);
    await page.getByTestId('login-username').fill('+79001234567');
    await page.getByTestId('buy-btn').click();
    await expect(page.getByTestId('plan-price')).toContainText('₽');

    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});