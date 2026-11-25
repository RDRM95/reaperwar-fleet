/**
 * Hull viewer: draws one hull (optionally beside another for scale) from a
 * named direction through a long lens, on a plain background. Used to render
 * the reference sheets and to check hulls while building them.
 *   ?hull=alliance_cruiser&view=port|starboard|top|bottom|bow|stern|quarter[&beside=alliance_frigate][&detail=1]
 */
import { HULLS } from '@rw/hulls';
import { OrbitRig } from './camera';
import { QUALITY, Renderer, type QualityName } from './render/renderer';

const VIEWS: Record<string, [yaw: number, pitch: number]> = {
  // The camera sits on the named side. +X is the port side (X = up x forward).
  port: [Math.PI / 2, 0],
  starboard: [-Math.PI / 2, 0],
  top: [Math.PI / 2, 1.5607],
  bottom: [Math.PI / 2, -1.5607],
  bow: [0, 0],
  stern: [Math.PI, 0],
  quarter: [0.75, 0.42],
};

export async function runViewer(params: URLSearchParams): Promise<void> {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  document.getElementById('ui')!.remove();
  const id = params.get('hull')!;
  (window as unknown as { __hulls: string[] }).__hulls = HULLS.map((h) => h.id);
  const hullIndex = HULLS.findIndex((h) => h.id === id);
  const besideIndex = HULLS.findIndex((h) => h.id === params.get('beside'));
  const view = params.get('view') ?? 'quarter';
  const detail = params.get('detail') === '1' ? 1 : 0;
  const state = { ready: false, error: null as string | null, frames: 0, hull: id, lengthM: 0, triangles: 0 };
  (window as unknown as { __rw: typeof state }).__rw = state;
  if (hullIndex < 0) {
    state.error = `unknown hull ${id}`;
    return;
  }
  const q = (params.get('quality') as QualityName) ?? 'high';
  const renderer = await Renderer.create(canvas, QUALITY[q] ?? QUALITY.high);
  renderer.plainBackground = true;
  renderer.setHulls(HULLS);
  renderer.device.addEventListener('uncapturederror', (e) => (state.error = (e as GPUUncapturedErrorEvent).error.message));
  const hull = HULLS[hullIndex];
  const mesh = hull.build(0);
  state.lengthM = mesh.max[2] - mesh.min[2];
  state.triangles = hull.build(detail).triangleCount;
  const beside = besideIndex >= 0 ? HULLS[besideIndex] : null;
  const besideMesh = beside?.build(0);

  // Place the hull at the origin; a comparison hull sits to starboard, bows level.
  const half = [Math.max(Math.abs(mesh.min[0]), mesh.max[0]), Math.max(Math.abs(mesh.min[1]), mesh.max[1]), Math.max(Math.abs(mesh.min[2]), mesh.max[2])];
  let centreX = 0;
  let extent = Math.hypot(half[0], half[1], half[2]);
  let besideX = 0;
  if (besideMesh) {
    besideX = mesh.max[0] + (besideMesh.max[0] - besideMesh.min[0]) * 0.75 + hull.lengthM * 0.04;
    centreX = besideX / 2;
    extent = Math.max(extent, Math.hypot(besideX / 2 + besideMesh.max[0], besideMesh.max[2])) + besideX * 0.25;
  }
  const rig = new OrbitRig();
  rig.fovY = (5 * Math.PI) / 180;
  const [yaw, pitch] = VIEWS[view] ?? VIEWS.quarter;
  rig.targetYaw = yaw;
  rig.targetPitch = pitch;
  // Fit the view: use the hull's size as seen from this direction.
  rig.snap();
  rig.update(0);
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const span = (ax: Float32Array) => Math.abs(ax[0]) * (half[0] + (besideMesh ? besideX / 2 + besideMesh.max[0] : 0)) + Math.abs(ax[1]) * half[1] + Math.abs(ax[2]) * Math.max(half[2], besideMesh ? besideMesh.max[2] : 0);
  const needH = Math.max(span(rig.up), span(rig.right) / aspect) * 1.12;
  rig.targetDist = needH / Math.tan(rig.fovY / 2);
  rig.maxDist = 1e9;
  rig.anchor[0] = centreX;
  rig.snap();
  void extent;

  const hullOf = new Uint16Array(2), lodOf = new Uint8Array(2);
  const sorted = new Float32Array(32);
  const put = (slot: number, x: number, index: number) => {
    const o = slot * 16;
    renderer.instances.set([x - rig.pos[0], -rig.pos[1], -rig.pos[2], 1, 0, 0, 1, 0.6, 0, 1, 0, 0.37, 1, 1, 1, 0], o);
    hullOf[slot] = index;
    lodOf[slot] = detail;
  };
  const frame = () => {
    renderer.resize();
    rig.update(0);
    put(0, 0, hullIndex);
    if (beside) put(1, besideX, besideIndex);
    // Key light from over the camera's left shoulder so every view is readable.
    const s = [0, 1, 2].map((i) => -rig.fwd[i] * 0.55 - rig.right[i] * 0.45 + rig.up[i] * 0.7);
    const l = Math.hypot(s[0], s[1], s[2]);
    renderer.frame(rig, [s[0] / l, s[1] / l, s[2] / l], 0, beside ? 2 : 1, hullOf, lodOf, sorted, 0);
    state.frames++;
    if (state.frames > 2) state.ready = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
