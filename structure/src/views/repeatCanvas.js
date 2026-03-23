import { GLOBAL_STATE, dispatch } from "../state";
import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";

function xPos(repeat) {
  return Math.floor((repeat.pos[0] * GLOBAL_STATE.scale) / devicePixelRatio);
}

function yPos(repeat) {
  return Math.floor(
    ((GLOBAL_STATE.chart.height - repeat.bitmap.height - repeat.pos[1]) *
      GLOBAL_STATE.scale) /
      devicePixelRatio
  );
}

export function repeatCanvas() {
  return html` <div id="repeat-container">
    ${GLOBAL_STATE.repeats.map(
      (repeat, index) =>
        html`<div
          data-repeatindex=${index}
          class="repeat-canvas-container"
          style="transform: translate(${xPos(repeat)}px, ${yPos(
            repeat
          )}px); ${GLOBAL_STATE.editingRepeat == index
            ? "z-index: 3"
            : "z-index: 1"}"
          id="repeat-${index}-container">
          ${when(
            GLOBAL_STATE.editingRepeat == index,
            () =>
              html`<button class="btn solid resize-repeat grab">
                <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
              </button> `
          )}
          <div
            class="repeat-bounds"
            style="width: ${(repeat.area[0] * GLOBAL_STATE.scale) /
            devicePixelRatio}px; height: ${(repeat.area[1] *
              GLOBAL_STATE.scale) /
            devicePixelRatio}px;">
            ${when(
              GLOBAL_STATE.editingRepeat == index,
              () =>
                html`<button class="repeat-area-dragger y-axis">
                    <i class="fa-solid fa-angles-up"></i></button
                  ><button class="repeat-area-dragger x-axis">
                    <i class="fa-solid fa-angles-right"></i>
                  </button>`
            )}
          </div>
          <canvas id="repeat-${index}" class="repeat-canvas"></canvas>
          <canvas id="repeat-${index}-grid" class="grid-canvas"></canvas>
          <canvas id="repeat-${index}-outline" class="outline-canvas"></canvas>
        </div>`
    )}
  </div>`;
}
