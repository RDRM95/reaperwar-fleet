/**
 * Pointer and keyboard input, bound to the canvas itself. Left button is
 * reserved for selection and orders; the camera uses right and middle.
 */
import type { OrbitRig } from './camera';

export class Input {
  private keys = new Set<string>();
  private drag: { button: number; x: number; y: number } | null = null;
  onKey: (key: string) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private rig: () => OrbitRig) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.focus();
      if (e.button === 1 || e.button === 2) {
        this.drag = { button: e.button, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      if (this.drag.button === 2) this.rig().rotate(dx, dy);
      else this.rig().slide(dx, dy);
    });
    const end = (e: PointerEvent) => {
      if (this.drag && e.button === this.drag.button) this.drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => (this.drag = null));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.rig().zoom(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.onKey(k);
      this.keys.add(k);
      if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Apply held keys for this frame. */
  update(dt: number): void {
    const rig = this.rig();
    const move = 520 * dt;
    const h = (this.keys.has('d') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('a') || this.keys.has('ArrowLeft') ? 1 : 0);
    const v = (this.keys.has('w') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('s') || this.keys.has('ArrowDown') ? 1 : 0);
    if (h || v) rig.slide(-h * move, v * move);
    const turn = (this.keys.has('e') ? 1 : 0) - (this.keys.has('q') ? 1 : 0);
    if (turn) rig.rotate(turn * 180 * dt, 0);
    const zoom = (this.keys.has('-') ? 1 : 0) - (this.keys.has('=') || this.keys.has('+') ? 1 : 0);
    if (zoom) rig.zoom(zoom * 900 * dt);
  }
}
