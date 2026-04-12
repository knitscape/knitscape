import { stitches } from "../constants";
import type { Bimp, Vec2 } from "../../../shared/Bimp";
import type { KnitPath } from "../types";

function plotLine(
  [x0, y0]: Vec2,
  [x1, y1]: Vec2,
  offset: Vec2,
  chart: Bimp,
  tile: Bimp,
  mode: string,
  ignore: number
): Bimp {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  let lastX: number | null = x0;
  let lastY: number | null = y0;

  while (true) {
    if (mode == "overlap") {
      chart = chart.overlay(tile, [x0 + offset[0], y0 + offset[1]], ignore);
    } else if (mode == "tiled") {
      if (
        lastX == null ||
        lastY == null ||
        Math.abs(x0 - lastX) >= tile.width ||
        Math.abs(y0 - lastY) >= tile.height
      ) {
        chart = chart.overlay(tile, [x0 + offset[0], y0 + offset[1]], ignore);
        lastX = x0;
        lastY = y0;
      }
    } else if (mode == "xDiff") {
      if (x0 != lastX) {
        chart = chart.overlay(tile, [x0 + offset[0], y0 + offset[1]], ignore);
        lastX = x0;
        lastY = y0;
      }
    } else if (mode == "yDiff") {
      if (y0 != lastY) {
        chart = chart.overlay(tile, [x0 + offset[0], y0 + offset[1]], ignore);
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

  return chart;
}

export function pathTiling(
  stitchChart: Bimp,
  yarnChart: Bimp,
  { pts, offset, yarnBlock, stitchBlock, tileMode }: KnitPath
) {
  for (let i = 0; i < pts.length - 1; i++) {
    stitchChart = plotLine(
      pts[i],
      pts[i + 1],
      offset,
      stitchChart,
      stitchBlock,
      tileMode,
      stitches.TRANSPARENT
    );
    yarnChart = plotLine(
      pts[i],
      pts[i + 1],
      offset,
      yarnChart,
      yarnBlock,
      tileMode,
      0
    );
  }

  return { stitch: stitchChart, yarn: yarnChart };
}
