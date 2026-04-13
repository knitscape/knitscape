import type { Bimp, BimpJSON } from "@shared/Bimp";
import type { ColorMode } from "@shared/chartSymbols";


export type Vec2 = [number, number];

export type Pan = { x: number; y: number };

export type BBox = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  width: number;
  height: number;
};

export type Boundary = Vec2[];

export interface Region {
  pos: Vec2;
  joinMode: string;
  shaping: number;
  yarnBlock: Bimp;
  stitchBlock: Bimp;
}

export interface KnitPath {
  pts: Vec2[];
  offset: Vec2;
  tileMode: string;
  yarnBlock: Bimp;
  stitchBlock: Bimp;
}

export interface Block {
  pos: Vec2;
  yarnBlock: Bimp;
  stitchBlock: Bimp;
}

export type InteractionMode = "boundary" | "path" | "block";
export type BlockEditMode = "yarn" | "stitch" | null;

export interface GlobalState {
  exampleLibrary: Record<string, () => Promise<unknown>>;
  heldKeys: Set<string>;
  snapshots: Record<string, unknown>[];
  lastSnapshot: number;
  transforming: boolean;

  colorMode: ColorMode;
  annotations: boolean;
  interactionMode: InteractionMode;
  pointer: Vec2;
  locked: boolean;
  cellAspect: number;

  activeTool: string;
  activeSymbol: number;
  activeYarn: number;
  selectedBoundary: number | null;
  selectedPath: number | null;
  selectedBlock: number | null;
  stitchSelect: [Vec2, Vec2] | null;

  boundaries: Boundary[];
  regions: Region[];
  paths: KnitPath[];
  blocks: Block[];
  blockEditMode: BlockEditMode;
  activeBlockTool: string;
  tucks: boolean;

  chart: Bimp | null;
  yarnChart: Bimp | null;
  machineChart: Bimp | null;
  rowMap: number[] | null;
  yarnSequence: number[];
  passSchedule: number[][];
  yarnSchedule: number[];

  scale: number;
  cellWidth: number;
  cellHeight: number;
  chartPan: Pan;
  bbox: BBox;

  simScale: number;
  simPan: Pan;
  simLive: boolean;
  kYarn: number;

  yarnPalette: string[] | null;
  yarnWidth: number;

  showSettings: boolean;
  showDownload: boolean;
  showUpload: boolean;
  showExampleLibrary: boolean;
  yarnExpanded: boolean;
  showTimeNeedleView: boolean;
  reverseScroll: boolean;
}

export interface StateObserver {
  syncState(state: GlobalState, changes?: string[]): void;
}

export type SubscriberFactory = (init: {
  state: GlobalState;
}) => StateObserver;

export interface StateMonitorType {
  register(componentArr: SubscriberFactory[]): void;
  syncState(state: GlobalState, changes?: string[]): void;
  requestRender?: () => void;
}

export interface WorkspaceJSON {
  cellAspect?: number;
  yarnPalette?: string[];
  boundaries?: Vec2[][];
  regions?: {
    pos: Vec2;
    joinMode?: string;
    shaping?: number;
    yarnBlock: BimpJSON;
    stitchBlock: BimpJSON;
  }[];
  paths?: {
    pts: Vec2[];
    offset: Vec2;
    tileMode?: string;
    yarnBlock: BimpJSON;
    stitchBlock: BimpJSON;
  }[];
  blocks?: {
    pos: Vec2;
    yarnBlock: BimpJSON;
    stitchBlock: BimpJSON;
  }[];
  annotations?: boolean;
  simLive?: boolean;
}
