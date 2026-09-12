import { test as baseTest, expect } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8003/';

export const test = baseTest;
export { expect };