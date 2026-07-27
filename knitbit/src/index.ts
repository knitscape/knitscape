import { render } from "lit-html";
import Split from "split.js";

import { drawChart, sidebarLayout, sidebarColumnAt } from "./drawChart";
import { Op } from "@shared/opData";
import {
  encodeOpsBmp,
  encodeControlJson,
  triggerDownload,
} from "./download";
import { simulate } from "./simulation/simulate";
import { countStitches } from "./simulation/topology";
import { runScript } from "./execute";
import { Bimp } from "@shared/Bimp";
import { view, type AppState, type ViewHandlers, type BimpTool } from "./view";
import {
  loadAllScripts,
  getScript,
  saveScript,
  deleteScript,
  renameScript,
  loadLastOpened,
  saveLastOpened,
  nextUntitledName,
} from "./scripts";
import {
  getEditorCode,
  setEditorCode,
  replaceBimpExpression,
  formatBimpExpression,
  type BimpEditTarget,
} from "./editor";
import { EXAMPLES } from "./examples";
import {
  DEFAULT_RELAX_SETTINGS,
  type KnittingProgram,
  type RelaxSettings,
} from "./simulation/types";

const MIN_CELL = 6;
const MAX_CELL = 80;

let state: AppState = {
  code: EXAMPLES[0].code,
  cellSize: 20,
  statusText: "Press Run or Ctrl+Enter to generate the chart.",
  statusClass: "text-[color:var(--base7)]",
  showExamplePicker: false,
  showScriptPicker: false,
  simState: "idle",
  topologyMs: 0,
  tickMs: 0,
  showHelp: false,
  layoutMode: "compressed",
  editingBimp: null,
  maxStitch: 0,
  totalStitches: 0,
  autoRun: true,
  scriptId: { type: "example", name: EXAMPLES[0].name },
  savedScripts: loadAllScripts(),
  relaxSettings: { ...DEFAULT_RELAX_SETTINGS },
  simShowSettings: false,
  simAlpha: 1,
};

let lastProgram: KnittingProgram | null = null;

const liveRelaxSettings: RelaxSettings = { ...DEFAULT_RELAX_SETTINGS };

// Simulation handles
let simDraw: (() => void) | undefined;
let simRelax: (() => void) | undefined;
let simRestart: (() => void) | undefined;
let simIsRelaxing: (() => boolean) | undefined;
let simGetTickMs: (() => number) | undefined;
let simGetAlpha: (() => number) | undefined;
let simFitCamera: (() => void) | undefined;
let simSetMaxStitch: ((n: number) => void) | undefined;
let simUpdateSettings: ((partial: Partial<RelaxSettings>) => void) | undefined;
let simTerminate: (() => void) | undefined;

let needsRender = true;

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  needsRender = true;
}

// ─── Chart rendering ──────────────────────────────────────────────────────────

function renderChart() {
  if (!lastProgram) return;
  const opsCanvas = document.getElementById(
    "chart-canvas"
  ) as HTMLCanvasElement | null;
  const sidebarCanvas = document.getElementById(
    "chart-sidebar"
  ) as HTMLCanvasElement | null;
  if (!opsCanvas || !sidebarCanvas) return;

  drawChart(
    sidebarCanvas,
    opsCanvas,
    lastProgram.ops,
    lastProgram.yarnFeeder,
    lastProgram.direction,
    lastProgram.racking,
    lastProgram.palette,
    state.cellSize
  );
}

// ─── Scrub-cursor highlight ──────────────────────────────────────────────────

/**
 * Walk the program in carriage order and find the (row, col) of the Nth
 * knit/tuck operation. Returns null when N is 0 or past the end.
 */
function stitchToRowCol(
  program: KnittingProgram,
  n: number
): { row: number; col: number } | null {
  if (n <= 0) return null;
  const w = program.width;
  const h = program.height;
  let count = 0;
  for (let row = 0; row < h; row++) {
    const dir = program.direction[row];
    for (let i = 0; i < w; i++) {
      const col = dir === "right" ? i : w - 1 - i;
      const op = program.ops.pixel(col, row);
      if (op === Op.MISS || op === Op.EMPTY) continue;
      count++;
      if (count === n) return { row, col };
    }
  }
  return null;
}

function rowColToStitch(
  program: KnittingProgram,
  targetRow: number,
  targetCol: number
): number {
  const w = program.width;
  let count = 0;
  for (let row = 0; row <= targetRow; row++) {
    const dir = program.direction[row];
    for (let i = 0; i < w; i++) {
      const col = dir === "right" ? i : w - 1 - i;
      const op = program.ops.pixel(col, row);
      if (op !== Op.MISS && op !== Op.EMPTY) count++;
      if (row === targetRow && col === targetCol) return count;
    }
  }
  return count;
}

function updateScrubHighlight() {
  const rowEl = document.getElementById("chart-scrub-row");
  const cellEl = document.getElementById("chart-scrub-cell");
  if (!rowEl || !cellEl) return;

  if (!lastProgram) {
    rowEl.classList.add("hidden");
    cellEl.classList.add("hidden");
    return;
  }

  const pos = stitchToRowCol(lastProgram, state.maxStitch);
  if (!pos) {
    rowEl.classList.add("hidden");
    cellEl.classList.add("hidden");
    return;
  }

  const opsCanvas = document.getElementById(
    "chart-canvas"
  ) as HTMLCanvasElement | null;
  const chartContent = document.getElementById("chart-content");
  if (!opsCanvas || !chartContent) return;

  const cs = state.cellSize;
  const h = lastProgram.height;
  const rowFromTop = h - 1 - pos.row;
  const opsRect = opsCanvas.getBoundingClientRect();
  const contentRect = chartContent.getBoundingClientRect();

  const rowTop = opsRect.top - contentRect.top + rowFromTop * cs;
  rowEl.style.top = `${rowTop}px`;
  rowEl.style.height = `${cs}px`;
  rowEl.classList.remove("hidden");

  // Cell marker lives inside the canvas wrapper, so coords are in
  // canvas-local pixel space.
  cellEl.style.top = `${rowFromTop * cs}px`;
  cellEl.style.left = `${pos.col * cs}px`;
  cellEl.style.width = `${cs}px`;
  cellEl.style.height = `${cs}px`;
  cellEl.classList.remove("hidden");
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function initSimulation(resetCamera = true) {
  if (!lastProgram) return;

  if (simTerminate) {
    simTerminate();
    simDraw = undefined;
    simRelax = undefined;
    simRestart = undefined;
    simIsRelaxing = undefined;
    simGetTickMs = undefined;
    simGetAlpha = undefined;
    simSetMaxStitch = undefined;
    simUpdateSettings = undefined;
    simTerminate = undefined;
  }

  const simCanvas = document.getElementById(
    "sim-canvas"
  ) as HTMLCanvasElement | null;
  if (!simCanvas) return;

  const result = simulate(lastProgram, {
    canvas: simCanvas,
    cellAspect: 1,
    resetCamera,
    layoutMode: state.layoutMode,
    maxStitch: state.maxStitch,
    relaxSettings: liveRelaxSettings,
  });

  simDraw = result.draw;
  simRelax = result.relax;
  simRestart = result.restart;
  simIsRelaxing = result.isRelaxing;
  simGetTickMs = result.getTickMs;
  simGetAlpha = result.getAlpha;
  simFitCamera = result.fitCamera;
  simSetMaxStitch = result.setMaxStitch;
  simUpdateSettings = result.updateSettings;
  simTerminate = result.terminate;
  setState({ simState: "idle", topologyMs: result.topologyMs, tickMs: 0 });
}

function relaxSimulation() {
  if (simRelax) {
    simRelax();
    setState({ simState: "relaxing" });
  }
}

// ─── Run logic ────────────────────────────────────────────────────────────────

function runWithCode(code: string, resetView = false) {
  try {
    const program = runScript(code);
    lastProgram = program;

    const w = program.width;
    const h = program.height;
    const total = countStitches(program);

    setState({
      statusText: `OK \u2014 ${w}\u00d7${h}`,
      statusClass: "text-green-400",
      totalStitches: total,
      maxStitch: total,
    });

    renderChart();
    updateScrubHighlight();
    initSimulation(resetView);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setState({ statusText: `Error: ${msg}`, statusClass: "text-red-400" });
  }
}

function runCurrentScript() {
  let code = getEditorCode();
  // If the bitmap editor is open, splice its in-progress state into the code
  // so the chart/sim preview reflects the live edits without touching the doc.
  if (state.editingBimp) {
    const e = state.editingBimp;
    const replacement = formatBimpExpression(
      e.width,
      e.height,
      e.pixels,
      e.palette
    );
    code = code.slice(0, e.exprFrom) + replacement + code.slice(e.exprTo);
  }
  setState({ code });
  runWithCode(code);
}

let autoRunTimer: number | undefined;
function scheduleAutoRun() {
  if (!state.autoRun) return;
  if (autoRunTimer !== undefined) clearTimeout(autoRunTimer);
  autoRunTimer = window.setTimeout(() => {
    autoRunTimer = undefined;
    if (state.autoRun) runCurrentScript();
  }, 250);
}

let autoSaveTimer: number | undefined;
function scheduleAutoSave() {
  if (autoSaveTimer !== undefined) clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = undefined;
    persistCurrentScript();
  }, 500);
}

function persistCurrentScript() {
  const code = getEditorCode();
  let name: string;
  if (state.scriptId.type === "example") {
    // Fork the example: create an Untitled saved script.
    name = nextUntitledName(state.savedScripts);
    setState({ scriptId: { type: "saved", name } });
  } else {
    name = state.scriptId.name;
  }
  saveScript(name, code);
  saveLastOpened({ type: "saved", name });
  setState({ savedScripts: loadAllScripts() });
}

function selectExample(i: number) {
  // Any pending auto-save for the outgoing script should flush first so
  // users don't lose the last few keystrokes when switching away.
  if (autoSaveTimer !== undefined) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = undefined;
    persistCurrentScript();
  }
  const ex = EXAMPLES[i];
  setState({
    code: ex.code,
    showExamplePicker: false,
    scriptId: { type: "example", name: ex.name },
  });
  setEditorCode(ex.code);
  saveLastOpened({ type: "example", name: ex.name });
  runWithCode(ex.code, true);
}

function loadSavedScript(name: string) {
  if (autoSaveTimer !== undefined) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = undefined;
    persistCurrentScript();
  }
  const script = getScript(name);
  if (!script) return;
  setState({
    code: script.code,
    showScriptPicker: false,
    scriptId: { type: "saved", name },
  });
  setEditorCode(script.code);
  saveLastOpened({ type: "saved", name });
  runWithCode(script.code, true);
}

// ─── Render loop ─────────────────────────────────────────────────────────────

const handlers: ViewHandlers = {
  onZoomIn: () => {
    setState({ cellSize: Math.min(state.cellSize + 4, MAX_CELL) });
    renderChart();
    updateScrubHighlight();
  },

  onZoomOut: () => {
    setState({ cellSize: Math.max(state.cellSize - 4, MIN_CELL) });
    renderChart();
    updateScrubHighlight();
  },

  onSelectExample: selectExample,
  onRelax: relaxSimulation,
  onReset: () => initSimulation(false),
  onFitCamera: () => {
    if (simFitCamera) simFitCamera();
  },
  onRun: runCurrentScript,
  onToggleHelp: () => setState({ showHelp: !state.showHelp }),
  onToggleExamplePicker: () =>
    setState({ showExamplePicker: !state.showExamplePicker }),
  onToggleLayoutMode: () => {
    setState({
      layoutMode: state.layoutMode === "technical" ? "compressed" : "technical",
    });
    initSimulation(false);
  },
  onScrub: (n: number) => {
    const clamped = Math.max(0, Math.min(n, state.totalStitches));
    setState({ maxStitch: clamped, simState: "idle" });
    if (simSetMaxStitch) simSetMaxStitch(clamped);
    updateScrubHighlight();
  },
  onEditBimp: (target: BimpEditTarget) => {
    const maxDim = Math.max(target.width, target.height);
    const initialCellSize = Math.max(18, Math.min(44, Math.floor(320 / maxDim)));
    setState({
      editingBimp: {
        exprFrom: target.exprFrom,
        exprTo: target.exprTo,
        width: target.width,
        height: target.height,
        pixels: target.pixels.slice(),
        palette: target.palette ? target.palette.slice() : undefined,
        brushValue: target.pixels[0] ?? 0,
        activeTool: "brush",
        dragFrom: null,
        dragTo: null,
        cellSize: initialCellSize,
      },
    });
  },
  onBimpCancel: () => {
    const wasEditing = !!state.editingBimp;
    setState({ editingBimp: null });
    // Revert any preview by re-running with the actual (un-edited) doc.
    if (wasEditing && state.autoRun) runCurrentScript();
  },
  onBimpSave: () => {
    if (!state.editingBimp) return;
    const { exprFrom, exprTo, width, height, pixels, palette } =
      state.editingBimp;
    replaceBimpExpression(exprFrom, exprTo, width, height, pixels, palette);
    setState({ editingBimp: null });
    runCurrentScript();
    // replaceBimpExpression is a programmatic dispatch, so onDocChange
    // won't fire — persist explicitly so the committed bitmap is saved.
    scheduleAutoSave();
  },
  onBimpPointerDown: (x: number, y: number) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    if (x < 0 || x >= cur.width || y < 0 || y >= cur.height) return;

    if (cur.activeTool === "brush") {
      const pixels = cur.pixels.slice();
      pixels[y * cur.width + x] = cur.brushValue;
      setState({
        editingBimp: { ...cur, pixels, dragFrom: [x, y], dragTo: [x, y] },
      });
      if (state.autoRun) runCurrentScript();
    } else if (cur.activeTool === "flood") {
      const bimp = new Bimp(cur.width, cur.height, cur.pixels);
      const pixels = Array.from(bimp.flood([x, y], cur.brushValue).pixels);
      setState({
        editingBimp: { ...cur, pixels, dragFrom: null, dragTo: null },
      });
      if (state.autoRun) runCurrentScript();
    } else {
      // line or rect — start drag, preview only (commit on pointerup)
      setState({
        editingBimp: { ...cur, dragFrom: [x, y], dragTo: [x, y] },
      });
    }
  },
  onBimpPointerMove: (x: number, y: number) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    if (!cur.dragFrom) return;
    const cx = Math.max(0, Math.min(cur.width - 1, x));
    const cy = Math.max(0, Math.min(cur.height - 1, y));

    if (cur.activeTool === "brush") {
      const idx = cy * cur.width + cx;
      if (cur.pixels[idx] === cur.brushValue) return;
      const pixels = cur.pixels.slice();
      pixels[idx] = cur.brushValue;
      setState({ editingBimp: { ...cur, pixels, dragTo: [cx, cy] } });
      if (state.autoRun) runCurrentScript();
    } else if (cur.activeTool === "line" || cur.activeTool === "rect") {
      if (cur.dragTo && cur.dragTo[0] === cx && cur.dragTo[1] === cy) return;
      setState({ editingBimp: { ...cur, dragTo: [cx, cy] } });
    }
  },
  onBimpPointerUp: () => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    if (!cur.dragFrom) return;

    if (
      (cur.activeTool === "line" || cur.activeTool === "rect") &&
      cur.dragTo
    ) {
      const bimp = new Bimp(cur.width, cur.height, cur.pixels);
      const result =
        cur.activeTool === "line"
          ? bimp.line(cur.dragFrom, cur.dragTo, cur.brushValue)
          : bimp.rect(cur.dragFrom, cur.dragTo, cur.brushValue);
      const pixels = Array.from(result.pixels);
      setState({
        editingBimp: { ...cur, pixels, dragFrom: null, dragTo: null },
      });
      if (state.autoRun) runCurrentScript();
    } else {
      setState({ editingBimp: { ...cur, dragFrom: null, dragTo: null } });
    }
  },
  onBimpToolSelect: (tool: BimpTool) => {
    if (!state.editingBimp) return;
    setState({
      editingBimp: {
        ...state.editingBimp,
        activeTool: tool,
        dragFrom: null,
        dragTo: null,
      },
    });
  },
  onBimpShift: (dx: number, dy: number) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const bimp = new Bimp(cur.width, cur.height, cur.pixels);
    const pixels = Array.from(bimp.shift(dx, dy).pixels);
    setState({ editingBimp: { ...cur, pixels } });
    if (state.autoRun) runCurrentScript();
  },
  onBimpBrushSelect: (value: number) => {
    if (!state.editingBimp) return;
    setState({ editingBimp: { ...state.editingBimp, brushValue: value } });
  },
  onBimpResize: (newWidth: number, newHeight: number) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const w = Math.max(1, Math.min(64, Math.floor(newWidth)));
    const h = Math.max(1, Math.min(64, Math.floor(newHeight)));
    if (w === cur.width && h === cur.height) return;
    const pixels = new Array(w * h).fill(0);
    for (let y = 0; y < Math.min(h, cur.height); y++) {
      for (let x = 0; x < Math.min(w, cur.width); x++) {
        pixels[y * w + x] = cur.pixels[y * cur.width + x];
      }
    }
    setState({ editingBimp: { ...cur, width: w, height: h, pixels } });
    if (state.autoRun) runCurrentScript();
  },
  onBimpZoom: (delta: number) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const next = Math.max(6, Math.min(80, cur.cellSize + delta));
    if (next === cur.cellSize) return;
    setState({ editingBimp: { ...cur, cellSize: next } });
  },
  onBimpPaletteColorChange: (index: number, color: string) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const palette = (cur.palette ?? []).slice();
    if (index < 0 || index >= palette.length) return;
    if (palette[index].color === color) return;
    palette[index] = { ...palette[index], color };
    setState({ editingBimp: { ...cur, palette } });
    if (state.autoRun) runCurrentScript();
  },
  onBimpPaletteLabelChange: (index: number, label: string) => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const palette = (cur.palette ?? []).slice();
    if (index < 0 || index >= palette.length) return;
    if (palette[index].label === label) return;
    palette[index] = { ...palette[index], label };
    setState({ editingBimp: { ...cur, palette } });
    // Label changes don't affect the runtime program (they're metadata
    // for the editor only), but we still auto-save so the source updates.
  },
  onBimpPaletteAdd: () => {
    if (!state.editingBimp) return;
    const cur = state.editingBimp;
    const palette = (cur.palette ?? []).slice();
    palette.push({ color: "#888888", label: "" });
    setState({ editingBimp: { ...cur, palette } });
    if (state.autoRun) runCurrentScript();
  },
  onToggleAutoRun: () => {
    const next = !state.autoRun;
    setState({ autoRun: next });
    // Turning auto-run on should sync the view with the current code.
    if (next) runCurrentScript();
  },
  onDocChange: () => {
    scheduleAutoRun();
    scheduleAutoSave();
  },
  onToggleScriptPicker: () =>
    setState({
      showScriptPicker: !state.showScriptPicker,
      savedScripts: loadAllScripts(),
    }),
  onLoadScript: loadSavedScript,
  onDeleteScript: (name: string) => {
    deleteScript(name);
    const scripts = loadAllScripts();
    setState({ savedScripts: scripts });
    // If we deleted the current script, fall back to the first example.
    if (state.scriptId.type === "saved" && state.scriptId.name === name) {
      const ex = EXAMPLES[0];
      setState({
        code: ex.code,
        scriptId: { type: "example", name: ex.name },
      });
      setEditorCode(ex.code);
      saveLastOpened({ type: "example", name: ex.name });
      runWithCode(ex.code, true);
    }
  },
  onRenameCurrentScript: (newName: string) => {
    if (state.scriptId.type !== "saved") return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === state.scriptId.name) {
      // Force re-render so the input reverts to the stored name.
      setState({ savedScripts: loadAllScripts() });
      return;
    }
    if (!renameScript(state.scriptId.name, trimmed)) {
      // Duplicate / empty — revert input display.
      setState({ savedScripts: loadAllScripts() });
      return;
    }
    setState({
      scriptId: { type: "saved", name: trimmed },
      savedScripts: loadAllScripts(),
    });
    saveLastOpened({ type: "saved", name: trimmed });
  },
  onDownloadBmp: () => {
    if (!lastProgram) return;
    triggerDownload(
      encodeOpsBmp(lastProgram.ops),
      "program.bmp",
      "image/bmp"
    );
  },
  onDownloadJson: () => {
    if (!lastProgram) return;
    triggerDownload(
      encodeControlJson(lastProgram),
      "program.json",
      "application/json"
    );
  },
  onDownloadScript: () => {
    const code = getEditorCode();
    const baseName = state.scriptId.name.replace(/[^\w\-. ]/g, "_").trim();
    const filename = `${baseName || "script"}.js`;
    triggerDownload(code, filename, "application/javascript");
  },
  onToggleSimSettings: () =>
    setState({ simShowSettings: !state.simShowSettings }),
  onRelaxSettingChange: (key, value) => {
    (liveRelaxSettings[key] as number) = value as number;
    setState({ relaxSettings: { ...liveRelaxSettings } });
    // Push the change into the worker so it takes effect on the next tick,
    // then restart to re-anneal α and show the new parameter's behavior.
    if (simUpdateSettings) simUpdateSettings({ [key]: value });
    if (simRestart) {
      simRestart();
      setState({ simState: "relaxing" });
    }
  },
  onResetRelaxSettings: () => {
    Object.assign(liveRelaxSettings, DEFAULT_RELAX_SETTINGS);
    setState({ relaxSettings: { ...liveRelaxSettings } });
    if (simUpdateSettings) simUpdateSettings(DEFAULT_RELAX_SETTINGS);
    if (simRestart) {
      simRestart();
      setState({ simState: "relaxing" });
    }
  },
};

function loop() {
  if (needsRender) {
    needsRender = false;
    render(view(state, handlers), document.body);
  }

  if (simDraw) simDraw();

  // Update tick timing and detect when relaxation finishes
  if (state.simState === "relaxing") {
    const patch: Partial<AppState> = {};
    if (simGetTickMs) patch.tickMs = simGetTickMs();
    if (simGetAlpha) patch.simAlpha = simGetAlpha();
    if (Object.keys(patch).length) setState(patch);
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

    // Ctrl/Cmd+S downloads the current script.
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "s") {
        e.preventDefault();
        handlers.onDownloadScript();
      }
    });

    // Escape closes any open modal
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (state.editingBimp) {
        e.preventDefault();
        setState({ editingBimp: null });
      } else if (state.showHelp) {
        e.preventDefault();
        setState({ showHelp: false });
      } else if (state.showExamplePicker) {
        e.preventDefault();
        setState({ showExamplePicker: false });
      } else if (state.showScriptPicker) {
        e.preventDefault();
        setState({ showScriptPicker: false });
      }
    });

    // Sync sidebar vertical position with the ops scroll container, and
    // forward wheel scrolls over the sidebar (it has overflow:hidden) to it.
    const chartScroll = document.getElementById("chart-scroll");
    const sidebarInner = document.getElementById("chart-sidebar-inner");
    const sidebarWrap = document.getElementById("chart-sidebar-wrap");
    chartScroll?.addEventListener("scroll", () => {
      if (sidebarInner)
        sidebarInner.style.transform = `translateY(${-chartScroll.scrollTop}px)`;
    });
    sidebarWrap?.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey || !chartScroll) return;
        e.preventDefault();
        chartScroll.scrollBy({ top: e.deltaY, left: e.deltaX });
      },
      { passive: false }
    );

    // Drag-to-pan: ops grid pans both axes, sidebar drags vertically only.
    // If the pointer doesn't actually move, treat it as a click and scrub.
    const DRAG_THRESHOLD_PX = 4;
    const startPan = (e: PointerEvent, allowX: boolean) => {
      if (e.button !== 0 || !chartScroll) return;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = chartScroll.scrollLeft;
      const startScrollTop = chartScroll.scrollTop;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        if (!moved) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
            moved = true;
            document.body.style.cursor = "grabbing";
          } else {
            return;
          }
        }
        chartScroll.scrollTop = startScrollTop - (ev.clientY - startY);
        if (allowX)
          chartScroll.scrollLeft = startScrollLeft - (ev.clientX - startX);
      };
      const onEnd = (ev: PointerEvent) => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onEnd);
        target.removeEventListener("pointercancel", onEnd);
        document.body.style.cursor = "";
        if (!moved && allowX && lastProgram && opsCanvas) {
          // Click without drag on the ops grid → scrub to that cell.
          const cs = state.cellSize;
          const h = lastProgram.height;
          const w = lastProgram.width;
          const rect = opsCanvas.getBoundingClientRect();
          const x = ev.clientX - rect.left;
          const y = ev.clientY - rect.top;
          const col = Math.floor(x / cs);
          const rowFromTop = Math.floor(y / cs);
          if (col >= 0 && col < w && rowFromTop >= 0 && rowFromTop < h) {
            const row = h - 1 - rowFromTop;
            handlers.onScrub(rowColToStitch(lastProgram, row, col));
          }
        }
      };
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onEnd);
      target.addEventListener("pointercancel", onEnd);
      e.preventDefault();
    };
    chartScroll?.addEventListener("pointerdown", (e) => startPan(e, true));
    sidebarWrap?.addEventListener("pointerdown", (e) => startPan(e, false));

    // Hover: track row/col under cursor, update bottom-bar text and row stripe.
    const chartContent = document.getElementById("chart-content");
    const opsCanvas = document.getElementById(
      "chart-canvas"
    ) as HTMLCanvasElement | null;
    const sidebarCanvas = document.getElementById(
      "chart-sidebar"
    ) as HTMLCanvasElement | null;
    const coordEl = document.getElementById("chart-coord");
    const rowHighlight = document.getElementById("chart-row-highlight");
    const colHighlight = document.getElementById("chart-col-highlight");
    let lastMouse: { x: number; y: number } | null = null;

    const hideHover = () => {
      if (coordEl) coordEl.innerHTML = "&nbsp;";
      if (rowHighlight) rowHighlight.classList.add("hidden");
      if (colHighlight) colHighlight.classList.add("hidden");
    };

    const updateHover = () => {
      if (!lastMouse || !lastProgram || !opsCanvas || !chartContent)
        return hideHover();
      const cs = state.cellSize;
      const h = lastProgram.height;
      const w = lastProgram.width;

      const opsRect = opsCanvas.getBoundingClientRect();
      const yInCanvas = lastMouse.y - opsRect.top;
      const rowFromTop = Math.floor(yInCanvas / cs);
      if (rowFromTop < 0 || rowFromTop >= h) return hideHover();
      const row = h - 1 - rowFromTop;

      const xInCanvas = lastMouse.x - opsRect.left;
      const overOps =
        xInCanvas >= 0 && xInCanvas < w * cs && lastMouse.x <= opsRect.right;
      const col = overOps ? Math.floor(xInCanvas / cs) : -1;

      let label = `row ${row + 1}`;
      if (overOps) {
        const opIdx = lastProgram.ops.pixel(col, row);
        const opName = Op[opIdx] ?? "?";
        label = `row ${row + 1}, col ${col + 1} \u2014 Op.${opName}`;
      } else if (sidebarCanvas) {
        const sbRect = sidebarCanvas.getBoundingClientRect();
        const xInSb = lastMouse.x - sbRect.left;
        const layout = sidebarLayout(h);
        const which = sidebarColumnAt(xInSb, layout);
        if (which === "racking") {
          label += `, racking ${lastProgram.racking[row] ?? 0}`;
        } else if (which === "yarn") {
          label += `, yarn ${lastProgram.yarnFeeder[row] ?? "none"}`;
        } else if (which === "direction") {
          label += `, direction ${lastProgram.direction[row] ?? "right"}`;
        }
      }
      if (coordEl) coordEl.textContent = label;

      if (rowHighlight) {
        const contentRect = chartContent.getBoundingClientRect();
        const top = opsRect.top - contentRect.top + rowFromTop * cs;
        rowHighlight.style.top = `${top}px`;
        rowHighlight.style.height = `${cs}px`;
        rowHighlight.classList.remove("hidden");
      }
      if (colHighlight) {
        if (overOps) {
          colHighlight.style.left = `${col * cs}px`;
          colHighlight.style.top = "0";
          colHighlight.style.width = `${cs}px`;
          colHighlight.style.height = `${h * cs}px`;
          colHighlight.classList.remove("hidden");
        } else {
          colHighlight.classList.add("hidden");
        }
      }
    };

    chartContent?.addEventListener("mousemove", (e) => {
      lastMouse = { x: e.clientX, y: e.clientY };
      updateHover();
    });
    chartContent?.addEventListener("mouseleave", () => {
      lastMouse = null;
      hideHover();
    });

    chartScroll?.addEventListener("scroll", () => {
      updateHover();
      updateScrubHighlight();
    });

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
          updateScrubHighlight();
        }
      },
      { passive: false }
    );

    // Restore the last-opened script (saved or example), else fall back
    // to the first bundled example.
    const last = loadLastOpened();
    let bootCode: string | null = null;
    if (last?.type === "saved") {
      const script = getScript(last.name);
      if (script) {
        bootCode = script.code;
        setState({
          code: script.code,
          scriptId: { type: "saved", name: last.name },
        });
        setEditorCode(script.code);
      }
    } else if (last?.type === "example") {
      const ex = EXAMPLES.find((e) => e.name === last.name);
      if (ex) {
        bootCode = ex.code;
        setState({
          code: ex.code,
          scriptId: { type: "example", name: ex.name },
        });
        setEditorCode(ex.code);
      }
    }
    if (bootCode === null) {
      const ex = EXAMPLES[0];
      bootCode = ex.code;
      setState({
        code: ex.code,
        scriptId: { type: "example", name: ex.name },
      });
      saveLastOpened({ type: "example", name: ex.name });
    }
    runWithCode(bootCode, true);
  });
}

window.onload = init;
