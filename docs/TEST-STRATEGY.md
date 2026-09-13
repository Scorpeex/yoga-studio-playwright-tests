# [(English version) Test Strategy](TEST-STRATEGY.md)
# [(Русская версия) Стратегия тестирования](TEST-STRATEGY.ru.md)

## Goal

Guarantee the core business flows of the Yoga Studio CRM keep working with every
change, while keeping the suite fast, deterministic and cheap to run from CI.

The suite is presented for hire-showcase purposes: 362 Playwright + TypeScript
tests illustrating layered coverage, a page-object architecture and CI meshing,
not just raw endpoint counting.

## Testing layers

```
                    ┌─────────────────────────────────────────┐
                    │  tests/functional/...                   │  ← user flows UI
                    │  tests/regression/                      │  ← money + isolation
                    ├─────────────────────────────────────────┤
 API coverage       │  @api tests (direct /api/ calls)        │
 Non-functional     │  @security @non-functional + performance│
                    └─────────────────────────────────────────┘
                    ┌─────────────────────────────────────────┐
                    │  demo.alenaproyoga.ru (full suite)      │  ← real stand, stubs
                    │  tests/demo (self-contained, CI)        │  ← fast signal on push
                    └─────────────────────────────────────────┘
```

1. **Functional UI** — Playwright drives the real browser over the page
   object model. Business domains live in `tests/functional/<domain>/`.
2. **API** — targeted backend calls through the same auth/setup helpers; fast,
   precise, stable. Tagged `@api`.
3. **Regression** — serial scenarios around the money lifecycle: subscription
   purchase, balance charge / refund, enrollment seats, multi-user isolation.
4. **Non-functional** — performance budgets (page loads under time limits),
   robustness / idempotency (duplicate payments, malformed webhooks, double
   cancels), security boundaries (guest redirects, role isolation, CSRF) and
   baseline accessibility checks.
5. **Primary run — demo subdomain**: the full suite runs on
   `demo.alenaproyoga.ru` — a DEMO_MODE application on a dedicated seeded
   database (`demo_db.sqlite3`, `settings_demo`) with test-only endpoints
   (`/api/auth/test/*`) and VK / YooKassa stubs, so nothing has to be skipped.

## Reliability principles

- **Deterministic data**: tests spawn their own users/events via test-only API
  helpers (unique phones, date offsets) and clean up afterwards (`deleteTestUser`,
  `deleteCalendarEvent`, idempotent guards). The only shared dependence is the
  canonical seed (test users s5/s6, tariffs, admin/moderator) which is provided by
  the test server / DEMO_MODE. The demo database is separate
  (`demo_db.sqlite3`) and seeded with `seed_data`; CI resets it (flush + seed)
  before every full run for full determinism.
- **Date isolation**: calendar scenarios use far-future dates, each suite on its
  own day-offset, so parallel workers never collide.
- **Idempotent setup**: helpers (`setBalance`, `purchaseSubscription`, …) tolerate
  leftovers from interrupted runs.
- **Self-healing selectors**: UI is driven by `data-test-id` attributes,
  not brittle CSS paths.
- **CI**: on every push — a quick collection check (`--list`) and the
  self-contained `tests/demo`. The full suite runs on the demo stand via a
  button (`workflow_dispatch` — runnable by an HR reviewing the portfolio) and a
  nightly schedule; the database is reset beforehand through the app's own
  DEMO_MODE-only endpoint `POST /api/demo/reset-db/` (flush + seed).

## Naming & structure

- Folders name the domain/category; `test.describe` names the scenario group;
  tags select categories: `@functional`, `@api`, `@regression`, `@security`,
  `@non-functional`, `@smoke`.
- New tests reuse `tests/support/pages/*` (POM) and `tests/support/fixtures/`
  (helpers) instead of duplicating setup.

## Documents

Detailed test plans (from which the specs are translated):

- [Login](test-plans/login.md)
- [Registration](test-plans/register.md)
- [Calendar & enrollment](test-plans/calendar.md)
