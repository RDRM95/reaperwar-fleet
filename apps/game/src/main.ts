import { HULLS } from '@rw/hulls';
import { hashHex } from '@rw/sim';
import { Bench, type BenchResult } from './bench';
import { OrbitRig } from './camera';
import { Input } from './input';
import { QUALITY, Renderer, type QualityName } from './render/renderer';
import { SceneBuilder } from './scene';
import { SimClient, type SimStatic } from './simClient';
import { Ui } from './ui';
import { runViewer } from './viewer';

declare const __BUILD__: string;

interface DebugHook {
  frames: number;
  tick: number;
  hash: string;
  seed: number;
  ships: number;
  ready: boolean;
  error: string | null;
  cam: { yaw: number; pitch: number; dist: number; pan: number[] };
  stats: { drawCalls: number; hulls: number; glints: number; sprites: number; triangles: number };
  gpu: { software: boolean; description: string };
  hashes(from: number, to: number): string[];
  bench: BenchResult | null;
  /** Ride with one ship at a given distance (metres). */
  focus(ship: number, dist: number, yaw?: number, pitch?: number): void;
  overview(): void;
  follow: number | null;
  paused: boolean;
  uiHidden: boolean;
}
declare global {
  interface Window {
    __rw: DebugHook;
  }
}

const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => (params.has(k) && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : d);

async function start(): Promise<void> {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const benchShips = num('bench', 0);
  let ships = Math.max(2, Math.floor(benchShips || num('ships', 2000)));
  let seed = num('seed', 1) >>> 0;
  const forced = /^(\d+)x(\d+)$/.exec(params.get('res') ?? '');
  const forcedRes = forced ? { w: Number(forced[1]), h: Number(forced[2]) } : undefined;

  let renderer: Renderer;
  let ui: Ui;
  let sim: SimClient;
  let st: SimStatic | null = null;
  let bench: Bench | null = null;
  let benchResult: BenchResult | null = null;
  let paused = false;
  /** Ship the camera rides with, or null for the fleet overview. */
  let followShip: number | null = null;
  let needFraming = true;

  const restart = (n: number, s: number) => {
    sim?.dispose();
    st = null;
    ships = n;
    seed = s;
    sim = new SimClient(n, s);
    sim.whenReady().then((x) => (st = x));
    followShip = null;
    needFraming = true;
    ui.sync(ships, seed, renderer.quality.name);
  };
  const startBench = (n: number) => {
    restart(n, seed);
    benchResult = null;
    bench = new Bench({
      build: __BUILD__, gpu: renderer.info, quality: renderer.quality, width: 0, height: 0,
      cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, dpr: window.devicePixelRatio || 1,
      ships: n, seed, seconds: num('secs', 20),
    });
  };

  ui = new Ui({
    onShips: (n) => restart(n, seed),
    onSeed: (s) => restart(ships, s),
    onQuality: (q) => { renderer.setQuality(QUALITY[q]); ui.sync(ships, seed, q); },
    onBenchmark: startBench,
  });

  const rig = new OrbitRig();
  try {
    renderer = await Renderer.create(canvas, QUALITY.high);
  } catch (e) {
    ui.fatal(String((e as Error).message ?? e));
    window.__rw = { error: String(e) } as DebugHook;
    return;
  }
  const wanted = params.get('quality') as QualityName | null;
  renderer.setQuality(QUALITY[wanted && wanted in QUALITY ? wanted : renderer.info.software ? 'low' : 'ultra']);
  renderer.setHulls(HULLS);
  renderer.device.lost.then((info) => ui.fatal(`The graphics device was lost (${info.message || info.reason}). Reload the page.`));
  // Probe classes map onto the two hulls built so far.
  const scene = new SceneBuilder(HULLS, [0, 1]);
  const input = new Input(canvas, () => rig);
  input.onKey = (k) => {
    if (k === ' ') { paused = !paused; sim.setRate(paused ? 0 : 1); }
    if (k === 'h') ui.toggleHidden();
    if (k === 'f' && st) hook.focus(followShip === null ? 0 : (followShip + 37) % st.n, 1800);
    if (k === 't' || k === 'Escape') { followShip = null; needFraming = true; }
  };
  ui.set('gpu', `${renderer.info.description || renderer.info.architecture || renderer.info.vendor || 'unknown'}${renderer.info.software ? ' (software)' : ''}`);

  if (benchShips) startBench(ships);
  else restart(ships, seed);

  let frames = 0;
  let last = performance.now();
  let fpsAcc = 0, fpsFrames = 0, hudAt = 0;
  const follow = new Float64Array(3);
  let overviewDist = 300000;
  const sun: [number, number, number] = [0.48, 0.42, 0.77];

  const hook: DebugHook = {
    get frames() { return frames; },
    get tick() { return sim.latestTick; },
    get hash() { return hashHex(sim.lastHash); },
    get seed() { return seed; },
    get ships() { return st?.n ?? 0; },
    get ready() { return st !== null && frames > 2 && sim.snaps.length >= 2; },
    error: null,
    get cam() { return { yaw: rig.yaw, pitch: rig.pitch, dist: rig.dist, pan: [...rig.pan] }; },
    get stats() { return { drawCalls: renderer.stats.drawCalls, hulls: renderer.stats.hulls, glints: scene.glints, sprites: renderer.stats.sprites, triangles: renderer.stats.triangles }; },
    gpu: { software: renderer.info.software, description: renderer.info.description },
    hashes(from, to) {
      const out: string[] = [];
      for (let t = from; t <= to; t++) out.push(sim.hashes.has(t) ? hashHex(sim.hashes.get(t)!) : '');
      return out;
    },
    get bench() { return benchResult; },
    get follow() { return followShip; },
    focus(ship, dist, yaw, pitch) {
      followShip = ship;
      rig.targetDist = dist;
      if (yaw !== undefined) rig.targetYaw = yaw;
      if (pitch !== undefined) rig.targetPitch = pitch;
      rig.targetPan.fill(0);
      rig.snap();
    },
    overview() { followShip = null; needFraming = true; },
    get paused() { return paused; },
    get uiHidden() { return ui.root.classList.contains('hidden'); },
  };
  window.__rw = hook;
  window.addEventListener('error', (e) => (hook.error = e.message));
  renderer.device.addEventListener('uncapturederror', (e) => {
    hook.error = (e as GPUUncapturedErrorEvent).error.message;
    console.error('WebGPU error:', hook.error);
  });

  const frame = (now: number) => {
    const frameMs = now - last;
    last = now;
    const dt = Math.min(0.1, frameMs / 1000);
    const cpu0 = performance.now();
    renderer.resize(forcedRes);
    input.update(dt);
    const view = st ? sim.advance(dt) : null;
    if (st && view) {
      const { a, b, alpha } = view;
      scene.computeCentroid(a, b, alpha, st.n);
      if (needFraming) {
        // Frame the whole battle: back off far enough to see every ship.
        let far = 0;
        const p = b.views.pos, c = scene.centroid;
        for (let i = 0; i < st.n; i++) far = Math.max(far, Math.hypot(p[i * 3] - c[0], p[i * 3 + 1] - c[1], p[i * 3 + 2] - c[2]));
        overviewDist = far * 2.6 + 4000;
        rig.targetYaw = 0.9; rig.targetPitch = 0.38; rig.targetDist = overviewDist;
        rig.targetPan.fill(0);
        rig.snap();
        needFraming = false;
      }
      if (bench) {
        // Scripted flight: half the run over the whole battle, half riding close behind one cruiser.
        const p = Math.max(0, bench.progress);
        const want = p > 0.5 ? 0 : null;
        if (want !== followShip) { followShip = want; rig.targetPan.fill(0); rig.snap(); }
        if (p > 0.5) { rig.targetDist = 2600 - 1700 * (p - 0.5) * 2; rig.targetYaw = 0.5 + (p - 0.5) * 4.4; rig.targetPitch = 0.18; }
        else { rig.targetDist = overviewDist * (1 - 0.9 * p); rig.targetYaw = 0.9 + p * 1.8; rig.targetPitch = 0.38; }
        if (bench.elapsed === 0) rig.snap();
      }
      if (followShip !== null && followShip < st.n) {
        scene.shipPos(a, b, alpha, followShip, follow);
        rig.anchor.set(follow);
      } else {
        rig.anchor.set(scene.centroid);
      }
      rig.update(dt);
      scene.build(renderer, st, a, b, alpha, rig);
      renderer.frame(rig, sun, now / 1000, scene.shipCount, scene.hullOf, scene.lodOf, scene.sorted, scene.spriteCount);
      renderer.stats.glints = scene.glints;
      frames++;
    }
    const cpuMs = performance.now() - cpu0;

    if (bench && st && view) {
      bench.input.width = renderer.width;
      bench.input.height = renderer.height;
      const wasRecording = bench.recording;
      bench.frame(frameMs, cpuMs, renderer.stats.gpuMs, renderer.stats);
      if (!wasRecording && bench.recording) sim.stepMs.length = 0;
      ui.showProgress(bench.recording ? `Benchmark: ${Math.min(100, Math.round(bench.progress * 100))} %` : 'Benchmark: warming up');
      if (bench.done) {
        bench.simMs = [...sim.stepMs];
        benchResult = bench.result(sim.latestTick, hashHex(sim.lastHash));
        ui.showProgress(null);
        ui.showReport(benchResult.text);
        console.log(benchResult.text);
        bench = null;
      }
    }

    fpsAcc += frameMs;
    fpsFrames++;
    if (now - hudAt > 250) {
      hudAt = now;
      const ms = fpsAcc / fpsFrames;
      fpsAcc = 0; fpsFrames = 0;
      const tick = sim.stepMs.length ? sim.stepMs.reduce((s, x) => s + x, 0) / sim.stepMs.length : 0;
      ui.set('seed', String(seed));
      ui.set('ships', `${(st?.n ?? 0).toLocaleString('en')}  (${renderer.stats.hulls} hulls, ${scene.glints} glints)`);
      ui.set('fps', (1000 / ms).toFixed(0));
      ui.set('frame', `${ms.toFixed(2)} ms  (${renderer.width}x${renderer.height})`);
      ui.set('sim tick', `${tick.toFixed(2)} ms`);
      ui.set('tick', `${sim.latestTick}${paused ? '  paused' : ''}`);
      ui.set('hash', hashHex(sim.lastHash));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (params.has('hull')) runViewer(params);
else start();
