import { html } from "lit-html";
import { relax, resetSim, fitCamera, simState } from "../subscribers/runSimulation";

export function simulationView() {
  return html`
    <div id="viz-container">
      <canvas id="sim-canvas"></canvas>
      ${simState === "idle"
        ? html`<button @click=${relax} class="sim-overlay-btn sim-relax-btn">
            <i class="fa-solid fa-play"></i> relax
          </button>`
        : simState === "relaxing"
          ? html`<button class="sim-overlay-btn sim-relax-btn" disabled>
              relaxing\u2026
            </button>`
          : html`<button @click=${resetSim} class="sim-overlay-btn sim-relax-btn">
              <i class="fa-solid fa-rotate-left"></i> reset
            </button>`}
      <button @click=${fitCamera} class="sim-overlay-btn sim-fit-btn" title="Fit view">
        <i class="fa-solid fa-expand"></i>
      </button>
    </div>
  `;
}
