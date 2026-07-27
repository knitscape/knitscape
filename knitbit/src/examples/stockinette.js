const w = 10, h = 10;

return {
  ops: Bimp.empty(w, h, Op.FKNIT),
  yarnFeeder: new Array(h).fill(1),
  palette: ["#a8dadc"],
};
