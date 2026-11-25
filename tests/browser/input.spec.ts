import { expect, test } from '@playwright/test';
import { frames, hook, open } from './helpers';

// Real pointer and key events, dispatched by the browser at screen positions
// over the battle, with the interface layer in place above the canvas.
test('mouse and keyboard reach the battle through the interface layer', async ({ page }) => {
  const errors = await open(page, 'ships=300&seed=5&quality=low');
  const cx = 640, cy = 400;

  // The element under the pointer at the centre of the screen must be the canvas.
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [cx, cy])).toBe('view');

  // Right-drag rotates.
  let before = await hook(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(cx + 160, cy + 60, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await frames(page, 4);
  let after = await hook(page);
  expect(Math.abs(after.cam.yaw - before.cam.yaw)).toBeGreaterThan(0.2);
  expect(Math.abs(after.cam.pitch - before.cam.pitch)).toBeGreaterThan(0.05);

  // Wheel zooms in.
  before = after;
  await page.mouse.wheel(0, -600);
  await frames(page, 6);
  after = await hook(page);
  expect(after.cam.dist).toBeLessThan(before.cam.dist * 0.8);

  // Middle-drag moves the view.
  before = after;
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cx - 120, cy - 40, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  await frames(page, 4);
  after = await hook(page);
  expect(Math.hypot(...after.cam.pan.map((v, i) => v - before.cam.pan[i]))).toBeGreaterThan(100);

  // Keys: W moves, Space pauses the simulation, F rides with a ship, T returns, H hides the interface.
  before = after;
  await page.keyboard.down('w');
  await frames(page, 4);
  await page.keyboard.up('w');
  after = await hook(page);
  expect(Math.hypot(...after.cam.pan.map((v, i) => v - before.cam.pan[i]))).toBeGreaterThan(1);

  await page.keyboard.press(' ');
  expect((await hook(page)).paused).toBe(true);
  await page.waitForTimeout(400);
  const t1 = (await hook(page)).tick;
  await page.waitForTimeout(600);
  expect((await hook(page)).tick).toBe(t1);
  await page.keyboard.press(' ');
  await page.waitForFunction((t) => window.__rw.tick > t, t1, { timeout: 60_000 });

  await page.keyboard.press('f');
  expect((await hook(page)).follow).toBe(0);
  await page.keyboard.press('t');
  expect((await hook(page)).follow).toBeNull();

  await page.keyboard.press('h');
  expect((await hook(page)).uiHidden).toBe(true);
  await expect(page.locator('#hud')).toBeHidden();
  await page.keyboard.press('h');
  await expect(page.locator('#hud')).toBeVisible();

  // The menu still works with the mouse.
  await page.locator('#ships-select').selectOption('200');
  await page.waitForFunction(() => window.__rw.ships === 200, null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});
