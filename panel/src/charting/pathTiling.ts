import { stitches } from "@shared/stitches";
import { Bimp } from "@shared/Bimp";
import type { Vec2 } from "@shared/Bimp";
import type { KnitPath } from "../types";

// Stamps the tile along the line directly into `target`, which the caller owns.
// Every stamp used to allocate a change array and a fresh copy of the whole
// chart, so a long path cost O(pathLength * chartArea).
function plotLine(
  [x0, y0]: Vec2,
  [x1, y1]: Vec2,
  offset: Vec2,
  chart: Bimp,
  target: Uint8ClampedArray,
  tile: Bimp,
  mode: string,
  ignore: number
): void {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  let lastX: number | null = x0;
  let lastY: number | null = y0;

  const stamp = () =>
    chart.overlayInto(
      target,
      tile,
      [x0 + offset[0], y0 + offset[1]],
      ignore
    );

  while (true) {
    if (mode == "overlap") {
      stamp();
    } else if (mode == "tiled") {
      if (
        lastX == null ||
        lastY == null ||
        Math.abs(x0 - lastX) >= tile.width ||
        Math.abs(y0 - lastY) >= tile.height
      ) {
        stamp();
        lastX = x0;
        lastY = y0;
      }
    } else if (mode == "xDiff") {
      if (x0 != lastX) {
        stamp();
        lastX = x0;
        lastY = y0;
      }
    } else if (mode == "yDiff") {
      if (y0 != lastY) {
        stamp();
        lastX = x0;
        lastY = y0;
      }
    }

    if (x0 == x1 && y0 == y1) break;
    let e2 = 2 * error;
    if (e2 >= dy) {
      if (x0 == x1) break;
      error = error + dy;
      x0 = x0 + sx;
    }
    if (e2 <= dx) {
      if (y0 == y1) break;
      error = error + dx;
      y0 = y0 + sy;
    }
  }
}

export function pathTiling(
  stitchChart: Bimp,
  yarnChart: Bimp,
  { pts, offset, yarnBlock, stitchBlock, tileMode }: KnitPath
) {
  const stitchPixels = stitchChart.pixels.slice();
  const yarnPixels = yarnChart.pixels.slice();

  for (let i = 0; i < pts.length - 1; i++) {
    plotLine(
      pts[i],
      pts[i + 1],
      offset,
      stitchChart,
      stitchPixels,
      stitchBlock,
      tileMode,
      stitches.TRANSPARENT
    );
    plotLine(
      pts[i],
      pts[i + 1],
      offset,
      yarnChart,
      yarnPixels,
      yarnBlock,
      tileMode,
      0
    );
  }

  return {
    stitch: Bimp.adopt(stitchChart.width, stitchChart.height, stitchPixels),
    yarn: Bimp.adopt(yarnChart.width, yarnChart.height, yarnPixels),
  };
}
