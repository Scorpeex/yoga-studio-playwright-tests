# Yoga Studio — Playwright E2E тесты

[![CI](https://img.shields.io/github/actions/workflow/status/Scorpeex/yoga-studio-playwright-tests/ci.yml?branch=main&label=CI)](https://github.com/Scorpeex/yoga-studio-playwright-tests/actions/workflows/ci.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.62.1-2bd4ae)](https://playwright.dev)
![Tests](https://img.shields.io/badge/tests-362-blue)

Набор E2E-тестов для CRM йога-студии на [Playwright](https://playwright.dev) +
TypeScript.

**362 теста**: функциональные, API, регрессионные, безопасность и
нефункциональные. Тесты разложены по папкам доменов, помечены тегами категорий,
используют общий Page Object Model и гоняются против тестового окружения —
плюс read-only смоук-набор для продакшена.

- [English version](README.md)

## Что покрыто

| Направление | Описание | Тег |
| --- | --- | --- |
| Функциональные (329) | Авторизация, регистрация, профиль, календарь занятий, абонементы / магазин, уведомления, дашборд | `@functional` |
| API (51) | Прямые обращения к бэкенду: auth, CRUD событий, запись, посещаемость, платежи | `@api` |
| Регрессия (65) | Ключевые бизнес-сценарии, жизненный цикл средств, изоляция пользователей | `@regression` |
| Безопасность (34) | Границы доступа, ролевая изоляция, редиректы гостей | `@security` |
| Нефункциональные (19) | Бюджеты производительности, отказоустойчивость / идемпотентность, CSRF, базовые проверки доступности | `@non-functional` |
| Смоук — продакшен (7) | Read-only проверки боевого приложения | `@smoke` |

Категории помечены через
[теги Playwright](https://playwright.dev/docs/test-annotations#tag-tests) на
`test.describe` — любой поднабор запускается через `--grep`.

## Структура репозитория

```
tests/
  functional/            # по бизнес-доменам (auth, calendar, home, ...)
  regression/            # ключевые бизнес-сценарии
  non-functional/        # производительность, отказоустойчивость, безопасность, доступность
  smoke/                 # read-only смоук продакшена
  demo/                  # самодостаточный CI-demo (без бэкенда)
  support/
    fixtures/            # общие фикстуры + API-хелперы
    pages/               # Page Object Model
    config/              # хелпер окружения
scripts/                 # утилиты (например, скрипт разметки тегов)
.github/workflows/       # CI-пайплайн
docs/                    # стратегия тестирования и тест-планы
```

## Быстрый старт

```bash
npm ci
npx playwright install chromium
```

Создайте `.env` по образцу `.env.example` (для локального запуска не обязателен —
по умолчанию тесты идут против локального тест-сервера на `127.0.0.1:8003`).

### Запуск против тестового окружения

```bash
npm test                 # весь набор
npm run test:regression  # --grep @regression
npm run test:api         # --grep @api
npm run test:non-functional
npm run test:headed      # видимый браузер
npm run test:ui          # режим UI
```

### Запуск против продакшена (read-only смоук)

```bash
# .env:
#   BASE_URL=https://your-app.example.com
#   PROD_USER_PHONE=+7...        # выделенный студент для смоука
#   PROD_USER_PASSWORD=...
npm run test:prod
```

Прод-конфиг (`playwright.prod.config.js`) подхватывает только `tests/smoke/` и
полностью read-only: не создаёт пользователей, записей и заказов. Гоняется с
одним воркером и **автоматически пропускается**, если креды не заданы
(`PROD_USER_*`).

## Отчёты и отладка

При падении для каждого теста сохраняются скриншот, видео и трейс в
`test-results/`. Открыть трейс:

```bash
npx playwright show-trace test-results/<dir>/trace.zip
```

HTML-отчёты публикуются как артефакты CI.

## CI

`.github/workflows/ci.yml` срабатывает на каждый push / PR:

1. **Проверка сбора** — `playwright test --list` для обоих конфигов (все спеки
   парсятся и подключены корректно).
2. **Demo-прогон** — самодостаточный набор `tests/demo` не требует бэкенда: он
   поднимает HTTP-сервер внутри теста и проверяет POM, моки API и отсутствие
   ошибок в консоли. Так CI остаётся честным без засеянного окружения.
3. **Прод-смоук** (защищён секретами окружения) — read-only проверки боевого
   приложения.

## Как добавить тест

1. Положите спец в папку нужного домена (`tests/functional/<domain>/`) или
   отдельной категории.
2. Помечьте `describe` тегами категорий (например `{ tag: ['@api', '@regression'] }`).
3. Переиспользуйте `tests/support/pages/*` и `tests/support/fixtures/helpers.ts`
   вместо дублирования логики.
4. Проверьте локально: `npx playwright test --list && npx playwright test <файл>`.

## Лицензия

[MIT](LICENSE)