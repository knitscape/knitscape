// A knit-to-shape sweater front, built row by row:
//   1. 1×1 rib hem
//   2. straight body
//   3. armholes: the edge stitches at each side stop knitting (for now
//      they're left live; on the machine they'd be bound off)
//   4. neck split: center stitches knit onto waste yarn and dropped, then
//      the two sides are knit with separate carriers (yarns 1 and 2)
//   5. neckline shaping (fully-fashioned decreases at the neck edges,
//      quickly at first to round it, then every other course)
//   6. short-row shoulders: needles are held in steps from the armhole
//      edge toward the neck, with a tuck on the turn to close the gap
//
// A "course" is one row of fabric. Once the neck splits, every course is
// two machine rows (left side on yarn 1, then right side on yarn 2).

const W = 168; // needles
const RIB_COURSES = 21;
const BODY_COURSES = 105;
const ARM_OFF = 8; // stitches taken out of work at each armhole
const ARM_COURSES_BEFORE_NECK = 62; // armhole depth before the neck splits
const NECK_CENTER = 36; // stitches taken off onto waste yarn
const WASTE_COURSES = 3;
const NECK_DECS = 12; // decreases per neck edge
const NECK_FAST_DECS = 6; // how many of those come every course (the rest every other)
const NECK_STRAIGHT = 4; // straight courses between neck shaping and shoulder
const SHOULDER_STEPS = 5; // short-row holds per shoulder
const FF = 2; // stitches moved per fully-fashioned decrease

const MAIN = "#8fb8de";
const WASTE = "#f4d35e";

// ── Row builder ────────────────────────────────────────────────────────
// Directions are tracked per yarn (each carrier alternates), and
// transfer rows just flip whatever came before.
const rows = [];
const yarnFeeder = [];
const racking = [];
const direction = [];
const lastDir = {};
let prevDir = "left";

function flip(d) {
  return d === "right" ? "left" : "right";
}

function nextDir(yarn) {
  return lastDir[yarn] ? flip(lastDir[yarn]) : "right";
}

function emit(cells, yarn, rack = 0) {
  const d = yarn == null ? flip(prevDir) : nextDir(yarn);
  if (yarn != null) lastDir[yarn] = d;
  prevDir = d;
  rows.push(cells);
  yarnFeeder.push(yarn);
  racking.push(rack);
  direction.push(d);
}

function blank() {
  return new Array(W).fill(Op.EMPTY);
}

// Knit plain across each [lo, hi] range (inclusive).
function knit(yarn, ranges, extra = {}) {
  const r = blank();
  for (const [lo, hi] of ranges) for (let x = lo; x <= hi; x++) r[x] = Op.FKNIT;
  for (const [x, op] of Object.entries(extra)) r[x] = op;
  emit(r, yarn);
}

// Move each stitch in `moves` ({ from, to }, |to - from| = 1) over one
// needle. Transfers go front → back at the rack that lands them on the
// destination needle, then back → front at rack 0. Moves sharing a rack
// share a transfer row.
function shift(moves) {
  if (moves.length === 0) return;
  const byRack = new Map();
  for (const m of moves) {
    const rack = m.to - m.from;
    if (!byRack.has(rack)) byRack.set(rack, []);
    byRack.get(rack).push(m);
  }
  for (const [rack, group] of byRack) {
    const r = blank();
    for (const m of group) r[m.from] = Op.FTB;
    emit(r, null, rack);
  }
  const r = blank();
  for (const m of moves) r[m.to] = Op.BTF;
  emit(r, null, 0);
}

// Fully-fashioned decrease: the FF stitches at the edge each move one
// needle inward, so the innermost lands on (and stacks with) its
// neighbor and the edge needle ends up empty. `dir` is +1 to move right.
function ffMoves(edge, dir) {
  const moves = [];
  for (let k = 0; k < FF; k++) {
    const from = edge + dir * k;
    moves.push({ from, to: from + dir });
  }
  return moves;
}

// ── 1. Rib hem ─────────────────────────────────────────────────────────
const odd = (x) => x % 2 === 1;
knit(1, [[0, W - 1]]);

let r = blank();
for (let x = 0; x < W; x++) if (odd(x)) r[x] = Op.FTB;
emit(r, null);

for (let c = 0; c < RIB_COURSES; c++) {
  const rib = blank();
  for (let x = 0; x < W; x++) rib[x] = odd(x) ? Op.BKNIT : Op.FKNIT;
  emit(rib, 1);
}

r = blank();
for (let x = 0; x < W; x++) if (odd(x)) r[x] = Op.BTF;
emit(r, null);

// ── 2. Body ────────────────────────────────────────────────────────────
let lo = 0;
let hi = W - 1;
for (let c = 0; c < BODY_COURSES; c++) knit(1, [[lo, hi]]);

// ── 3. Armholes ────────────────────────────────────────────────────────
lo += ARM_OFF;
hi -= ARM_OFF;
for (let c = 0; c < ARM_COURSES_BEFORE_NECK; c++) knit(1, [[lo, hi]]);

// ── 4. Neck split ──────────────────────────────────────────────────────
// Center stitches get a few rows of waste yarn, then come off the
// needles. The waste yarn holds the neck's live loops for a neckband.
const live = hi - lo + 1;
const neckLo = lo + Math.floor((live - NECK_CENTER) / 2);
const neckHi = neckLo + NECK_CENTER - 1;

for (let c = 0; c < WASTE_COURSES; c++) knit(3, [[neckLo, neckHi]]);
r = blank();
for (let x = neckLo; x <= neckHi; x++) r[x] = Op.FDROP;
emit(r, null);

// Yarn 1 carries on with whichever side its carrier finished on, so it
// doesn't float across the neck; yarn 2 comes in for the other side.
const endedRight = lastDir[1] === "right";
const left = { lo, hi: neckLo - 1, yarn: endedRight ? 2 : 1 };
const right = { lo: neckHi + 1, hi, yarn: endedRight ? 1 : 2 };

function course() {
  knit(left.yarn, [[left.lo, left.hi]]);
  knit(right.yarn, [[right.lo, right.hi]]);
}

// ── 5. Neckline shaping ────────────────────────────────────────────────
// Decrease every course at first to round the bottom of the neck, then
// every other course up the sides.
for (let d = 0; d < NECK_DECS; d++) {
  if (d >= NECK_FAST_DECS) course();
  course();
  shift([...ffMoves(left.hi, -1), ...ffMoves(right.lo, +1)]);
  left.hi--;
  right.lo++;
}
for (let c = 0; c < NECK_STRAIGHT; c++) course();

// ── 6. Short-row shoulders ─────────────────────────────────────────────
// Each shoulder holds `step` more needles at its armhole edge every time
// the carriage heads toward the armhole. The row that turns short tucks
// the first held needle (a machine "wrap") so no hole forms at the turn.
// Once every step is held, one full row knits across all needles.
//
// Returns a list of rows: { held, wrap } where `held` counts needles
// held from the armhole edge.
function shoulderPlan(side, towardArm) {
  const width = side.hi - side.lo + 1;
  const step = Math.floor(width / (SHOULDER_STEPS + 1));
  const plan = [];
  let d = nextDir(side.yarn);
  // Knit one full row first if we'd otherwise start heading away.
  if (d !== towardArm) {
    plan.push({ held: 0, wrap: false });
    d = flip(d);
  }
  for (let s = 1; s <= SHOULDER_STEPS; s++) {
    plan.push({ held: s * step, wrap: true }); // toward armhole, turns short
    plan.push({ held: s * step, wrap: false }); // back toward the neck
  }
  plan.push({ held: 0, wrap: false }); // closing row, knits every needle
  return plan;
}

// Left armhole is at the low-needle end, so "toward" it is leftward.
const leftPlan = shoulderPlan(left, "left");
const rightPlan = shoulderPlan(right, "right");

for (let i = 0; i < Math.max(leftPlan.length, rightPlan.length); i++) {
  const lp = leftPlan[i];
  if (lp) {
    const start = left.lo + lp.held;
    knit(left.yarn, [[start, left.hi]], lp.wrap ? { [start - 1]: Op.FTUCK } : {});
  }
  const rp = rightPlan[i];
  if (rp) {
    const end = right.hi - rp.held;
    knit(right.yarn, [[right.lo, end]], rp.wrap ? { [end + 1]: Op.FTUCK } : {});
  }
}

return {
  ops: new Bimp(W, rows.length, rows.flat()),
  yarnFeeder,
  racking,
  direction,
  palette: [MAIN, MAIN, WASTE],
};
