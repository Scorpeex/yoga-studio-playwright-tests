import { expect, Page } from '@playwright/test';

/**
 * Page object for the main dashboard (`/dashboard/`).
 */
export class HomePage {
  constructor(private readonly page: Page) {}

  get greeting(): ReturnType<Page['locator']> {
    return this.page.getByTestId('greeting-text');
  }

  get notificationBell(): ReturnType<Page['locator']> {
    return this.page.getByTestId('notification-bell');
  }

  get navHome(): ReturnType<Page['locator']> {
    return this.page.getByTestId('nav-home');
  }

  get navCalendar(): ReturnType<Page['locator']> {
    return this.page.getByTestId('nav-calendar');
  }

  get navShop(): ReturnType<Page['locator']> {
    return this.page.getByTestId('nav-shop');
  }

  get navProfile(): ReturnType<Page['locator']> {
    return this.page.getByTestId('nav-profile');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard/');
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.greeting).toBeVisible();
  }
}