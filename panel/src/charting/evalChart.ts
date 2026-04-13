import { Bimp } from "@shared/Bimp";
import { stitches } from "@shared/stitches";
import { knitScanline } from "./knitScanline";
import { pathTiling } from "./pathTiling";
import { bBoxAllBoundaries } from "./helpers";
import { yarnSeparation } from "./yarnSeparation";
import type { Boundary, BBox, Region, Block, KnitPath } from "../types";

function rootAtZero(
  bbox: BBox,
  boundaries: Boundary[],
  regions: Region[],
  blocks: Block[],
  paths: KnitPath[]
) {
  return {
    boundaries: boundaries.map((pts) =>
      pts.map(([x, y]) => [x - bbox.xMin, y - bbox.yMin] as [number, number])
    ),
    regions: regions.map((region) => {
      return {
        ...region,
        pos: [region.pos[0] - bbox.xMin, region.pos[1] - bbox.yMin] as [number, number],
      };
    }),
    blocks: blocks.map((block) => {
      return {
        ...block,
        pos: [block.pos[0] - bbox.xMin, block.pos[1] - bbox.yMin] as [number, number],
      };
    }),
    paths: paths.map((path) => {
      return {
        ...path,
        pts: path.pts.map(([x, y]) => [x - bbox.xMin, y - bbox.yMin] as [number, number]),
      };
    }),
  };
}

export function rasterizeChart(
  rawBounds: Boundary[],
  rawRegions: Region[],
  rawBlocks: Block[],
  rawPaths: KnitPath[]
) {
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
