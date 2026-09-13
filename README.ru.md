[![CI](https://img.shields.io/github/actions/workflow/status/Scorpeex/yoga-studio-playwright-tests/ci.yml?branch=main&label=CI)](https://github.com/Scorpeex/yoga-studio-playwright-tests/actions/workflows/ci.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.62.1-2bd4ae)](https://playwright.dev)
![Tests](https://img.shields.io/badge/tests-362-blue)

# [(Русская версия) Йога-студия — Playwright E2E тесты](README.ru.md)
# [(English version) Yoga Studio — Playwright E2E Test Suite](README.md)

Набор E2E-тестов для CRM йога-студии на [Playwright](https://playwright.dev) +
TypeScript.

**362 теста**: функциональные, API, регрессионные, безопасность и
нефункциональные. Тесты разложены по папкам доменов, помечены тегами категорий,
используют общий Page Object Model и гоняют **весь набор** на demo-поддомене
`demo.alenaproyoga.ru` — плюс опциональный read-only смоук для продакшена.

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

## Документация

- [Стратегия тестирования](docs/TEST-STRATEGY.ru.md) · [Test Strategy (EN)](docs/TEST-STRATEGY.md)
- Тест-планы (RU): [Вход](docs/test-plans/login.md) · [Регистрация](docs/test-plans/register.md) · [Календарь и запись](docs/test-plans/calendar.md)

## Быстрый старт

```bash
npm ci
npx playwright install chromium
```

Создайте `.env` по образцу `.env.example` (обязателен — по умолчанию полный
набор гоняется на demo-поддомене `https://demo.alenaproyoga.ru`, где доступны
все тестовые эндпоинты и заглушки VK / ЮKassa, поэтому скипы не нужны).

### Полный набор против demo-поддомена

```bash
npm test                 # весь набор (demo.alenaproyoga.ru)
npm run test:regression  # --grep @regression
npm run test:api         # --grep @api
npm run test:non-functional
npm run test:headed      # видимый браузер
npm run test:ui          # режим UI
```

Переопределите базовый адрес для локального прогона:

```bash
BASE_URL=http://127.0.0.1:8003/ npm test
```

### Прод-смоук (опциональный, read-only, вне CI)

```bash
# .env:
#   BASE_URL=https://alenaproyoga.ru
#   PROD_USER_PHONE=+7...        # выделенный студент для смоука
#   PROD_USER_PASSWORD=...
npm run test:prod
```

Прод-конфиг (`playwright.prod.config.js`) — доп. профиль к основному набору:
подхватывает только `tests/smoke/` и полностью read-only: не создаёт
пользователей, записей и заказов. Гоняется с одним воркером и
**автоматически пропускается**, если креды не заданы (`PROD_USER_*`).

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
   ошибок в консоли. Это быстрый сигнал на каждый push.

Полный набор гоняется на demo-поддомене — посмотреть вживую может любой: на
[странице Actions](https://github.com/Scorpeex/yoga-studio-playwright-tests/actions/workflows/ci.yml)
нажмите **Run workflow** (джоба `workflow_dispatch`, поэтому публично доступна —
например HR, который смотрит портфолио). Также запускается ночью по расписанию
(cron). Перед прогоном БД demo сбрасывается через тестовый эндпоинт самого
приложения `POST /api/demo/reset-db/` (flush + seed, доступен только в
DEMO_MODE), чтобы остатки от прошлых прогонов не могли сломать тесты, затем
весь набор бежит против `https://demo.alenaproyoga.ru/`. HTML-отчёт
выкладывается артефактом CI.

## Как добавить тест

1. Положите спец в папку нужного домена (`tests/functional/<domain>/`) или
   отдельной категории.
2. Помечьте `describe` тегами категорий (например `{ tag: ['@api', '@regression'] }`).
3. Переиспользуйте `tests/support/pages/*` и `tests/support/fixtures/helpers.ts`
   вместо дублирования логики.
4. Проверьте локально: `npx playwright test --list && npx playwright test <файл>`.

## Лицензия

[MIT](LICENSE)
