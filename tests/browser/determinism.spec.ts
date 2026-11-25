import { expect, test } from '@playwright/test';
import { World, hashHex, hashWorld, probeScenario } from '../../packages/sim/src/index';
import { open } from './helpers';

test('the in-game simulation thread and the headless runner produce the same hash on every tick', async ({ page }) => {
  const ships = 600, seed = 11, ticks = 120;
  await open(page, `ships=${ships}&seed=${seed}&quality=low`);
  await page.waitForFunction((t) => window.__rw.tick >= t, ticks, { timeout: 180_000 });
  const inGame = await page.evaluate((t) => window.__rw.hashes(1, t), ticks);

  const world = new World(probeScenario(ships, seed));
  const headless: string[] = [];
  for (let t = 0; t < ticks; t++) {
    world.step();
    headless.push(hashHex(hashWorld(world)));
  }
  expect(inGame.filter((h) => h === '').length, 'no tick was missed').toBe(0);
  expect(inGame).toEqual(headless);
});
