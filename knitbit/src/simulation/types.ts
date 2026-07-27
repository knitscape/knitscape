import type { Bimp } from "@shared/Bimp";

// Core node/segment/relaxation types are shared across stitch models; knitbit's
// modules import them from here so their own imports stay in one place.
export type {
  NodeType,
  SegmentType,
  YarnSegments,
  ResolvedSegment,
  RelaxSettings,
} from "@shared/simulation/types";
export { DEFAULT_RELAX_SETTINGS } from "@shared/simulation/types";

// ─── Layout mode ─────────────────────────────────────────────────────────────

export type LayoutMode = "technical" | "compressed";

export interface KnittingProgram {
  width: number; // number of needles
  height: number; // number of rows
  ops: Bimp; // width × height bitmap of Op values
  yarnFeeder: (number | null)[]; // per-row yarn index (1-based); null = transfer-only row (no yarn)
  direction: ("left" | "right")[]; // per-row carriage direction
  racking: number[]; // per-row bed offset
  palette: string[]; // yarn colors (indexed by yarnFeeder - 1)
}

// ─── Topology output ─────────────────────────────────────────────────────────

export interface TopologyNode {
  gridI: number; // 0..2*width-1 (two sub-positions per needle)
  gridJ: number; // 0..height (grid row)
  row: number; // program row that created this node
  bed: "front" | "back";
  isLeg: boolean; // leg node (lower) vs head node (upper)
  stackIndex: number; // position in z-stack (0 = deepest)
  stackSize: number; // total items in stack at this grid position
}

export interface TopologyResult {
  gridWidth: number; // 2 * program.width
  gridHeight: number; // program.height + 1
  nodes: TopologyNode[];
  yarnPaths: { yarnIndex: number; nodeIndices: number[] }[];
  /** Racking value at the point where topology generation stopped —
   *  applied to all back-bed nodes as a horizontal offset in layout. */
  currentRacking: number;
}
