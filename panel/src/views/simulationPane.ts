import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { drawYarns, relax } from "../subscribers/runSimulation";

export function simulationView() {
  const gs = GLOBAL_STATE as any;
  const { simLive } = GLOBAL_STATE;
  const viz = gs.viz as string | undefined;

  return html`
    <div id="viz-container" style="flex: 1;">
      <canvas id="sim-canvas"></canvas>
    </div>
    <div class="sim-toolbar">
      <div class="radio-group">
        <span>viz</span>
        <button
          class="${viz == "topdown" ? "selected" : ""}"
          @click=${() => (dispatch as (s: any) => void)({ viz:"topdown" })}>
          top down
        </button>
        <button
          class="${viz == "noodle" ? "selected" : ""}"
          @click=${() => (dispatch as (s: any) => void)({ viz:"noodle" })}>
          noodle
        </button>
        <button
          class="${viz == "tube" ? "selected" : ""}"
          @click=${() => (dispatch as (s: any) => void)({ viz:"tube" })}>
          tube
        </button>
        <button
          class="${viz == "centerline" ? "selected" : ""}"
          @click=${() => (dispatch as (s: any) => void)({ viz:"centerline" })}>
          centerline
        </button>
      </div>
      <div class="radio-group">
        <span>auto regen</span>
        <button
          class="${simLive ? "selected" : ""}"
          @click=${() => dispatch({ simLive: true })}>
          on
        </button>
        <button
          class="${simLive ? "" : "selected"}"
          @click=${() => dispatch({ simLive: false })}>
          off
        </button>
      </div>
      <button @click=${drawYarns} class="btn solid sim-action-button">
        <i class="fa-solid fa-rotate"></i>refresh
      </button>
      <button @click=${relax} class="btn solid sim-action-button">
        <i class="fa-solid fa-couch"></i>
        relax
      </button>
    </div>
  `;
}
