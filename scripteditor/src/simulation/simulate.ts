import { hexToRgb } from "@shared/hexToRgb";
import { yarnRelaxation } from "./relaxation";
import { segmentsToPoints, generateTopology, computeYarnPathSpline, layoutNodes } from "./layout";
import type { StitchPatternType } from "./types";

import { noodleRenderer } from "./renderer";

let renderer = noodleRenderer;

const YARN_DIAMETER = 0.27;
const STITCH_WIDTH = 1;
const BED_OFFSET = 0.1;

export interface SimulateOptions {
  canvas: HTMLCanvasElement;
  yarnPalette: string[];
  cellAspect: number;
  resetCamera?: boolean;
}

export function simulate(
  stitchPattern: StitchPatternType,
  options: SimulateOptions
) {
  const ASPECT = options.cellAspect;
  const params = {
    YARN_RADIUS: YARN_DIAMETER / 2,
    STITCH_WIDTH,
    ASPECT,
    BED_OFFSET,
  };

  let canvas = options.canvas;
  let relaxed = false;
  let sim: ReturnType<typeof yarnRelaxation> | undefined;

  const { DS, yarnPath } = generateTopology(stitchPattern);

  const nodes = layoutNodes(DS, stitchPattern, params);

  const segments = computeYarnPathSpline(
    DS,
    yarnPath,
    stitchPattern,
    nodes,
    params
  );

  const yarnPalette = options.yarnPalette;
  const yarnData = Object.entries(segments).map(([yarnIndex, segmentArr]) => {
    return {
      yarnIndex: yarnIndex,
      pts: segmentsToPoints(segmentArr, nodes),
      diameter: YARN_DIAMETER,
      color: hexToRgb(yarnPalette[Number(yarnIndex) - 1]).map(
        (colorInt: number) => colorInt / 255
      ),
    };
  });

  renderer.init(yarnData, canvas, options.resetCamera ?? true);

  function draw() {
    if (sim && sim.running()) {
      sim.tick(segments as any, DS, nodes);

      for (let i = 0; i < yarnData.length; i++) {
        yarnData[i].pts = segmentsToPoints(
          segments[Number(yarnData[i].yarnIndex)],
          nodes
        );
      }

      renderer.updateYarnGeometry(yarnData);
    }
    renderer.draw();
  }

  function relax() {
    if (relaxed) return;
    sim = yarnRelaxation();
    relaxed = true;
  }

  function stopSim() {
    if (sim) sim.stop();
  }

  function isRelaxing() {
    return sim !== undefined && sim.running();
  }

  return { relax, stopSim, draw, isRelaxing };
}
