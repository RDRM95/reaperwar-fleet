/**
 * Camera rig. Every camera is an anchor (a point that travels with whatever
 * is being framed, taken fresh from the interpolated simulation each frame)
 * plus an offset. Only the offset is eased, never the camera's own world
 * position, so the view stays steady at any frame rate.
 */
export class OrbitRig {
  /** World position of what is framed, metres. Set by the caller every frame. */
  anchor = new Float64Array(3);
  yaw = 0.6;
  pitch = 0.35;
  dist = 40000;
  /** Sideways offset from the anchor in the anchor's own neighbourhood, metres. */
  pan = new Float64Array(3);
  targetYaw = this.yaw;
  targetPitch = this.pitch;
  targetDist = this.dist;
  targetPan = new Float64Array(3);
  fovY = (38 * Math.PI) / 180;
  minDist = 60;
  maxDist = 2.5e6;

  readonly right = new Float32Array(3);
  readonly up = new Float32Array(3);
  readonly fwd = new Float32Array(3);
  /** Camera position in the world, metres. */
  readonly pos = new Float64Array(3);

  rotate(dx: number, dy: number): void {
    this.targetYaw -= dx * 0.005;
    this.targetPitch = Math.max(-1.5, Math.min(1.5, this.targetPitch + dy * 0.005));
  }

  zoom(delta: number): void {
    this.targetDist = Math.max(this.minDist, Math.min(this.maxDist, this.targetDist * Math.exp(delta * 0.0012)));
  }

  /** Slide the framed point across the screen plane. */
  slide(dx: number, dy: number): void {
    const k = this.dist * 0.0012;
    for (let i = 0; i < 3; i++) this.targetPan[i] += (-this.right[i] * dx + this.up[i] * dy) * k;
  }

  /** Jump the offset to its target (used on cuts). */
  snap(): void {
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.dist = this.targetDist;
    this.pan.set(this.targetPan);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 9);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.dist *= Math.exp(Math.log(this.targetDist / this.dist) * k);
    for (let i = 0; i < 3; i++) this.pan[i] += (this.targetPan[i] - this.pan[i]) * k;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // Forward points from the camera to the anchor.
    this.fwd[0] = -sy * cp; this.fwd[1] = -sp; this.fwd[2] = -cy * cp;
    this.right[0] = cy; this.right[1] = 0; this.right[2] = -sy;
    this.up[0] = -sy * sp; this.up[1] = cp; this.up[2] = -cy * sp;
    for (let i = 0; i < 3; i++) this.pos[i] = this.anchor[i] + this.pan[i] - this.fwd[i] * this.dist;
  }
}
