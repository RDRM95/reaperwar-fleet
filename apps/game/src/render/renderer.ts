/**
 * WebGPU renderer. It knows nothing about the simulation: each frame it is
 * given ship transforms (already interpolated, relative to the camera) and
 * draws them as instanced hulls with far-range glints, a sky, bloom and a
 * filmic tone curve.
 */
import type { HullDef, MeshData } from '@rw/hulls';
import common from '../shaders/common.wgsl?raw';
import meshSrc from '../shaders/mesh.wgsl?raw';
import skySrc from '../shaders/sky.wgsl?raw';
import spriteSrc from '../shaders/sprite.wgsl?raw';
import postSrc from '../shaders/post.wgsl?raw';

export type QualityName = 'low' | 'medium' | 'high' | 'ultra';

export interface Quality {
  name: QualityName;
  /** Rendered pixels per device pixel. */
  scale: number;
  msaa: 1 | 4;
  bloom: boolean;
  /** Hulls smaller than this many pixels are drawn as a glint only. */
  minHullPx: number;
  /** Hulls larger than this many pixels use the full-detail mesh. */
  fullDetailPx: number;
}

export const QUALITY: Record<QualityName, Quality> = {
  low: { name: 'low', scale: 0.5, msaa: 1, bloom: false, minHullPx: 5, fullDetailPx: 140 },
  medium: { name: 'medium', scale: 0.75, msaa: 1, bloom: true, minHullPx: 4, fullDetailPx: 100 },
  high: { name: 'high', scale: 1, msaa: 4, bloom: true, minHullPx: 3, fullDetailPx: 70 },
  ultra: { name: 'ultra', scale: 1, msaa: 4, bloom: true, minHullPx: 2, fullDetailPx: 40 },
};

export interface Camera {
  /** Unit axes of the camera in world space. */
  right: Float32Array;
  up: Float32Array;
  fwd: Float32Array;
  /** Vertical field of view, radians. */
  fovY: number;
}

export interface GpuInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  software: boolean;
  timestamps: boolean;
}

interface HullGpu {
  def: HullDef;
  lods: { vertex: GPUBuffer; index: GPUBuffer; indexCount: number; triangles: number }[];
}

const INSTANCE_FLOATS = 16;
const SPRITE_FLOATS = 8;
const HDR: GPUTextureFormat = 'rgba16float';
const BLOOM_LEVELS = 5;

function interleave(m: MeshData): ArrayBuffer {
  const count = m.positions.length / 3;
  const buf = new ArrayBuffer(count * 32);
  const f = new Float32Array(buf);
  const u = new Uint8Array(buf);
  for (let i = 0; i < count; i++) {
    f.set(m.positions.subarray(i * 3, i * 3 + 3), i * 8);
    f.set(m.normals.subarray(i * 3, i * 3 + 3), i * 8 + 3);
    u.set(m.colors.subarray(i * 4, i * 4 + 4), i * 32 + 24);
    u.set(m.kinds.subarray(i * 4, i * 4 + 4), i * 32 + 28);
  }
  return buf;
}

export class Renderer {
  readonly device: GPUDevice;
  readonly info: GpuInfo;
  quality: Quality;
  width = 1;
  height = 1;
  /** Counters for the last frame. */
  stats = { drawCalls: 0, hulls: 0, glints: 0, sprites: 0, triangles: 0, gpuMs: -1 };
  /** Draw a flat studio background instead of the sky (hull viewer and reference sheets). */
  plainBackground = false;

  private ctx: GPUCanvasContext;
  private canvasFormat: GPUTextureFormat;
  private hulls: HullGpu[] = [];
  private globals: GPUBuffer;
  private globalsData = new Float32Array(32);
  private globalsBind!: GPUBindGroup;
  private globalsLayout: GPUBindGroupLayout;
  private meshPipe!: GPURenderPipeline;
  private skyPipe!: GPURenderPipeline;
  private spritePipe!: GPURenderPipeline;
  private downPipe: GPURenderPipeline;
  private upPipe: GPURenderPipeline;
  private compositePipe: GPURenderPipeline;
  private sampler: GPUSampler;
  private instanceBuf!: GPUBuffer;
  instances!: Float32Array;
  private spriteBuf!: GPUBuffer;
  sprites!: Float32Array;
  private capacity = 0;
  private spriteCapacity = 0;

  private sceneMs: GPUTexture | null = null;
  private scene!: GPUTexture;
  private depth!: GPUTexture;
  private bloom: GPUTexture[] = [];
  private postParams: GPUBuffer[] = [];
  private postBinds: { down: GPUBindGroup[]; up: GPUBindGroup[]; composite: GPUBindGroup } | null = null;
  private black!: GPUTexture;

  private querySet: GPUQuerySet | null = null;
  private queryResolve: GPUBuffer | null = null;
  private queryRead: GPUBuffer | null = null;
  private queryBusy = false;

  // Scratch for sorting instances into (hull, level of detail) runs.
  private bucketCount = new Int32Array(0);
  private bucketStart = new Int32Array(0);

  static async create(canvas: HTMLCanvasElement, quality: Quality): Promise<Renderer> {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser. Use a current Chrome or Edge.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter was found.');
    const timestamps = adapter.features.has('timestamp-query');
    const device = await adapter.requestDevice({ requiredFeatures: timestamps ? ['timestamp-query'] : [] });
    const ai = adapter.info;
    const info: GpuInfo = {
      vendor: ai?.vendor ?? '',
      architecture: ai?.architecture ?? '',
      device: ai?.device ?? '',
      description: ai?.description ?? '',
      software: /swiftshader|llvmpipe|software/i.test(`${ai?.architecture} ${ai?.description} ${ai?.device}`) || (ai as unknown as { isFallbackAdapter?: boolean })?.isFallbackAdapter === true,
      timestamps,
    };
    return new Renderer(canvas, device, info, quality);
  }

  private constructor(private canvas: HTMLCanvasElement, device: GPUDevice, info: GpuInfo, quality: Quality) {
    this.device = device;
    this.info = info;
    this.quality = quality;
    this.ctx = canvas.getContext('webgpu')!;
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device, format: this.canvasFormat, alphaMode: 'opaque' });

    this.globals = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.globalsLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
    });
    this.globalsBind = device.createBindGroup({ layout: this.globalsLayout, entries: [{ binding: 0, resource: { buffer: this.globals } }] });
    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

    const post = device.createShaderModule({ code: postSrc, label: 'post' });
    const postPipe = (entry: string, format: GPUTextureFormat, additive: boolean) =>
      device.createRenderPipeline({
        label: entry,
        layout: 'auto',
        vertex: { module: post, entryPoint: 'vs' },
        fragment: {
          module: post,
          entryPoint: entry,
          targets: [{ format, blend: additive ? { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } : undefined }],
        },
      });
    this.downPipe = postPipe('down', HDR, false);
    this.upPipe = postPipe('up', HDR, true);
    this.compositePipe = postPipe('composite', this.canvasFormat, false);
    for (let i = 0; i < BLOOM_LEVELS * 2 + 1; i++) {
      this.postParams.push(device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
    }
    this.black = device.createTexture({ size: [1, 1], format: HDR, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });

    if (info.timestamps) {
      this.querySet = device.createQuerySet({ type: 'timestamp', count: 4 });
      this.queryResolve = device.createBuffer({ size: 32, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      this.queryRead = device.createBuffer({ size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    }
    this.buildScenePipelines();
    this.ensureCapacity(1024, 4096);
  }

  setQuality(q: Quality): void {
    const msaaChanged = q.msaa !== this.quality.msaa;
    this.quality = q;
    if (msaaChanged) this.buildScenePipelines();
    this.width = 0; // force target rebuild on next resize
  }

  private buildScenePipelines(): void {
    const d = this.device;
    const layout = d.createPipelineLayout({ bindGroupLayouts: [this.globalsLayout] });
    const multisample: GPUMultisampleState = { count: this.quality.msaa };
    const mesh = d.createShaderModule({ code: common + meshSrc, label: 'mesh' });
    this.meshPipe = d.createRenderPipeline({
      label: 'mesh',
      layout,
      vertex: {
        module: mesh,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'unorm8x4' },
              { shaderLocation: 3, offset: 28, format: 'uint8x4' },
            ],
          },
          {
            arrayStride: INSTANCE_FLOATS * 4,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 4, offset: 0, format: 'float32x4' },
              { shaderLocation: 5, offset: 16, format: 'float32x4' },
              { shaderLocation: 6, offset: 32, format: 'float32x4' },
              { shaderLocation: 7, offset: 48, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: { module: mesh, entryPoint: 'fs', targets: [{ format: HDR }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
      multisample,
    });
    const sky = d.createShaderModule({ code: common + skySrc, label: 'sky' });
    this.skyPipe = d.createRenderPipeline({
      label: 'sky',
      layout,
      vertex: { module: sky, entryPoint: 'vs' },
      fragment: { module: sky, entryPoint: 'fs', targets: [{ format: HDR }] },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' },
      multisample,
    });
    const sprite = d.createShaderModule({ code: common + spriteSrc, label: 'sprite' });
    this.spritePipe = d.createRenderPipeline({
      label: 'sprite',
      layout,
      vertex: {
        module: sprite,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: SPRITE_FLOATS * 4,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x4' },
              { shaderLocation: 1, offset: 16, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: sprite,
        entryPoint: 'fs',
        targets: [{ format: HDR, blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }],
      },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample,
    });
  }

  /** Upload hull meshes. The index of a hull in `defs` is the class id used in instances. */
  setHulls(defs: HullDef[]): void {
    const d = this.device;
    this.hulls = defs.map((def) => ({
      def,
      lods: ([0, 1] as const).map((detail) => {
        const m = def.build(detail);
        const data = interleave(m);
        const vertex = d.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        d.queue.writeBuffer(vertex, 0, data);
        const index = d.createBuffer({ size: m.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
        d.queue.writeBuffer(index, 0, m.indices.buffer as ArrayBuffer, m.indices.byteOffset, m.indices.byteLength);
        return { vertex, index, indexCount: m.indices.length, triangles: m.triangleCount };
      }),
    }));
    this.bucketCount = new Int32Array(this.hulls.length * 2);
    this.bucketStart = new Int32Array(this.hulls.length * 2 + 1);
  }

  ensureCapacity(ships: number, sprites: number): void {
    if (ships > this.capacity) {
      this.capacity = ships;
      this.instanceBuf?.destroy();
      this.instanceBuf = this.device.createBuffer({ size: ships * INSTANCE_FLOATS * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      this.instances = new Float32Array(ships * INSTANCE_FLOATS);
    }
    if (sprites > this.spriteCapacity) {
      this.spriteCapacity = sprites;
      this.spriteBuf?.destroy();
      this.spriteBuf = this.device.createBuffer({ size: sprites * SPRITE_FLOATS * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      this.sprites = new Float32Array(sprites * SPRITE_FLOATS);
    }
  }

  /** Match the drawing buffer to the canvas (or to a forced size for benchmarks). */
  resize(forced?: { w: number; h: number }): void {
    const dpr = window.devicePixelRatio || 1;
    const max = this.device.limits.maxTextureDimension2D;
    const w = Math.max(1, Math.min(max, Math.round(forced?.w ?? this.canvas.clientWidth * dpr * this.quality.scale)));
    const h = Math.max(1, Math.min(max, Math.round(forced?.h ?? this.canvas.clientHeight * dpr * this.quality.scale)));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    const d = this.device;
    this.sceneMs?.destroy();
    this.scene?.destroy();
    this.depth?.destroy();
    for (const t of this.bloom) t.destroy();
    const msaa = this.quality.msaa;
    this.sceneMs = msaa > 1 ? d.createTexture({ size: [w, h], format: HDR, sampleCount: msaa, usage: GPUTextureUsage.RENDER_ATTACHMENT }) : null;
    this.scene = d.createTexture({ size: [w, h], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.depth = d.createTexture({ size: [w, h], format: 'depth32float', sampleCount: msaa, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.bloom = [];
    let bw = w, bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      this.bloom.push(d.createTexture({ size: [bw, bh], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
    }
    // Bind groups for the post chain.
    const bind = (pipe: GPURenderPipeline, src: GPUTexture, params: GPUBuffer, extra?: GPUTexture) =>
      d.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: src.createView() },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: params } },
          ...(extra ? [{ binding: 3, resource: extra.createView() }] : []),
        ],
      });
    const down: GPUBindGroup[] = [];
    const up: GPUBindGroup[] = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const src = i === 0 ? this.scene : this.bloom[i - 1];
      d.queue.writeBuffer(this.postParams[i], 0, new Float32Array([1 / src.width, 1 / src.height, i === 0 ? 1 : 0, 1]));
      down.push(bind(this.downPipe, src, this.postParams[i]));
    }
    for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
      const src = this.bloom[i];
      d.queue.writeBuffer(this.postParams[BLOOM_LEVELS + i], 0, new Float32Array([1 / src.width, 1 / src.height, 0, 1]));
      up[i] = bind(this.upPipe, src, this.postParams[BLOOM_LEVELS + i]);
    }
    this.postBinds = {
      down,
      up,
      composite: bind(this.compositePipe, this.scene, this.postParams[BLOOM_LEVELS * 2], this.quality.bloom ? this.bloom[0] : this.black),
    };
  }

  get hullCount(): number {
    return this.hulls.length;
  }

  /**
   * Draw one frame.
   * `shipCount` instances are already in `this.instances` (unsorted), with the
   * hull id and level of detail for each in `hullOf` / `lodOf` (lod 2 = glint only).
   * `spriteCount` sprites are already in `this.sprites`.
   */
  frame(cam: Camera, sunDir: [number, number, number], time: number, shipCount: number, hullOf: Uint16Array, lodOf: Uint8Array, sorted: Float32Array, spriteCount: number): void {
    const d = this.device;
    const q = this.quality;
    const focal = 1 / Math.tan(cam.fovY / 2);
    const aspect = this.width / this.height;
    const g = this.globalsData;
    g.set([cam.right[0] * (focal / aspect), cam.right[1] * (focal / aspect), cam.right[2] * (focal / aspect), 0], 0);
    g.set([cam.up[0] * focal, cam.up[1] * focal, cam.up[2] * focal, 0], 4);
    g.set([cam.fwd[0], cam.fwd[1], cam.fwd[2], 0.5], 8);
    g.set([cam.right[0], cam.right[1], cam.right[2], aspect / focal], 12);
    g.set([cam.up[0], cam.up[1], cam.up[2], 1 / focal], 16);
    g.set([sunDir[0], sunDir[1], sunDir[2], time], 20);
    g.set([1.45, 1.4, 1.32, 0.9], 24);
    g.set([this.width, this.height, (this.height * focal) / 2, 1.0], 28);
    d.queue.writeBuffer(this.globals, 0, g);
    d.queue.writeBuffer(this.postParams[BLOOM_LEVELS * 2], 0, new Float32Array([0, 0, 1.0, q.bloom ? 0.55 : 0]));

    // Sort instances into runs by (hull, level of detail) so each run is one draw call.
    const nb = this.hulls.length * 2;
    const count = this.bucketCount, start = this.bucketStart;
    count.fill(0);
    for (let i = 0; i < shipCount; i++) if (lodOf[i] < 2) count[hullOf[i] * 2 + lodOf[i]]++;
    start[0] = 0;
    for (let b = 0; b < nb; b++) start[b + 1] = start[b] + count[b];
    count.fill(0);
    const src = this.instances;
    for (let i = 0; i < shipCount; i++) {
      if (lodOf[i] >= 2) continue;
      const b = hullOf[i] * 2 + lodOf[i];
      const dst = (start[b] + count[b]++) * INSTANCE_FLOATS;
      const s = i * INSTANCE_FLOATS;
      for (let k = 0; k < INSTANCE_FLOATS; k++) sorted[dst + k] = src[s + k];
    }
    const drawn = start[nb];
    if (drawn > 0) d.queue.writeBuffer(this.instanceBuf, 0, sorted.buffer, sorted.byteOffset, drawn * INSTANCE_FLOATS * 4);
    if (spriteCount > 0) d.queue.writeBuffer(this.spriteBuf, 0, this.sprites.buffer, 0, spriteCount * SPRITE_FLOATS * 4);

    const enc = d.createCommandEncoder();
    const useQuery = this.querySet && !this.queryBusy;
    const scenePass = enc.beginRenderPass({
      colorAttachments: [
        this.sceneMs
          ? { view: this.sceneMs.createView(), resolveTarget: this.scene.createView(), loadOp: 'clear', storeOp: 'discard', clearValue: this.plainBackground ? [0.035, 0.045, 0.06, 1] : [0, 0, 0, 1] }
          : { view: this.scene.createView(), loadOp: 'clear', storeOp: 'store', clearValue: this.plainBackground ? [0.035, 0.045, 0.06, 1] : [0, 0, 0, 1] },
      ],
      depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      timestampWrites: useQuery ? { querySet: this.querySet!, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } : undefined,
    });
    let draws = 0, tris = 0;
    scenePass.setBindGroup(0, this.globalsBind);
    if (!this.plainBackground) {
      scenePass.setPipeline(this.skyPipe);
      scenePass.draw(3);
      draws++;
    }
    if (drawn > 0) {
      scenePass.setPipeline(this.meshPipe);
      scenePass.setVertexBuffer(1, this.instanceBuf);
      for (let b = 0; b < nb; b++) {
        const n = start[b + 1] - start[b];
        if (n === 0) continue;
        const lod = this.hulls[b >> 1].lods[b & 1];
        scenePass.setVertexBuffer(0, lod.vertex);
        scenePass.setIndexBuffer(lod.index, 'uint32');
        scenePass.drawIndexed(lod.indexCount, n, 0, 0, start[b]);
        draws++;
        tris += lod.triangles * n;
      }
    }
    if (spriteCount > 0) {
      scenePass.setPipeline(this.spritePipe);
      scenePass.setVertexBuffer(0, this.spriteBuf);
      scenePass.draw(6, spriteCount);
      draws++;
    }
    scenePass.end();

    const binds = this.postBinds!;
    if (q.bloom) {
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        const p = enc.beginRenderPass({ colorAttachments: [{ view: this.bloom[i].createView(), loadOp: 'clear', storeOp: 'store' }] });
        p.setPipeline(this.downPipe);
        p.setBindGroup(0, binds.down[i]);
        p.draw(3);
        p.end();
        draws++;
      }
      for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
        const p = enc.beginRenderPass({ colorAttachments: [{ view: this.bloom[i - 1].createView(), loadOp: 'load', storeOp: 'store' }] });
        p.setPipeline(this.upPipe);
        p.setBindGroup(0, binds.up[i]);
        p.draw(3);
        p.end();
        draws++;
      }
    }
    const out = enc.beginRenderPass({
      colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }],
      timestampWrites: useQuery ? { querySet: this.querySet!, beginningOfPassWriteIndex: 2, endOfPassWriteIndex: 3 } : undefined,
    });
    out.setPipeline(this.compositePipe);
    out.setBindGroup(0, binds.composite);
    out.draw(3);
    out.end();
    draws++;

    if (useQuery) {
      enc.resolveQuerySet(this.querySet!, 0, 4, this.queryResolve!, 0);
      enc.copyBufferToBuffer(this.queryResolve!, 0, this.queryRead!, 0, 32);
    }
    d.queue.submit([enc.finish()]);
    if (useQuery) {
      this.queryBusy = true;
      const buf = this.queryRead!;
      buf.mapAsync(GPUMapMode.READ).then(
        () => {
          const t = new BigInt64Array(buf.getMappedRange());
          const ns = Number(t[3] - t[0]);
          if (ns > 0) this.stats.gpuMs = ns / 1e6;
          buf.unmap();
          this.queryBusy = false;
        },
        () => {
          this.queryBusy = false;
        },
      );
    }
    this.stats.drawCalls = draws;
    this.stats.hulls = drawn;
    this.stats.sprites = spriteCount;
    this.stats.triangles = tris;
  }
}
