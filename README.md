[![CI](https://img.shields.io/github/actions/workflow/status/Scorpeex/yoga-studio-playwright-tests/ci.yml?branch=main&label=CI)](https://github.com/Scorpeex/yoga-studio-playwright-tests/actions/workflows/ci.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.62.1-2bd4ae)](https://playwright.dev)
![Tests](https://img.shields.io/badge/tests-362-blue)

# [(English version) Yoga Studio — Playwright E2E Test Suite](README.md)
# [(Русская версия) Йога-студия — Playwright E2E тесты](README.ru.md)

End-to-end test suite for a Yoga Studio CRM web application, built with
[Playwright](https://playwright.dev) + TypeScript.

**362 tests** across functional, API, regression, security and non-functional
categories. Tests are organised into domain folders, tagged by category,
reuse a shared Page Object Model, and run against a test environment — plus a
read-only smoke suite for production.

## What is covered

| Area | Description | Tag |
| --- | --- | --- |
| Functional (329) | Auth, registration, profile, event calendar, subscriptions / shop, notifications, home dashboard | `@functional` |
| API (51) | Direct backend endpoints: auth, calendar CRUD, enrollment, attendance, payments | `@api` |
| Regression (65) | Core business flows, money lifecycle, multi-user isolation | `@regression` |
| Security (34) | Access boundaries, role isolation, guest redirects | `@security` |
| Non-functional (19) | Performance budgets, robustness / idempotency, CSRF, accessibility basics | `@non-functional` |
| Smoke — production (7) | Read-only checks against the live application | `@smoke` |

Categories are marked with
[Playwright tags](https://playwright.dev/docs/test-annotations#tag-tests) on
`test.describe`, so any subset can be run with `--grep`.

## Repository layout

```
tests/
  functional/            # by business domain (auth, calendar, home, ...)
  regression/            # core business flows
  non-functional/        # performance, robustness, security, accessibility
  smoke/                 # read-only production smoke suite
  demo/                  # self-contained CI demo (no backend required)
  support/
    fixtures/            # shared test setup + API helpers
    pages/               # Page Object Model
    config/              # environment helper
scripts/                 # tooling (e.g. suite tagging script)
.github/workflows/       # CI pipeline
docs/                    # test strategy + test plans
```

## Getting started

```bash
npm ci
npx playwright install chromium
```

Create `.env` from `.env.example` (optional for local runs — sensible defaults
point to a local test server on `127.0.0.1:8003`).

### Run against the test environment

```bash
npm test                 # full suite
npm run test:regression  # --grep @regression
npm run test:api         # --grep @api
npm run test:non-functional
npm run test:headed      # visible browser
npm run test:ui          # Playwright UI mode
```

### Run against production (read-only smoke)

```bash
# .env:
#   BASE_URL=https://your-app.example.com
#   PROD_USER_PHONE=+7...        # dedicated smoke-test student
#   PROD_USER_PASSWORD=...
npm run test:prod
```

The production config (`playwright.prod.config.js`) only picks up `tests/smoke/`
and is entirely read-only — no test users, bookings or orders are created.
It runs with a single worker and is **skipped automatically** when no
credentials are provided (`PROD_USER_*`).

## Reports & debugging

On failure Playwright keeps screenshots, video and a trace for every test in
`test-results/`. Open a trace with:

```bash
npx playwright show-trace test-results/<dir>/trace.zip
```

HTML reports are published as CI artifacts.

## CI

`.github/workflows/ci.yml` runs on every push / PR:

1. **Collection check** — `playwright test --list` for both configs (guarantees
   every spec parses and is wired correctly).
2. **Demo run** — the self-contained `tests/demo` suite needs no backend; it
   starts an in-test HTTP server and verifies POM usage, API mocking and
   console-error guards. This keeps CI honest without a seeded environment.
3. **Production smoke** (workflow_dispatch + environment-secret protected) —
   read-only checks against the live app using GitHub secrets.

## How to add a test

1. Place the spec in the matching domain folder (`tests/functional/<domain>/`)
   or a dedicated category folder.
2. Tag the `describe` block with the relevant categories
   (e.g. `{ tag: ['@api', '@regression'] }`).
3. Reuse `tests/support/pages/*` and `tests/support/fixtures/helpers.ts`
   instead of duplicating setup logic.
4. Verify locally: `npx playwright test --list && npx playwright test <your-file>`.

## License

[MIT](LICENSE)
