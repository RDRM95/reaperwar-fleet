/** The on-screen interface for M0: a status readout, a small menu and the benchmark report. */
import type { QualityName } from './render/renderer';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, children: (Node | string)[] = []) => {
  const e = document.createElement(tag);
  const { class: cls, ...rest } = props;
  Object.assign(e, rest);
  if (cls) e.className = cls;
  for (const c of children) e.append(c);
  return e;
};

export interface UiCallbacks {
  onShips(n: number): void;
  onSeed(n: number): void;
  onQuality(q: QualityName): void;
  onBenchmark(ships: number): void;
}

export class Ui {
  readonly root = document.getElementById('ui')!;
  private rows = new Map<string, HTMLElement>();
  private reportBox: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private shipsSel!: HTMLSelectElement;
  private qualitySel!: HTMLSelectElement;
  private seedInput!: HTMLInputElement;

  constructor(private cb: UiCallbacks) {
    const hud = el('div', { id: 'hud', class: 'panel' }, [el('h1', { textContent: 'REAPER WAR: FLEET' })]);
    for (const key of ['milestone', 'seed', 'ships', 'fps', 'frame', 'sim tick', 'tick', 'hash', 'gpu']) {
      const b = el('b');
      this.rows.set(key, b);
      hud.append(el('div', { class: 'row' }, [key, b]));
    }
    this.set('milestone', 'M0 scale probe');

    this.shipsSel = el('select', { id: 'ships-select' });
    for (const n of [200, 1000, 2000, 5000, 10000]) this.shipsSel.append(el('option', { value: String(n), textContent: n.toLocaleString('en') }));
    this.shipsSel.onchange = () => cb.onShips(Number(this.shipsSel.value));
    this.qualitySel = el('select', { id: 'quality-select' });
    for (const q of ['low', 'medium', 'high', 'ultra']) this.qualitySel.append(el('option', { value: q, textContent: q[0].toUpperCase() + q.slice(1) }));
    this.qualitySel.onchange = () => cb.onQuality(this.qualitySel.value as QualityName);
    this.seedInput = el('input', { id: 'seed-input', type: 'number', min: '0' });
    this.seedInput.onchange = () => cb.onSeed(Number(this.seedInput.value) >>> 0);
    const menu = el('div', { id: 'menu', class: 'panel' }, [
      el('h2', { textContent: 'SCENE' }),
      el('label', {}, ['Ships', this.shipsSel]),
      el('label', {}, ['Seed', this.seedInput]),
      el('label', {}, ['Quality', this.qualitySel]),
      el('h2', { textContent: 'BENCHMARK (20 s)', class: 'gap' }),
      ...[1000, 2000, 5000].map((n) => el('button', { id: `bench-${n}`, textContent: `Run with ${n.toLocaleString('en')} ships`, onclick: () => cb.onBenchmark(n) })),
    ]);
    const hint = el('div', { id: 'hint', textContent: 'Right-drag: rotate   Wheel: zoom   Middle-drag or W A S D: move   Space: pause   H: hide interface' });
    this.root.append(hud, menu, hint);
  }

  set(key: string, value: string): void {
    const r = this.rows.get(key);
    if (r && r.textContent !== value) r.textContent = value;
  }

  sync(ships: number, seed: number, quality: QualityName): void {
    if (![...this.shipsSel.options].some((o) => o.value === String(ships))) this.shipsSel.append(el('option', { value: String(ships), textContent: ships.toLocaleString('en') }));
    this.shipsSel.value = String(ships);
    this.seedInput.value = String(seed);
    this.qualitySel.value = quality;
  }

  toggleHidden(): void {
    this.root.classList.toggle('hidden');
  }

  showProgress(text: string | null): void {
    if (text === null) {
      this.progress?.remove();
      this.progress = null;
      return;
    }
    if (!this.progress) {
      this.progress = el('div', { id: 'progress', class: 'panel always' });
      this.root.append(this.progress);
    }
    this.progress.textContent = text;
  }

  showReport(text: string): void {
    this.reportBox?.remove();
    const pre = el('pre', { id: 'report-text', textContent: text });
    const copy = el('button', {
      textContent: 'Copy to clipboard',
      onclick: () => {
        navigator.clipboard?.writeText(text).then(() => (copy.textContent = 'Copied'), () => (copy.textContent = 'Select the text and copy'));
      },
    });
    const close = el('button', { textContent: 'Close', onclick: () => this.reportBox?.remove() });
    this.reportBox = el('div', { id: 'report', class: 'panel always' }, [pre, el('div', { class: 'buttons' }, [copy, close])]);
    this.root.append(this.reportBox);
  }

  fatal(message: string): void {
    this.root.append(el('div', { id: 'fatal' }, [el('div', { class: 'panel', textContent: message })]));
  }
}
