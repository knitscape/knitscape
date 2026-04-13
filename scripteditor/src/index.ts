import { render } from "lit-html";
import Split from "split.js";

import { drawChart } from "../../panel/src/charting/drawing";
import { simulate } from "../../panel/src/simulation/topDownYarnSimulation";
import { Pattern } from "../../panel/src/simulation/Pattern";
import { runScript, type ScriptResult } from "./execute";
import { yarnSeparation } from "../../panel/src/charting/yarnSeparation";
import { view, type AppState, type ViewHandlers } from "./view";
import { EXAMPLES } from "./examples";

const MIN_CELL = 6;
const MAX_CELL = 80;

let state: AppState = {
  code: EXAMPLES[0].code,
  previewView: "chart",
  cellSize: 20,
  statusText: "Press Run or Ctrl+Enter to generate the chart.",
  statusClass: "",
  activeExample: 0,
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

function startSimulation() {
  if (!lastResult) return;

  if (simStop) {
    simStop();
    simStop = undefined;
    simDraw = undefined;
  }

  const simCanvas = document.getElementById(
    "sim-canvas"
  ) as HTMLCanvasElement | null;
  if (!simCanvas) return;

  const { stitches: stitchBimp, yarns: yarnBimp, palette } = lastResult;
  // Run yarn separation: splits multi-yarn rows into one carriage pass per yarn,
  // producing the machineChart the simulation expects.
  const { machineChart, yarnSequence, rowMap } = yarnSeparation(
    stitchBimp,
    yarnBimp,
    false // no tuck joins at yarn transitions
  );
  const pattern = new Pattern(machineChart, yarnSequence, rowMap);

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

    if (state.previewView === "sim") {
      startSimulation();
    } else {
      stopSimulation();
    }
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
  onRun: runCurrentScript,

  onViewChange: (v) => {
    setState({ previewView: v });
    if (v === "sim") {
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

  onSelectExample: selectExample,
};

function loop() {
  if (needsRender) {
    needsRender = false;
    render(view(state, handlers), document.body);
  }

  if (simDraw && state.previewView === "sim") simDraw();

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

    // Ctrl+scroll to zoom on the preview pane
    const previewPane = document.getElementById("preview-pane");
    previewPane?.addEventListener(
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
