import type { Vec2 } from "./Vec2";

// Re-exported so `import type { Bimp, Vec2 } from "@shared/Bimp"` keeps working.
export type { Vec2 };

export interface BimpJSON {
  width: number;
  height: number;
  pixels: number[];
}

export interface PixelChange {
  x: number;
  y: number;
  color: number;
}

export interface IndexedChange {
  index: number;
  color: number;
}

export type PaletteEntry = string | { color: string; label?: string };

export class Bimp {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  // Optional so the editors that track palette separately (panel, structure)
  // are unaffected; knitbit's scripting API carries it on the bitmap itself.
  palette?: PaletteEntry[];

  constructor(
    width: number,
    height: number,
    pixels: ArrayLike<number>,
    palette?: PaletteEntry[]
  ) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(pixels);
    if (palette) this.palette = palette;
  }

  // Takes ownership of `pixels` instead of copying it. Only safe when the
  // caller just allocated the array and holds no other reference to it.
  static adopt(
    width: number,
    height: number,
    pixels: Uint8ClampedArray,
    palette?: PaletteEntry[]
  ): Bimp {
    const bimp: Bimp = Object.create(Bimp.prototype);
    bimp.width = width;
    bimp.height = height;
    bimp.pixels = pixels;
    if (palette) bimp.palette = palette;
    return bimp;
  }

  static fromJSON(jsonObj: BimpJSON): Bimp {
    return new Bimp(jsonObj.width, jsonObj.height, jsonObj.pixels);
  }

  static empty(width: number, height: number, color: number): Bimp {
    const pixels = new Uint8ClampedArray(width * height);
    if (color !== 0) pixels.fill(color);
    return Bimp.adopt(width, height, pixels);
  }

  static fromTile(width: number, height: number, tile: Bimp): Bimp {
    const tiled = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiled[x + y * width] = tile.pixel(x % tile.width, y % tile.height);
      }
    }
    return Bimp.adopt(width, height, tiled, tile.palette);
  }

  overlay(overlayBimp: Bimp, pos: Vec2, skip?: number, avoid?: number): Bimp {
    const copy = this.pixels.slice();
    this.overlayInto(copy, overlayBimp, pos, skip, avoid);
    return Bimp.adopt(this.width, this.height, copy, this.palette);
  }

  // Writes an overlay straight into a pixel buffer. Lets callers that stamp the
  // same tile many times (path tiling) pay for one buffer copy instead of one
  // copy plus a change-object array per stamp.
  overlayInto(
    target: Uint8ClampedArray,
    overlayBimp: Bimp,
    pos: Vec2,
    skip?: number,
    avoid?: number
  ): void {
    for (let y = 0; y < overlayBimp.height; y++) {
      const ty = pos[1] + y;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < overlayBimp.width; x++) {
        const color = overlayBimp.pixel(x, y);
        if (skip !== undefined && skip !== null && color === skip) continue;
        if (avoid !== undefined && avoid !== null && this.pixel(x, y) === avoid)
          continue;
        const tx = pos[0] + x;
        if (tx < 0 || tx >= this.width) continue;
        target[tx + ty * this.width] = color;
      }
    }
  }

  toJSON(): BimpJSON {
    return {
      pixels: Array.from(this.pixels),
      width: this.width,
      height: this.height,
    };
  }

  pad(paddingX: number, paddingY: number, color: number): Bimp {
    const filled = Array(paddingY * (this.width + 2 * paddingX)).fill(color);
    const col = Array(paddingX).fill(color);
    const twod = this.make2d();
    return new Bimp(
      this.width + 2 * paddingX,
      this.height + 2 * paddingY,
      [
        ...twod.reduce(
          (acc: number[], row: number[]) => [...acc, ...col, ...row, ...col],
          [...filled]
        ),
        ...filled,
      ],
      this.palette
    );
  }

  resize(width: number, height: number, emptyColor: number = 0): Bimp {
    const resized = new Uint8ClampedArray(width * height);
    if (emptyColor !== 0) resized.fill(emptyColor);
    const copyWidth = Math.min(width, this.width);
    const copyHeight = Math.min(height, this.height);
    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        resized[x + y * width] = this.pixels[x + y * this.width];
      }
    }
    return Bimp.adopt(width, height, resized, this.palette);
  }

  make2d(): number[][] {
    const rows: number[][] = new Array(this.height);
    for (let y = 0; y < this.height; y++) {
      const row: number[] = new Array(this.width);
      const start = y * this.width;
      for (let x = 0; x < this.width; x++) row[x] = this.pixels[start + x];
      rows[y] = row;
    }
    return rows;
  }

  vMirror(): Bimp {
    return this.vFlip();
  }

  vFlip(): Bimp {
    const out = new Uint8ClampedArray(this.pixels.length);
    for (let y = 0; y < this.height; y++) {
      const src = y * this.width;
      const dst = (this.height - 1 - y) * this.width;
      for (let x = 0; x < this.width; x++) out[dst + x] = this.pixels[src + x];
    }
    return Bimp.adopt(this.width, this.height, out, this.palette);
  }

  hFlip(): Bimp {
    const out = new Uint8ClampedArray(this.pixels.length);
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        out[row + (this.width - 1 - x)] = this.pixels[row + x];
      }
    }
    return Bimp.adopt(this.width, this.height, out, this.palette);
  }

  // ── Composition ──────────────────────────────────────────────────────────

  crop(x: number, y: number, w: number, h: number): Bimp {
    const out = new Uint8ClampedArray(w * h);
    for (let j = 0; j < h; j++) {
      const sy = y + j;
      if (sy < 0 || sy >= this.height) continue;
      for (let i = 0; i < w; i++) {
        const sx = x + i;
        if (sx < 0 || sx >= this.width) continue;
        out[i + j * w] = this.pixels[sx + sy * this.width];
      }
    }
    return Bimp.adopt(w, h, out, this.palette);
  }

  concat(other: Bimp, axis: "x" | "y"): Bimp {
    if (axis === "x") {
      if (this.height !== other.height)
        throw new Error("concat axis=x requires matching height");
      const w = this.width + other.width;
      const out = new Uint8ClampedArray(w * this.height);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++)
          out[x + y * w] = this.pixels[x + y * this.width];
        for (let x = 0; x < other.width; x++)
          out[this.width + x + y * w] = other.pixels[x + y * other.width];
      }
      return Bimp.adopt(w, this.height, out, this.palette);
    }
    if (axis === "y") {
      if (this.width !== other.width)
        throw new Error("concat axis=y requires matching width");
      const h = this.height + other.height;
      const out = new Uint8ClampedArray(this.width * h);
      out.set(this.pixels, 0);
      out.set(other.pixels, this.pixels.length);
      return Bimp.adopt(this.width, h, out, this.palette);
    }
    throw new Error(`concat axis must be "x" or "y"`);
  }

  repeat(nx: number, ny: number): Bimp {
    return Bimp.fromTile(this.width * nx, this.height * ny, this);
  }

  trim(bgColor: number = 0): Bimp {
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.pixels[x + y * this.width] !== bgColor) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return new Bimp(0, 0, [], this.palette);
    return this.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  // ── Rotation / transpose ─────────────────────────────────────────────────

  rotate90(): Bimp {
    const w = this.height;
    const h = this.width;
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // (x, y) → (w - 1 - y, x) in the rotated frame
        out[this.height - 1 - y + x * w] = this.pixels[x + y * this.width];
      }
    }
    return Bimp.adopt(w, h, out, this.palette);
  }

  rotate180(): Bimp {
    const out = new Uint8ClampedArray(this.pixels.length);
    for (let i = 0; i < this.pixels.length; i++) {
      out[this.pixels.length - 1 - i] = this.pixels[i];
    }
    return Bimp.adopt(this.width, this.height, out, this.palette);
  }

  rotate270(): Bimp {
    const w = this.height;
    const h = this.width;
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // (x, y) → (y, h - 1 - x)
        out[y + (this.width - 1 - x) * w] = this.pixels[x + y * this.width];
      }
    }
    return Bimp.adopt(w, h, out, this.palette);
  }

  transpose(): Bimp {
    const w = this.height;
    const h = this.width;
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out[y + x * w] = this.pixels[x + y * this.width];
      }
    }
    return Bimp.adopt(w, h, out, this.palette);
  }

  // ── Value mapping ────────────────────────────────────────────────────────

  map(fn: (value: number, x: number, y: number) => number): Bimp {
    const out = new Uint8ClampedArray(this.pixels.length);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;
        out[i] = fn(this.pixels[i], x, y);
      }
    }
    return Bimp.adopt(this.width, this.height, out, this.palette);
  }

  replace(oldColor: number, newColor: number): Bimp {
    return this.map((v) => (v === oldColor ? newColor : v));
  }

  remap(table: Record<number, number> | number[]): Bimp {
    const isArr = Array.isArray(table);
    return this.map((v) => {
      const replacement = isArr
        ? (table as number[])[v]
        : (table as Record<number, number>)[v];
      return replacement === undefined ? v : replacement;
    });
  }

  // ── Inspection ───────────────────────────────────────────────────────────

  uniqueValues(): number[] {
    const seen = new Set<number>();
    for (let i = 0; i < this.pixels.length; i++) seen.add(this.pixels[i]);
    return Array.from(seen).sort((a, b) => a - b);
  }

  count(color: number): number {
    let n = 0;
    for (let i = 0; i < this.pixels.length; i++) {
      if (this.pixels[i] === color) n++;
    }
    return n;
  }

  equals(other: Bimp): boolean {
    if (this.width !== other.width || this.height !== other.height)
      return false;
    if (this.pixels.length !== other.pixels.length) return false;
    for (let i = 0; i < this.pixels.length; i++) {
      if (this.pixels[i] !== other.pixels[i]) return false;
    }
    return true;
  }

  forEach(fn: (value: number, x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(this.pixels[x + y * this.width], x, y);
      }
    }
  }

  // ── Palette helpers ──────────────────────────────────────────────────────

  withPalette(palette?: PaletteEntry[]): Bimp {
    return new Bimp(this.width, this.height, this.pixels, palette);
  }

  // ── Pixel access ─────────────────────────────────────────────────────────

  pixel(x: number, y: number): number {
    if (x > this.width - 1 || x < 0 || y > this.height - 1 || y < 0) return -1;
    return this.pixels[x + y * this.width];
  }

  pixelAt(x: number, y: number): number {
    if (x >= this.width || y >= this.height) return -1;
    if (x < 0) x = this.width + x;
    if (y < 0) y = this.height + y;
    if (x < 0 || y < 0) return -1;
    return this.pixels[x + y * this.width];
  }

  // ── Drawing ──────────────────────────────────────────────────────────────

  draw(changes: PixelChange[]): Bimp {
    const copy = this.pixels.slice();
    for (const { x, y, color } of changes) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
      copy[x + y * this.width] = color;
    }
    return Bimp.adopt(this.width, this.height, copy, this.palette);
  }

  indexedDraw(changes: IndexedChange[]): Bimp {
    const copy = this.pixels.slice();
    for (const { index, color } of changes) {
      if (index >= this.pixels.length) continue;
      copy[index] = color;
    }
    return Bimp.adopt(this.width, this.height, copy, this.palette);
  }

  indexedBrush(index: number, color: number): Bimp {
    return this.indexedDraw([{ index, color }]);
  }

  brush(pos: Vec2, color: number): Bimp {
    return this.draw([{ x: pos[0], y: pos[1], color }]);
  }

  circle(center: Vec2, radius: number, color: number): Bimp {
    const [cx, cy] = center;
    const changes: PixelChange[] = [];
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) changes.push({ x, y, color });
      }
    }
    return this.draw(changes);
  }

  flood(pos: Vec2, color: number): Bimp {
    const targetColor = this.pixel(pos[0], pos[1]);
    if (targetColor === color) return this.draw([]);
    const around: Vec2[] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const drawn: PixelChange[] = [{ x: pos[0], y: pos[1], color }];
    // Membership set keyed by flat index, so the "already queued?" check stays
    // O(1) instead of scanning the whole frontier for every candidate.
    const seen = new Set<number>([pos[0] + pos[1] * this.width]);
    for (let done = 0; done < drawn.length; done++) {
      for (const [dx, dy] of around) {
        const x = drawn[done].x + dx;
        const y = drawn[done].y + dy;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
        const index = x + y * this.width;
        if (seen.has(index) || this.pixels[index] !== targetColor) continue;
        seen.add(index);
        drawn.push({ x, y, color });
      }
    }
    return this.draw(drawn);
  }

  shift(dx: number, dy: number): Bimp {
    const changes: PixelChange[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        changes.push({
          x: (x - (dx % this.width) + this.width) % this.width,
          y: (y - (dy % this.height) + this.height) % this.height,
          color: this.pixel(x, y),
        });
      }
    }
    return this.draw(changes);
  }

  rect(start: Vec2, end: Vec2, color: number): Bimp {
    const xStart = Math.min(start[0], end[0]);
    const yStart = Math.min(start[1], end[1]);
    const xEnd = Math.max(start[0], end[0]);
    const yEnd = Math.max(start[1], end[1]);
    const changes: PixelChange[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        changes.push({ x, y, color });
      }
    }
    return this.draw(changes);
  }

  line(from: Vec2, to: Vec2, color: number): Bimp {
    if (from[0] === to[0] && from[1] === to[1])
      return this.draw([{ x: from[0], y: from[1], color }]);
    const changes: PixelChange[] = [];
    if (Math.abs(from[0] - to[0]) > Math.abs(from[1] - to[1])) {
      if (from[0] > to[0]) [from, to] = [to, from];
      const slope = (to[1] - from[1]) / (to[0] - from[0]);
      let y = from[1];
      for (let x = from[0]; x <= to[0]; x++) {
        changes.push({ x, y: Math.round(y), color });
        y += slope;
      }
    } else {
      if (from[1] > to[1]) [from, to] = [to, from];
      const slope = (to[0] - from[0]) / (to[1] - from[1]);
      let x = from[0];
      for (let y = from[1]; y <= to[1]; y++) {
        changes.push({ x: Math.round(x), y, color });
        x += slope;
      }
    }
    return this.draw(changes);
  }
}
