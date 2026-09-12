import { test, expect, BASE_URL } from '../../support/fixtures/base';
import {
  loginAsStudent,
  fillPhoneField,
  loginAsModerator,
  registerNewUser,
  uniquePhone,
  deleteTestUser,
  getUserInfo,
  getCsrfToken,
} from '../../support/fixtures/helpers';

const STUDENT_PHONE = '3333333333';
const STUDENT_PASS = 'stud123';
const FULL_PHONE = '+73333333333';

// Заполнить форму входа (обход phone-mask). По умолчанию s5.
async function fillLoginForm(
  page: any,
  { phone = STUDENT_PHONE, password = STUDENT_PASS } = {},
) {
  await fillPhoneField(page, '[data-test-id="login-username"]', phone);
  await page.getByTestId('login-password').fill(password);
}

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

test.describe('Страница Входа — рендер и структура', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('страница /login/ открывается с формой', async ({ page }) => {
    const res = await page.goto('/login/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('.auth-card')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Вход в систему');
  });

  test('все поля формы и кнопка входа присутствуют', async ({ page }) => {
    await page.goto('/login/');
    await expect(page.getByTestId('login-username')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('поле пароля имеет тип password', async ({ page }) => {
    await page.goto('/login/');
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
  });

  test('ссылка "Зарегистрироваться" ведёт на /register/', async ({ page }) => {
    await page.goto('/login/');
    const link = page.locator('a', { hasText: 'Зарегистрироваться' });
    await expect(link).toHaveAttribute('href', '/register/');
  });

  test('ссылка "Вход для администратора" ведёт на /admin/', async ({ page }) => {
    await page.goto('/login/');
    const link = page.locator('a', { hasText: 'Вход для администратора' });
    await expect(link).toHaveAttribute('href', '/admin/');
  });

  test('блок авторизации через VK присутствует', async ({ page }) => {
    await page.goto('/login/');
    await expect(page.locator('#vk-login-container')).toBeAttached();
  });

  test('уже авторизованный пользователь перенаправляется с /login/ на /dashboard/', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/login/');
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
  });
});

test.describe('Страница Входа — валидация и нормализация телефона', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login/');
  });

  test('пустой телефон — ошибка "Номер телефона обязателен" красным под полем, без редиректа', async ({ page }) => {
    await fillLoginForm(page, { phone: '', password: STUDENT_PASS });
    await page.getByTestId('login-submit').click();
    const error = page.locator('.error').first();
    await expect(error).toContainText('Номер телефона обязателен');
    await expect(error).toHaveCSS('color', 'rgb(231, 76, 60)'); // #e74c3c — красный
    await expect(page.locator('.alert-error')).not.toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}login/`);
  });

  test('пустой пароль — ошибка "Пароль обязателен" красным под полем, без редиректа', async ({ page }) => {
    await fillLoginForm(page, { phone: STUDENT_PHONE, password: '' });
    await page.getByTestId('login-submit').click();
    const error = page.locator('.error').first();
    await expect(error).toContainText('Пароль обязателен');
    await expect(error).toHaveCSS('color', 'rgb(231, 76, 60)'); // #e74c3c — красный
    await expect(page.locator('.alert-error')).not.toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}login/`);
  });

  test('некорректный формат телефона — ошибка поля', async ({ page }) => {
    await fillLoginForm(page, { phone: '123', password: STUDENT_PASS });
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.error')).toContainText('Неверный формат телефона');
    await expect(page).toHaveURL(`${BASE_URL}login/`);
  });
});

test.describe('Телефон-маска', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login/');
  });

  test('поле телефона инициализируется с префиксом "+7 (" и placeholder', async ({ page }) => {
    const input = page.getByTestId('login-username');
    await expect(input).toHaveValue('+7 (');
    await expect(input).toHaveAttribute('placeholder', '+7 (___) ___-__-__');
  });

  test('ввод цифр форматируется в +7 (XXX) XXX-XX-XX', async ({ page }) => {
    const input = page.getByTestId('login-username');
    await input.click();
    await input.pressSequentially('9001234567');
    await expect(input).toHaveValue('+7 (900) 123-45-67');
  });

  test('при потере фокуса неполный номер очищается', async ({ page }) => {
    const input = page.getByTestId('login-username');
    await input.click();
    await input.pressSequentially('900');
    await expect(input).toHaveValue('+7 (900');
    await input.blur();
    await expect(input).toHaveValue('');
  });
});

test.describe('Страница Входа — успешный вход', { tag: ['@functional'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('вход студента по телефону ведёт на /dashboard/', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
  });

  test('пользователь авторизован после входа (API my-info доступен)', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
    expect(await isLoggedIn(page)).toBe(true);
  });

  test('вход с ?next=/calendar/ ведёт на /calendar/', async ({ page }) => {
    await page.goto('/login/?next=/calendar/');
    await fillLoginForm(page);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}calendar/`);
  });

  test('нормализация: ввод с пробелами/скобками/дефисами', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page, { phone: '+7 (900) 111-22-33', password: 'wrongpass' });
    // s5 не 9001112233 — просто проверяем, что формат принят (без ошибки поля телефона)
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.error')).not.toBeVisible();
  });

  test('нормализация "восьмёрки": 89000000000 конвертируется в +79... и вход успешен для правильного аккаунта', async ({ page }) => {
    const phone = uniquePhone(); // +79xx...YY
    const eight = '8' + phone.slice(2); // 89xx...YY (11 цифр)
    await registerNewUser(page, phone);
    await page.context().clearCookies();
    await page.goto('/login/');
    await fillLoginForm(page, { phone: eight, password: STUDENT_PASS });
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
    await deleteTestUser(page, phone);
  });
});

test.describe('Страница Входа — ошибки и безопасность', { tag: ['@functional', '@security'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('неверный пароль — сообщение об ошибке, остаёмся на /login/', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page, { phone: STUDENT_PHONE, password: 'wrongpass' });
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.alert-error')).toContainText('Неправильное имя пользователя или пароль');
    await expect(page).toHaveURL(`${BASE_URL}login/`);
  });

  test('несуществующий телефон — то же сообщение (без раскрытия аккаунта)', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page, { phone: '+79998887766', password: STUDENT_PASS });
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.alert-error')).toContainText('Неправильное имя пользователя или пароль');
    await expect(page).toHaveURL(`${BASE_URL}login/`);
  });

  test('после неудачного входа доступ к защищённой странице закрыт', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page, { phone: STUDENT_PHONE, password: 'wrongpass' });
    await page.getByTestId('login-submit').click();
    await page.goto('/dashboard/');
    await expect(page).toHaveURL(`${BASE_URL}login/?next=/dashboard/`);
  });

  test('пользователь не авторизован после неудачного входа', async ({ page }) => {
    await page.goto('/login/');
    await fillLoginForm(page, { phone: STUDENT_PHONE, password: 'wrongpass' });
    await page.getByTestId('login-submit').click();
    expect(await isLoggedIn(page)).toBe(false);
  });
});

test.describe('Страница Входа — логин по username без цифр (PhoneAuthBackend)', { tag: ['@functional', '@api'] }, () => {
  test('admin логинится по username через backend', async ({ page }) => {
    await page.context().clearCookies();
    const r = await page.request.post('/api/auth/test/authenticate/', {
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'admin', password: 'admin123' },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.success).toBe(true);
  });
});

test.describe('Страница Входа — выход (logout)', { tag: ['@functional'] }, () => {
  test('выход из аккаунта завершает сессию (POST /logout/)', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/profile/');
    await page.getByTestId('logout-btn').click();
    await expect(page).toHaveURL(`${BASE_URL}login/`);
    await page.goto('/profile/');
    await expect(page).toHaveURL(`${BASE_URL}login/?next=/profile/`);
  });
});

test.describe('Страница Входа — role-based доступ', { tag: ['@functional', '@security'] }, () => {
  test('модератор логинится в админ-панель (стандартный вход)', async ({ page }) => {
    await page.context().clearCookies();
    await loginAsModerator(page);
    await expect(page).toHaveURL(/admin/);
  });
});

test.describe('Вход через API (хелпер loginAsStudent)', { tag: ['@functional', '@api'] }, () => {
  test('loginAsStudent проходит на /dashboard/ и идентифицирует s5', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page).toHaveURL(`${BASE_URL}dashboard/`);
    const info = await getUserInfo(page, FULL_PHONE);
    expect(info.exists).toBe(true);
  });
});

test.describe('VK привязка к существующему аккаунту (/api/auth/vk/link/)', { tag: ['@functional', '@api'] }, () => {
  async function linkVk(page: any, body: Record<string, unknown>): Promise<any> {
    const csrf = await getCsrfToken(page);
    return page.evaluate(async ({ body, csrf }) => {
      const r = await fetch('/api/auth/vk/link/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      let data: any = {};
      try { data = await r.json(); } catch { /* ignore */ }
      return { status: r.status, data };
    }, { body, csrf });
  }

  test('верный пароль привязывает VK к существующей учётке и выполняет вход', async ({ page }) => {
    const phone = uniquePhone();
    await registerNewUser(page, phone);
    const before = await getUserInfo(page, phone);
    expect(before.vk_user_id ?? '').toBeFalsy();

    const res = await linkVk(page, {
      phone, vk_id: '111222333', access_token: 'tok', password: STUDENT_PASS, first_name: 'ВК', last_name: 'Тест',
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.redirect_url).toBe('/dashboard/');

    const after = await getUserInfo(page, phone);
    expect(after.vk_user_id).toBe('111222333');
    await deleteTestUser(page, phone);
  });

  test('неверный пароль НЕ привязывает VK', async ({ page }) => {
    const phone = uniquePhone();
    await registerNewUser(page, phone);

    const res = await linkVk(page, {
      phone, vk_id: '444555666', access_token: 'tok', password: 'wrongpassword',
    });
    expect(res.status).toBe(403);
    expect(res.data.success).toBe(false);

    const after = await getUserInfo(page, phone);
    expect(after.vk_user_id ?? '').toBeFalsy();
    await deleteTestUser(page, phone);
  });

  test('VK ID уже привязан к другому аккаунту — отклоняется', async ({ page }) => {
    const phone = uniquePhone();
    const otherPhone = uniquePhone();
    await registerNewUser(page, phone);
    await linkVk(page, { phone, vk_id: '999000111', access_token: 'tok', password: STUDENT_PASS });

    // Вторая попытка тем же vk_id, но с другим телефоном/паролем
    await registerNewUser(page, otherPhone);
    const res = await linkVk(page, { phone: otherPhone, vk_id: '999000111', password: STUDENT_PASS });
    expect(res.status).toBe(409);

    await deleteTestUser(page, phone);
    await deleteTestUser(page, otherPhone);
  });
});

test.describe('Установка пароля (/api/auth/set-password/)', { tag: ['@functional', '@api'] }, () => {
  async function setPassword(page: any, password: string): Promise<any> {
    const csrf = await getCsrfToken(page);
    return page.evaluate(async ({ password, csrf }) => {
      const r = await fetch('/api/auth/set-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      let data: any = {};
      try { data = await r.json(); } catch { /* ignore */ }
      return { status: r.status, data };
    }, { password, csrf });
  }

  async function tryLogin(page: any, phone: string, password: string): Promise<boolean> {
    return page.evaluate(async ({ phone, password }) => {
      const r = await fetch('/api/auth/test/authenticate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: phone, password }),
      });
      const d = await r.json();
      return !!d.success;
    }, { phone, password });
  }

  test('устанавливает пароль: вход по старому не работает, по новому работает', async ({ page }) => {
    const phone = uniquePhone();
    await registerNewUser(page, phone);

    // До смены — старый пароль работает
    expect(await tryLogin(page, phone, STUDENT_PASS)).toBe(true);

    const res = await setPassword(page, 'newpass123');
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    // После смены — новый работает, старый нет
    expect(await tryLogin(page, phone, 'newpass123')).toBe(true);
    expect(await tryLogin(page, phone, STUDENT_PASS)).toBe(false);

    await deleteTestUser(page, phone);
  });

  test('невалидный пароль (только цифры) отклоняется', async ({ page }) => {
    const phone = uniquePhone();
    await registerNewUser(page, phone);
    const res = await setPassword(page, '12345');
    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    await deleteTestUser(page, phone);
  });
});
