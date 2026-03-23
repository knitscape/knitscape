export const MAX_SCALE = 100;
export const MIN_SCALE = 5;

export const MAX_SIM_SCALE = 6;
export const MIN_SIM_SCALE = 0.6;

export const SNAPSHOT_INTERVAL = 1000;

export const SNAPSHOT_FIELDS = ["yarnPalette", "yarnSequence", "repeats"];

export const LAYERS = ["chart", "repeats", "yarn"];

export const SYMBOL_PATHS = {
  knit: new Path2D(
    "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.7 0.2 0.5 0.2 C 0.3 0.2 0.3 0.5 0.6 0.5 L 1 0.5"
  ),
  purl: new Path2D(
    "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.3 0.8 0.5 0.8 C 0.7 0.8 0.7 0.5 0.4 0.5 L 0 0.5"
  ),
  slip: new Path2D("M 0 0.5 L 1 0.5"),
  tuck: new Path2D(
    "M 0 0.5 L 0.2 0.5 C 0.3 0.5 0.35 0.5 0.4 0.45 C 0.45 0.4 0.4 0.2 0.5 0.2 C 0.6 0.2 0.55 0.4 0.6 0.45 C 0.65 0.5 0.7 0.5 0.8 0.5 L 1 0.5"
  ),
};

export const SYMBOL_BITS = {
  knit: false,
  purl: false,
  slip: true,
  tuck: true,
};

export const DEFAULT_SYMBOLS = ["knit", "purl", "slip", "tuck"];

export const DEFAULT_PATTERN_LIBRARY = import.meta.glob("../examples/*.json");

export const toolData = {
  brush: { icon: "fa-solid fa-paintbrush", hotkey: "b" },
  flood: { icon: "fa-solid fa-fill-drip fa-flip-horizontal", hotkey: "f" },
  rect: { icon: "fa-solid fa-vector-square", hotkey: "r" },
  line: { icon: "fa-solid fa-minus", hotkey: "l" },
  shift: { icon: "fa-solid fa-right-left", hotkey: "s" },
  move: { hotkey: "h" },
};
