import { Bimp } from "./lib/Bimp";
import {
  SNAPSHOT_INTERVAL,
  MAX_SNAPSHOTS,
  DEFAULT_PATTERN_LIBRARY,
  DEFAULT_SYMBOLS,
  SNAPSHOT_FIELDS,
} from "./constants";
import type {
  GlobalState,
  StateObserver,
  ComponentFactory,
} from "./types";

let GLOBAL_STATE: GlobalState = {
  editingPalette: false,
  transforming: false,

  activeTool: "brush",
  activeSymbol: 0,

  chartBackground: "#ffffff",
  symbolPalette: {},
  symbolMap: DEFAULT_SYMBOLS,
  patternLibrary: DEFAULT_PATTERN_LIBRARY,

  scale: 15,
  pos: [-1, -1],
  chartPan: [0, 0],

  simScale: 1,
  simPan: [0, 0],

  activeYarn: 0,
  yarnPalette: [
    "rgba(16,18,189,1)",
    "rgba(235,233,187,1)",
    "rgba(247,85,0,1)",
  ],
  yarnSequence: new Bimp(1, 8, [1, 1, 1, 1, 2, 2, 0, 0]),

  repeatPos: [-1, -1],

  repeats: [
    {
      bitmap: new Bimp(
        4,
        8,
        [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 3, 0, 0, 0, 3,
          0, 0, 0, 3, 0, 0, 0, 3, 0, 0,
        ]
      ),
    },
  ],

  repeatLibrary: [
    {
      title: "blank",
      bitmap: new Bimp(2, 2, [0, 0, 0, 0]),
    },
    {
      title: "checks",
      bitmap: new Bimp(2, 2, [0, 2, 2, 0]),
    },
    {
      title: "stripe",
      bitmap: new Bimp(2, 2, [0, 2, 0, 2]),
    },
  ],

  chart: Bimp.empty(48, 60, 0),

  reverseScroll: false,
  grid: true,
  symbolLineWidth: 3,
  flipped: false,

  // PUNCH CARD
  punchcardMode: false,
  machine: "th860",
  punchVerticalRepeats: 5,
  rows: 40,
  numSides: 8,

  // Various UI pane states
  showLibrary: false,
  showSettings: false,
  showDownload: false,
  showRepeatLibrary: false,

  snapshots: [],
  lastSnapshot: 0,
  heldKeys: new Set(),
};

function loadWorkspace(workspace: Partial<GlobalState>): void {
  _needsRender = true;
  GLOBAL_STATE = { ...GLOBAL_STATE, ...workspace };
  GLOBAL_STATE.updateSim = true;
}

function shouldSnapshot(action: Partial<GlobalState>): boolean {
  if (!(GLOBAL_STATE.lastSnapshot < Date.now() - SNAPSHOT_INTERVAL))
    return false;

  for (const field of SNAPSHOT_FIELDS) {
    if (field in action) return true;
  }

  return false;
}

function snapshotUpdate(action: Partial<GlobalState>): GlobalState {
  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...action,
    snapshots: [
      Object.fromEntries(
        SNAPSHOT_FIELDS.map((field) => [field, GLOBAL_STATE[field]])
      ),
      ...GLOBAL_STATE.snapshots,
    ].slice(0, MAX_SNAPSHOTS),
    lastSnapshot: Date.now(),
  };

  return GLOBAL_STATE;
}

function normalUpdate(action: Partial<GlobalState>): GlobalState {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...action };
  return GLOBAL_STATE;
}

function updateState(action: Partial<GlobalState>): GlobalState {
  return shouldSnapshot(action) ? snapshotUpdate(action) : normalUpdate(action);
}

function undo(): void {
  _needsRender = true;
  if (GLOBAL_STATE.snapshots.length < 1) return;
  const changes = Object.keys(GLOBAL_STATE.snapshots[0]);

  GLOBAL_STATE = {
    ...GLOBAL_STATE,
    ...(GLOBAL_STATE.snapshots[0] as Partial<GlobalState>),
    lastSnapshot: 0,
    snapshots: GLOBAL_STATE.snapshots.slice(1),
  };

  StateMonitor.syncState(GLOBAL_STATE, changes);
}

function dispatch(action: Partial<GlobalState>): void {
  _needsRender = true;
  const changes = Object.keys(action);
  StateMonitor.syncState(updateState(action), changes);
}

const StateMonitor = (() => {
  const components: StateObserver[] = [];

  function syncState(state: GlobalState, changes: string[]): void {
    components.forEach((component) => {
      component.syncState(state, changes);
    });
  }

  function register(componentArr: ComponentFactory[]): void {
    componentArr.forEach((component) =>
      components.push(component({ state: GLOBAL_STATE, dispatch }))
    );
  }

  return {
    register,
    syncState,
  };
})();

let _needsRender = true;

export const renderState = {
  get needsRender() {
    return _needsRender;
  },
  consume() {
    _needsRender = false;
  },
};

export { GLOBAL_STATE, undo, dispatch, StateMonitor, loadWorkspace };
