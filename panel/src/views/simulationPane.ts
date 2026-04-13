import { html } from "lit-html";
import { resetSimulation, relax } from "../subscribers/runSimulation";

export function simulationView() {
  return html`
    <div id="viz-container" style="flex: 1;">
      <canvas id="sim-canvas"></canvas>
    </div>
    <div class="sim-toolbar">
      <button @click=${resetSimulation} class="sim-action-button btn solid ">
        <i class="fa-solid fa-rotate-left"></i>reset
      </button>
      <button @click=${relax} class="sim-action-button btn solid ">
        <i class="fa-solid fa-couch"></i>
        relax
      </button>
    </div>
  `;
}
