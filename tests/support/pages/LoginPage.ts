import { expect, Page } from '@playwright/test';

/**
 * Page object for the student sign-in page (`/login/`).
 *
 * The phone input uses an input mask, so values are set through the native
 * value setter to avoid digit duplication (see repo docs).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  get card(): ReturnType<Page['locator']> {
    return this.page.locator('.auth-card');
  }

  get heading(): ReturnType<Page['locator']> {
    return this.page.locator('h2');
  }

  get phoneInput(): ReturnType<Page['locator']> {
    return this.page.getByTestId('login-username');
  }

  get passwordInput(): ReturnType<Page['locator']> {
    return this.page.getByTestId('login-password');
  }

  get submitButton(): ReturnType<Page['locator']> {
    return this.page.getByTestId('login-submit');
  }

  get registerLink(): ReturnType<Page['locator']> {
    return this.page.getByRole('link', { name: 'Зарегистрироваться' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login/');
  }

  async fillPhone(phone: string): Promise<void> {
    await this.page.evaluate(
      ({ selector, value }) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      { selector: '[data-test-id="login-username"]', value: phone },
    );
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async loginAs(phone: string, password: string): Promise<void> {
    await this.goto();
    await this.fillPhone(phone);
    await this.fillPassword(password);
    await this.submit();
    await this.page.waitForURL('**/dashboard/');
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.heading).toContainText('Вход в систему');
    await expect(this.phoneInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}