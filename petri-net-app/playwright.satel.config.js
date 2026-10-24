import { defineConfig, devices } from '@playwright/test';
const built = process.env.SATEL_BUILT === '1';
export default defineConfig({
  testDir: './tests/e2e/satel', timeout: 120000, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.SATEL_BROWSER_REPORT || 'test-results/satel-browser.json' }]],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3000',
    launchOptions: { ...(process.env.SATEL_CHROMIUM ? { executablePath: process.env.SATEL_CHROMIUM } : {}), args: ['--disable-dev-shm-usage', '--no-zygote'] } },
  webServer: {
    command: built ? 'node node_modules/vite/bin/vite.js preview --config vite.satel-test.config.js --host 127.0.0.1 --port 3000' : 'node node_modules/vite/bin/vite.js --host 127.0.0.1',
    url: 'http://127.0.0.1:3000', reuseExistingServer: false, timeout: 120000, env: { PW_NO_OPEN: '1' }
  }
});
