import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('the benchmark switch runs and prints a complete paste-back report', async ({ page }) => {
  const errors = await open(page, 'bench=300&secs=2&seed=7&quality=low&res=640x360');
  await page.waitForFunction(() => window.__rw.bench !== null, null, { timeout: 200_000 });
  const text = await page.locator('#report-text').innerText();
  for (const field of ['GPU:', 'resolution: 640x360', 'settings: low', 'ships: 300', 'seed: 7', 'fps: avg', '1% low', '0.1% low', 'main-thread CPU', 'GPU passes', 'simulation (worker thread): tick avg', 'state hash:']) {
    expect(text).toContain(field);
  }
  const r = await page.evaluate(() => window.__rw.bench!);
  expect(r.frames).toBeGreaterThan(3);
  expect(r.fpsAvg).toBeGreaterThan(0);
  expect(r.simAvg).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
