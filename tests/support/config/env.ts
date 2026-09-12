/**
 * Centralized access to environment configuration.
 *
 * Values come from `.env` (loaded by the Playwright config) or defaults that
 * match a local test environment. Production smoke credentials are read from
 * environment variables only and never committed to the repository.
 */

export const env = {
  /** Base URL of the application under test (test profile default). */
  baseURL: process.env.BASE_URL || 'http://127.0.0.1:8003/',

  /** Dedicated read-only users created on the LIVE environment. */
  prod: {
    baseURL: process.env.BASE_URL || 'https://alenaproyoga.ru',
    userPhone: process.env.PROD_USER_PHONE || '',
    userPassword: process.env.PROD_USER_PASSWORD || '',
  },
};

/** True when production smoke credentials are present in the environment. */
export const hasProdCredentials = Boolean(
  env.prod.userPhone && env.prod.userPassword,
);