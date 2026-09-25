// A chunky-cable sweater front: the shaping from "Sweater Front" (rib
// hem, armholes, split neck, short-row shoulders) with a few bold cables
// on a reverse-stockinette (purl) background, mirrored about the center:
//
//   double moss | rope | horseshoe | XO | rope | horseshoe | rope | XO | ...
//
// The big ropes cross 4 over 4, so these transfers rack up to 4 needles.

// Knits sit on the front bed and purls on the back bed. Every course
// runs in the same order: work that course's cable crosses (as transfers),
// move each stitch to the bed its next stitch needs, then knit. A cable
// cross sends all of its stitches to the back bed, then brings the group
// that should end up in front back to the front first, racked to its new
// needles, and the other group after it.

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
const SELVEDGE = 2; // plain knit stitches kept at every edge

const MAIN = "#9e2a2b"; // brick red
const WASTE = "#f2cc8f";

// ── Panels ─────────────────────────────────────────────────────────────
// A panel is { width, stitch(x, c), crosses(c) } in panel-local needles x
// and pattern courses c. stitch gives "k" or "p" for the stitch knit
// there on course c (after that course's crosses). crosses lists
// { x, left, right, over }: the `left` stitches starting at x trade places
// with the `right` stitches beside them, and `over` ("left" or "right")
// names the group that ends up in front.

const knit = () => "k";
const noCrosses = () => [];
const mossStitch = (x, c) => ((x + c) % 2 === 0 ? "k" : "p");

function purl(width) {
  return { width, stitch: () => "p", crosses: noCrosses };
}

// Double moss: moss stitch with each row worked twice.
function doubleMoss(width) {
  return {
    width,
    stitch: (x, c) => mossStitch(x, Math.floor(c / 2)),
    crosses: noCrosses,
  };
}

// Rope: `half`-over-`half` cross every `every` courses.
function rope(half, every) {
  return {
    width: 2 * half,
    stitch: knit,
    crosses: (c) => (c % every === 0 ? [{ x: 0, left: half, right: half, over: "left" }] : []),
  };
}

// Horseshoe: two `half`-over-`half` crosses side by side, the left one
// leaning left and the right one leaning right, every `every` courses.
function horseshoe(half, every) {
  return {
    width: 4 * half,
    stitch: knit,
    crosses: (c) =>
      c % every === 0
        ? [
            { x: 0, left: half, right: half, over: "right" },
            { x: 2 * half, left: half, right: half, over: "left" },
          ]
        : [],
  };
}

// XO ("hugs and kisses"): two 2-over-2 crosses side by side. Crossing
// the same way twice makes an O, then the other way twice an X.
function xo() {
  return {
    width: 8,
    stitch: knit,
    crosses: (c) => {
      if (c % 4 !== 0) return [];
      const o = c % 16 < 8;
      return [
        { x: 0, left: 2, right: 2, over: o ? "left" : "right" },
        { x: 4, left: 2, right: 2, over: o ? "right" : "left" },
      ];
    },
  };
}

// Right half, from the center outward; the left half mirrors it.
const HALF = [
  purl(3),
  rope(4, 12),
  purl(3),
  xo(),
  purl(3),
  horseshoe(3, 8),
  purl(3),
  rope(4, 12),
  purl(3),
];
const CENTER = horseshoe(4, 12);
const FILL = doubleMoss;

// Lay the panels out across the needles, filling the sides with FILL.
const halfWidth = HALF.reduce((sum, p) => sum + p.width, 0);
const fill = (W - CENTER.width - 2 * halfWidth) / 2;
if (!Number.isInteger(fill) || fill < 0) {
  throw new Error(`Panels don't fit symmetrically in ${W} needles`);
}
const placed = []; // { panel, start, mirror }
let at = 0;
function place(panel, mirror) {
  placed.push({ panel, start: at, mirror });
  at += panel.width;
}
place(FILL(fill), true);
for (const p of [...HALF].reverse()) place(p, true);
place(CENTER, false);
for (const p of HALF) place(p, false);
place(FILL(fill), false);

const columns = new Array(W);
for (const entry of placed) {
  for (let i = 0; i < entry.panel.width; i++) {
    const lx = entry.mirror ? entry.panel.width - 1 - i : i;
    columns[entry.start + i] = { entry, lx };
  }
}

// Knit/purl for needle x on pattern course p.
function panelStitch(x, p) {
  const { entry, lx } = columns[x];
  return entry.panel.stitch(lx, p);
}

// All crosses on pattern course p, in needle coordinates.
function panelCrosses(p) {
  const out = [];
  for (const { panel, start, mirror } of placed) {
    for (const cr of panel.crosses(p)) {
      if (!mirror) {
        out.push({ ...cr, x: start + cr.x });
      } else {
        out.push({
          x: start + panel.width - cr.x - cr.left - cr.right,
          left: cr.right,
          right: cr.left,
          over: cr.over === "left" ? "right" : "left",
        });
      }
    }
  }
  return out;
}

// 2×2 rib, symmetric about the center.
const ribStitch = (x) => ((x + 1) % 4 < 2 ? "k" : "p");

// Pattern courses start one before the body so no cable crosses on the
// first body course, right out of the rib.
const PHASE = 1;
const stitchAt = (x, c) => panelStitch(x, c + PHASE);
const crossesAt = (c) => panelCrosses(c + PHASE);

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

function range(from, count) {
  return Array.from({ length: count }, (_, i) => from + i);
}

// Which bed each needle's loop is on: "f", "b", or null (no loop).
// The machine starts with a loop on every front needle.
const bed = new Array(W).fill("f");

// One transfer row; skipped if nothing moves.
function transfer(needles, op, rack) {
  if (needles.length === 0) return;
  const r = blank();
  for (const x of needles) r[x] = op;
  emit(r, null, rack);
}

function knitOp(x) {
  return bed[x] === "b" ? Op.BKNIT : Op.FKNIT;
}

// ── Transfers ──────────────────────────────────────────────────────────

// Work a set of non-overlapping cable crosses.
function cross(list) {
  if (list.length === 0) return;
  const span = list.flatMap((c) => range(c.x, c.left + c.right));
  transfer(span.filter((x) => bed[x] === "f"), Op.FTB, 0);
  for (const phase of ["over", "under"]) {
    const byRack = new Map();
    for (const c of list) {
      const moveLeft = (c.over === "left") === (phase === "over");
      const from = moveLeft ? c.x : c.x + c.left;
      const count = moveLeft ? c.left : c.right;
      const shift = moveLeft ? c.right : -c.left;
      const rack = -shift; // back → front lands on needle - rack
      if (!byRack.has(rack)) byRack.set(rack, []);
      byRack.get(rack).push(...range(from, count));
    }
    for (const [rack, needles] of byRack) transfer(needles, Op.BTF, rack);
  }
  for (const x of span) bed[x] = "f";
}

// Put each needle in `want` (needle → "k" | "p") on the bed its next
// stitch needs: knits on the front, purls on the back.
function align(want) {
  const toBack = [];
  const toFront = [];
  for (const [x, t] of want) {
    if (t === "p" && bed[x] === "f") toBack.push(x);
    if (t === "k" && bed[x] === "b") toFront.push(x);
  }
  transfer(toBack, Op.FTB, 0);
  transfer(toFront, Op.BTF, 0);
  for (const x of toBack) bed[x] = "b";
  for (const x of toFront) bed[x] = "f";
}

// Move each stitch in `moves` ({ from, to }, |to - from| = 1) over one
// needle, all on the front bed: front → back at the rack that lands them
// on the destination, then back → front at rack 0.
function shift(moves) {
  const involved = [...new Set(moves.flatMap((m) => [m.from, m.to]))];
  const onBack = involved.filter((x) => bed[x] === "b");
  transfer(onBack, Op.BTF, 0);
  const byRack = new Map();
  for (const m of moves) {
    const rack = m.to - m.from;
    if (!byRack.has(rack)) byRack.set(rack, []);
    byRack.get(rack).push(m.from);
  }
  for (const [rack, needles] of byRack) transfer(needles, Op.FTB, rack);
  transfer(moves.map((m) => m.to), Op.BTF, 0);
  for (const m of moves) bed[m.from] = null;
  for (const m of moves) bed[m.to] = "f";
}

// Fully-fashioned decrease: the FF stitches at the edge each move one
// needle inward, so the innermost lands on (and stacks with) its
// neighbor and the edge needle ends up empty. `dir` is +1 to move right.
function ffMoves(edge, dir) {
  return range(0, FF).map((k) => ({ from: edge + dir * k, to: edge + dir * (k + 1) }));
}

// ── Courses ────────────────────────────────────────────────────────────
// A course is one row of fabric, knit by one or more `parts`:
//   { yarn, lo, hi, from, to, wrap }
// [lo, hi] is the part's live section (its outer SELVEDGE stitches knit
// plain), [from, to] the needles knit this course (narrower during short
// rows), and `wrap` an optional held needle to tuck at the turn.
function course(parts, typeAt, crosses = []) {
  const inPart = (x, p) => x >= p.lo + SELVEDGE && x <= p.hi - SELVEDGE && x >= p.from && x <= p.to;
  cross(
    crosses.filter((cr) =>
      parts.some((p) => inPart(cr.x, p) && inPart(cr.x + cr.left + cr.right - 1, p))
    )
  );

  const want = new Map();
  for (const p of parts) {
    for (let x = p.from; x <= p.to; x++) {
      const edge = x < p.lo + SELVEDGE || x > p.hi - SELVEDGE;
      want.set(x, edge ? "k" : typeAt(x));
    }
  }
  align(want);

  for (const p of parts) {
    const r = blank();
    for (let x = p.from; x <= p.to; x++) r[x] = knitOp(x);
    if (p.wrap != null) r[p.wrap] = bed[p.wrap] === "b" ? Op.BTUCK : Op.FTUCK;
    emit(r, p.yarn);
  }
}

// Body course c across the given parts, cables and all.
let c = 0;
function bodyCourse(parts, cables = true) {
  const cc = c++;
  course(parts, (x) => stitchAt(x, cc), cables ? crossesAt(cc) : []);
}

const whole = (yarn, lo, hi) => ({ yarn, lo, hi, from: lo, to: hi });

// ── 1. Rib hem ─────────────────────────────────────────────────────────
for (let i = 0; i < RIB_COURSES; i++) course([whole(1, 0, W - 1)], ribStitch);

// ── 2. Body ────────────────────────────────────────────────────────────
let lo = 0;
let hi = W - 1;
for (let i = 0; i < BODY_COURSES; i++) bodyCourse([whole(1, lo, hi)]);

// ── 3. Armholes ────────────────────────────────────────────────────────
// For now the armhole stitches are just left live, not bound off.
for (let x = 0; x < ARM_OFF; x++) {
  bed[lo + x] = null;
  bed[hi - x] = null;
}
lo += ARM_OFF;
hi -= ARM_OFF;
for (let i = 0; i < ARM_COURSES_BEFORE_NECK; i++) bodyCourse([whole(1, lo, hi)]);

// ── 4. Neck split ──────────────────────────────────────────────────────
// Center stitches get a few rows of waste yarn, then come off the
// needles. The waste yarn holds the neck's live loops for a neckband.
const live = hi - lo + 1;
const neckLo = lo + Math.floor((live - NECK_CENTER) / 2);
const neckHi = neckLo + NECK_CENTER - 1;

for (let i = 0; i < WASTE_COURSES; i++) {
  const r = blank();
  for (let x = neckLo; x <= neckHi; x++) r[x] = knitOp(x);
  emit(r, 3);
}
const drop = blank();
for (let x = neckLo; x <= neckHi; x++) {
  drop[x] = bed[x] === "b" ? Op.BDROP : Op.FDROP;
  bed[x] = null;
}
emit(drop, null);

// Yarn 1 carries on with whichever side its carrier finished on, so it
// doesn't float across the neck; yarn 2 comes in for the other side.
const endedRight = lastDir[1] === "right";
const left = { lo, hi: neckLo - 1, yarn: endedRight ? 2 : 1 };
const right = { lo: neckHi + 1, hi, yarn: endedRight ? 1 : 2 };
const sides = () => [whole(left.yarn, left.lo, left.hi), whole(right.yarn, right.lo, right.hi)];

// ── 5. Neckline shaping ────────────────────────────────────────────────
// Decrease every course at first to round the bottom of the neck, then
// every other course up the sides.
for (let d = 0; d < NECK_DECS; d++) {
  if (d >= NECK_FAST_DECS) bodyCourse(sides());
  bodyCourse(sides());
  shift([...ffMoves(left.hi, -1), ...ffMoves(right.lo, +1)]);
  left.hi--;
  right.lo++;
}
for (let i = 0; i < NECK_STRAIGHT; i++) bodyCourse(sides());

// ── 6. Short-row shoulders ─────────────────────────────────────────────
// Each shoulder holds `step` more needles at its armhole edge every time
// the carriage heads toward the armhole. The row that turns short tucks
// the first held needle (a machine "wrap") so no hole forms at the turn.
// Once every step is held, one full row knits across all needles. The
// knit/purl pattern carries on through the shoulders; the cables stop.
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
  const parts = [];
  const lp = leftPlan[i];
  if (lp) {
    const from = left.lo + lp.held;
    parts.push({ ...whole(left.yarn, left.lo, left.hi), from, wrap: lp.wrap ? from - 1 : null });
  }
  const rp = rightPlan[i];
  if (rp) {
    const to = right.hi - rp.held;
    parts.push({ ...whole(right.yarn, right.lo, right.hi), to, wrap: rp.wrap ? to + 1 : null });
  }
  bodyCourse(parts, false);
}

return {
  ops: new Bimp(W, rows.length, rows.flat()),
  yarnFeeder,
  racking,
  direction,
  palette: [MAIN, MAIN, WASTE],
};
