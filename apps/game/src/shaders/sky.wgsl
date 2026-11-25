struct VOut { @builtin(position) clip: vec4f, @location(0) ndc: vec2f }

@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: VOut;
  o.clip = vec4f(p, 0.0, 1.0); // depth 0 = infinitely far in reversed depth
  o.ndc = p;
  return o;
}

// One layer of stars: the sky is cut into cells and a few of them hold a star.
fn starLayer(dir: vec3f, scale: f32, density: f32, brightness: f32) -> vec3f {
  let p = dir * scale;
  let px = (fwidth(p.x) + fwidth(p.y) + fwidth(p.z)) * 0.45; // about one pixel, in cell units
  let cell = floor(p);
  let h = hash31(cell);
  let centre = cell + vec3f(hash31(cell + 11.0), hash31(cell + 23.0), hash31(cell + 37.0)) * 0.5 + 0.25;
  let d = length(p - centre);
  let core = exp(-d * d / max(px * px, 1e-6));
  let mag = pow(hash31(cell + 5.0), 9.0) * 14.0 + 0.25;
  let tint = mix(vec3f(1.0, 0.78, 0.6), vec3f(0.68, 0.8, 1.0), hash31(cell + 71.0));
  return tint * core * mag * brightness * step(h, density);
}

fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3f(1, 0, 0)), u.x), mix(hash31(i + vec3f(0, 1, 0)), hash31(i + vec3f(1, 1, 0)), u.x), u.y),
    mix(mix(hash31(i + vec3f(0, 0, 1)), hash31(i + vec3f(1, 0, 1)), u.x), mix(hash31(i + vec3f(0, 1, 1)), hash31(i + vec3f(1, 1, 1)), u.x), u.y),
    u.z);
}

@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let dir = normalize(g.camFwd.xyz + g.rawRight.xyz * i.ndc.x * g.rawRight.w + g.rawUp.xyz * i.ndc.y * g.rawUp.w);
  var col = starLayer(dir, 34.0, 0.1, 1.0) + starLayer(dir, 85.0, 0.06, 0.55) + starLayer(dir, 210.0, 0.035, 0.3);
  // A soft galactic band.
  let band = exp(-pow(dot(dir, normalize(vec3f(0.25, 0.9, 0.35))) * 3.2, 2.0));
  let n = noise3(dir * 3.0) * 0.6 + noise3(dir * 9.0) * 0.3 + noise3(dir * 27.0) * 0.1;
  col += vec3f(0.035, 0.04, 0.06) * band * (0.4 + n) + vec3f(0.05, 0.03, 0.02) * band * band * n * n;
  // Sun disc and glare.
  let s = max(dot(dir, g.sunDir.xyz), 0.0);
  col += g.sunColor.rgb * (smoothstep(0.99996, 0.99999, s) * 40.0 + pow(s, 900.0) * 1.5 + pow(s, 40.0) * 0.05);
  return vec4f(col, 1.0);
}
