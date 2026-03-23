import { Vec3 } from "ogl";

function catmullRom(p0, p1, p2, p3, alpha = 0.5, tension = 0) {
  let t01 = p0.distance(p1);
  let t12 = p1.distance(p2);
  let t23 = p2.distance(p3);

  const m1x =
    (1.0 - tension) *
    (p2[0] -
      p1[0] +
      t12 * ((p1[0] - p0[0]) / t01 - (p2[0] - p0[0]) / (t01 + t12)));

  const m1y =
    (1.0 - tension) *
    (p2[1] -
      p1[1] +
      t12 * ((p1[1] - p0[1]) / t01 - (p2[1] - p0[1]) / (t01 + t12)));

  const m1z =
    (1.0 - tension) *
    (p2[2] -
      p1[2] +
      t12 * ((p1[2] - p0[2]) / t01 - (p2[2] - p0[2]) / (t01 + t12)));

  const m2x =
    (1.0 - tension) *
    (p2[0] -
      p1[0] +
      t12 * ((p3[0] - p2[0]) / t23 - (p3[0] - p1[0]) / (t12 + t23)));

  const m2y =
    (1.0 - tension) *
    (p2[1] -
      p1[1] +
      t12 * ((p3[1] - p2[1]) / t23 - (p3[1] - p1[1]) / (t12 + t23)));

  const m2z =
    (1.0 - tension) *
    (p2[2] -
      p1[2] +
      t12 * ((p3[2] - p2[2]) / t23 - (p3[2] - p1[2]) / (t12 + t23)));

  const m1 = new Vec3(m1x, m1y, m1z);
  const m2 = new Vec3(m2x, m2y, m2z);

  return {
    a: p1.clone().sub(p2).multiply(2.0).add(m1).add(m2),
    b: p1.clone().sub(p2).multiply(-3.0).sub(m1).sub(m1).sub(m2),
    c: m1.clone(),
    d: p1.clone(),
  };
}

function pointInSegment(seg, t) {
  return seg.a
    .clone()
    .multiply(t * t * t)
    .add(seg.b.clone().multiply(t * t))
    .add(seg.c.clone().multiply(t))
    .add(seg.d.clone());
}

export function buildYarnCurve(pts, divisions = 5, tension = 0.5) {
  let vec3arr = [];

  for (let i = 0; i < pts.length - 9; i += 3) {
    let cp1 = new Vec3(pts[i + 0], pts[i + 1], pts[i + 2]);
    let p1 = new Vec3(pts[i + 3], pts[i + 4], pts[i + 5]);
    let p2 = new Vec3(pts[i + 6], pts[i + 7], pts[i + 8]);
    let cp2 = new Vec3(pts[i + 9], pts[i + 10], pts[i + 11]);
    const coefficients = catmullRom(cp1, p1, p2, cp2, 0, tension);

    for (let t = 0; t < 1; t += 1 / divisions) {
      vec3arr.push(pointInSegment(coefficients, t));
    }
  }

  return vec3arr.map((pt) => pt.toArray()).flat();
}
