export type ColorMode = "yarn" | "operation";

export interface SymbolData {
  pathdata?: string;
  path?: Path2D;
  color: string;
  stroke?: string;
  yarnModeColor?: string;
  description?: string;
}

export const BACK_OPS = new Set([
  "PURL",
  "BT",
  "BXR1",
  "BXR2",
  "BXR3",
  "BXL1",
  "BXL2",
  "BXL3",
]);

// Paths made in https://yqnn.github.io/svg-path-editor/
export const SYMBOL_DATA: Record<string, SymbolData> = {
  EMPTY: {
    pathdata: "M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25",
    path: new Path2D("M 0.25 0.25 L 0.75 0.75 M 0.25 0.75 L 0.75 0.25"),
    color: "#555555",
    stroke: "#ffffff",
    description: "Empty - a yarn never passes this needle.",
  },
  KNIT: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.3 0.8 0.5 0.8 C 0.7 0.8 0.7 0.5 0.4 0.5 L 0 0.5",
    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.3 0.8 0.5 0.8 C 0.7 0.8 0.7 0.5 0.4 0.5 L 0 0.5"
    ),
    color: "#08ccab",
    description: "Knit - loop pulled from back to front.",
  },
  PURL: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.7 0.2 0.5 0.2 C 0.3 0.2 0.3 0.5 0.6 0.5 L 1 0.5",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.7 0.2 0.5 0.2 C 0.3 0.2 0.3 0.5 0.6 0.5 L 1 0.5"
    ),
    color: "#079e85",
    description: "Purl - loop pulled from front to back.",
  },
  FM: {
    pathdata: "M 0 0.5 L 1 0.5",

    path: new Path2D("M 0 0.5 L 1 0.5"),
    color: "#fbacda",
    yarnModeColor: "#FFFFFF",
    description: "Front miss",
  },
  BM: {
    pathdata: "M 0 0.5 L 1 0.5",

    path: new Path2D("M 0 0.5 L 1 0.5"),
    color: "#de75b2",
    yarnModeColor: "#FFFFFF",
    description: "Back miss",
  },
  FT: {
    pathdata:
      "M 1 0.5 L 0.8 0.5 C 0.7 0.5 0.65 0.5 0.6 0.55 C 0.55 0.6 0.6 0.8 0.5 0.8 C 0.4 0.8 0.45 0.6 0.4 0.55 C 0.35 0.5 0.3 0.5 0.2 0.5 L 0 0.5",

    path: new Path2D(
      "M 1 0.5 L 0.8 0.5 C 0.7 0.5 0.65 0.5 0.6 0.55 C 0.55 0.6 0.6 0.8 0.5 0.8 C 0.4 0.8 0.45 0.6 0.4 0.55 C 0.35 0.5 0.3 0.5 0.2 0.5 L 0 0.5"
    ),
    color: "#eb4034",
    yarnModeColor: "#FFFFFF",
    description: "Front tuck",
  },
  BT: {
    pathdata:
      "M 0 0.5 L 0.2 0.5 C 0.3 0.5 0.35 0.5 0.4 0.45 C 0.45 0.4 0.4 0.2 0.5 0.2 C 0.6 0.2 0.55 0.4 0.6 0.45 C 0.65 0.5 0.7 0.5 0.8 0.5 L 1 0.5",

    path: new Path2D(
      "M 0 0.5 L 0.2 0.5 C 0.3 0.5 0.35 0.5 0.4 0.45 C 0.45 0.4 0.4 0.2 0.5 0.2 C 0.6 0.2 0.55 0.4 0.6 0.45 C 0.65 0.5 0.7 0.5 0.8 0.5 L 1 0.5"
    ),
    color: "#b03027",
    yarnModeColor: "#FFFFFF",
    description: "Back tuck",
  },
  FXR1: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.18 0.65 L 0.25 0.57 V 0.85 M 0.18 0.85 H 0.32",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.18 0.65 L 0.25 0.57 V 0.85 M 0.18 0.85 H 0.32"
    ),
    color: "#9557b4",
    description: "1x front transfer right",
  },
  FXR2: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.176 0.69 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.176 0.69 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141"
    ),
    color: "#9557b4",
    description: "2x front transfer right",
  },
  FXR3: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.187 0.61 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.869 0.771 0.867 C 0.932 0.869 0.7 0.5 0.4 0.5 L 0 0.5 M 0.187 0.61 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122"
    ),
    color: "#9557b4",
    description: "3x front transfer right",
  },
  FXL1: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.68 0.65 L 0.75 0.57 V 0.85 M 0.68 0.85 H 0.82",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.68 0.65 L 0.75 0.57 V 0.85 M 0.68 0.85 H 0.82"
    ),
    color: "#de9321",
    description: "1x front transfer left",
  },
  FXL2: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.661 0.687 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.661 0.687 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141"
    ),
    color: "#de9321",
    description: "2x front transfer left",
  },
  FXL3: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.708 0.612 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.869 0.229 0.867 C 0.068 0.869 0.3 0.5 0.6 0.5 L 1 0.5 M 0.708 0.612 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122"
    ),
    color: "#de9321",
    description: "3x front transfer left",
  },
  BXR1: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.18 0.2 L 0.25 0.12 V 0.4 M 0.18 0.4 H 0.32",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.18 0.2 L 0.25 0.12 V 0.4 M 0.18 0.4 H 0.32"
    ),
    color: "#74448d",
    description: "1x back transfer right",
  },
  BXR2: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.156 0.213 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.156 0.213 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141"
    ),
    color: "#74448d",
    description: "2x back transfer right",
  },
  BXR3: {
    pathdata:
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.198 0.158 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122",

    path: new Path2D(
      "M 1 0.5 L 0.6 0.5 C 0.3 0.5 0.621 0.131 0.771 0.133 C 0.932 0.131 0.7 0.5 0.4 0.5 L 0 0.5 M 0.198 0.158 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122"
    ),
    color: "#74448d",
    description: "3x back transfer right",
  },
  BXL1: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.68 0.2 L 0.75 0.12 V 0.4 M 0.68 0.4 H 0.82",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.68 0.2 L 0.75 0.12 V 0.4 M 0.68 0.4 H 0.82"
    ),
    color: "#b47619",
    description: "1x back transfer left",
  },
  BXL2: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.666 0.212 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.666 0.212 c 0.028 -0.136 0.186 -0.041 0.127 0.023 l -0.124 0.129 h 0.141"
    ),
    color: "#b47619",
    description: "2x back transfer left",
  },
  BXL3: {
    pathdata:
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.711 0.144 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122",

    path: new Path2D(
      "M 0 0.5 L 0.4 0.5 C 0.7 0.5 0.379 0.131 0.229 0.133 C 0.068 0.131 0.3 0.5 0.6 0.5 L 1 0.5 M 0.711 0.144 c 0.112 -0.071 0.151 0.108 0.034 0.106 c 0.116 0.003 0.099 0.175 -0.03 0.122"
    ),
    color: "#b47619",
    description: "3x back transfer left",
  },
  TRANSPARENT: {
    pathdata: "",
    path: new Path2D(),
    color: "#dfdfdf7f",
    description: "transparent",
  },
  FTB: {
    color: "#fcff46",
  },
  BTF: {
    color: "#afff46",
  },
  FL1: {
    color: "#de9321",
  },
  FL2: {
    color: "#de9321",
  },
  FL3: {
    color: "#de9321",
  },
  FR1: {
    color: "#9557b4",
  },
  FR2: {
    color: "#9557b4",
  },
  FR3: {
    color: "#9557b4",
  },
  BL1: {
    color: "#b47619",
  },
  BL2: {
    color: "#b47619",
  },
  BL3: {
    color: "#b47619",
  },
  BR1: {
    color: "#74448d",
  },
  BR2: {
    color: "#74448d",
  },
  BR3: {
    color: "#74448d",
  },
};
