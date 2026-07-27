// A 4×4 basketweave stitch tile. Pixel values are Op codes:
// 1 = FKNIT (front knit "V"), 3 = BKNIT (back knit "purl").
// The 4th arg to Bimp is a color palette for the bitmap editor.
// Click the ✎ button next to the literal to paint it visually.
const tile = new Bimp(
  4,
  4,
  [1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1],
  [
    { color: "#fbacda", label: "miss" },
    { color: "#08ccab", label: "front knit" },
    { color: "#eb4034", label: "front tuck" },
    { color: "#079e85", label: "back knit" },
    { color: "#b03027", label: "back tuck" },
    { color: "#fcff46", label: "ftb xfer" },
    { color: "#afff46", label: "btf xfer" },
    { color: "#d48cff", label: "front drop" },
    { color: "#8050c0", label: "back drop" },
    { color: "#1a1a1a", label: "empty" },
  ],
);

const w = 20,
  h = 20;
const ops = Bimp.fromTile(w, h, tile);

const yarnFeeder = new Array(h).fill(1);

// Insert transfer rows wherever a knit wants to happen on a different
// bed than the loop currently sits on. For each input row, compare it
// against the previous row column-by-column: any column whose bed has
// changed needs a transfer (FTB or BTF) in a prepended row so the loop
// is on the correct bed before the carriage passes. Transfer rows are
// only emitted when at least one column actually needs one.
function bedTransfers(ops, yarnFeeder) {
  const w = ops.width;
  const h = ops.height;

  let out = ops.crop(0, 0, w, 1);
  const outFeeder = [yarnFeeder[0]];

  for (let r = 1; r < h; r++) {
    const curRow = ops.crop(0, r, w, 1);
    const prevRow = ops.crop(0, r - 1, w, 1);
    const xferRow = curRow.map((cur, x) => {
      const prev = prevRow.pixel(x, 0);
      if (cur === Op.FKNIT && prev === Op.BKNIT) return Op.BTF;
      if (cur === Op.BKNIT && prev === Op.FKNIT) return Op.FTB;
      return Op.EMPTY;
    });

    if (xferRow.count(Op.EMPTY) < w) {
      out = out.concat(xferRow, "y");
      // null yarn marks a transfer-only row (no yarn is being fed).
      outFeeder.push(null);
    }
    out = out.concat(curRow, "y");
    outFeeder.push(yarnFeeder[r]);
  }

  return {
    ops: out,
    yarnFeeder: outFeeder,
    racking: new Array(out.height).fill(0),
  };
}

const result = bedTransfers(ops, yarnFeeder);

return {
  ops: result.ops,
  yarnFeeder: result.yarnFeeder,
  racking: result.racking,
  palette: ["#a8dadc"],
};
