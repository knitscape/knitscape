import { GLOBAL_STATE } from "../state";
import { html } from "lit-html";

export function repeatCanvas() {
  const { repeats, chart, scale } = GLOBAL_STATE;
  const bitmap = repeats[0].bitmap;
  const yOffset = Math.floor(
    ((chart.height - bitmap.height) * scale) / devicePixelRatio
  );

  return html`<div id="repeat-container">
    <div
      class="repeat-canvas-container"
      id="repeat-0-container"
      style="transform: translate(0px, ${yOffset}px);">
      <button class="btn solid resize-repeat grab">
        <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
      </button>
      <canvas id="repeat-0" class="repeat-canvas"></canvas>
      <canvas id="repeat-0-grid" class="grid-canvas"></canvas>
      <canvas id="repeat-0-outline" class="outline-canvas"></canvas>
    </div>
  </div>`;
}
