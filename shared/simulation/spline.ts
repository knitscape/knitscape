interface Segment {
  a: number[];
  b: number[];
  c: number[];
  d: number[];
}

function dist3(a: number[], b: number[]): number {
  const dx = a[0] - b[0],
    dy = a[1] - b[1],
    dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function add3(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(v: number[], s: number): number[] {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function catmullRom(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  tension = 0
): Segment {
  const t01 = dist3(p0, p1);
  const t12 = dist3(p1, p2);
  const t23 = dist3(p2, p3);

  const m1 = [
    (1 - tension) *
      (p2[0] -
        p1[0] +
        t12 * ((p1[0] - p0[0]) / t01 - (p2[0] - p0[0]) / (t01 + t12))),
    (1 - tension) *
      (p2[1] -
        p1[1] +
        t12 * ((p1[1] - p0[1]) / t01 - (p2[1] - p0[1]) / (t01 + t12))),
    (1 - tension) *
      (p2[2] -
        p1[2] +
        t12 * ((p1[2] - p0[2]) / t01 - (p2[2] - p0[2]) / (t01 + t12))),
  ];

  const m2 = [
    (1 - tension) *
      (p2[0] -
        p1[0] +
        t12 * ((p3[0] - p2[0]) / t23 - (p3[0] - p1[0]) / (t12 + t23))),
    (1 - tension) *
      (p2[1] -
        p1[1] +
        t12 * ((p3[1] - p2[1]) / t23 - (p3[1] - p1[1]) / (t12 + t23))),
    (1 - tension) *
      (p2[2] -
        p1[2] +
        t12 * ((p3[2] - p2[2]) / t23 - (p3[2] - p1[2]) / (t12 + t23))),
  ];

  return {
    a: add3(add3(scale3(sub3(p1, p2), 2), m1), m2),
    b: sub3(sub3(sub3(scale3(sub3(p1, p2), -3), m1), m1), m2),
    c: [...m1],
    d: [...p1],
  };
}

function pointInSegment(seg: Segment, t: number): number[] {
  return add3(
    add3(add3(scale3(seg.a, t * t * t), scale3(seg.b, t * t)), scale3(seg.c, t)),
    seg.d
  );
}

export function buildYarnCurve(
  pts: number[],
  divisions = 5,
  tension = 0.5
): number[] {
  const result: number[] = [];
  for (let i = 0; i < pts.length - 9; i += 3) {
    const cp1 = [pts[i], pts[i + 1], pts[i + 2]];
    const p1 = [pts[i + 3], pts[i + 4], pts[i + 5]];
    const p2 = [pts[i + 6], pts[i + 7], pts[i + 8]];
    const cp2 = [pts[i + 9], pts[i + 10], pts[i + 11]];
    const coefficients = catmullRom(cp1, p1, p2, cp2, tension);

    for (let t = 0; t < 1; t += 1 / divisions) {
      const pt = pointInSegment(coefficients, t);
      result.push(pt[0], pt[1], pt[2]);
    }
  }
  return result;
}

// The t values buildYarnCurve steps through per segment, accumulated the same
// way so the two agree point for point.
function curveSteps(divisions: number): number[] {
  const steps: number[] = [];
  for (let t = 0; t < 1; t += 1 / divisions) steps.push(t);
  return steps;
}

/**
 * buildYarnCurve without its per-point allocations: the same curve, written
 * into `out` when it has the right length (so a redraw allocates nothing) or
 * into a new Float32Array.
 */
export function buildYarnCurveInto(
  pts: ArrayLike<number>,
  divisions = 5,
  tension = 0.5,
  out?: Float32Array
): Float32Array {
  const steps = curveSteps(divisions);
  const segments = Math.max(0, Math.floor((pts.length - 9 + 2) / 3));
  const length = segments * steps.length * 3;
  if (!out || out.length !== length) out = new Float32Array(length);
  const k = 1 - tension;
  let o = 0;
  for (let i = 0; i < pts.length - 9; i += 3) {
    const p0x = pts[i], p0y = pts[i + 1], p0z = pts[i + 2];
    const p1x = pts[i + 3], p1y = pts[i + 4], p1z = pts[i + 5];
    const p2x = pts[i + 6], p2y = pts[i + 7], p2z = pts[i + 8];
    const p3x = pts[i + 9], p3y = pts[i + 10], p3z = pts[i + 11];
    const t01 = Math.sqrt((p1x - p0x) ** 2 + (p1y - p0y) ** 2 + (p1z - p0z) ** 2);
    const t12 = Math.sqrt((p2x - p1x) ** 2 + (p2y - p1y) ** 2 + (p2z - p1z) ** 2);
    const t23 = Math.sqrt((p3x - p2x) ** 2 + (p3y - p2y) ** 2 + (p3z - p2z) ** 2);
    const m1x = k * (p2x - p1x + t12 * ((p1x - p0x) / t01 - (p2x - p0x) / (t01 + t12)));
    const m1y = k * (p2y - p1y + t12 * ((p1y - p0y) / t01 - (p2y - p0y) / (t01 + t12)));
    const m1z = k * (p2z - p1z + t12 * ((p1z - p0z) / t01 - (p2z - p0z) / (t01 + t12)));
    const m2x = k * (p2x - p1x + t12 * ((p3x - p2x) / t23 - (p3x - p1x) / (t12 + t23)));
    const m2y = k * (p2y - p1y + t12 * ((p3y - p2y) / t23 - (p3y - p1y) / (t12 + t23)));
    const m2z = k * (p2z - p1z + t12 * ((p3z - p2z) / t23 - (p3z - p1z) / (t12 + t23)));
    const ax = 2 * (p1x - p2x) + m1x + m2x, ay = 2 * (p1y - p2y) + m1y + m2y, az = 2 * (p1z - p2z) + m1z + m2z;
    const bx = -3 * (p1x - p2x) - m1x - m1x - m2x, by = -3 * (p1y - p2y) - m1y - m1y - m2y, bz = -3 * (p1z - p2z) - m1z - m1z - m2z;
    for (const t of steps) {
      const t2 = t * t, t3 = t2 * t;
      out[o++] = ax * t3 + bx * t2 + m1x * t + p1x;
      out[o++] = ay * t3 + by * t2 + m1y * t + p1y;
      out[o++] = az * t3 + bz * t2 + m1z * t + p1z;
    }
  }
  return out;
}
