const w = 10, h = 10;

// Tile a 2×1 "knit-purl" unit across the whole chart.
const unit = new Bimp(2, 1, [Op.FKNIT, Op.BKNIT]);

return {
  ops: Bimp.fromTile(w, h, unit),
  yarnFeeder: new Array(h).fill(1),
  palette: ["#08ccab"],
};
