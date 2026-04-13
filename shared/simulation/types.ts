export type GridCell = [number | null, number, [number | null, number | null], number[][], number[], number[][]];

export interface DSType {
  width: number;
  height: number;
  data: GridCell[];
  readonly length: number;
  CN(i: number, j: number): GridCell;
  ST(i: number, j: number): number | null;
  AV(i: number, j: number): number;
  MV(i: number, j: number): [number | null, number | null];
  CNL(i: number, j: number): number[][];
  YPI(i: number, j: number): number[];
  CNO(i: number, j: number): number[][];
  setST(i: number, j: number, st: number): void;
  setAV(i: number, j: number, av: number): void;
  setMV(i: number, j: number, mv: [number | null, number | null]): void;
  setCNL(i: number, j: number, cnl: number[][]): void;
  setYPI(i: number, j: number, ypi: number[]): void;
  setCNO(i: number, j: number, cno: number[][]): void;
}

export interface StitchPatternType {
  width: number;
  height: number;
  ops: ArrayLike<number>;
  op(x: number, y: number): number;
  carriagePasses: string[];
  yarnSequence: number[];
  rowMap: number[];
  yarns: number[];
}

export type NodeType = { pos: number[]; f: number[]; v: number[]; q0: number[]; q1: number[] };

export type SegmentType = {
  source: number;
  target: number | undefined;
  sourceOffset: number[] | undefined;
  targetOffset: number[] | undefined;
  restLength: number | undefined;
  leg: [boolean, boolean | undefined];
};

export type YarnSegments = Record<number, SegmentType[]>;

// Fully resolved segment — all fields present. Used by relaxation after layout is complete.
export type ResolvedSegment = {
  source: number;
  target: number;
  sourceOffset: number[];
  targetOffset: number[];
  restLength: number;
};
