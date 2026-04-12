import { Bimp } from "../../../shared/Bimp";

export class Pattern {
  ops: ArrayLike<number>;
  width: number;
  height: number;
  yarnSequence: number[];
  rowMap: number[];
  yarns: number[];
  carriagePasses: string[];

  constructor(bitmap: Bimp, yarnSequence: number[], rowMap: number[]) {
    this.ops = bitmap.pixels;
    this.width = bitmap.width;
    this.height = bitmap.height;
    this.yarnSequence = yarnSequence;
    this.rowMap = rowMap;
    this.yarns = Array.from(
      yarnSequence.filter((value: number, index: number, arr: number[]) => arr.indexOf(value) === index)
    );
    this.carriagePasses = rowMap.map((ogRow: number) =>
      ogRow % 2 == 0 ? "right" : "left"
    );
  }

  op(x: number, y: number): number {
    if (x > this.width - 1 || x < 0 || y > this.height - 1 || y < 0) {
      return -1;
    }
    return (this.ops as Uint8ClampedArray).at(x + y * this.width) ?? -1;
  }
}
