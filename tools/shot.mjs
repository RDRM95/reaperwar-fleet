// Open the built game in headed Chromium (software WebGPU under Xvfb) and save screenshots.
//   xvfb-run -a node tools/shot.mjs <out-dir> "<query>" [name] [waitMs] [script]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [out, query = '', name = 'shot', waitMs = '4000', script = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`${process.env.BASE_URL ?? "http://localhost:4173/"}?${query}`);
await page.waitForFunction(() => window.__rw && (window.__rw.ready || window.__rw.error), null, { timeout: 60000 }).catch(() => logs.push('timeout waiting for ready'));
await page.waitForTimeout(Number(waitMs));
if (script) await page.evaluate(script);
if (script) await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/${name}.png` });
const state = await page.evaluate(() => (window.__rw ? { frames: __rw.frames, tick: __rw.tick, hash: __rw.hash, ships: __rw.ships, stats: __rw.stats, cam: __rw.cam, error: __rw.error, gpu: __rw.gpu } : null));
console.log(JSON.stringify(state));
console.log([...new Set(logs)].slice(0, 8).map((l) => l.slice(0, 900)).join("\n"));
await browser.close();
