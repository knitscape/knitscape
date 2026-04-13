export const MAX_SCALE = 100;
export const MIN_SCALE = 5;

export const MAX_SIM_SCALE = 6;
export const MIN_SIM_SCALE = 0.6;

export const SNAPSHOT_INTERVAL = 5000;

export const SNAPSHOT_FIELDS = ["yarnPalette", "boundary"];

export const EXAMPLE_LIBRARY = import.meta.glob("../examples/*.json");

export const FRONT_BED = new Set([
  "KNIT",
  "FT",
  "FXR1",
  "FXR2",
  "FXR3",
  "FXL1",
  "FXL2",
  "FXL3",
]);

export const TRANSFERS = new Set([
  "FXR1",
  "FXR2",
  "FXR3",
  "FXL1",
  "FXL2",
  "FXL3",
  "BXR1",
  "BXR2",
  "BXR3",
  "BXL1",
  "BXL2",
  "BXL3",
]);

export const toolData = {
  brush: { icon: "fa-solid fa-paintbrush", hotkey: "b" },
  flood: { icon: "fa-solid fa-fill-drip fa-flip-horizontal", hotkey: "f" },
  rect: { icon: "fa-solid fa-vector-square", hotkey: "r" },
  line: { icon: "fa-solid fa-minus", hotkey: "l" },
  shift: { icon: "fa-solid fa-right-left", hotkey: "s" },
  move: { hotkey: "h" },
};
