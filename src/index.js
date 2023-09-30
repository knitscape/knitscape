import { render } from "lit-html";
import Split from "split.js";

import { GLOBAL_STATE, StateMonitor } from "./state";

import { fitChart } from "./actions/zoomFit";

import { view } from "./views/view";

import { DEFAULT_SYMBOLS, SYMBOL_DIR } from "./constants";

import { chartCanvas } from "./components/chartCanvas";
import { gridCanvas } from "./components/gridCanvas";
import { outlineCanvas } from "./components/outlineCanvas";

import { addKeypressListeners } from "./events/keypressEvents";
import { chartPointerInteraction } from "./events/chartPointerInteraction";
import { chartTouchInteraction } from "./events/chartTouchInteraction";

import { closeModals } from "./events/closeModals";
import { trackPointer } from "./events/trackPointer";
import { trackTouch } from "./events/trackTouch";
import { addPointerIcon } from "./events/addPointerIcon";

import { loadSymbol } from "./actions/importers";

import { isMobile } from "./utils";

function r() {
  render(view(), document.body);
  window.requestAnimationFrame(r);
}

function initKeyboard() {
  addKeypressListeners();
  trackPointer({ target: document.getElementById("outline") });
  addPointerIcon(
    document.getElementById("pointer"),
    document.getElementById("desktop")
  );
  chartPointerInteraction({
    target: document.getElementById("outline"),
    desktop: document.getElementById("desktop"),
  });
  closeModals();
}

function initTouch() {
  document.body.style.setProperty("--font-size", "1.2rem");
  trackTouch({ target: document.getElementById("outline") });
  chartTouchInteraction({
    target: document.getElementById("outline"),
    desktop: document.getElementById("desktop"),
  });
  closeModals();
}

function calcSplit() {
  const portrait = screen.availHeight > screen.availWidth;
  document
    .getElementById("site")
    .style.setProperty("flex-direction", portrait ? "column" : "row");

  return portrait
    ? Split(["#chart-pane", "#sim-pane"], {
        sizes: [90, 10],
        minSize: 100,
        gutterSize: 11,
        direction: "vertical",
      })
    : Split(["#chart-pane", "#sim-pane"], {
        sizes: [90, 10],
        minSize: 100,
        gutterSize: 11,
      });
}

function measureWindow() {
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`
  );
  document.documentElement.style.setProperty(
    "--vw",
    `${window.innerWidth * 0.01}px`
  );
}

function init() {
  DEFAULT_SYMBOLS.forEach((symbolName) =>
    loadSymbol(symbolName, `${SYMBOL_DIR}/${symbolName}.png`)
  );

  r();

  calcSplit();

  isMobile() ? initTouch() : initKeyboard();
  StateMonitor.register([
    chartCanvas({ canvas: document.getElementById("chart") }),
    gridCanvas({ canvas: document.getElementById("grid") }),
    outlineCanvas({ canvas: document.getElementById("outline") }),
  ]);

  measureWindow();
  fitChart();
}

window.onload = init;
window.onresize = measureWindow;