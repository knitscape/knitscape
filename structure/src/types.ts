import type { Bimp } from "./lib/Bimp";

export type Vec2 = [number, number];

export type SymbolName = "knit" | "purl" | "slip" | "tuck";

export type ToolName = "brush" | "flood" | "rect" | "line" | "shift" | "move";

export interface PixelChange {
  x: number;
  y: number;
  color: number;
}

export interface RepeatBlock {
  bitmap: Bimp;
}

export interface RepeatLibraryItem {
  title: string;
  bitmap: Bimp;
}

export interface ToolData {
  icon?: string;
  hotkey: string;
}

export interface StateObserver {
  syncState(state: GlobalState, changes?: string[]): void;
}

export type ComponentFactory = (init: {
  state: GlobalState;
  dispatch: DispatchFn;
}) => StateObserver;

export type DispatchFn = (action: Partial<GlobalState>) => void;

export interface BimpJSON {
  width: number;
  height: number;
  pixels: number[];
}

export interface PatternJSON {
  width: number;
  height: number;
  yarnPalette: string[];
  yarnSequence: BimpJSON;
  repeats: {
    bitmap: BimpJSON;
  }[];
}

export type PatternLibrary = Record<string, () => Promise<PatternJSON>>;

export interface GlobalState {
  editingPalette: boolean;

  activeTool: ToolName;
  activeSymbol: number;

  symbolMap: SymbolName[];
  patternLibrary: PatternLibrary;

  scale: number;
  pos: Vec2;
  chartPan: Vec2;

  simScale: number;
  simPan: Vec2;

  activeYarn: number;
  yarnPalette: string[];
  yarnSequence: Bimp;

  repeatPos: Vec2;

  repeats: RepeatBlock[];
  repeatLibrary: RepeatLibraryItem[];

  chart: Bimp;

  reverseScroll: boolean;
  grid: boolean;
  symbolLineWidth: number;
  flipped: boolean;

  // Punchcard
  machine: string;
  punchVerticalRepeats: number;
  rows: number;
  numSides: number;

  // UI pane states
  showLibrary: boolean;
  showSettings: boolean;
  showDownload: boolean;

  snapshots: Record<string, unknown>[];
  lastSnapshot: number;
  heldKeys: Set<string>;

  updateSim?: boolean;
}
