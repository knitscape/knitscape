export type Vec2 = [number, number];

export const Vec2 = {
  add(a: number[], b: number[]): number[] {
    return [a[0] + b[0], a[1] + b[1]];
  },

  sub(a: number[], b: number[]): number[] {
    return [a[0] - b[0], a[1] - b[1]];
  },

  scale(v: number[], scalar: number): number[] {
    return [v[0] * scalar, v[1] * scalar];
  },

  abs(v: number[]): number[] {
    return [Math.abs(v[0]), Math.abs(v[1])];
  },

  mag(v: number[]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  },

  dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1];
  },

  normalize(v: number[]): number[] {
    return this.scale(v, 1 / this.mag(v));
  },
};
