import { html } from "lit-html";

export interface AppState {
  code: string;
  colorMode: "operation" | "yarn";
  previewView: "chart" | "sim";
  cellSize: number;
  statusText: string;
  statusClass: string;
}

export function view(state: AppState, handlers: {
  onRun: () => void;
  onModeChange: (mode: "operation" | "yarn") => void;
  onViewChange: (view: "chart" | "sim") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
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

        <div class="btn-group">
          <button
            class=${state.colorMode === "operation" ? "active" : ""}
            title="Show stitch operations"
            @click=${() => handlers.onModeChange("operation")}>
            operation
          </button>
          <button
            class=${state.colorMode === "yarn" ? "active" : ""}
            title="Show yarn colors"
            @click=${() => handlers.onModeChange("yarn")}>
            yarn
          </button>
        </div>

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
          <canvas id="chart-canvas"></canvas>
        </div>
        <div
          id="sim-canvas-wrap"
          class=${state.previewView === "sim" ? "" : "hidden"}>
          <canvas id="sim-canvas"></canvas>
        </div>
      </div>
    </div>

    <div id="status-bar" class=${state.statusClass}>${state.statusText}</div>
  `;
}
