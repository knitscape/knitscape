import {
  SNAPSHOT_INTERVAL,
  SNAPSHOT_FIELDS,
  EXAMPLE_LIBRARY,
} from "./constants";

let GLOBAL_STATE = {
  exampleLibrary: EXAMPLE_LIBRARY,

  heldKeys: new Set(), // Keys that are currently held down
  snapshots: [], // Array of snapshot history
  lastSnapshot: 0, // time of last snapshot
  transforming: false, // If the pointer is being used to do something

  // Chart view states
  colorMode: "yarn", // operation or yarn
  annotations: true, // slope and point annotations for paths and boundaries

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
  bbox: { xMin: 0, yMin: 0 },

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

function shouldSnapshot(action) {
  if (!(GLOBAL_STATE.lastSnapshot < Date.now() - SNAPSHOT_INTERVAL))
    return false;

  for (const field of SNAPSHOT_FIELDS) {
    if (field in action) return true;
  }

  return false;
}

function snapshotUpdate(action) {
  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...action,
    snapshots: [
      Object.fromEntries(
        SNAPSHOT_FIELDS.map((field) => [field, GLOBAL_STATE[field]])
      ),
      ...GLOBAL_STATE.snapshots,
    ],
    lastSnapshot: Date.now(),
  };

  return GLOBAL_STATE;
}

function normalUpdate(action) {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...action };
  return GLOBAL_STATE;
}

function updateState(action) {
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

  StateMonitor.syncState(GLOBAL_STATE, changes);
}

function dispatch(action, requestRender = false) {
  const changes = Object.keys(action);

  if (requestRender) {
    updateState(action);
    StateMonitor.requestRender();
    StateMonitor.syncState(GLOBAL_STATE, changes);
  } else {
    StateMonitor.syncState(updateState(action), changes);
  }
}

const StateMonitor = (() => {
  const components = [];

  function syncState(state, changes) {
    components.forEach((component) => {
      component.syncState(state, changes);
    });
  }

  function register(componentArr) {
    componentArr.forEach((component) =>
      components.push(component({ state: GLOBAL_STATE }))
    );
  }

  return {
    register,
    syncState,
  };
})();

export { GLOBAL_STATE, undo, dispatch, StateMonitor };
