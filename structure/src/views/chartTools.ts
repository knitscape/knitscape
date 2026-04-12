import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { MIN_SCALE, MAX_SCALE } from "../constants";
import { centerZoom, fitChart } from "../actions/zoomFit";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import { toolData } from "../constants";

export function chartTools() {
  return html`<div class="panzoom-controls">
    <span
      >${GLOBAL_STATE.repeats[0].bitmap.width} x
      ${GLOBAL_STATE.repeats[0].bitmap.height}
    </span>
    ${Object.keys(repeatEditingTools).map(
      (toolName) => html`<button
        class="btn solid ${GLOBAL_STATE.activeTool == toolName ? "current" : ""}"
        @click=${() => dispatch({ activeTool: toolName as any })}>
        <i class=${toolData[toolName].icon}></i>
      </button>`
    )}
    <div class="toolbar-divider"></div>
    <button class="btn icon" @click=${() => centerZoom(GLOBAL_STATE.scale - 1)}>
      <i class="fa-solid fa-magnifying-glass-minus"></i>
    </button>
    <input
      type="range"
      min=${MIN_SCALE}
      max=${MAX_SCALE}
      .value=${String(GLOBAL_STATE.scale)}
      @input=${(e: Event) =>
        centerZoom(Number((e.target as HTMLInputElement).value))} />
    <button class="btn icon" @click=${() => centerZoom(GLOBAL_STATE.scale + 1)}>
      <i class="fa-solid fa-magnifying-glass-plus"></i>
    </button>
    <button class="btn icon" @click=${fitChart}>
      <i class="fa-solid fa-expand"></i>
    </button>
  </div>`;
}
