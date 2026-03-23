export const Vec2 = {
  add(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
  },

  sub(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
  },

  scale(v, scalar) {
    return [v[0] * scalar, v[1] * scalar];
  },

  abs(v) {
    return [Math.abs(v[0], Math.abs(v[1]))];
  },
  mag(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  },
  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  },
  normalize(v) {
    return this.scale(v, 1 / this.mag(v));
  },
};
