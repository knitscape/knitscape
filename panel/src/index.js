import Split from "split.js";
import { render } from "lit-html";

import { GLOBAL_STATE, StateMonitor } from "./state";

import { runSimulation } from "./subscribers/runSimulation";
// import { visualizationSubscriber } from "./subscribers/visualizationSubscriber";
import { chartSubscriber } from "./subscribers/chartSubscriber";
import { blockSubscriber } from "./subscribers/blockSubscriber";
import { blockFillSubscriber } from "./subscribers/blockFillSubscriber";
import { chartEvalSubscriber } from "./subscribers/chartEvalSubscriber";
import { pathTileSubscriber } from "./subscribers/pathTileSubscriber";
import { timeNeedleSubscriber } from "./subscribers/timeNeedleViewSubscriber";
import { globalKeydown, globalKeyup } from "./interaction/globalKeypress";

import { hydrateWorkspaceJSON } from "./utilities/importers";
import { measureWindow } from "./utilities/misc";
import { fitChart } from "./interaction/chartPanZoom";

import { mainView } from "./views/mainView";

const DEFAULT_WORKSPACE = "rib";

function r() {
  render(mainView(), document.body);
  window.requestAnimationFrame(r);
}

async function init() {
  const workspace = await GLOBAL_STATE.exampleLibrary[
    `../examples/${DEFAULT_WORKSPACE}.json`
  ]();

  hydrateWorkspaceJSON(workspace);

  r();

  Split(["#chart-pane", "#view-pane"], {
    sizes: [30, 70],
    minSize: 100,
    gutterSize: 8,
  });

  window.addEventListener("keydown", globalKeydown);
  window.addEventListener("keyup", globalKeyup);

  StateMonitor.requestRender = () => render(mainView(), document.body);

  StateMonitor.register([
    chartEvalSubscriber(),
    chartSubscriber(),
    blockSubscriber(),
    blockFillSubscriber(),
    pathTileSubscriber(),
    timeNeedleSubscriber(),
    runSimulation(),
  ]);

  measureWindow();

  setTimeout(() => fitChart());
}

window.onload = init;
window.onresize = measureWindow;
