import { expect, Page } from '@playwright/test';

/**
 * Page object for the student sign-up page (`/register/`).
 */
export class RegisterPage {
  constructor(private readonly page: Page) {}

  get firstNameInput(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-first-name');
  }

  get lastNameInput(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-last-name');
  }

  get phoneInput(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-phone');
  }

  get password1Input(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-password1');
  }

  get password2Input(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-password2');
  }

  get submitButton(): ReturnType<Page['locator']> {
    return this.page.getByTestId('register-submit');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register/');
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
      { selector: '[data-test-id="register-phone"]', value: phone },
    );
  }

  async registerAs(
    phone: string,
    password: string,
    firstName = 'Тест',
    lastName = 'Тестов',
  ): Promise<void> {
    await this.goto();
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.fillPhone(phone);
    await this.password1Input.fill(password);
    await this.password2Input.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL('**/dashboard/');
  }

  async expectVisible(): Promise<void> {
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.lastNameInput).toBeVisible();
    await expect(this.phoneInput).toBeVisible();
    await expect(this.password1Input).toBeVisible();
    await expect(this.password2Input).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}