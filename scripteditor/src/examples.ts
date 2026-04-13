export interface Example {
  name: string;
  description: string;
  code: string;
}

function stripedRib(w: number, h: number): string {
  return `const w = ${w}, h = ${h};
const s = [], y = [];

for (let row = 0; row < h; row++) {
  const color = Math.floor(row / 2) % 2 + 1; // stripe every 2 rows
  for (let col = 0; col < w; col++) {
    s.push(col % 2 === 0 ? STITCHES.KNIT : STITCHES.PURL);
    y.push(color);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#a8dadc", "#e63946"],
};`;
}

export const EXAMPLES: Example[] = [
  {
    name: "Striped Rib 10\u00d710",
    description: "1\u00d71 rib with two-color stripes, 10\u00d710",
    code: stripedRib(10, 10),
  },
  {
    name: "Striped Rib 50\u00d750",
    description: "1\u00d71 rib with two-color stripes, 50\u00d750",
    code: stripedRib(50, 50),
  },
  {
    name: "Striped Rib 100\u00d7100",
    description: "1\u00d71 rib with two-color stripes, 100\u00d7100",
    code: stripedRib(100, 100),
  },
  {
    name: "Striped Rib 500\u00d7500",
    description: "1\u00d71 rib with two-color stripes, 500\u00d7500",
    code: stripedRib(500, 500),
  },
  {
    name: "Striped Rib 1000\u00d71000",
    description: "1\u00d71 rib with two-color stripes, 1000\u00d71000",
    code: stripedRib(1000, 1000),
  },
];
