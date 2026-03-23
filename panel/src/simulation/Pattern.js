export class Pattern {
  constructor(bitmap, yarnSequence, rowMap) {
    this.ops = bitmap.pixels;
    this.width = bitmap.width;
    this.height = bitmap.height;
    this.yarnSequence = yarnSequence;
    this.rowMap = rowMap;
    this.yarns = Array.from(
      yarnSequence.filter((value, index, arr) => arr.indexOf(value) === index)
    );
    this.carriagePasses = rowMap.map((ogRow) =>
      ogRow % 2 == 0 ? "right" : "left"
    );
  }

  op(x, y) {
    if (x > this.width - 1 || x < 0 || y > this.height - 1 || y < 0) {
      return -1;
    }
    return this.ops.at(x + y * this.width);
  }
}
