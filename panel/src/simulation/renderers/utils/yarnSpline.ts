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
