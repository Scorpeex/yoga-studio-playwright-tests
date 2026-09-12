// @ts-check
/**
 * Categorize test suites with Playwright tags by assigning `tag` options
 * to every `test.describe(...)` block in the functional suites.
 *
 * Categories (tags):
 *   @functional     — UI end-to-end checks (default category)
 *   @api            — tests that drive the application through its API
 *   @regression     — critical business flows re-checked on every release
 *   @security       — role isolation, auth boundaries, input validation
 *
 * The script is idempotent: it strips existing `tag` options first, so it can
 * be re-run safely whenever new suites are added.
 *
 * Usage: node scripts/tag-suites.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const EXTRA_TAGS = {
  'tests/functional/auth/login.spec.ts': {
    'Страница Входа — логин по username без цифр (PhoneAuthBackend)': ['@api'],
    'Страница Входа — role-based доступ': ['@security'],
    'Страница Входа — ошибки и безопасность': ['@security'],
    'Вход через API (хелпер loginAsStudent)': ['@api'],
    'VK привязка к существующему аккаунту (/api/auth/vk/link/)': ['@api'],
    'Установка пароля (/api/auth/set-password/)': ['@api'],
  },
  'tests/functional/auth/register.spec.ts': {
    'Страница Регистрации — валидация пароля': ['@security'],
    'Страница Регистрации — безопасность': ['@security'],
  },
  'tests/functional/home/home.spec.ts': {
    'YooKassa виджет': ['@api'],
    'Модалка покупки абонемента': ['@regression'],
    'Модалка продления абонемента': ['@regression'],
    'Модалка пополнения баланса': ['@regression'],
  },
  'tests/functional/notifications/notifications.spec.ts': {
    'Плановые уведомления': ['@regression'],
  },
  'tests/functional/profile/profile.spec.ts': {
    'Редактирование — безопасность': ['@security'],
    'История баланса': ['@regression'],
    'VK секция': ['@api'],
  },
  'tests/functional/shop/shop.spec.ts': {
    'Вебхук YooKassa': ['@api', '@regression'],
    'Покупка абонемента': ['@regression'],
    'Пополнение баланса (валидация)': ['@api', '@regression'],
    'YooKassa виджет': ['@api'],
  },
  'tests/functional/calendar/calendar.spec.ts': {
    'Списание и возврат средств': ['@api', '@regression'],
    'Удаление занятия возвращает средства': ['@regression'],
    'Запись других пользователей': ['@security'],
    'Сплит-тариф': ['@api', '@regression'],
    'Админ — краевые случаи посещаемости': ['@api'],
    'Сплит — оплата по дедлайну': ['@api', '@regression'],
    'Абонемент — просроченный': ['@regression'],
    'Списание из абонемента — повторная запись': ['@regression'],
    'Группы тарифов (Lite/Pro)': ['@api'],
    'Права студента': ['@security'],
    'API событий — доступность тарифов': ['@api'],
    'Посещаемость — роли и приватность': ['@security'],
    'Студент — запрет': ['@security'],
    'Студент — ограничения и граничные случаи': ['@regression'],
    'Цвет текста события зала': ['@api'],
  },
  'tests/functional/calendar/centering.spec.ts': {
    'Центровка событий и стабильность высоты строк': ['@regression'],
  },
};

const SPEC_FILES = readdirSync('tests/functional', { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.spec.ts'))
  .map((f) => `tests/functional/${f}`);

const STRIP_TAG_OPTS = /,\s*\{\s*tag:\s*\[[^\]]*\]\s*\}/g;
const DESCRIBE_RE = /test\.describe\(\s*(['"])([^'"]+)\1/g;

let totalTagged = 0;
for (const file of SPEC_FILES) {
  let src = readFileSync(file, 'utf8');
  src = src.replace(STRIP_TAG_OPTS, '');

  let tagged = 0;
  src = src.replace(DESCRIBE_RE, (match, quote, name) => {
    const tags = [...new Set(['@functional', ...(EXTRA_TAGS[file]?.[name] ?? [])])];
    tagged += 1;
    const opts = `{ tag: [${tags.map((t) => `'${t}'`).join(', ')}] }`;
    return `test.describe(${quote}${name}${quote}, ${opts}`;
  });

  writeFileSync(file, src);
  totalTagged += tagged;
  console.log(`${file}: tagged ${tagged} describe groups`);
}

console.log(`Total describe groups tagged: ${totalTagged}`);