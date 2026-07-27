// This example uses black to represent the regions where we won't knit,
// and colors to represent where we want the yarns to go.
const base = new Bimp(
  20,
  20,
  [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2,
    2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    3, 3, 3, 3, 3, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  ],
  [
    { color: "#000000", label: "miss" },
    { color: "#08ccab", label: "yarn 1" },
    { color: "#eb4034", label: "yarn 2" },
    { color: "#20079d", label: "yarn 3" },
  ],
);

// Separate the non-miss colors into their own machine rows. Value 0 in
// the chart means "nothing here" (always Op.EMPTY). Any other value is
// a yarn index: on that yarn's machine row its own cells knit while
// other non-zero cells miss (yarn floats past).
function colorSeparation(src) {
  const w = src.width;
  const h = src.height;
  const colors = (src.palette ?? []).map((p) =>
    typeof p === "string" ? p : p.color,
  );

  const outOps = [];
  const outFeeder = [];
  for (let y = 0; y < h; y++) {
    const rowSlice = src.crop(0, y, w, 1);
    const activeColors = rowSlice.uniqueValues().filter((c) => c !== 0);
    for (const c of activeColors) {
      for (let x = 0; x < w; x++) {
        const v = rowSlice.pixel(x, 0);
        if (v === 0) outOps.push(Op.EMPTY);
        else if (v === c) outOps.push(Op.FKNIT);
        else outOps.push(Op.MISS);
      }
      outFeeder.push(c);
    }
  }

  return {
    ops: new Bimp(w, outOps.length / w, outOps),
    yarnFeeder: outFeeder,
    // Drop palette[0] — it's the "miss/empty" placeholder, not a yarn.
    palette: colors.slice(1),
  };
}

const result = colorSeparation(base);

return {
  ops: result.ops,
  yarnFeeder: result.yarnFeeder,
  palette: result.palette,
};
