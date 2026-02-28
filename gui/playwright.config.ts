import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:38880',
    headless: true,
    locale: 'zh-TW',
  },
  webServer: {
    command: 'npm run dev',
    port: 38880,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
