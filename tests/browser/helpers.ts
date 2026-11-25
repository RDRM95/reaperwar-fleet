import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

export interface Hook {
  frames: number;
  tick: number;
  hash: string;
  ships: number;
  ready: boolean;
  error: string | null;
  paused: boolean;
  uiHidden: boolean;
  follow: number | null;
  cam: { yaw: number; pitch: number; dist: number; pan: number[] };
  stats: { drawCalls: number; hulls: number; glints: number; sprites: number; triangles: number };
}

/** Open the game and wait until it is drawing. Collects console errors for the caller to assert on. */
export async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__rw && (window.__rw.ready || window.__rw.error), null, { timeout: 120_000 });
  expect(await page.evaluate(() => window.__rw.error), 'game reported an error').toBeNull();
  return errors;
}

export const hook = (page: Page): Promise<Hook> =>
  page.evaluate(() => {
    const r = window.__rw;
    return { frames: r.frames, tick: r.tick, hash: r.hash, ships: r.ships, ready: r.ready, error: r.error, paused: r.paused, uiHidden: r.uiHidden, follow: r.follow, cam: r.cam, stats: r.stats };
  });

/** Wait until `n` more frames have been drawn (slow software rendering is expected). */
export async function frames(page: Page, n: number): Promise<void> {
  const start = (await hook(page)).frames;
  await page.waitForFunction((target) => window.__rw.frames >= target, start + n, { timeout: 180_000 });
}

export interface ImageStats {
  width: number;
  height: number;
  lit: number;
  blue: number;
  orange: number;
  /** Bounding box of strongly coloured pixels, as fractions of the frame. */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** Count lit pixels and pixels in each fleet's colour in a screenshot. */
export function analyse(png: Buffer): ImageStats {
  const img = PNG.sync.read(png);
  let lit = 0, blue = 0, orange = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
      if (r + g + b > 90) lit++;
      const isBlue = b > 110 && b > r * 1.7;
      const isOrange = r > 110 && r > b * 2.4 && g < r * 0.8;
      if (isBlue) blue++;
      if (isOrange) orange++;
      if (isBlue || isOrange) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const box = x1 < 0 ? null : { x0: x0 / img.width, y0: y0 / img.height, x1: x1 / img.width, y1: y1 / img.height };
  return { width: img.width, height: img.height, lit, blue, orange, box };
}
