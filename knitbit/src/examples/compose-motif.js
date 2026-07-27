// Build a larger pattern by mirroring and tiling a small asymmetric
// motif. Demonstrates concat, hFlip / vFlip, repeat, and remap.
//
// Paint the base motif below (✎). Values map: 0 → knit stitch ("V"),
// 1 → back knit (shows as a "purl" bump). The motif is mirrored into
// a 4-fold-symmetric block and then tiled 3 × 3 across the swatch.

const motif = new Bimp(
  4,
  4,
  [1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1],
  [
    { color: "#f1faee", label: "knit (V)" },
    { color: "#457b9d", label: "purl (bump)" },
  ],
);

// Mirror horizontally → a 2-wide pair; then vertically → a 4-fold block.
const top = motif.concat(motif.hFlip(), "x");
const block = top.concat(top.vFlip(), "y");
// Make a new chart by tiling the block.
const chart = block.repeat(10, 10);

// Substitute palette indices with Op codes: 0 → FKNIT, 1 → BKNIT.
const baseChart = chart.remap({ 0: Op.FKNIT, 1: Op.BKNIT });

const baseFeeder = new Array(baseChart.height).fill(1);

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
  };
}

const result = bedTransfers(baseChart, baseFeeder);

return {
  ops: result.ops,
  yarnFeeder: result.yarnFeeder,
  palette: ["#a8dadc"],
};
