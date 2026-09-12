// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv/config');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8003/';

/**
 * Main Playwright configuration — runs against a test environment
 * (Django test server on :8003 with a seeded, isolated test database).
 *
 * How to run:
 *   npx playwright test                     # full suite
 *   npx playwright test tests/functional  # domain folders
 *   npx playwright test --grep @regression  # category tags
 *
 * For a production smoke run use `npx playwright test -c playwright.prod.config.js`.
 */
module.exports = defineConfig({
  testDir: './tests',

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  workers: process.env.CI ? 1 : 5,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-test-id',
    colorScheme: 'light',
    ...devices['Desktop Chrome'],
  },

  outputDir: 'test-results',
});