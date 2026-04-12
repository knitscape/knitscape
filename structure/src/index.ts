import { render } from "lit-html";
import Split from "split.js";

import { StateMonitor, renderState } from "./state";

import { fitChart, fitSimulation } from "./actions/zoomFit";

import { view } from "./views/view";

import { yarnSequenceCanvas } from "./components/yarnSequenceCanvas";

// Chart View Canvas Layers
import { drawYarnColors } from "./components/drawYarnColors";
import { drawSymbols } from "./components/drawSymbols";
import { drawGrid } from "./components/drawGrid";
import { drawRepeats } from "./components/drawRepeats";

// Pointer/keyboard interaction
import { addKeypressListeners } from "./events/keypressEvents";
import { desktopPointerPanZoom } from "./events/desktopPointerPanZoom";
import { colorSequencePointerInteraction } from "./events/colorSequencePointerInteraction";
import { repeatPointerInteraction } from "./events/repeatPointerInteraction";
import { simulationPointerInteraction } from "./events/simulationPointerInteraction";

// Touch interaction
import { desktopTouchPanZoom } from "./events/desktopTouchPanZoom";
import { colorSequenceTouchInteraction } from "./events/colorSequenceTouchInteraction";
import { repeatTouchInteraction } from "./events/repeatTouchInteraction";
import { simulationTouchInteraction } from "./events/simulationTouchInteraction";

import { drawSymbolPicker } from "./components/drawSymbolPicker";
import { resizeCanvases } from "./components/resizeCanvases";
import { runSimulation } from "./components/runSimulation";
import { closeModals } from "./events/closeModals";
import { generateChart } from "./components/generateChart";
import { isMobile } from "./utils";

let symbolCanvas: HTMLCanvasElement,
  gridCanvas: HTMLCanvasElement,
  yarnColorCanvas: HTMLCanvasElement,
  desktop: HTMLElement,
  repeatContainer: HTMLElement,
  yarnSequenceEditorCanvas: HTMLCanvasElement,
  colorDragger: HTMLElement,
  simContainer: HTMLElement;

function r(): void {
  if (renderState.needsRender) {
    renderState.consume();
    render(view(), document.body);
  }
  window.requestAnimationFrame(r);
}

function initKeyboard(): void {
  addKeypressListeners();

  desktopPointerPanZoom(desktop);
  repeatPointerInteraction(repeatContainer);
  colorSequencePointerInteraction(yarnSequenceEditorCanvas, colorDragger);
  simulationPointerInteraction(simContainer);
  closeModals();
}

function initTouch(): void {
  document.body.style.setProperty("--font-size", "1.1rem");

  desktopTouchPanZoom(desktop);
  repeatTouchInteraction(repeatContainer);
  colorSequenceTouchInteraction(yarnSequenceEditorCanvas, colorDragger);
  simulationTouchInteraction(simContainer);
  closeModals();
}

function measureWindow(): void {
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`
  );
  document.documentElement.style.setProperty(
    "--vw",
    `${window.innerWidth * 0.01}px`
  );
}

function init(): void {
  r();

  symbolCanvas = document.getElementById(
    "symbol-canvas"
  ) as HTMLCanvasElement;
  gridCanvas = document.getElementById("grid") as HTMLCanvasElement;
  yarnColorCanvas = document.getElementById(
    "yarn-color-canvas"
  ) as HTMLCanvasElement;
  yarnSequenceEditorCanvas = document.getElementById(
    "yarn-sequence-canvas"
  ) as HTMLCanvasElement;
  desktop = document.getElementById("desktop")!;
  repeatContainer = document.getElementById("repeat-container")!;
  simContainer = document.getElementById("sim-container")!;
  colorDragger = document.getElementById("color-dragger")!;

  Split(["#chart-pane", "#sim-pane"], {
    sizes: [60, 40],
    minSize: 100,
    gutterSize: 11,
  });

  isMobile() ? initTouch() : initKeyboard();

  StateMonitor.register([
    resizeCanvases([symbolCanvas, gridCanvas, yarnColorCanvas]),
    yarnSequenceCanvas({
      canvas: yarnSequenceEditorCanvas,
    }),
    drawSymbols(symbolCanvas),
    drawYarnColors(yarnColorCanvas),
    drawGrid(gridCanvas),
    drawRepeats(),
    drawSymbolPicker(),
    runSimulation(),
    generateChart(),
  ]);

  measureWindow();
  fitChart();
  fitSimulation();
}

window.onload = init;
window.onresize = measureWindow;
