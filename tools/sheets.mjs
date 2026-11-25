// Render a reference sheet image for each hull: six orthographic views, a
// three-quarter view and a scale comparison, composed onto one page.
//   xvfb-run -a node tools/sheets.mjs [hull-id ...]      (needs `npm run build` first)
// Output: docs/design/sheets/<hull-id>.png
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.SHEETS_PORT ?? 4174);
const STANDARD = 'alliance_cruiser'; // every sheet shows the hull beside this one for scale
const server = spawn('npx', ['vite', 'preview', '--config', 'apps/game/vite.config.ts', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let ids = process.argv.slice(2);
  if (ids.length === 0) {
    await page.goto(`http://localhost:${PORT}/?hull=__list`);
    ids = await page.evaluate(() => window.__hulls ?? []);
  }
  mkdirSync('docs/design/sheets', { recursive: true });
  for (const id of ids) {
    const shots = [];
    let info = null;
    const views = ['port', 'starboard', 'top', 'bottom', 'bow', 'stern', 'quarter', 'scale'];
    for (const view of views) {
      const q = view === 'scale' ? `hull=${id}&view=top&beside=${id === STANDARD ? 'alliance_frigate' : STANDARD}` : `hull=${id}&view=${view}`;
      await page.goto(`http://localhost:${PORT}/?${q}&quality=high`);
      await page.waitForFunction(() => window.__rw && (window.__rw.ready || window.__rw.error), null, { timeout: 120000 });
      info = await page.evaluate(() => ({ ...window.__rw }));
      if (info.error) throw new Error(`${id} ${view}: ${info.error}`);
      await page.waitForTimeout(300);
      shots.push({ view, data: (await page.screenshot()).toString('base64') });
    }
    const label = { port: 'Port side', starboard: 'Starboard side', top: 'Top', bottom: 'Bottom', bow: 'Bow', stern: 'Stern', quarter: 'Three-quarter', scale: `Scale: beside ${id === STANDARD ? 'alliance_frigate' : STANDARD}` };
    const html = `<body style="margin:0;background:#070a10;color:#cfe3ff;font:14px system-ui">
      <div style="padding:14px 18px;font-size:20px;letter-spacing:.08em">${id} <span style="color:#7f93b3;font-size:14px">built length ${info.lengthM.toFixed(0)} m, ${info.triangles} triangles</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,400px);gap:6px;padding:0 18px 18px">
      ${shots.map((s) => `<figure style="margin:0"><img width="400" height="225" src="data:image/png;base64,${s.data}"><figcaption style="color:#7f93b3;padding:2px 0 6px">${label[s.view]}</figcaption></figure>`).join('')}
      </div></body>`;
    const sheet = await browser.newPage({ viewport: { width: 1654, height: 560 } });
    await sheet.setContent(html);
    writeFileSync(`docs/design/sheets/${id}.png`, await sheet.screenshot({ fullPage: true }));
    await sheet.close();
    console.log(`${id}: built length ${info.lengthM.toFixed(1)} m, ${info.triangles} triangles -> docs/design/sheets/${id}.png`);
  }
  if (errors.length) console.log('console errors:', [...new Set(errors)].slice(0, 5));
} finally {
  await browser.close();
  server.kill();
}
