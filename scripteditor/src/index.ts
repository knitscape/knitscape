import { render } from "lit-html";
import Split from "split.js";

import { drawChart } from "../../panel/src/charting/drawing";
import { simulate } from "../../panel/src/simulation/topDownYarnSimulation";
import { Pattern } from "../../panel/src/simulation/Pattern";
import { runScript, yarnSequenceFromChart, type ScriptResult } from "./execute";
import { view, type AppState } from "./view";

const DEFAULT_SCRIPT = `const w = 20, h = 20;
const s = [], y = [];

for (let row = 0; row < h; row++) {
  for (let col = 0; col < w; col++) {
    s.push((col + row) % 2 === 0 ? STITCHES.KNIT : STITCHES.PURL);
    y.push((col + row) % 2 === 0 ? 1 : 2);
  }
}

return {
  stitches: new Bimp(w, h, new Uint8ClampedArray(s)),
  yarns:    new Bimp(w, h, new Uint8ClampedArray(y)),
  palette:  ["#08ccab", "#eb4034"],
};`;

const MIN_CELL = 6;
const MAX_CELL = 80;

let state: AppState = {
  code: DEFAULT_SCRIPT,
  colorMode: "operation",
  previewView: "chart",
  cellSize: 20,
  statusText: "Press Run or Ctrl+Enter to generate the chart.",
  statusClass: "",
};

// Last successful script result — kept so we can re-render on zoom/mode changes
let lastResult: ScriptResult | null = null;

// Simulation handles
let simDraw: (() => void) | undefined;
let simStop: (() => void) | undefined;

let needsRender = true;

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  needsRender = true;
}

// ─── Chart rendering ──────────────────────────────────────────────────────────

function renderChart() {
  if (!lastResult) return;
  const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  const { stitches: stitchBimp, yarns: yarnBimp, palette } = lastResult;
  canvas.width = stitchBimp.width * state.cellSize;
  canvas.height = stitchBimp.height * state.cellSize;

  drawChart(
    canvas,
    state.colorMode,
    stitchBimp,
    yarnBimp,
    palette,
    state.cellSize,
    state.cellSize
  );
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function startSimulation() {
  if (!lastResult) return;

  // Stop any running simulation first
  if (simStop) {
    simStop();
    simStop = undefined;
    simDraw = undefined;
  }

  const simCanvas = document.getElementById("sim-canvas") as HTMLCanvasElement | null;
  if (!simCanvas) return;

  const { stitches: stitchBimp, yarns: yarnBimp, palette } = lastResult;
  const yarnSequence = yarnSequenceFromChart(yarnBimp);
  const rowMap = Array.from({ length: stitchBimp.height }, (_, i) => i);
  const pattern = new Pattern(stitchBimp, yarnSequence, rowMap);

  const result = simulate(pattern, {
    canvas: simCanvas,
    yarnPalette: palette,
    cellAspect: 1,
  });

  simDraw = result.draw;
  simStop = result.stopSim;
  result.relax();
}

function stopSimulation() {
  if (simStop) {
    simStop();
    simStop = undefined;
    simDraw = undefined;
  }
}

// ─── Run script ───────────────────────────────────────────────────────────────

function runCurrentScript() {
  const editor = document.getElementById("code-editor") as HTMLTextAreaElement | null;
  const code = editor ? editor.value : state.code;

  try {
    const result = runScript(code);
    lastResult = result;

    const w = result.stitches.width;
    const h = result.stitches.height;
    setState({
      code,
      statusText: `OK — ${w} \u00d7 ${h} chart`,
      statusClass: "ok",
    });

    renderChart();

    // Re-start simulation if currently in sim view
    if (state.previewView === "sim") {
      startSimulation();
    } else {
      // Stop any stale sim so it doesn't keep ticking in the background
      stopSimulation();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setState({
      code,
      statusText: `Error: ${msg}`,
      statusClass: "error",
    });
  }
}

// ─── Render loop ─────────────────────────────────────────────────────────────

function loop() {
  if (needsRender) {
    needsRender = false;
    render(
      view(state, {
        onRun: runCurrentScript,
        onModeChange: (mode) => {
          setState({ colorMode: mode });
          renderChart();
        },
        onViewChange: (v) => {
          setState({ previewView: v });
          if (v === "sim") {
            // Defer until after lit-html reveals the canvas
            requestAnimationFrame(() => startSimulation());
          } else {
            stopSimulation();
            requestAnimationFrame(() => renderChart());
          }
        },
        onZoomIn: () => {
          setState({ cellSize: Math.min(state.cellSize + 4, MAX_CELL) });
          renderChart();
        },
        onZoomOut: () => {
          setState({ cellSize: Math.max(state.cellSize - 4, MIN_CELL) });
          renderChart();
        },
      }),
      document.body
    );
  }

  // Drive the simulation draw loop
  if (simDraw && state.previewView === "sim") simDraw();

  requestAnimationFrame(loop);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

function init() {
  loop();

  // Split.js for resizable panes — wait one frame so lit-html has rendered
  requestAnimationFrame(() => {
    Split(["#editor-pane", "#preview-pane"], {
      sizes: [50, 50],
      minSize: 200,
      gutterSize: 6,
    });

    // Keyboard shortcut: Ctrl/Cmd+Enter to run
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCurrentScript();
      }
    });

    // Tab key in the editor inserts spaces instead of moving focus
    const editor = document.getElementById("code-editor") as HTMLTextAreaElement | null;
    if (editor) {
      editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value =
            editor.value.substring(0, start) +
            "  " +
            editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        }
      });

      // Mouse-wheel zoom on the chart canvas area
      const previewPane = document.getElementById("preview-pane");
      previewPane?.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            setState({ cellSize: Math.min(state.cellSize + 2, MAX_CELL) });
          } else {
            setState({ cellSize: Math.max(state.cellSize - 2, MIN_CELL) });
          }
          renderChart();
        }
      }, { passive: false });
    }

    // Auto-run on load
    runCurrentScript();
  });
}

window.onload = init;
