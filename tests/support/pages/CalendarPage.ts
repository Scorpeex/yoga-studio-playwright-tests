import { expect, Page } from '@playwright/test';

/**
 * Page object for the schedule page (`/calendar/`), built on FullCalendar v6.
 */
export class CalendarPage {
  constructor(private readonly page: Page) {}

  get container(): ReturnType<Page['locator']> {
    return this.page.locator('#calendar');
  }

  get legend(): ReturnType<Page['locator']> {
    return this.page.locator('.hall-legend');
  }

  get toolbar(): ReturnType<Page['locator']> {
    return this.page.locator('.fc-toolbar');
  }

  async goto(): Promise<void> {
    await this.page.goto('/calendar/');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.container).toBeVisible();
    await expect(this.toolbar).toBeVisible();
  }
}