import { render } from "lit-html";
import Split from "split.js";

import { drawChart } from "./drawChart";
import { simulate } from "./simulation/simulate";
import { runScript, type ScriptResult } from "./execute";
import { yarnSeparation } from "./yarnSeparation";
import { view, type AppState, type ViewHandlers } from "./view";
import { EXAMPLES } from "./examples";

const MIN_CELL = 6;
const MAX_CELL = 80;

let state: AppState = {
  code: EXAMPLES[0].code,
  cellSize: 20,
  statusText: "Press Run or Ctrl+Enter to generate the chart.",
  statusClass: "",
  activeExample: 0,
  simState: "idle",
  topologyMs: 0,
  tickMs: 0,
};

// Last successful script result — kept so we can re-render on zoom/mode changes
let lastResult: ScriptResult | null = null;

// Simulation handles
let simDraw: (() => void) | undefined;
let simStop: (() => void) | undefined;
let simRelax: (() => void) | undefined;
let simIsRelaxing: (() => boolean) | undefined;
let simGetTickMs: (() => number) | undefined;

let needsRender = true;

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  needsRender = true;
}

// ─── Chart rendering ──────────────────────────────────────────────────────────

function renderChart() {
  if (!lastResult) return;
  const canvasOp = document.getElementById(
    "chart-canvas-op"
  ) as HTMLCanvasElement | null;
  const canvasYarn = document.getElementById(
    "chart-canvas-yarn"
  ) as HTMLCanvasElement | null;
  if (!canvasOp || !canvasYarn) return;

  const { stitches: stitchBimp, yarns: yarnBimp, palette } = lastResult;
  const w = stitchBimp.width * state.cellSize;
  const h = stitchBimp.height * state.cellSize;

  canvasOp.width = w;
  canvasOp.height = h;
  drawChart(canvasOp, "operation", stitchBimp, yarnBimp, palette, state.cellSize, state.cellSize);

  canvasYarn.width = w;
  canvasYarn.height = h;
  drawChart(canvasYarn, "yarn", stitchBimp, yarnBimp, palette, state.cellSize, state.cellSize);
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function initSimulation(resetCamera = true) {
  if (!lastResult) return;

  if (simStop) {
    simStop();
    simStop = undefined;
    simDraw = undefined;
    simRelax = undefined;
    simIsRelaxing = undefined;
    simGetTickMs = undefined;
  }

  const simCanvas = document.getElementById(
    "sim-canvas"
  ) as HTMLCanvasElement | null;
  if (!simCanvas) return;

  const { stitches: stitchBimp, yarns: yarnBimp, palette } = lastResult;
  const pattern = yarnSeparation(stitchBimp, yarnBimp, false);

  const result = simulate(pattern, {
    canvas: simCanvas,
    yarnPalette: palette,
    cellAspect: 1,
    resetCamera,
  });

  simDraw = result.draw;
  simStop = result.stopSim;
  simRelax = result.relax;
  simIsRelaxing = result.isRelaxing;
  simGetTickMs = result.getTickMs;
  setState({ simState: "idle", topologyMs: result.topologyMs, tickMs: 0 });
}

function relaxSimulation() {
  if (simRelax) {
    simRelax();
    setState({ simState: "relaxing" });
  }
}

// ─── Run logic ────────────────────────────────────────────────────────────────

function runWithCode(code: string) {
  try {
    const result = runScript(code);
    lastResult = result;

    const w = result.stitches.width;
    const h = result.stitches.height;
    setState({
      statusText: `OK \u2014 ${w}\u00d7${h}`,
      statusClass: "ok",
    });

    renderChart();
    initSimulation();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setState({ statusText: `Error: ${msg}`, statusClass: "error" });
  }
}

function runCurrentScript() {
  const editor = document.getElementById(
    "code-editor"
  ) as HTMLTextAreaElement | null;
  const code = editor ? editor.value : state.code;
  setState({ code, activeExample: -1 });
  runWithCode(code);
}

function selectExample(i: number) {
  const ex = EXAMPLES[i];
  setState({ code: ex.code, activeExample: i });
  runWithCode(ex.code);
}

// ─── Render loop ─────────────────────────────────────────────────────────────

const handlers: ViewHandlers = {
  onZoomIn: () => {
    setState({ cellSize: Math.min(state.cellSize + 4, MAX_CELL) });
    renderChart();
  },

  onZoomOut: () => {
    setState({ cellSize: Math.max(state.cellSize - 4, MIN_CELL) });
    renderChart();
  },

  onSelectExample: selectExample,
  onRelax: relaxSimulation,
  onReset: () => initSimulation(false),
};

function loop() {
  if (needsRender) {
    needsRender = false;
    render(view(state, handlers), document.body);
  }

  if (simDraw) simDraw();

  // Update tick timing and detect when relaxation finishes
  if (state.simState === "relaxing") {
    if (simGetTickMs) {
      setState({ tickMs: simGetTickMs() });
    }
    if (simIsRelaxing && !simIsRelaxing()) {
      setState({ simState: "relaxed" });
    }
  }

  requestAnimationFrame(loop);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

function init() {
  loop();

  requestAnimationFrame(() => {
    Split(["#editor-pane", "#preview-pane"], {
      sizes: [50, 50],
      minSize: 200,
      gutterSize: 6,
    });

    Split(["#code-pane", "#chart-pane"], {
      sizes: [50, 50],
      minSize: 80,
      gutterSize: 6,
      direction: "vertical",
    });

    // Ctrl/Cmd+Enter to run
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCurrentScript();
      }
    });

    // Tab inserts spaces in the editor
    const editor = document.getElementById(
      "code-editor"
    ) as HTMLTextAreaElement | null;
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
    }

    // Ctrl+scroll to zoom on the chart pane
    const chartPane = document.getElementById("chart-pane");
    chartPane?.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 2 : -2;
          setState({
            cellSize: Math.max(
              MIN_CELL,
              Math.min(state.cellSize + delta, MAX_CELL)
            ),
          });
          renderChart();
        }
      },
      { passive: false }
    );

    // Auto-run the first example on load
    runWithCode(EXAMPLES[0].code);
  });
}

window.onload = init;
