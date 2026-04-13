export const stitches = {
  EMPTY: 0,
  KNIT: 1,
  PURL: 2,
  FM: 3, // Front miss
  BM: 4, // Back miss
  FT: 5, // Front tuck
  BT: 6, // Back tuck
  FXR1: 7, // Front right transfers
  FXR2: 8,
  FXR3: 9,
  FXL1: 10, // Front Left transfers
  FXL2: 11,
  FXL3: 12,
  BXR1: 13, // Back right transfers
  BXR2: 14,
  BXR3: 15,
  BXL1: 16, // Back left transfers
  BXL2: 17,
  BXL3: 18,
  TRANSPARENT: 19,
  FTB: 20,
  BTF: 21,
  // front to back racked transfers
  FR1: 22,
  FR2: 23,
  FR3: 24,
  FL1: 25,
  FL2: 26,
  FL3: 27,
  // back to front racked transfers
  BR1: 28,
  BR2: 29,
  BR3: 30,
  BL1: 31,
  BL2: 32,
  BL3: 33,
};

export const STITCH_MAP = Object.keys(stitches);
