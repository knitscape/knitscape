import { html } from "lit-html";
import { GLOBAL_STATE } from "../state";
import { toolData } from "../constants";

export function pointerIcon() {
  return html`<div id="pointer">
    <i class="fa-solid ${toolData[GLOBAL_STATE.activeTool]?.icon}"></i>
  </div>`;
}
