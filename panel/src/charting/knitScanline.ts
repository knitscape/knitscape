import { stitches } from "@shared/stitches";
import { Bimp } from "@shared/Bimp";
import type { Boundary, Region } from "../types";

interface Edge {
  x: number;
  yMin: number;
  yMax: number;
  dx: number;
  xLast: number;
}

function addEdge(edgeTable: Edge[], [x1, y1]: [number, number], [x2, y2]: [number, number]) {
  if (y1 === y2) return; // Skip horizontal edges

  if (y1 > y2) {
    [x1, x2] = [x2, x1];
    [y1, y2] = [y2, y1];
  }

  let dx = (x2 - x1) / (y2 - y1);

  edgeTable.push({
    x: x1 + dx / 2,
    yMin: y1,
    yMax: y2,
    dx,
    xLast: x1,
  });
}

// Horizontal run, inclusive of both ends — matches what Bimp.line() produces
// for two points that share a y, without copying the chart.
function hLine(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xA: number,
  xB: number,
  y: number,
  color: number
) {
  if (y < 0 || y >= height) return;
  const from = Math.min(xA, xB);
  const to = Math.max(xA, xB);
  const rowStart = y * width;
  for (let x = Math.max(from, 0); x <= Math.min(to, width - 1); x++) {
    pixels[rowStart + x] = color;
  }
}

function applyShaping(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  y: number,
  xLeft: number,
  xRight: number,
  edgeLeft: Edge,
  edgeRight: Edge,
  shaping: number
) {
  if (shaping < 1) return;
  let diffLeft = xLeft - edgeLeft.xLast;
  let diffRight = xRight - edgeRight.xLast;

  if (Math.abs(edgeLeft.dx) <= 1) {
    if (diffLeft === 1) {
      hLine(pixels, width, height, edgeLeft.xLast, edgeLeft.xLast + shaping - 1, y - 1, stitches.FXR1);
    } else if (diffLeft === -1) {
      hLine(pixels, width, height, edgeLeft.xLast, edgeLeft.xLast + shaping - 1, y - 1, stitches.FXL1);
    }
  }

  if (Math.abs(edgeRight.dx) <= 1) {
    if (diffRight === -1) {
      hLine(pixels, width, height, edgeRight.xLast - shaping, edgeRight.xLast - 1, y - 1, stitches.FXL1);
    } else if (diffRight === 1) {
      hLine(pixels, width, height, edgeRight.xLast - shaping, edgeRight.xLast - 1, y - 1, stitches.FXR1);
    }
  }

  edgeLeft.xLast = xLeft;
  edgeRight.xLast = xRight;
}

export function knitScanline(
  stitchChart: Bimp,
  yarnChart: Bimp,
  points: Boundary,
  { stitchBlock, yarnBlock, pos, shaping }: Region
) {
  let edges: Edge[] = [];

  for (let i = 0; i < points.length; i++) {
    addEdge(edges, points[i], points[(i + 1) % points.length]);
  }

  edges.sort((a, b) => a.yMin - b.yMin); // sort edges by their min y

  // The scanline used to call Bimp.draw() twice per span, and each call copied
  // both charts in full — so filling an H-row boundary cost O(H) whole-chart
  // copies. Write into one buffer per chart instead and wrap them up at the end.
  const { width, height } = stitchChart;
  const stitchPixels = stitchChart.pixels.slice();
  const yarnPixels = yarnChart.pixels.slice();

  let activeEdges: Edge[] = [];
  let y = 0;

  // If there are still edges left to process
  while (edges.length > 0 || activeEdges.length > 0) {
    while (edges.length > 0) {
      // while there are still edges we haven't processed
      if (edges[0].yMin == y) {
        // add any edges that start at or below the current Y value
        activeEdges.push(edges.shift()!);
      } else break;
    }

    activeEdges.sort((a, b) => a.x - b.x); // sort active edges by x

    for (let i = 0; i < activeEdges.length; i = i + 2) {
      if (i + 1 >= activeEdges.length) {
        console.error("index out of range");
        continue;
      }

      const xLeft = Math.round(activeEdges[i].x);
      const xRight = Math.round(activeEdges[i + 1].x);

      if (xLeft == xRight) continue;

      const inRow = y >= 0 && y < height;
      const rowStart = y * width;
      const xFrom = Math.max(xLeft, 0);
      const xTo = Math.min(xRight, width);

      let SBy = (y - pos[1]) % stitchBlock.height;

      if (inRow) {
        for (let x = xFrom; x < xTo; x++) {
          let SBx = (x - pos[0]) % stitchBlock.width;

          let operation = stitchBlock.pixelAt(SBx, SBy);
          if (operation == stitches.TRANSPARENT) continue;
          stitchPixels[rowStart + x] = operation;
        }

        // Apply the yarn block texture
        let YBy = (y - pos[1]) % yarnBlock.height;

        for (let x = xFrom; x < xTo; x++) {
          let YBx = (x - pos[0]) % yarnBlock.width;

          let yarnColor = yarnBlock.pixelAt(YBx, YBy);

          if (yarnColor == 0) {
            // if there's no assigned yarn check what's below it in the chart
            if (yarnPixels[rowStart + x] == 0) {
              // if it's also transparent, assign yarn index 1 to make sure we have a yarn
              yarnPixels[rowStart + x] = 1;
            }
            continue;
          }
          yarnPixels[rowStart + x] = yarnColor;
        }
      }

      applyShaping(
        stitchPixels,
        width,
        height,
        y,
        xLeft,
        xRight,
        activeEdges[i],
        activeEdges[i + 1],
        shaping
      );
    }

    y++;

    // filter out any edges we've passed
    activeEdges = activeEdges.filter((edge) => edge.yMax > y);

    // update the x value for each edge
    for (let i = 0; i < activeEdges.length; i++) {
      activeEdges[i].x += activeEdges[i].dx;
    }
  }

  return {
    stitch: Bimp.adopt(width, height, stitchPixels),
    // stitchChart and yarnChart are always allocated at the same size, which is
    // what lets the two buffers share one row-index calculation above.
    yarn: Bimp.adopt(width, height, yarnPixels),
  };
}
