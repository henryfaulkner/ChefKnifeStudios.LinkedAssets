import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  webServer: process.env.LA_START_STATIC_HOST==='1' ? { command:'python static-server.py ../../artifacts/client/wwwroot',url:'http://127.0.0.1:5180',reuseExistingServer:false } : undefined,
  testDir: '.', testMatch: '*.spec.js', workers: 1, timeout: 45000,
  reporter: 'list', use: { baseURL: process.env.LA_STATIC_HOST==='1' || process.env.LA_START_STATIC_HOST==='1'
    ? 'http://localhost:5180' : (process.env.LA_PREVIEW_URL ?? 'https://localhost:7099/'), viewport: {width: 1440, height: 900} },
  projects: [{ name: 'chromium', use: {...devices['Desktop Chrome']} }, { name: 'firefox', use: {...devices['Desktop Firefox']} }]
});
