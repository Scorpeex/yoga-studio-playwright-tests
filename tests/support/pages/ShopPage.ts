import { expect, Page } from '@playwright/test';

/**
 * Page object for the shop / tariff purchase page (`/shop/`).
 */
export class ShopPage {
  constructor(private readonly page: Page) {}

  get subscriptionCards(): ReturnType<Page['locator']> {
    return this.page.getByTestId('subscription-card');
  }

  get lockedCards(): ReturnType<Page['locator']> {
    return this.page.getByTestId('subscription-card-locked');
  }

  get purchaseModal(): ReturnType<Page['locator']> {
    return this.page.getByTestId('purchase-modal');
  }

  get topupModal(): ReturnType<Page['locator']> {
    return this.page.getByTestId('topup-modal');
  }

  async goto(): Promise<void> {
    await this.page.goto('/shop/');
  }

  async expectVisible(): Promise<void> {
    await expect(this.page.locator('h2').first()).toBeVisible();
  }
}