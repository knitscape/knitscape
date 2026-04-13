import { html } from "lit-html";
import { EXAMPLES } from "./examples";

export interface AppState {
  code: string;
  previewView: "chart" | "sim";
  cellSize: number;
  statusText: string;
  statusClass: string;
  activeExample: number; // index into EXAMPLES, -1 = none
}

export interface ViewHandlers {
  onRun: () => void;
  onViewChange: (v: "chart" | "sim") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectExample: (i: number) => void;
}

export function view(state: AppState, handlers: ViewHandlers) {
  return html`
    <div id="toolbar">
      <div id="toolbar-left">
        <button
          class="run-btn"
          title="Run script (Ctrl+Enter)"
          @click=${handlers.onRun}>
          <i class="fa-solid fa-play"></i> Run
        </button>

        <div class="toolbar-sep"></div>

        <button title="Zoom in" @click=${handlers.onZoomIn}>
          <i class="fa-solid fa-plus"></i>
        </button>
        <button title="Zoom out" @click=${handlers.onZoomOut}>
          <i class="fa-solid fa-minus"></i>
        </button>
      </div>

      <div id="toolbar-right">
        <div class="btn-group">
          <button
            class=${state.previewView === "chart" ? "active" : ""}
            title="Show flat chart"
            @click=${() => handlers.onViewChange("chart")}>
            chart
          </button>
          <button
            class=${state.previewView === "sim" ? "active" : ""}
            title="Show yarn simulation"
            @click=${() => handlers.onViewChange("sim")}>
            simulation
          </button>
        </div>
      </div>
    </div>

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
          <textarea
            id="code-editor"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            .value=${state.code}></textarea>
        </div>

        <div id="preview-pane">
          <div
            id="chart-canvas-wrap"
            class=${state.previewView === "chart" ? "" : "hidden"}>
            <div class="chart-section">
              <div class="chart-label">operation</div>
              <canvas id="chart-canvas-op"></canvas>
            </div>
            <div class="chart-section">
              <div class="chart-label">yarn</div>
              <canvas id="chart-canvas-yarn"></canvas>
            </div>
          </div>
          <div
            id="sim-canvas-wrap"
            class=${state.previewView === "sim" ? "" : "hidden"}>
            <canvas id="sim-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div id="status-bar" class=${state.statusClass}>${state.statusText}</div>
  `;
}
