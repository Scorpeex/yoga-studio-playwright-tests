// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv/config');

/**
 * Production smoke configuration.
 *
 * Runs ONLY read-only tests from tests/smoke/ against the live application.
 * Credentials for dedicated smoke users are expected in the environment
 * (see .env.example):
 *   BASE_URL            — https://your-app.example.com
 *   PROD_USER_PHONE     — dedicated test student phone
 *   PROD_USER_PASSWORD  — dedicated test student password
 *
 * Usage:
 *   npx playwright test -c playwright.prod.config.js
 */
module.exports = defineConfig({
  testDir: './tests',
  testMatch: /smoke\/.+\.spec\.ts/,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL || 'https://alenaproyoga.ru',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    testIdAttribute: 'data-test-id',
    ...devices['Desktop Chrome'],
  },

  outputDir: 'test-results',
});