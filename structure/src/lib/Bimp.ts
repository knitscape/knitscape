import type { Vec2, PixelChange, BimpJSON } from "../types";

export class Bimp {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;

  constructor(width: number, height: number, pixels: ArrayLike<number>) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(pixels);
  }

  static fromJSON(jsonObj: BimpJSON): Bimp {
    return new Bimp(jsonObj.width, jsonObj.height, jsonObj.pixels);
  }

  static empty(width: number, height: number, color: number): Bimp {
    const pixels = new Array(width * height).fill(color);
    return new Bimp(width, height, pixels);
  }

  static fromTile(width: number, height: number, tile: Bimp): Bimp {
    const tiled: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiled.push(tile.pixel(x % tile.width, y % tile.height));
      }
    }

    return new Bimp(width, height, tiled);
  }

  overlay(overlayBimp: Bimp, pos: Vec2): Bimp {
    const changes: PixelChange[] = [];
    for (let y = 0; y < overlayBimp.height; y++) {
      for (let x = 0; x < overlayBimp.width; x++) {
        changes.push({
          x: pos[0] + x,
          y: pos[1] + overlayBimp.height - y - 1,
          color: overlayBimp.pixel(x, y),
        });
      }
    }

    return this.draw(changes);
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

    return new Bimp(this.width + 2 * paddingX, this.height + 2 * paddingY, [
      ...twod.reduce(
        (acc: number[], row: number[]) => {
          return [...acc, ...col, ...row, ...col];
        },
        [...filled]
      ),
      ...filled,
    ]);
  }

  resize(width: number, height: number, emptyColor: number = 0): Bimp {
    const resized: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y >= this.height || x >= this.width) {
          resized.push(emptyColor);
        } else {
          resized.push(this.pixel(x, y));
        }
      }
    }
    return new Bimp(width, height, resized);
  }

  make2d(): number[][] {
    const copy = Array.from(this.pixels).slice();
    const newArray: number[][] = [];
    while (copy.length > 0) newArray.push(copy.splice(0, this.width));
    return newArray;
  }

  vMirror(): Bimp {
    return new Bimp(this.width, this.height, this.make2d().toReversed().flat());
  }

  vFlip(): Bimp {
    return new Bimp(this.width, this.height, this.make2d().toReversed().flat());
  }

  pixel(x: number, y: number): number {
    if (x > this.width - 1 || x < 0 || y > this.height - 1 || y < 0) {
      return -1;
    }
    return this.pixels.at(x + y * this.width)!;
  }

  draw(changes: PixelChange[]): Bimp {
    const copy = this.pixels.slice();
    for (const { x, y, color } of changes) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
      copy[x + y * this.width] = color;
    }
    return new Bimp(this.width, this.height, copy);
  }

  brush(pos: Vec2, color: number): Bimp {
    const drawn: PixelChange = { x: pos[0], y: pos[1], color };
    return this.draw([drawn]);
  }

  flood(pos: Vec2, color: number): Bimp {
    const targetColor = this.pixel(pos[0], pos[1]);
    if (targetColor === color) return this.draw([]);

    const around = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    const drawn: PixelChange[] = [{ x: pos[0], y: pos[1], color }];
    for (let done = 0; done < drawn.length; done++) {
      for (const { dx, dy } of around) {
        const x = drawn[done].x + dx;
        const y = drawn[done].y + dy;
        if (
          x >= 0 &&
          x < this.width &&
          y >= 0 &&
          y < this.height &&
          this.pixel(x, y) == targetColor &&
          !drawn.some((p) => p.x == x && p.y == y)
        ) {
          drawn.push({ x, y, color });
        }
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
