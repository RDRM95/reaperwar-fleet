struct VIn {
  @location(0) pos: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) kind: vec4u,
  @location(4) iPos: vec4f,  // xyz relative to camera, w = scale
  @location(5) iFwd: vec4f,  // xyz, w = engine throttle 0..1
  @location(6) iUp: vec4f,   // xyz, w = seed for per-ship variation
  @location(7) iTint: vec4f, // rgb hull tint, a unused
}
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) normal: vec3f,
  @location(1) local: vec3f,
  @location(2) localNormal: vec3f,
  @location(3) color: vec4f,
  @location(4) @interpolate(flat) kind: u32,
  @location(5) rel: vec3f,
  @location(6) @interpolate(flat) misc: vec4f, // throttle, seed, 0, 0
  @location(7) @interpolate(flat) tint: vec3f,
}

@vertex fn vs(v: VIn) -> VOut {
  let right = cross(v.iUp.xyz, v.iFwd.xyz);
  let s = v.iPos.w;
  let rel = v.iPos.xyz + (right * v.pos.x + v.iUp.xyz * v.pos.y + v.iFwd.xyz * v.pos.z) * s;
  var o: VOut;
  o.clip = toClip(rel);
  o.normal = right * v.normal.x + v.iUp.xyz * v.normal.y + v.iFwd.xyz * v.normal.z;
  o.local = v.pos;
  o.localNormal = v.normal;
  o.color = v.color;
  o.kind = v.kind.x;
  o.rel = rel;
  o.misc = vec4f(v.iFwd.w, v.iUp.w, 0.0, 0.0);
  o.tint = v.iTint.rgb;
  return o;
}

// Armour plating drawn from hull-local position: plates of two sizes with
// slightly varied paint and dark seams. Fades out before it can shimmer.
fn plating(local: vec3f, n: vec3f, seed: f32) -> vec2f {
  let a = abs(n);
  var uv: vec2f;
  if (a.x >= a.y && a.x >= a.z) { uv = local.zy; } else if (a.y >= a.z) { uv = local.xz; } else { uv = local.xy; }
  var shade = 1.0;
  var seam = 0.0;
  let sizes = array<vec2f, 2>(vec2f(22.0, 9.0), vec2f(5.5, 3.0));
  for (var i = 0; i < 2; i++) {
    let p = uv / sizes[i] + seed * 7.0;
    let w = fwidth(p);
    let fade = clamp(1.0 - max(w.x, w.y) * 1.5, 0.0, 1.0);
    let cell = floor(p);
    let f = fract(p);
    let h = hash21(cell + f32(i) * 17.0);
    shade *= 1.0 + (h - 0.5) * (0.22 - f32(i) * 0.1) * fade;
    let e = min(min(f.x, 1.0 - f.x) / max(w.x, 1e-5), min(f.y, 1.0 - f.y) / max(w.y, 1e-5));
    seam = max(seam, (1.0 - clamp(e * 0.7, 0.0, 1.0)) * fade * (0.55 - f32(i) * 0.2));
  }
  return vec2f(shade, seam);
}

@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let n = normalize(i.normal);
  let view = normalize(-i.rel);
  let sun = g.sunDir.xyz;
  var albedo = i.color.rgb * i.tint;
  var rough = 0.55;
  let pl = plating(i.local, i.localNormal, i.misc.y); // derivatives must be taken outside any branch
  if (i.kind < 2u) {
    albedo *= pl.x * (1.0 - pl.y);
    rough = select(0.5, 0.35, i.kind == 1u);
  }
  let ndl = max(dot(n, sun), 0.0);
  let h = normalize(sun + view);
  let spec = pow(max(dot(n, h), 0.0), mix(90.0, 12.0, rough)) * (1.0 - rough) * 1.4 * ndl;
  // Fill: faint sky light from above, planet-shine from below, and a rim so dark sides keep a shape.
  let fill = mix(vec3f(0.035, 0.05, 0.085), vec3f(0.03, 0.035, 0.05), n.y * 0.5 + 0.5);
  let rim = pow(1.0 - max(dot(n, view), 0.0), 3.0) * 0.06;
  var col = albedo * (g.sunColor.rgb * ndl + fill + rim) + g.sunColor.rgb * spec;
  // Self-lit parts: windows steady, engines by throttle.
  let glow = i.color.a;
  if (glow > 0.0) {
    let engine = step(0.9, glow);
    let power = mix(2.2, 3.0 + 22.0 * i.misc.x, engine);
    col += i.color.rgb * glow * power;
  }
  return vec4f(col, 1.0);
}
