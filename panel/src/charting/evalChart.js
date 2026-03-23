import { Bimp } from "../lib/Bimp";
import { stitches } from "../constants";
import { knitScanline } from "./knitScanline";
import { pathTiling } from "./pathTiling";
import { bBoxAllBoundaries } from "./helpers";
import { yarnSeparation } from "./yarnSeparation";

function rootAtZero(bbox, boundaries, regions, blocks, paths) {
  return {
    boundaries: boundaries.map((pts) =>
      pts.map(([x, y]) => [x - bbox.xMin, y - bbox.yMin])
    ),
    regions: regions.map((region) => {
      return {
        ...region,
        pos: [region.pos[0] - bbox.xMin, region.pos[1] - bbox.yMin],
      };
    }),
    blocks: blocks.map((block) => {
      return {
        ...block,
        pos: [block.pos[0] - bbox.xMin, block.pos[1] - bbox.yMin],
      };
    }),
    paths: paths.map((path) => {
      return {
        ...path,
        pts: path.pts.map(([x, y]) => [x - bbox.xMin, y - bbox.yMin]),
      };
    }),
  };
}

export function rasterizeChart(rawBounds, rawRegions, rawBlocks, rawPaths) {
  const bbox = bBoxAllBoundaries(rawBounds);

  const { boundaries, regions, blocks, paths } = rootAtZero(
    bbox,
    rawBounds,
    rawRegions,
    rawBlocks,
    rawPaths
  );

  const chartWidth = bbox.width;
  const chartHeight = bbox.height;

  // First, create an empty chart that is fit to the boundaries
  let stitchChart = Bimp.empty(chartWidth, chartHeight, stitches.EMPTY);
  let yarnChart = Bimp.empty(chartWidth, chartHeight, 0);

  regions.forEach((region, regionIndex) => {
    let { stitch, yarn } = knitScanline(
      stitchChart,
      yarnChart,
      boundaries[regionIndex],
      region
    );

    stitchChart = stitch;
    yarnChart = yarn;
  });

  paths.forEach((path) => {
    let { stitch, yarn } = pathTiling(stitchChart, yarnChart, path);

    stitchChart = stitch;
    yarnChart = yarn;
  });

  for (const { stitchBlock, yarnBlock, pos } of blocks) {
    stitchChart = stitchChart.overlay(stitchBlock, pos, stitches.TRANSPARENT);
    yarnChart = yarnChart.overlay(yarnBlock, pos, 0);
  }

  const { machineChart, yarnSequence, rowMap } = yarnSeparation(
    stitchChart,
    yarnChart
  );

  return { stitchChart, yarnChart, machineChart, yarnSequence, rowMap };
}
