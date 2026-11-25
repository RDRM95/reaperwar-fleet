struct Globals {
  camRight: vec4f, // xyz scaled by focal/aspect
  camUp: vec4f,    // xyz scaled by focal
  camFwd: vec4f,   // xyz, w = near plane
  rawRight: vec4f, // xyz unit, w = aspect/focal
  rawUp: vec4f,    // xyz unit, w = 1/focal
  sunDir: vec4f,   // xyz towards the sun, w = time in seconds
  sunColor: vec4f, // rgb, w = bloom strength
  viewport: vec4f, // width, height, pixels per radian, exposure
}
@group(0) @binding(0) var<uniform> g: Globals;

// Camera-relative position to clip space. Reversed depth with no far plane:
// depth = near / distance, so precision is spread evenly from 1 m to infinity.
fn toClip(p: vec3f) -> vec4f {
  return vec4f(dot(p, g.camRight.xyz), dot(p, g.camUp.xyz), g.camFwd.w, dot(p, g.camFwd.xyz));
}

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn hash31(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
