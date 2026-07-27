// Core simulation types — shared by every stitch model. Model-specific
// topology types live alongside their topology generator (see ds/types.ts and
// knitbit/src/simulation/types.ts).

export type NodeType = {
  pos: number[];
  f: number[];
  v: number[];
  q0: number[];
  q1: number[];
};

export type SegmentType = {
  source: number;
  target: number | undefined;
  sourceOffset: number[] | undefined;
  targetOffset: number[] | undefined;
  restLength: number | undefined;
  leg: [boolean, boolean | undefined];
};

export type YarnSegments = Record<number, SegmentType[]>;

// Fully resolved segment — all fields present. Used by relaxation after layout
// is complete.
export type ResolvedSegment = {
  source: number;
  target: number;
  sourceOffset: number[];
  targetOffset: number[];
  restLength: number;
};

// What the renderer consumes: one entry per yarn, with flat control points.
export interface YarnData {
  yarnIndex: string;
  pts: number[];
  diameter: number;
  color: number[];
}

// ─── Relaxation settings (live-tunable) ──────────────────────────────────────

export interface RelaxSettings {
  kYarn: number; // yarn spring stiffness
  tYarn: number; // bending stiffness
  iterations: number; // sub-steps per tick
  velocityDecay: number; // 0..1 damping multiplier (0 = full damping)
  alphaMin: number; // simulation stops when ALPHA drops below this
  alphaTarget: number; // ALPHA decays toward this value
}

export const DEFAULT_RELAX_SETTINGS: RelaxSettings = {
  kYarn: 0.4,
  tYarn: 0.01,
  iterations: 4,
  velocityDecay: 0.5,
  alphaMin: 0.001,
  alphaTarget: 0,
};
