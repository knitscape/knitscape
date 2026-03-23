import { html } from "lit-html";
import { GLOBAL_STATE } from "../state";
import { tools } from "../constants";

export function pointerIcon() {
  return html`<div id="pointer">
    <i class="fa-solid ${tools[GLOBAL_STATE.activeTool].icon}"></i>
  </div>`;
}
