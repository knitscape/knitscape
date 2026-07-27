import Split from "split.js";
import { render } from "lit-html";

import { GLOBAL_STATE, StateMonitor, consumeDirty, markDirty } from "./state";

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

// Render right now, whether or not anything is marked dirty. Used for the first
// paint and for dispatches that need the DOM current before subscribers run.
function renderView() {
  consumeDirty();
  render(mainView(), document.body);
}

function renderLoop() {
  if (consumeDirty()) render(mainView(), document.body);
  window.requestAnimationFrame(renderLoop);
}

async function init() {
  const workspace = await GLOBAL_STATE.exampleLibrary[
    `../examples/${DEFAULT_WORKSPACE}.json`
  ]();

  hydrateWorkspaceJSON(workspace as any);

  // Split() needs the panes to exist, so the first paint has to be synchronous.
  renderView();
  renderLoop();

  Split(["#chart-pane", "#view-pane"], {
    sizes: [30, 70],
    minSize: 100,
    gutterSize: 8,
  });

  window.addEventListener("keydown", globalKeydown);
  window.addEventListener("keyup", globalKeyup);

  StateMonitor.requestRender = renderView;

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
window.onresize = () => {
  measureWindow();
  markDirty();
};
