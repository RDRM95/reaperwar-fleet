/** Collects frame and tick timings for a fixed period and formats the paste-back report. */
import type { GpuInfo, Quality } from './render/renderer';

export interface BenchInput {
  build: string;
  gpu: GpuInfo;
  quality: Quality;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  ships: number;
  seed: number;
  seconds: number;
}

export interface BenchResult {
  text: string;
  frames: number;
  fpsAvg: number;
  low1: number;
  low01: number;
  cpuAvg: number;
  gpuAvg: number;
  simAvg: number;
  ships: number;
  seed: number;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

export class Bench {
  frameMs: number[] = [];
  cpuMs: number[] = [];
  gpuMs: number[] = [];
  simMs: number[] = [];
  draws: number[] = [];
  hulls: number[] = [];
  tris: number[] = [];
  sprites: number[] = [];
  elapsed = 0;
  readonly warmup = 3;

  constructor(readonly input: BenchInput) {}

  get recording(): boolean {
    return this.elapsed >= this.warmup;
  }

  get done(): boolean {
    return this.elapsed >= this.warmup + this.input.seconds;
  }

  /** 0..1 through the measured period (negative during warm-up). */
  get progress(): number {
    return (this.elapsed - this.warmup) / this.input.seconds;
  }

  frame(frameMs: number, cpuMs: number, gpuMs: number, stats: { drawCalls: number; hulls: number; triangles: number; sprites: number }): void {
    this.elapsed += frameMs / 1000;
    if (!this.recording || this.done) return;
    this.frameMs.push(frameMs);
    this.cpuMs.push(cpuMs);
    if (gpuMs >= 0) this.gpuMs.push(gpuMs);
    this.draws.push(stats.drawCalls);
    this.hulls.push(stats.hulls);
    this.tris.push(stats.triangles);
    this.sprites.push(stats.sprites);
  }

  result(finalTick: number, finalHash: string): BenchResult {
    const i = this.input;
    const f = [...this.frameMs].sort((a, b) => a - b);
    const total = f.reduce((s, x) => s + x, 0);
    const fpsAvg = (f.length / total) * 1000;
    // "1 % low": mean frame rate over the slowest 1 % of frames.
    const slow = (share: number) => {
      const k = Math.max(1, Math.round(f.length * share));
      return 1000 / mean(f.slice(f.length - k));
    };
    const cpu = [...this.cpuMs].sort((a, b) => a - b);
    const gpu = [...this.gpuMs].sort((a, b) => a - b);
    const sim = [...this.simMs].sort((a, b) => a - b);
    const n1 = (x: number) => x.toFixed(1);
    const n2 = (x: number) => x.toFixed(2);
    const gpuLine = gpu.length
      ? `GPU passes: avg ${n2(mean(gpu))} ms  p99 ${n2(pct(gpu, 0.99))} ms (timestamp queries, ${gpu.length} samples)`
      : 'GPU passes: not available (browser did not grant timestamp queries)';
    const text = [
      '=== REAPER WAR: FLEET benchmark ===',
      `build: ${i.build}`,
      `GPU: ${[i.gpu.vendor, i.gpu.architecture, i.gpu.device, i.gpu.description].filter(Boolean).join(' / ') || 'unknown'}${i.gpu.software ? '  [SOFTWARE RENDERER]' : ''}`,
      `browser: ${navigator.userAgent.replace(/^.*?(Chrome\/[\d.]+|Edg\/[\d.]+|Firefox\/[\d.]+).*$/, '$1')} on ${navigator.platform}`,
      `resolution: ${i.width}x${i.height} rendered  (window ${i.cssWidth}x${i.cssHeight}, pixel ratio ${i.dpr})`,
      `settings: ${i.quality.name}  (MSAA ${i.quality.msaa}x, bloom ${i.quality.bloom ? 'on' : 'off'}, render scale ${i.quality.scale})`,
      `scenario: probe  ships: ${i.ships}  seed: ${i.seed}  measured: ${n1(total / 1000)} s after ${this.warmup} s warm-up  frames: ${f.length}`,
      `fps: avg ${n1(fpsAvg)}  1% low ${n1(slow(0.01))}  0.1% low ${n1(slow(0.001))}`,
      `frame time: avg ${n2(mean(f))} ms  median ${n2(pct(f, 0.5))} ms  p99 ${n2(pct(f, 0.99))} ms  max ${n2(f[f.length - 1] ?? 0)} ms`,
      `frame breakdown: main-thread CPU avg ${n2(mean(cpu))} ms  p99 ${n2(pct(cpu, 0.99))} ms`,
      `  ${gpuLine}`,
      `  note: frames are paced by the display; if avg fps equals your refresh rate, CPU + GPU time shows the headroom`,
      `drawn per frame: ${Math.round(mean(this.draws))} draw calls  ${Math.round(mean(this.hulls))} hulls  ${Math.round(mean(this.tris))} triangles  ${Math.round(mean(this.sprites))} sprites`,
      `simulation (worker thread): tick avg ${n2(mean(sim))} ms  p99 ${n2(pct(sim, 0.99))} ms  max ${n2(sim[sim.length - 1] ?? 0)} ms  at 20 Hz`,
      `final tick: ${finalTick}  state hash: ${finalHash}`,
      '=== end ===',
    ].join('\n');
    return { text, frames: f.length, fpsAvg, low1: slow(0.01), low01: slow(0.001), cpuAvg: mean(cpu), gpuAvg: gpu.length ? mean(gpu) : -1, simAvg: mean(sim), ships: i.ships, seed: i.seed };
  }
}
