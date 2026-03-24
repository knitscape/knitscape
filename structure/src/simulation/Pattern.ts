import type { Bimp } from "../lib/Bimp";

const opTypes: Record<string, number> = {
  T: 0,
  K: 1,
  S: 2,
  p: 3,
};

const pixToOp = ["K", "P", "M", "T"];

export interface OpData {
  index: number;
  stitch: string;
  op: number;
  cnIndices: number[];
}

export class Pattern {
  ops: string[];
  width: number;
  height: number;

  constructor(bitmap: Bimp) {
    this.ops = Array.from(bitmap.pixels).map((val) => pixToOp[val]);
    this.width = bitmap.width;
    this.height = bitmap.height;
  }

  op(x: number, y: number): string | -1 {
    if (x > this.width - 1 || x < 0 || y > this.height - 1 || y < 0) {
      return -1;
    }
    return this.ops.at(x + y * this.width)!;
  }

  makeOpData(): OpData[] {
    const w = this.width;
    const h = this.height;

    const ops: OpData[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const flatIndex = y * w + x;
        const stitch = this.op(x, y) as string;
        const cnIJ: [number, number][] = [
          [2 * x, y],
          [2 * x + 1, y],
          [2 * x + 1, y + 1],
          [2 * x, y + 1],
        ];

        ops.push({
          index: flatIndex,
          stitch: stitch,
          op: opTypes[stitch],
          cnIndices: cnIJ.map(([i, j]) => j * 2 * w + i),
        });
      }
    }

    return ops;
  }
}
