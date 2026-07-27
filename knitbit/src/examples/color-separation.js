// Color-separation: paint a multi-color *tile* where each
// pixel is a palette index, repeat it across a larger chart, then
// expand each chart row into one machine row per yarn. On each machine
// row, needles of the active yarn knit; the rest miss (the yarn floats
// behind the fabric).
//
// Click the ✎ badge on the tile below to paint it visually.

const tile = new Bimp(
  10,
  10,
  [
    0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 2,
    2, 1, 1, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1,
    1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 1, 1, 2,
    2, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0,
  ],
  [
    { color: "#f1faee", label: "cream" },
    { color: "#e63946", label: "red" },
    { color: "#1d3557", label: "navy" },
  ],
);

// Tile the base motif 10× in each direction.
const chart = Bimp.fromTile(tile.width * 10, tile.height * 10, tile);

// This function separates the colors of a bimp into one per row
function colorSeparation(src) {
  const w = src.width;
  const h = src.height;
  // The Bimp palette may be hex strings or {color, label} objects; the
  // return-value palette is always a list of hex strings indexed by
  // (yarnFeeder - 1), so normalise here.
  const colors = (src.palette ?? []).map((p) =>
    typeof p === "string" ? p : p.color,
  );

  const outOps = [];
  const outFeeder = [];
  for (let y = 0; y < h; y++) {
    // One machine row per yarn that appears in this chart row. The row
    // slice is itself a Bimp — uniqueValues() gives a sorted list of
    // which yarns are in play.
    const rowSlice = src.crop(0, y, w, 1);
    for (const c of rowSlice.uniqueValues()) {
      for (let x = 0; x < w; x++) {
        outOps.push(rowSlice.pixel(x, 0) === c ? Op.FKNIT : Op.MISS);
      }
      outFeeder.push(c + 1);
    }
  }

  return {
    ops: new Bimp(w, outOps.length / w, outOps),
    yarnFeeder: outFeeder,
    palette: colors,
  };
}

const result = colorSeparation(chart);

return {
  ops: result.ops,
  yarnFeeder: result.yarnFeeder,
  palette: result.palette,
};
