struct VOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) color: vec3f }

// One soft additive point per instance: engine flares, distant-ship glints, and later weapon effects.
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f) -> VOut {
  let corners = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let c = corners[vi];
  var clip = toClip(a.xyz);
  let px = max(a.w * g.viewport.z / max(clip.w, 1e-3), b.w);
  clip = vec4f(clip.xy + c * px / g.viewport.xy * clip.w, clip.z, clip.w);
  var o: VOut;
  o.clip = clip;
  o.uv = c;
  o.color = b.rgb;
  return o;
}

@fragment fn fs(i: VOut) -> @location(0) vec4f {
  let d2 = dot(i.uv, i.uv);
  let a = max(exp(-d2 * 5.0) - 0.0067, 0.0);
  return vec4f(i.color * a, 0.0);
}
