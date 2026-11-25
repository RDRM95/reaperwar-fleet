import { expect, test } from '@playwright/test';
import { analyse, frames, hook, open } from './helpers';

test('the battle is drawn: not blank, both fleets in their colours, framed, no errors', async ({ page }) => {
  const errors = await open(page, 'ships=600&seed=11&quality=medium');
  await page.keyboard.press('h'); // hide the interface so only the battle is measured
  await frames(page, 6);
  const shot = analyse(await page.screenshot());
  const h = await hook(page);

  expect(h.ships).toBe(600);
  expect(h.stats.glints + h.stats.hulls, 'every ship is on screen in the overview').toBe(600);
  expect(shot.lit, 'frame is not blank').toBeGreaterThan(300);
  expect(shot.lit, 'frame is not washed out').toBeLessThan(shot.width * shot.height * 0.2);
  expect(shot.blue, 'first fleet shows in blue').toBeGreaterThan(40);
  expect(shot.orange, 'second fleet shows in orange').toBeGreaterThan(40);
  // Framing: the fleets span a good part of the view and are not cut off at its edge.
  expect(shot.box).not.toBeNull();
  expect(shot.box!.x1 - shot.box!.x0).toBeGreaterThan(0.25);
  expect(shot.box!.x0).toBeGreaterThan(0.01);
  expect(shot.box!.x1).toBeLessThan(0.99);
  expect(shot.box!.y0).toBeGreaterThan(0.01);
  expect(shot.box!.y1).toBeLessThan(0.99);
  expect(errors).toEqual([]);
});

test('a ship seen up close is drawn as a full hull with engine light', async ({ page }) => {
  const errors = await open(page, 'ships=200&seed=3&quality=medium');
  await page.keyboard.press('h');
  await page.evaluate(() => window.__rw.focus(0, 1200, 0.9, 0.3));
  await frames(page, 6);
  const h = await hook(page);
  const shot = analyse(await page.screenshot());
  expect(h.stats.hulls).toBeGreaterThan(0);
  expect(h.stats.triangles).toBeGreaterThan(1000);
  expect(shot.lit, 'the hull covers a visible area').toBeGreaterThan(shot.width * shot.height * 0.01);
  expect(shot.blue, 'engine and stripe colour is visible').toBeGreaterThan(50);
  expect(errors).toEqual([]);
});
