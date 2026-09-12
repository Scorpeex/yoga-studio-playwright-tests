import { expect, Page } from '@playwright/test';

/**
 * Page object for the student personal account (`/profile/`).
 */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  get firstName(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-first-name');
  }

  get phone(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-phone');
  }

  get balance(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-balance');
  }

  get subscriptionItems(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-sub-item');
  }

  get upcomingSessions(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-upcoming-session');
  }

  get noUpcoming(): ReturnType<Page['locator']> {
    return this.page.getByTestId('profile-no-upcoming');
  }

  async goto(): Promise<void> {
    await this.page.goto('/profile/');
  }

  async expectVisible(): Promise<void> {
    await expect(this.firstName).toBeVisible();
    await expect(this.phone).toBeVisible();
  }
}