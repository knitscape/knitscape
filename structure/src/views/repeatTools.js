import { html } from "lit-html";
import { dispatch, GLOBAL_STATE } from "../state";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import { toolData } from "../constants";

export function repeatTools() {
  return html` <div class="tool-picker">
    <button
      class="btn"
      @click=${() =>
        dispatch({
          editingRepeat: -1,
          repeats: [
            ...GLOBAL_STATE.repeats.slice(0, GLOBAL_STATE.editingRepeat),
            ...GLOBAL_STATE.repeats.slice(GLOBAL_STATE.editingRepeat + 1),
          ],
        })}>
      <i class="fa-solid fa-trash"></i>
    </button>
    <span
      >${GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.width} x
      ${GLOBAL_STATE.repeats[GLOBAL_STATE.editingRepeat].bitmap.height}
    </span>
    ${Object.keys(repeatEditingTools).map(
      (toolName) => html`<button
        class="btn solid ${GLOBAL_STATE.activeTool == toolName
          ? "current"
          : ""}"
        @click=${() =>
          dispatch({
            activeTool: toolName,
          })}>
        <i class=${toolData[toolName].icon}></i>
      </button>`
    )}
    <button
      class="btn solid move-repeat ${GLOBAL_STATE.activeTool == "move"
        ? "current"
        : ""}"
      @click=${() =>
        dispatch({
          activeTool: "move",
        })}>
      <i class="fa-solid fa-hand"></i>
    </button>
    <button
      class="btn"
      @click=${() =>
        dispatch({
          editingRepeat: -1,
        })}>
      <i class="fa-solid fa-circle-xmark"></i>
    </button>
  </div>`;
}
