struct VOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f }

@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> params: vec4f; // texel x, texel y, mode, strength
@group(0) @binding(3) var bloomTex: texture_2d<f32>;

// Bloom downsample: 4 bilinear taps; the first step keeps only what is brighter than white.
@fragment fn down(i: VOut) -> @location(0) vec4f {
  let t = params.xy;
  var c = textureSample(src, samp, i.uv + t * vec2f(-1.0, -1.0)).rgb
        + textureSample(src, samp, i.uv + t * vec2f(1.0, -1.0)).rgb
        + textureSample(src, samp, i.uv + t * vec2f(-1.0, 1.0)).rgb
        + textureSample(src, samp, i.uv + t * vec2f(1.0, 1.0)).rgb;
  c *= 0.25;
  if (params.z > 0.5) {
    let l = max(c.r, max(c.g, c.b));
    c *= clamp((l - 1.3) / max(l, 1e-4), 0.0, 1.0);
    c = min(c, vec3f(64.0));
  }
  return vec4f(c, 1.0);
}

// Bloom upsample: 3x3 tent, added to the level above.
@fragment fn up(i: VOut) -> @location(0) vec4f {
  let t = params.xy;
  var c = textureSample(src, samp, i.uv).rgb * 4.0;
  c += (textureSample(src, samp, i.uv + t * vec2f(-1.0, 0.0)).rgb + textureSample(src, samp, i.uv + t * vec2f(1.0, 0.0)).rgb
      + textureSample(src, samp, i.uv + t * vec2f(0.0, -1.0)).rgb + textureSample(src, samp, i.uv + t * vec2f(0.0, 1.0)).rgb) * 2.0;
  c += textureSample(src, samp, i.uv + t * vec2f(-1.0, -1.0)).rgb + textureSample(src, samp, i.uv + t * vec2f(1.0, -1.0)).rgb
     + textureSample(src, samp, i.uv + t * vec2f(-1.0, 1.0)).rgb + textureSample(src, samp, i.uv + t * vec2f(1.0, 1.0)).rgb;
  return vec4f(c / 16.0 * params.w, 1.0);
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

// Final image: scene plus bloom, exposure, filmic curve, gamma, a little dither against banding.
@fragment fn composite(i: VOut) -> @location(0) vec4f {
  var c = textureSample(src, samp, i.uv).rgb;
  c += textureSample(bloomTex, samp, i.uv).rgb * params.w;
  c = aces(c * params.z);
  c = pow(c, vec3f(1.0 / 2.2));
  let n = fract(sin(dot(i.clip.xy, vec2f(12.9898, 78.233))) * 43758.5453);
  return vec4f(c + (n - 0.5) / 255.0, 1.0);
}
