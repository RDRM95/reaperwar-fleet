/**
 * Deterministic maths for the simulation.
 *
 * JavaScript guarantees exact IEEE-754 results for + - * / and Math.sqrt, but
 * not for Math.sin, Math.cos, Math.atan2, Math.pow, Math.exp or Math.hypot:
 * those may differ between browsers and CPUs. Simulation code therefore uses
 * only the functions in this file, which are built from the exact operations.
 * The lint rules forbid the others inside packages/sim.
 */

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

/** sin(x) for x in [-pi/2, pi/2], odd polynomial, error below 1e-9. */
function sinCore(x: number): number {
  const x2 = x * x;
  return (
    x *
    (1 +
      x2 *
        (-0.16666666666666666 +
          x2 *
            (0.008333333333333333 +
              x2 *
                (-0.0001984126984126984 +
                  x2 * (0.0000027557319223985893 + x2 * (-2.505210838544172e-8 + x2 * 1.6059043836821613e-10))))))
  );
}

export function dsin(x: number): number {
  // Reduce to [-pi, pi], then fold into [-pi/2, pi/2].
  let r = x - TAU * Math.floor((x + PI) / TAU);
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  return sinCore(r);
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

/** atan(x) for |x| <= 1, error below 2e-6 radians after one refinement step. */
function atanCore(x: number): number {
  const x2 = x * x;
  // Minimax polynomial (odd, degree 11).
  let a =
    x *
    (0.99997726 +
      x2 * (-0.33262347 + x2 * (0.19354346 + x2 * (-0.11643287 + x2 * (0.05265332 + x2 * -0.0117212)))));
  // One Newton step on tan(a) = x using exact sin and cos polynomials.
  const s = sinCore(a);
  const c = sinCore(HALF_PI - (a < 0 ? -a : a));
  a += (x * c - s) * c;
  return a;
}

export function datan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  let a = ax >= ay ? atanCore(ay / ax) : HALF_PI - atanCore(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export function dacos(x: number): number {
  const c = x > 1 ? 1 : x < -1 ? -1 : x;
  return datan2(Math.sqrt(1 - c * c), c);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
