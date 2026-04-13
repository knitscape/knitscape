export interface Example {
  name: string;
  description: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Checkerboard",
    description: "Alternating KNIT/PURL with two colors",
    code: `const w = 20, h = 20;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    s.push((col + row) % 2 === 0 ? STITCHES.KNIT : STITCHES.PURL);
    y.push((col + row) % 2 === 0 ? 1 : 2);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#08ccab", "#eb4034"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Rule 90 — Sierpinski",
    description: "1D cellular automaton: new cell = left XOR right. Generates the Sierpinski triangle fractal from a single seed.",
    code: `// Rule 90 elementary cellular automaton.
// Each cell becomes XOR of its two neighbors.
// A single central seed unfolds into the Sierpinski triangle.
const w = 41, h = 41;

const rows = [];
let cur = new Uint8Array(w);
cur[Math.floor(w / 2)] = 1; // single seed

for (let i = 0; i < h; i++) {
  rows.push(Array.from(cur));
  const next = new Uint8Array(w);
  for (let c = 0; c < w; c++) {
    const l = c > 0 ? cur[c - 1] : 0;
    const r = c < w - 1 ? cur[c + 1] : 0;
    next[c] = l ^ r;
  }
  cur = next;
}
rows.reverse(); // seed at top of display

const s = [], y = [];
for (const row of rows) {
  for (const v of row) {
    s.push(STITCHES.KNIT);
    y.push(v ? 2 : 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#d4d4d4", "#1a1a1a"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Rule 30 — Chaos",
    description: "Wolfram's Rule 30: a simple 1D rule that generates cryptographic-quality randomness from a single seed.",
    code: `// Rule 30 elementary cellular automaton.
// new cell = left XOR (center OR right)
// Produces chaotic output — used in Mathematica's random number generator.
const w = 51, h = 40;

const rows = [];
let cur = new Uint8Array(w);
cur[Math.floor(w / 2)] = 1;

for (let i = 0; i < h; i++) {
  rows.push(Array.from(cur));
  const next = new Uint8Array(w);
  for (let c = 0; c < w; c++) {
    const l = c > 0 ? cur[c - 1] : 0;
    const m = cur[c];
    const r = c < w - 1 ? cur[c + 1] : 0;
    next[c] = (30 >> ((l << 2) | (m << 1) | r)) & 1;
  }
  cur = next;
}
rows.reverse(); // seed at top

const s = [], y = [];
for (const row of rows) {
  for (const v of row) {
    s.push(STITCHES.KNIT);
    y.push(v ? 2 : 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#f0ead2", "#6b4226"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Thue-Morse 2D",
    description: "Self-similar fractal from the Thue-Morse substitution sequence applied in 2D. Zooming out reveals the same pattern.",
    code: `// Thue-Morse sequence in 2D.
// Color of cell (x, y) = parity of the number of 1-bits in (x XOR y).
// This creates a self-similar fractal: every zoom level looks the same.
const w = 32, h = 32;

function popcount(n) {
  let count = 0;
  while (n > 0) { count += n & 1; n >>>= 1; }
  return count;
}

const s = [], y = [];
for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    const tm = popcount(col ^ row) & 1;
    s.push(STITCHES.KNIT);
    y.push(tm + 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#f9f7f7", "#112d4e"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Sine Interference",
    description: "Two overlapping sine waves in orthogonal directions create moiré interference patterns.",
    code: `// Two sine waves — one horizontal, one vertical — sum to create
// interference (moiré) patterns. Adjusting frequencies changes the pattern.
const w = 40, h = 40;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    const v1 = Math.sin((col / w) * Math.PI * 8 + row * 0.15);
    const v2 = Math.sin((row / h) * Math.PI * 6 - col * 0.12);
    const combined = (v1 + v2 + 2) / 4; // normalize to [0, 1]
    const band = Math.min(Math.floor(combined * 3), 2);
    s.push(STITCHES.KNIT);
    y.push(band + 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#f4a261", "#e76f51", "#264653"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Voronoi Cells",
    description: "Each stitch takes the color of its nearest seed point, partitioning the chart into organic Voronoi regions.",
    code: `// Voronoi diagram: each cell is colored by its nearest seed point.
// The seed positions are deterministic (hashed from their index).
const w = 36, h = 36;

function hash(n) {
  n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) | 0;
  n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) | 0;
  return (n ^ (n >>> 16)) >>> 0;
}

const N_SEEDS = 12;
const seeds = Array.from({ length: N_SEEDS }, (_, i) => [
  (hash(i * 73 + 1) / 0x100000000) * w,
  (hash(i * 73 + 2) / 0x100000000) * h,
]);

const palette = ["#e9c46a", "#f4a261", "#e76f51", "#264653"];

const s = [], y = [];
for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    let minDist = Infinity, nearest = 0;
    for (let i = 0; i < seeds.length; i++) {
      const dx = col - seeds[i][0], dy = row - seeds[i][1];
      const d = dx * dx + dy * dy;
      if (d < minDist) { minDist = d; nearest = i; }
    }
    s.push(STITCHES.KNIT);
    y.push((nearest % palette.length) + 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette,
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Binary Counter",
    description: "Column k shows bit k of the row number. The pattern directly visualizes binary representation.",
    code: `// Binary counter: each row is a binary number, each column a bit.
// Column 0 = least significant bit. Reading right-to-left gives the row count.
// PURL marks 1-bits, KNIT marks 0-bits — texture mirrors the color.
const w = 16, h = 32;
const s = [], y = [];

// Row 0 = count 0, pushed first → appears at bottom (y=0)
for (let count = 0; count < h; count++) {
  for (let col = 0; col < w; col++) {
    const bit = (count >> col) & 1;
    s.push(bit ? STITCHES.PURL : STITCHES.KNIT);
    y.push(bit ? 2 : 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#f1faee", "#457b9d"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Diamond Lattice",
    description: "Argyle-style diamonds using Manhattan distance on a 45°-rotated grid.",
    code: `// Diamond (argyle) pattern using Manhattan distance on rotated axes.
// Rotating coordinates 45° turns circles into diamonds.
const w = 32, h = 40;
const PERIOD = 10;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    // Rotate grid 45° by using diagonal sums/differences
    const u = ((col + row) % PERIOD + PERIOD) % PERIOD;
    const v = ((col - row) % PERIOD + PERIOD) % PERIOD;
    const dist = Math.abs(u - PERIOD / 2) + Math.abs(v - PERIOD / 2);
    s.push(STITCHES.KNIT);
    y.push(dist < PERIOD / 2 ? 1 : 2);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#c77dff", "#10002b"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Concentric Rings",
    description: "Euclidean distance from center creates concentric rings — a simple distance-field pattern.",
    code: `// Distance field: Euclidean distance from the chart center creates rings.
// Varying the ring width or count changes the visual density.
const w = 32, h = 32;
const s = [], y = [];
const cx = (w - 1) / 2, cy = (h - 1) / 2;
const RING_WIDTH = 3;

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    const dx = col - cx, dy = row - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ring = Math.floor(dist / RING_WIDTH) % 3;
    s.push(STITCHES.KNIT);
    y.push(ring + 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#cdb4db", "#a2d2ff", "#bde0fe"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Value Noise",
    description: "Bilinear interpolation between hashed grid values creates smooth, cloud-like blobs of color.",
    code: `// Value noise: random values at integer grid points, bilinearly interpolated.
// Smooth transitions between colors emerge from simple hashing.
const w = 36, h = 36;

function hash(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + 1013904223;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function lerp(a, b, t) { return a + (b - a) * t; }

function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
  return lerp(
    lerp(hash(xi, yi),     hash(xi + 1, yi),     xf),
    lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), xf),
    yf
  );
}

const SCALE = 6; // lower = larger blobs
const s = [], y = [];
for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    const n = noise(col / SCALE, row / SCALE);
    const v = n < 0.38 ? 1 : n < 0.68 ? 2 : 3;
    s.push(STITCHES.KNIT);
    y.push(v);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#fefee3", "#fcbf49", "#d62828"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Rib & Seed Textures",
    description: "Bands of different stitch textures (plain knit, 1×1 rib, purl, seed stitch) with two-color horizontal stripes.",
    code: `// Four stitch textures cycle every 4 rows; color changes every 8 rows.
// Toggle to 'operation' mode to see the stitch structure clearly.
const w = 24, h = 32;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  const band = Math.floor(row / 4) % 4;
  const color = Math.floor(row / 8) % 2 + 1;
  for (let col = 0; col < w; col++) {
    let stitch;
    if (band === 0) {
      stitch = STITCHES.KNIT;                             // plain knit
    } else if (band === 1) {
      stitch = col % 2 === 0 ? STITCHES.KNIT : STITCHES.PURL; // 1×1 rib
    } else if (band === 2) {
      stitch = STITCHES.PURL;                             // all purl
    } else {
      stitch = (col + row) % 2 === 0 ? STITCHES.KNIT : STITCHES.PURL; // seed
    }
    s.push(stitch);
    y.push(color);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#a8dadc", "#457b9d"],
};`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Fractal XOR Quilt",
    description: "Bitwise XOR of coordinates, shifted right by 2, gives a recursive quilt pattern at 4 color levels.",
    code: `// XOR quilt: color = (col XOR row) shifted right, masked to 2 bits.
// The bit-shift controls the "zoom level" of the recursion.
// Try changing >> 2 to >> 1 or >> 3 for different scales.
const w = 32, h = 32;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    const v = ((col ^ row) >> 2) & 3;
    s.push(STITCHES.KNIT);
    y.push(v + 1);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#d8f3dc", "#74c69d", "#40916c", "#1b4332"],
};`,
  },
];
