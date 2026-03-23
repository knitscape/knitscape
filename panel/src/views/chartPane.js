import { html, svg } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { classMap } from "lit-html/directives/class-map.js";

import { GLOBAL_STATE } from "../state";

import {
  chartContextMenu,
  chartPointerDown,
} from "../interaction/chartInteraction";
import { zoom } from "../interaction/chartPanZoom";

import {
  backgroundBoundaryView,
  activeBoundaryPath,
  boundaryBlocks,
} from "./annotations/boundaries";
import { blocks } from "./annotations/blocks";

import { backgroundPathView, activePath, pathTiles } from "./paths";
import { stitchSelectBox } from "./annotations/selectBox";
import { currentTargetPointerPos } from "../utilities/misc";

import { bottomBar } from "./bottomBar";
import { modeToolbar } from "./toolbars";
import { pickers } from "./pickers";

function trackPointer(e) {
  const { cellWidth, cellHeight, chartPan, bbox } = GLOBAL_STATE;
  let [x, y] = currentTargetPointerPos(e);

  GLOBAL_STATE.pointer = [
    Math.floor((x - chartPan.x) / cellWidth - bbox.xMin),
    Math.floor((y - chartPan.y) / cellHeight - bbox.yMin),
  ];
}

// function pointerCellHighlight() {
//   const {
//     cellWidth,
//     cellHeight,
//     chart,
//     transforming,
//     pointer: [x, y],
//   } = GLOBAL_STATE;

//   if (transforming || x < 0 || y < 0 || x >= chart.width || y >= chart.height)
//     return;

//   return svg`<rect
//       class="cell-highlight"
//       transform="translate(${x * cellWidth + 2} ${y * cellHeight + 2})"
//       filter="url(#path-shadow)"
//       width=${cellWidth - 3}
//       height=${cellHeight - 3}></rect>`;
// }

export function chartPaneView() {
  const {
    cellWidth,
    cellHeight,
    chartPan,
    chart,
    bbox,
    transforming,
    interactionMode,
    stitchSelect,
    annotations,
  } = GLOBAL_STATE;

  const offsetX = Math.round(bbox.xMin * cellWidth);
  const offsetY = Math.round(bbox.yMin * cellHeight);

  const w = Math.round(cellWidth * chart.width);
  const h = Math.round(cellHeight * chart.height);

  const classes = {
    allowHover:
      !transforming &&
      (interactionMode == "boundary" || interactionMode == "path"),
    boundaryMode: interactionMode == "boundary",
    pathMode: interactionMode == "path",
    blockMode: interactionMode == "block",
    showAnnotations: annotations,
  };

  return html`
    <div
      class="desktop ${classMap(classes)}"
      @pointermove=${(e) => trackPointer(e)}
      @wheel=${zoom}>
      <div
        style="position: absolute; bottom: 0; left: 0; transform: translate(${chartPan.x}px,${-chartPan.y}px);">
        <canvas
          style="transform: translate(${offsetX}px,${-offsetY}px); outline: 1px solid black;"
          id="chart-canvas"></canvas>
      </div>
      <svg
        id="svg-layer"
        preserveAspectRatio="xMidYMid meet"
        style="position: absolute;"
        width="100%"
        height="100%"
        @pointerdown=${chartPointerDown}
        @contextmenu=${chartContextMenu}>
        <g transform="scale (1, -1)" transform-origin="center">
          <g transform="translate(${chartPan.x} ${chartPan.y})">
            <g transform="translate(${offsetX} ${offsetY})">
              ${cellHeight > 10
                ? svg`
              <rect
                width=${w}
                height=${h}
                fill="url(#grid)">
              </rect>`
                : ""}
            </g>
            ${backgroundBoundaryView()} ${backgroundPathView()}
          </g>
        </g>
      </svg>
      <div
        style="position: absolute; bottom: 0; left: 0;
      transform: translate(${chartPan.x}px, ${-chartPan.y}px); ">
        ${when(interactionMode == "boundary", boundaryBlocks)}
        ${when(interactionMode == "path", pathTiles)}
        ${when(interactionMode == "block", blocks)}
        ${when(stitchSelect, stitchSelectBox)}
      </div>
      <svg
        preserveAspectRatio="xMidYMid meet"
        class="vector-overlay"
        style="position: absolute; "
        width="100%"
        height="100%"
        @pointerdown=${chartPointerDown}
        @contextmenu=${chartContextMenu}
        @wheel=${zoom}>
        <g transform="scale (1, -1)" transform-origin="center">
          <g transform="translate(${chartPan.x} ${chartPan.y})">
            ${activeBoundaryPath()} ${activePath()}
          </g>
        </g>
      </svg>

      ${pickers()}
      <div class="bottom-bars-container">${modeToolbar()} ${bottomBar()}</div>
    </div>
  `;
}
