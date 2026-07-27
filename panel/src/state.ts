import {
  SNAPSHOT_INTERVAL,
  SNAPSHOT_FIELDS,
  EXAMPLE_LIBRARY,
} from "./constants";
import type { GlobalState, StateMonitorType, SubscriberFactory } from "./types";

let GLOBAL_STATE: GlobalState = {
  exampleLibrary: EXAMPLE_LIBRARY,

  heldKeys: new Set(), // Keys that are currently held down
  snapshots: [], // Array of snapshot history
  lastSnapshot: 0, // time of last snapshot
  transforming: false, // If the pointer is being used to do something

  // Chart view states
  colorMode: "yarn", // operation or yarn
  annotations: false, // slope and point annotations for paths and boundaries

  // Interaction mode can be path, boundary, or block.
  interactionMode: "boundary",
  pointer: [0, 0], // Pointer postition in chart coordinates
  locked: false,

  cellAspect: 0.75,

  activeTool: "pointer",
  activeSymbol: 1,
  activeYarn: 1,

  boundaries: [],
  regions: [],
  paths: [],
  blocks: [],

  blockEditMode: null, // Can be yarn, stitch, or null
  activeBlockTool: "brush",

  // TODO: How to handle selections better? How to implement multi-select?
  selectedBoundary: null,
  selectedPath: null,
  selectedBlock: null,

  stitchSelect: null,

  tucks: false,

  chart: null,
  yarnChart: null,
  machineChart: null,
  rowMap: null,
  yarnSequence: [],
  passSchedule: [],
  yarnSchedule: [],

  scale: 15, // Number of pixels for each chart cell
  cellWidth: 15 / 7,
  cellHeight: 15 / 11,

  chartPan: { x: 0, y: 0 }, // Pan value for the chart editor view
  bbox: { xMin: 0, yMin: 0, xMax: 0, yMax: 0, width: 0, height: 0 },

  // SIMULATION
  simScale: 1,
  simPan: { x: 0, y: 0 },
  simLive: true,
  kYarn: 0.4,

  // YARN
  yarnPalette: null,
  yarnWidth: 0.25,

  // Various UI pane states
  showSettings: false,
  showDownload: false,
  showUpload: false,
  showExampleLibrary: false,
  yarnExpanded: false,
  showTimeNeedleView: false,

  // INTERACTION
  reverseScroll: false,
};

// The main view is re-rendered from a requestAnimationFrame loop. Rather than
// rebuilding the whole lit template 60 times a second whether or not anything
// changed, the loop only renders when something has marked the view dirty.
//
// dispatch() marks it for you. Anything that changes what a view reads WITHOUT
// going through dispatch — direct GLOBAL_STATE writes, or module-local state a
// view closes over — has to call markDirty() itself, or its change will not
// show up until the next unrelated render.
let viewDirty = true;

function markDirty() {
  viewDirty = true;
}

// Returns whether a render is needed, and clears the flag.
function consumeDirty() {
  const wasDirty = viewDirty;
  viewDirty = false;
  return wasDirty;
}

function shouldSnapshot(action: Partial<GlobalState>) {
  if (!(GLOBAL_STATE.lastSnapshot < Date.now() - SNAPSHOT_INTERVAL))
    return false;

  for (const field of SNAPSHOT_FIELDS) {
    if (field in action) return true;
  }

  return false;
}

function snapshotUpdate(action: Partial<GlobalState>) {
  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...action,
    snapshots: [
      Object.fromEntries(
        SNAPSHOT_FIELDS.map((field) => [field, (GLOBAL_STATE as unknown as Record<string, unknown>)[field]])
      ),
      ...GLOBAL_STATE.snapshots,
    ],
    lastSnapshot: Date.now(),
  };

  return GLOBAL_STATE;
}

function normalUpdate(action: Partial<GlobalState>) {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...action };
  return GLOBAL_STATE;
}

function updateState(action: Partial<GlobalState>) {
  // return shouldSnapshot(action) ? snapshotUpdate(action) : normalUpdate(action);

  return normalUpdate(action);
}

function undo() {
  if (GLOBAL_STATE.snapshots.length < 1) return;
  const changes = Object.keys(GLOBAL_STATE.snapshots[0]);

  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...GLOBAL_STATE.snapshots[0],
    lastSnapshot: 0,
    snapshots: GLOBAL_STATE.snapshots.slice(1),
  };

  markDirty();
  StateMonitor.syncState(GLOBAL_STATE, changes);
}

function dispatch(action: Partial<GlobalState>, requestRender = false) {
  const changes = Object.keys(action);

  markDirty();

  if (requestRender) {
    updateState(action);
    if (StateMonitor.requestRender) StateMonitor.requestRender();
    StateMonitor.syncState(GLOBAL_STATE, changes);
  } else {
    StateMonitor.syncState(updateState(action), changes);
  }
}

const StateMonitor: StateMonitorType = (() => {
  const components: { syncState: (state: GlobalState, changes?: string[]) => void }[] = [];
  let renderCallback: (() => void) | undefined;

  function syncState(state: GlobalState, changes?: string[]) {
    components.forEach((component) => {
      component.syncState(state, changes);
    });
  }

  function register(componentArr: SubscriberFactory[]) {
    componentArr.forEach((component) =>
      components.push(component({ state: GLOBAL_STATE }))
    );
  }

  function requestRender() {
    if (renderCallback) renderCallback();
  }

  const monitor = {
    register,
    syncState,
    requestRender,
    setRenderCallback(cb: () => void) {
      renderCallback = cb;
    },
  };

  return monitor;
})() as StateMonitorType & { setRenderCallback?: (cb: () => void) => void };

export { GLOBAL_STATE, undo, dispatch, StateMonitor, markDirty, consumeDirty };
