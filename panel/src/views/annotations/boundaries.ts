import { svg, html } from "lit-html";
import { GLOBAL_STATE } from "../../state";
import type { Vec2 } from "../../types";
import {
  moveBoundaryFill,
  editBoundaryFill,
  resizeFillBlock,
} from "../../interaction/boundaryInteraction";
import { pointAnnotation, slopeAnnotation } from "../paths";

function boundaryPoints(boundaryIndex: number, pts: Vec2[], cellWidth: number, cellHeight: number) {
  return pts.map(
    ([x, y]: Vec2, i: number) => svg`
<circle
  class="point"
  data-boundaryindex="${boundaryIndex}"
  data-index="${i}"
  cx="${x * cellWidth}"
  cy="${y * cellHeight}"
  r="6" />
${pointAnnotation(x, y, cellWidth, cellHeight)}
      `
  );
}

function boundaryPaths(boundaryIndex: number, pts: Vec2[], cellWidth: number, cellHeight: number) {
  let paths = [];
  for (let i = 0; i < pts.length; i++) {
    let [x1, y1] = pts[i];
    let [x2, y2] = pts[(i + 1) % pts.length];
    paths.push(
      svg`<line
      class="path bottom"
      data-boundaryindex="${boundaryIndex}"
      data-index="${i}"
      x1=${x1 * cellWidth}
      y1=${y1 * cellHeight}
      x2=${x2 * cellWidth}
      y2=${y2 * cellHeight}>
      </line>
      <line
      class="path top"
      data-boundaryindex="${boundaryIndex}"
      data-index="${i}"
      x1=${x1 * cellWidth}
      y1=${y1 * cellHeight}
      x2=${x2 * cellWidth}
      y2=${y2 * cellHeight}></line>
${slopeAnnotation(x1, y1, x2, y2, cellWidth, cellHeight)}`
    );
  }
  return paths;
}

export function boundaryBlocks() {
  const { selectedBoundary, regions, cellWidth, cellHeight, blockEditMode } =
    GLOBAL_STATE;
  if (blockEditMode == null || selectedBoundary == null) return;

  const { pos } = regions[selectedBoundary];

  return html`<div
    class="chart-block"
    style="left: ${Math.round(pos[0] * cellWidth)}px; bottom: ${Math.round(
      pos[1] * cellHeight
    )}px;">
    <canvas id="block-fill-canvas" @pointerdown=${editBoundaryFill}></canvas>
    <div class="block-inset-shadow"></div>
    <button class="move-block" @pointerdown=${(e: PointerEvent) => moveBoundaryFill(e)}>
      <i class="fa-solid fa-arrows-up-down-left-right"></i>
    </button>
    <button class="dragger up" @pointerdown=${(e: PointerEvent) => resizeFillBlock(e, "up")}>
      <i class="fa-solid fa-angle-up"></i>
    </button>
    <button
      class="dragger down"
      @pointerdown=${(e: PointerEvent) => resizeFillBlock(e, "down")}>
      <i class="fa-solid fa-angle-down"></i>
    </button>
    <button
      class="dragger left"
      @pointerdown=${(e: PointerEvent) => resizeFillBlock(e, "left")}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
    <button
      class="dragger right"
      @pointerdown=${(e: PointerEvent) => resizeFillBlock(e, "right")}>
      <i class="fa-solid fa-angle-right"></i>
    </button>
  </div>`;
}

function activeBoundary(boundaryIndex: number | string, boundary: Vec2[], cellWidth: number, cellHeight: number) {
  return svg`<path
      data-boundaryindex="${boundaryIndex}"
      class="boundary active" d="M ${boundary.reduce(
        (acc: string, [x, y]: Vec2) => `${acc} ${x * cellWidth} ${y * cellHeight}`,
        ""
      )} Z">`;
}

function inactiveBoundary(boundaryIndex: number | string, boundary: Vec2[], cellWidth: number, cellHeight: number) {
  return svg`<path
      data-boundaryindex="${boundaryIndex}"
      class="boundary inactive" d="M ${boundary.reduce(
        (acc: string, [x, y]: Vec2) => `${acc} ${x * cellWidth} ${y * cellHeight}`,
        ""
      )} Z">`;
}

export function backgroundBoundaryView() {
  let { boundaries, selectedBoundary, scale, cellAspect } = GLOBAL_STATE;
  const cellHeight = scale * cellAspect;

  return Object.entries(boundaries).map(([boundaryIndex, boundary]) => {
    if (Number(boundaryIndex) === selectedBoundary) {
      return activeBoundary(boundaryIndex, boundary, scale, cellHeight);
    } else {
      return inactiveBoundary(boundaryIndex, boundary, scale, cellHeight);
    }
  });
}

export function activeBoundaryPath() {
  let { boundaries, selectedBoundary, scale, cellAspect } = GLOBAL_STATE;
  if (selectedBoundary == null) return;

  const cellHeight = scale * cellAspect;

  return [
    boundaryPaths(
      selectedBoundary,
      boundaries[selectedBoundary],
      scale,
      cellHeight
    ),
    boundaryPoints(
      selectedBoundary,
      boundaries[selectedBoundary],
      scale,
      cellHeight
    ),
  ];
}
