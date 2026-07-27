import { hexToRgb } from "../../hexToRgb";
import { generateTopology, computeYarnPathSpline, layoutNodes } from "./layout";
import { segmentsToPoints } from "../segments";
import { createRelaxationDriver } from "../relaxationDriver";
import type { RelaxSettings } from "../types";
import type { StitchPatternType } from "./types";

const YARN_DIAMETER = 0.27;
const STITCH_WIDTH = 1;
const BED_OFFSET = 0.1;

export interface SimulateOptions {
  canvas: HTMLCanvasElement;
  yarnPalette: string[];
  cellAspect: number;
  resetCamera?: boolean;
  relaxSettings?: RelaxSettings;
}

export function simulate(
  stitchPattern: StitchPatternType,
  options: SimulateOptions
) {
  const params = {
    YARN_RADIUS: YARN_DIAMETER / 2,
    STITCH_WIDTH,
    ASPECT: options.cellAspect,
    BED_OFFSET,
  };

  const t0 = performance.now();

  const { DS, yarnPath } = generateTopology(stitchPattern);
  const nodes = layoutNodes(DS, stitchPattern, params);
  const segments = computeYarnPathSpline(
    DS,
    yarnPath,
    stitchPattern,
    nodes,
    params
  );

  const topologyMs = performance.now() - t0;

  const yarnPalette = options.yarnPalette;
  const yarnData = Object.entries(segments).map(([yarnIndex, segmentArr]) => ({
    yarnIndex,
    pts: segmentsToPoints(segmentArr, nodes),
    diameter: YARN_DIAMETER,
    color: hexToRgb(yarnPalette[Number(yarnIndex) - 1]).map(
      (colorInt: number) => colorInt / 255
    ),
  }));

  const driver = createRelaxationDriver(
    { nodes, segments, yarnData },
    {
      canvas: options.canvas,
      resetCamera: options.resetCamera,
      relaxSettings: options.relaxSettings,
    }
  );

  return { ...driver, topologyMs };
}
