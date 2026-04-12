import { html } from "lit-html";
import { dispatch, GLOBAL_STATE } from "../state";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import { toolData } from "../constants";

export function repeatTools() {
  return html`<div class="tool-picker">
    <span
      >${GLOBAL_STATE.repeats[0].bitmap.width} x
      ${GLOBAL_STATE.repeats[0].bitmap.height}
    </span>
    ${Object.keys(repeatEditingTools).map(
      (toolName) => html`<button
        class="btn solid ${GLOBAL_STATE.activeTool == toolName
          ? "current"
          : ""}"
        @click=${() =>
          dispatch({
            activeTool: toolName as any,
          })}>
        <i class=${toolData[toolName].icon}></i>
      </button>`
    )}
  </div>`;
}
