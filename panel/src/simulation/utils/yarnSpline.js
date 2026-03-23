const Vec2 = {
  add([ax, ay], [bx, by]) {
    return [ax + bx, ay + by];
  },

  sub([ax, ay], [bx, by]) {
    return [ax - bx, ay - by];
  },

  scale([x, y], scalar) {
    return [x * scalar, y * scalar];
  },

  abs([x, y]) {
    return [Math.abs(x), Math.abs(y)];
  },

  mag([x, y]) {
    return Math.sqrt(x * x + y * y);
  },

  dot([ax, ay], [bx, by]) {
    return ax * bx + ay * by;
  },

  normalize(vec) {
    return this.scale(vec, 1 / this.mag(vec));
  },
};

function calcM([p0x, p0y], [p1x, p1y], [p2x, p2y], [p3x, p3y], tension = 0) {
  function dist([x1, y1], [x2, y2]) {
    return Math.sqrt(Math.hypot(x2 - x1, y2 - y1));
  }

  const t01 = dist([p0x, p0y], [p1x, p1y]);
  const t12 = dist([p1x, p1y], [p2x, p2y]);
  const t23 = dist([p2x, p2y], [p3x, p3y]);

  const m1x =
    (1.0 - tension) *
    (p2x - p1x + t12 * ((p1x - p0x) / t01 - (p2x - p0x) / (t01 + t12)));

  const m1y =
    (1.0 - tension) *
    (p2y - p1y + t12 * ((p1y - p0y) / t01 - (p2y - p0y) / (t01 + t12)));

  const m2x =
    (1.0 - tension) *
    (p2x - p1x + t12 * ((p3x - p2x) / t23 - (p3x - p1x) / (t12 + t23)));

  const m2y =
    (1.0 - tension) *
    (p2y - p1y + t12 * ((p3y - p2y) / t23 - (p3y - p1y) / (t12 + t23)));

  return [
    [m1x, m1y],
    [m2x, m2y],
  ];
}

export function yarnSpline(
  [p0x, p0y],
  [p1x, p1y],
  [p2x, p2y],
  [p3x, p3y],
  tension = 0
) {
  // Returns control points for a cubic bezier representing the
  // centripetal catmull rom spline passing through p0 - p3

  const [[m1x, m1y], [m2x, m2y]] = calcM(
    [p0x, p0y],
    [p1x, p1y],
    [p2x, p2y],
    [p3x, p3y],
    tension
  );

  const pF = [p1x + m1x / 3, p1y + m1y / 3];
  const pL = [p2x - m2x / 3, p2y - m2y / 3];

  return [[p1x, p1y], pF, pL, [p2x, p2y]];
}

export function splitYarnSpline(p0, [p1x, p1y], [p2x, p2y], p3, tension = 0) {
  const [m1, m2] = calcM(p0, [p1x, p1y], [p2x, p2y], p3, tension);

  const a = Vec2.add(
    Vec2.scale(Vec2.sub([p1x, p1y], [p2x, p2y]), 2.0),
    Vec2.add(m1, m2)
  );

  const b = Vec2.sub(
    Vec2.sub(
      Vec2.sub(Vec2.scale(Vec2.sub([p1x, p1y], [p2x, p2y]), -3.0), m1),
      m1
    ),
    m2
  );

  const c = m1;
  const d = [p1x, p1y];

  const half = Vec2.add(
    Vec2.add(
      Vec2.add(Vec2.scale(a, 0.5 * 0.5 * 0.5), Vec2.scale(b, 0.5 * 0.5)),
      Vec2.scale(c, 0.5)
    ),
    d
  );

  return [
    yarnSpline(p0, [p1x, p1y], half, [p2x, p2y]),
    yarnSpline([p1x, p1y], half, [p2x, p2y], p3),
  ];
}
