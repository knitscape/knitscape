const w = 10, h = 10;

// Tile a 2×1 "knit-purl" unit across the whole chart.
const unit = new Bimp(2, 1, [Op.FKNIT, Op.BKNIT]);

return {
  ops: Bimp.fromTile(w, h, unit),
  // Alternate yarns every 2 rows.
  yarnFeeder: Array.from({ length: h }, (_, r) => (Math.floor(r / 2) % 2) + 1),
  palette: ["#a8dadc", "#e63946"],
};
