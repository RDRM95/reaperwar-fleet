import { defineConfig } from '@playwright/test';

// Browser tests run headed Chromium under Xvfb: that is the configuration in
// which software WebGPU both creates a device and shows its pixels in
// screenshots. Timeouts allow for a CI runner several times slower than a
// developer machine.
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: false,
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] },
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
