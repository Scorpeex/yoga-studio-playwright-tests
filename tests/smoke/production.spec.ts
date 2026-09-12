import { test, expect } from '@playwright/test';
import { env, hasProdCredentials } from '../support/config/env';
import { CalendarPage } from '../support/pages/CalendarPage';
import { HomePage } from '../support/pages/HomePage';
import { LoginPage } from '../support/pages/LoginPage';
import { ProfilePage } from '../support/pages/ProfilePage';
import { RegisterPage } from '../support/pages/RegisterPage';
import { ShopPage } from '../support/pages/ShopPage';

/**
 * Production smoke suite (run with `playwright.prod.config.js`).
 *
 * Read-only checks against the LIVE application using dedicated test users
 * whose credentials are supplied via environment variables (.env → .env.example).
 *
 * Usage:
 *   npx playwright test -c playwright.prod.config.js
 */
test.skip(!hasProdCredentials, 'PROD_USER_PHONE / PROD_USER_PASSWORD не заданы — прод-смоук пропущен');

test.describe.configure({ mode: 'serial' });

const PROD_USER = { phone: env.prod.userPhone, password: env.prod.userPassword };

test.describe('Продакшен: смоук-проверка ключевых страниц', { tag: ['@smoke'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('страница входа рендерится', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectVisible();
  });

  test('страница регистрации рендерится', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.expectVisible();
  });

  test('вход выделенным пользователем открывает дашборд', async ({ page }) => {
    const homePage = new HomePage(page);
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(PROD_USER.phone, PROD_USER.password);

    await expect(homePage.greeting).toBeVisible();
    for (const nav of [homePage.navHome, homePage.navCalendar, homePage.navShop, homePage.navProfile]) {
      await expect(nav).toBeVisible();
    }
  });

  test('календарь загружает FullCalendar', async ({ page }) => {
    const calendarPage = new CalendarPage(page);
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(PROD_USER.phone, PROD_USER.password);
    await calendarPage.goto();
    await calendarPage.expectLoaded();
  });

  test('магазин показывает тарифы', async ({ page }) => {
    const shopPage = new ShopPage(page);
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(PROD_USER.phone, PROD_USER.password);
    await shopPage.goto();
    await expect(shopPage.subscriptionCards.first()).toBeVisible();
  });

  test('профиль показывает данные пользователя', async ({ page }) => {
    const profilePage = new ProfilePage(page);
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(PROD_USER.phone, PROD_USER.password);
    await profilePage.goto();
    await profilePage.expectVisible();
  });

  test('выход из аккаунта возвращает на страницу входа', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAs(PROD_USER.phone, PROD_USER.password);

    // Форма выхода доступна на странице профиля.
    await page.goto('/profile/');
    await page.getByTestId('logout-form').evaluate((form: HTMLFormElement) => form.submit());
    await page.waitForURL(/\/login\//);
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });
});