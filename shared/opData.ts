export enum Op {
  MISS = 0,
  FKNIT = 1,
  FTUCK = 2,
  BKNIT = 3,
  BTUCK = 4,
  FTB = 5,
  BTF = 6,
  FDROP = 7,
  BDROP = 8,
  EMPTY = 9,
}

export const BACK_OPS = new Set([Op.BKNIT, Op.BTUCK, Op.BTF, Op.BDROP]);

export interface SymbolData {
  pathdata?: string;
  path?: Path2D;
  color: string;
  stroke?: string;
  description: string;
}

// Paths made in https://yqnn.github.io/svg-path-editor/
export const SYMBOL_DATA: Record<number, SymbolData> = {
  [Op.MISS]: {
    pathdata: "M 0 0.5 L 1 0.5",
    path: new Path2D("M 0 0.5 L 1 0.5"),
    color: "#fbacda",
    description: "Miss - yarn floats past the needle",
  },
  [Op.FKNIT]: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.3 0.8 0.5 0.8 C 0.7 0.8 0.7 0.5 0.4 0.5 L 0 0.5",
    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.3 0.8 0.5 0.8 C 0.7 0.8 0.7 0.5 0.4 0.5 L 0 0.5"
    ),
    color: "#08ccab",
    description: "Front bed knit",
  },
  [Op.FTUCK]: {
    pathdata:
      "M 1 0.5 L 0.8 0.5 C 0.7 0.5 0.65 0.5 0.6 0.55 C 0.55 0.6 0.6 0.8 0.5 0.8 C 0.4 0.8 0.45 0.6 0.4 0.55 C 0.35 0.5 0.3 0.5 0.2 0.5 L 0 0.5",
    path: new Path2D(
      "M 1 0.5 L 0.8 0.5 C 0.7 0.5 0.65 0.5 0.6 0.55 C 0.55 0.6 0.6 0.8 0.5 0.8 C 0.4 0.8 0.45 0.6 0.4 0.55 C 0.35 0.5 0.3 0.5 0.2 0.5 L 0 0.5"
    ),
    color: "#eb4034",
    description: "Front bed tuck",
  },
  [Op.BKNIT]: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.7 0.2 0.5 0.2 C 0.3 0.2 0.3 0.5 0.6 0.5 L 1 0.5",
    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.7 0.2 0.5 0.2 C 0.3 0.2 0.3 0.5 0.6 0.5 L 1 0.5"
    ),
    color: "#079e85",
    description: "Back bed knit",
  },
  [Op.BTUCK]: {
    pathdata:
      "M 0 0.5 L 0.2 0.5 C 0.3 0.5 0.35 0.5 0.4 0.45 C 0.45 0.4 0.4 0.2 0.5 0.2 C 0.6 0.2 0.55 0.4 0.6 0.45 C 0.65 0.5 0.7 0.5 0.8 0.5 L 1 0.5",
    path: new Path2D(
      "M 0 0.5 L 0.2 0.5 C 0.3 0.5 0.35 0.5 0.4 0.45 C 0.45 0.4 0.4 0.2 0.5 0.2 C 0.6 0.2 0.55 0.4 0.6 0.45 C 0.65 0.5 0.7 0.5 0.8 0.5 L 1 0.5"
    ),
    color: "#b03027",
    description: "Back bed tuck",
  },
  [Op.FTB]: {
    pathdata: "M 0.5 1 L 0.5 0 M 0.3 0.3 L 0.5 0 L 0.7 0.3",
    path: new Path2D("M 0.5 1 L 0.5 0 M 0.3 0.3 L 0.5 0 L 0.7 0.3"),
    color: "#fcff46",
    description: "Transfer front to back",
  },
  [Op.BTF]: {
    pathdata: "M 0.5 0 L 0.5 1 M 0.3 0.7 L 0.5 1 L 0.7 0.7",
    path: new Path2D("M 0.5 0 L 0.5 1 M 0.3 0.7 L 0.5 1 L 0.7 0.7"),
    color: "#afff46",
    description: "Transfer back to front",
  },
  [Op.FDROP]: {
    pathdata: "M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25",
    path: new Path2D("M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25"),
    color: "#d48cff",
    description: "Front bed drop — loop removed from the front bed",
  },
  [Op.BDROP]: {
    pathdata: "M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25",
    path: new Path2D("M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25"),
    color: "#8050c0",
    description: "Back bed drop — loop removed from the back bed",
  },
  [Op.EMPTY]: {
    color: "#1a1a1a",
    description: "Empty — no action at this cell",
  },
};
