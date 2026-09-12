# Test Strategy

## Goal

Guarantee the core business flows of the Yoga Studio CRM keep working with every
change, while keeping the suite fast, deterministic and cheap to run from CI.

The suite is presented for hire-showcase purposes: 362 Playwright + TypeScript
tests illustrating layered coverage, a page-object architecture and CI meshing,
not just raw endpoint counting.

## Testing layers

```
                    ┌────────────────────────────────────────┐
                    │  tests/functional/...                   │  ← user flows UI
                    │  tests/regression/                      │  ← money + isolation
                    ├────────────────────────────────────────┤
 API coverage       │  @api tests (direct /api/ calls)        │
 Non-functional     │  @security @non-functional + performance│
                    └────────────────────────────────────────┘
                    ┌────────────────────────────────────────┐
                    │  tests/smoke (prod, read-only)          │  ← deploy sanity
                    │  tests/demo (self-contained, CI)        │  ← CI honesty
                    └────────────────────────────────────────┘
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
5. **Production smoke** — a deliberately *read-only* suite (`tests/smoke/`)
   that runs against the live application with dedicated credentials and never
   mutates data.

## Reliability principles

- **Deterministic data**: tests spawn their own users/events via test-only API
  helpers and clean up afterwards; no dependence on shared state.
- **Date isolation**: calendar scenarios use far-future dates, each suite on its
  own day-offset, so parallel workers never collide.
- **Idempotent setup**: helpers (`setBalance`, `purchaseSubscription`, …) tolerate
  leftovers from interrupted runs.
- **Self-healing selectors**: UI is driven by `data-test-id` attributes,
  not brittle CSS paths.
- **CI honesty**: the full UI+API suite needs a seeded test environment, so CI
  runs (a) a `--list` collection check, (b) the backend-free `tests/demo`, and
  (c) production smoke when credentials are supplied.

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