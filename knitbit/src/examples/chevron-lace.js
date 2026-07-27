const w = 50,
  h = 50;
const repeat = Math.floor(w / 2);

// 4-row repeat:
//   phase 0, 1: plain knit row (yarn = 1, rack = 0)
//   phase 2:    transfer FTB at two symmetric columns (yarn = null, rack = 1)
//   phase 3:    transfer BTF return row             (yarn = null, rack = 0)
// The FTB/BTF columns walk inward each repeat, giving the chevron.
const ops = Bimp.empty(w, h, Op.EMPTY).map((_, x, y) => {
  const s = Math.floor(y / 4) % repeat;
  const phase = y % 4;
  if (phase === 2) return x === s || x === w - 1 - s ? Op.FTB : Op.EMPTY;
  if (phase === 3) return x === s + 1 || x === w - s ? Op.BTF : Op.EMPTY;
  return Op.FKNIT;
});

return {
  ops,
  yarnFeeder: Array.from({ length: h }, (_, r) => (r % 4 >= 2 ? null : 1)),
  racking: Array.from({ length: h }, (_, r) => (r % 4 === 2 ? 1 : 0)),
  palette: ["#c8b6e2"],
};
