import { GLOBAL_STATE } from "../state";
import { hexToRgb } from "../utilities/misc";
import { yarnRelaxation } from "./relaxation";
import { segmentsToPoints } from "./shared";
import { generateTopology, computeYarnPathSpline, layoutNodes } from "./shared";

import { topDownRenderer } from "./renderers/topdown";
import { noodleRenderer } from "./renderers/noodle";
import { centerlineRenderer } from "./renderers/centerline";
import { threeTubeRenderer } from "./renderers/threeTube";

export const visualizations = {
  noodle: noodleRenderer,
  topdown: topDownRenderer,
  centerline: centerlineRenderer,
  tube: threeTubeRenderer,
};

let renderer = noodleRenderer;

const YARN_DIAMETER = 0.27;
const STITCH_WIDTH = 1;
const BED_OFFSET = 0.1;

export function simulate(stitchPattern) {
  const ASPECT = GLOBAL_STATE.cellAspect;
  const params = {
    YARN_RADIUS: YARN_DIAMETER / 2,
    STITCH_WIDTH,
    ASPECT,
    BED_OFFSET,
  };

  let canvas = document.getElementById("sim-canvas");
  let relaxed = false;
  let sim;

  const { DS, yarnPath } = generateTopology(stitchPattern);

  const nodes = layoutNodes(DS, stitchPattern, params);

  const segments = computeYarnPathSpline(
    DS,
    yarnPath,
    stitchPattern,
    nodes,
    params
  );

  const yarnData = Object.entries(segments).map(([yarnIndex, segmentArr]) => {
    return {
      yarnIndex: yarnIndex,
      pts: segmentsToPoints(segmentArr, nodes),
      diameter: YARN_DIAMETER,
      color: hexToRgb(GLOBAL_STATE.yarnPalette[yarnIndex - 1]).map(
        (colorInt) => colorInt / 255
      ),
    };
  });

  renderer.init(yarnData, canvas);

  function draw() {
    if (sim && sim.running()) {
      sim.tick(segments, DS, nodes);

      for (let i = 0; i < yarnData.length; i++) {
        yarnData[i].pts = segmentsToPoints(
          segments[yarnData[i].yarnIndex],
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

  return { relax, stopSim, draw };
}
