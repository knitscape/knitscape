import { html } from "lit-html";
import { EXAMPLES } from "./examples";

export type SimState = "idle" | "relaxing" | "relaxed";

export interface AppState {
  code: string;
  cellSize: number;
  statusText: string;
  statusClass: string;
  activeExample: number; // index into EXAMPLES, -1 = none
  simState: SimState;
  topologyMs: number;
  tickMs: number;
}

export interface ViewHandlers {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectExample: (i: number) => void;
  onRelax: () => void;
  onReset: () => void;
  onFitCamera: () => void;
}

export function view(state: AppState, handlers: ViewHandlers) {
  return html`
    <div id="main">
      <div id="examples-sidebar">
        <div class="sidebar-header">Examples</div>
        <div class="sidebar-list">
          ${EXAMPLES.map(
            (ex, i) => html`
              <button
                class="example-item ${state.activeExample === i ? "active" : ""}"
                title=${ex.description}
                @click=${() => handlers.onSelectExample(i)}>
                ${ex.name}
              </button>
            `
          )}
        </div>
      </div>

      <div id="work-area">
        <div id="editor-pane">
          <div id="code-pane">
            <textarea
              id="code-editor"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              .value=${state.code}></textarea>
          </div>
          <div id="chart-pane">
            <div id="chart-canvas-wrap">
              <div class="chart-section">
                <div class="chart-label">operation</div>
                <canvas id="chart-canvas-op"></canvas>
              </div>
              <div class="chart-section">
                <div class="chart-label">yarn</div>
                <canvas id="chart-canvas-yarn"></canvas>
              </div>
            </div>
            <div class="chart-zoom-controls">
              <button title="Zoom in" @click=${handlers.onZoomIn}>
                <i class="fa-solid fa-plus"></i>
              </button>
              <button title="Zoom out" @click=${handlers.onZoomOut}>
                <i class="fa-solid fa-minus"></i>
              </button>
            </div>
          </div>
        </div>

        <div id="preview-pane">
          <canvas id="sim-canvas"></canvas>
          <div class="sim-stats">
            <span>topology: ${state.topologyMs.toFixed(1)}ms</span>
            ${state.simState !== "idle"
              ? html`<span>tick: ${state.tickMs.toFixed(1)}ms</span>`
              : ""}
          </div>
          <button
            class="fit-camera-btn"
            title="Fit view"
            @click=${handlers.onFitCamera}>
            <i class="fa-solid fa-expand"></i>
          </button>
          ${state.simState === "idle"
            ? html`<button
                class="relax-btn"
                @click=${handlers.onRelax}>
                <i class="fa-solid fa-play"></i> Relax
              </button>`
            : state.simState === "relaxing"
              ? html`<button class="relax-btn disabled" disabled>
                  Relaxing\u2026
                </button>`
              : html`<button
                  class="relax-btn"
                  @click=${handlers.onReset}>
                  <i class="fa-solid fa-rotate-left"></i> Reset
                </button>`}
        </div>
      </div>
    </div>

    <div id="status-bar" class=${state.statusClass}>${state.statusText}</div>
  `;
}
