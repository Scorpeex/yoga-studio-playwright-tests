import { test, expect, BASE_URL } from '../../support/fixtures/base';
import {
  loginAsStudent,
  fillPhoneField,
  fillRegisterForm,
  uniquePhone,
  deleteTestUser,
  getUserInfo,
  getCurrentUserInfo,
} from '../../support/fixtures/helpers';

const STUDENT_PASS = 'stud123';
const S5_PHONE = '+73333333333';

async function isLoggedIn(page: any): Promise<boolean> {
  return page.evaluate(async () => {
    const r = await fetch('/api/auth/test/my-info/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '' },
      credentials: 'same-origin',
      body: JSON.stringify({}),
    });
    return r.ok;
  });
}

test.describe('Страница Регистрации — рендер и структура', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('страница /register/ открывается с формой', async ({ page }) => {
    const res = await page.goto('/register/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('.auth-card')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Регистрация');
  });

  test('все поля формы и кнопка регистрации присутствуют', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.getByTestId('register-first-name')).toBeVisible();
    await expect(page.getByTestId('register-last-name')).toBeVisible();
    await expect(page.getByTestId('register-phone')).toBeVisible();
    await expect(page.getByTestId('register-password1')).toBeVisible();
    await expect(page.getByTestId('register-password2')).toBeVisible();
    await expect(page.getByTestId('register-submit')).toBeVisible();
  });

  test('поля паролей имеют тип password', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.getByTestId('register-password1')).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('register-password2')).toHaveAttribute('type', 'password');
  });

  test('подписи полей и обязательные звёздочки присутствуют', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.locator('label', { hasText: 'Имя' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Фамилия' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Телефон' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Пароль' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Подтверждение пароля' })).toBeVisible();
    await expect(page.locator('span.required')).toHaveCount(5);
  });

  test('help-text отображается только у телефона, требований к паролю на странице нет', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.locator('.help-text')).toHaveCount(1);
    await expect(page.locator('.help-text')).toContainText('Введите номер телефона в формате +7XXXXXXXXXX');
    await expect(page.locator('.help-text').filter({ hasText: /минимум/ })).toHaveCount(0);
  });

  test('форма помечена novalidate (валидация серверная)', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.locator('form')).toHaveAttribute('novalidate', '');
  });

  test('ссылка "Войти" ведёт на /login/', async ({ page }) => {
    await page.goto('/register/');
    const link = page.locator('a', { hasText: 'Войти' });
    await expect(link).toHaveAttribute('href', '/login/');
  });

  test('модалка уведомлений скрыта по умолчанию', async ({ page }) => {
    await page.goto('/register/');
    await expect(page.getByTestId('notification-modal')).toBeHidden();
  });

  test('уже авторизованный пользователь перенаправляется с /register/ на /dashboard/', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/register/');
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
  });
});

test.describe('Страница Регистрации — валидация и нормализация телефона', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/register/');
  });

  test('пустой телефон — ошибка "Номер телефона обязателен" красным под полем, без редиректа', async ({ page }) => {
    await fillRegisterForm(page, { phone: '' });
    await page.getByTestId('register-submit').click();
    const error = page.locator('.error').first();
    await expect(error).toContainText('Номер телефона обязателен');
    await expect(error).toHaveCSS('color', 'rgb(231, 76, 60)'); // #e74c3c — красный
    await expect(page.locator('.alert-error')).not.toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });

  test('пустые имя/фамилия/пароли — ошибки "Обязательное поле." у каждого поля', async ({ page }) => {
    await fillRegisterForm(page, {
      firstName: '',
      lastName: '',
      phone: uniquePhone(),
      password1: '',
      password2: '',
    });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toHaveCount(4);
    const errors = page.locator('.error');
    for (let i = 0; i < 4; i++) {
      await expect(errors.nth(i)).toContainText('Обязательное поле.');
    }
    await expect(page.locator('.alert-error')).not.toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });

  test('некорректный формат телефона — ошибка поля', async ({ page }) => {
    await fillRegisterForm(page, { phone: '123' });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toContainText('Неверный формат телефона');
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });

  test('дубликат телефона (s5) — ошибка "Пользователь с таким номером телефона уже зарегистрирован", пользователь не создаётся', async ({ page }) => {
    await fillRegisterForm(page, { phone: S5_PHONE });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toContainText('Пользователь с таким номером телефона уже зарегистрирован');
    await expect(page).toHaveURL(`${BASE_URL}register/`);
    const s5 = await getUserInfo(page, S5_PHONE);
    expect(s5.exists).toBe(true);
  });
});

test.describe('Телефон-маска (регистрация)', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/register/');
  });

  test('поле телефона инициализируется с префиксом "+7 (" и placeholder', async ({ page }) => {
    const input = page.getByTestId('register-phone');
    await expect(input).toHaveValue('+7 (');
    await expect(input).toHaveAttribute('placeholder', '+7 (___) ___-__-__');
  });

  test('ввод цифр форматируется в +7 (XXX) XXX-XX-XX', async ({ page }) => {
    const input = page.getByTestId('register-phone');
    await input.click();
    await input.pressSequentially('9001234567');
    await expect(input).toHaveValue('+7 (900) 123-45-67');
  });

  test('при потере фокуса неполный номер очищается', async ({ page }) => {
    const input = page.getByTestId('register-phone');
    await input.click();
    await input.pressSequentially('900');
    await expect(input).toHaveValue('+7 (900');
    await input.blur();
    await expect(input).toHaveValue('');
  });
});

test.describe('Страница Регистрации — валидация пароля', { tag: ['@functional', '@security'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/register/');
  });

  test('короткий пароль — ошибка о минимальной длине', async ({ page }) => {
    await fillRegisterForm(page, { phone: uniquePhone(), password1: 'stud1', password2: 'stud1' });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toContainText('Пароль должен содержать минимум 6 символов');
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });

  test('пароль только из цифр — ошибки про буквы и "только цифры"', async ({ page }) => {
    await fillRegisterForm(page, { phone: uniquePhone(), password1: '1234567', password2: '1234567' });
    await page.getByTestId('register-submit').click();
    const errors = page.locator('.error');
    await expect(errors).toContainText('Пароль должен содержать хотя бы одну букву');
    await expect(errors).toContainText('Введённый пароль состоит только из цифр');
  });

  test('распространённый пароль — ошибка "слишком широко распространён"', async ({ page }) => {
    await fillRegisterForm(page, { phone: uniquePhone(), password1: 'password123', password2: 'password123' });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toContainText('Введённый пароль слишком широко распространён');
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });

  test('несовпадающие пароли — ошибка "Введенные пароли не совпадают."', async ({ page }) => {
    await fillRegisterForm(page, { phone: uniquePhone(), password1: 'Test1234!', password2: 'Test1235!' });
    await page.getByTestId('register-submit').click();
    await expect(page.locator('.error')).toContainText('Введенные пароли не совпадают');
    await expect(page).toHaveURL(`${BASE_URL}register/`);
  });
});

test.describe('Страница Регистрации — успешная регистрация', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/register/');
  });

  test('регистрация с уникальным телефоном ведёт на /dashboard/ и авторизует', async ({ page }) => {
    const phone = uniquePhone();
    await fillRegisterForm(page, { phone });
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
    expect(await isLoggedIn(page)).toBe(true);
    await deleteTestUser(page, phone);
  });

  test('созданный профиль: username=телефон, имя/фамилия, баланс 0, без подписок и записей', async ({ page }) => {
    const phone = uniquePhone();
    await fillRegisterForm(page, { phone, firstName: 'Иван', lastName: 'Иванов' });
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);

    const info = await getUserInfo(page, phone);
    expect(info.exists).toBe(true);
    expect(info.username).toBe(phone);
    expect(info.first_name).toBe('Иван');
    expect(info.last_name).toBe('Иванов');
    expect(info.balance).toBe('0.00');
    expect(info.booking_count).toBe(0);
    expect(info.subscription_count).toBe(0);

    const me = await getCurrentUserInfo(page);
    expect(me.balance).toBe('0.00');
    await deleteTestUser(page, phone);
  });

  test('нормализация: ввод с пробелами/скобками/дефисами сохраняется как +7XXXXXXXXXX', async ({ page }) => {
    const phone = uniquePhone(); // +7 + 10 цифр
    const digits = phone.slice(2); // 10 цифр номера
    const formatted = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
    await fillRegisterForm(page, { phone: formatted });
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);

    const info = await getUserInfo(page, phone);
    expect(info.username).toBe(phone);
    await deleteTestUser(page, phone);
  });

  test('номер от "восьмёрки" 8XXXXXXXXXX сохраняется как +79... и регистрация успешна', async ({ page }) => {
    const phone = uniquePhone(); // +7...
    const eight = '8' + phone.slice(2); // 89... (11 цифр)
    await fillRegisterForm(page, { phone: eight });
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);

    const info = await getUserInfo(page, phone);
    expect(info.exists).toBe(true);
    expect(info.username).toBe(phone);
    await deleteTestUser(page, phone);
  });

  test('после регистрации можно войти на /login/ с этими же данными', async ({ page }) => {
    const phone = uniquePhone();
    await fillRegisterForm(page, { phone, password1: STUDENT_PASS, password2: STUDENT_PASS });
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);

    await page.context().clearCookies();
    await page.goto('/login/');
    await fillPhoneField(page, '[data-test-id="login-username"]', phone.slice(1));
    await page.getByTestId('login-password').fill(STUDENT_PASS);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);

    await deleteTestUser(page, phone);
  });
});

test.describe('Страница Регистрации — безопасность', { tag: ['@functional', '@security'] }, () => {
  test('POST /register/ без CSRF-токена отклоняется (403)', async ({ page }) => {
    const r = await page.request.post('/register/', {
      form: {
        first_name: 'Иван',
        last_name: 'Иванов',
        phone: uniquePhone(),
        password1: 'Test1234!',
        password2: 'Test1234!',
      },
    });
    expect(r.status()).toBe(403);
  });
});