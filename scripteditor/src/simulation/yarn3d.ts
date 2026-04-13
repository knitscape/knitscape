import { stitches } from "@shared/stitches";
import { Vec2 } from "@shared/Vec2";
import type { DSType } from "./topology";

const BED_OFFSET = 0.2;

type Yarn3DNode = {
  pos: { x: number; y: number; z: number };
  f: { x: number; y: number };
  v: { x: number; y: number };
};

export function layoutNodes(
  DS: DSType,
  stitchChart: { height: number },
  rowMap: number[],
  stitchWidth: number = 1,
  stitchAspect: number = 0.75
): Yarn3DNode[] {
  // calculates the x,y values for the i,j
  const HALF_STITCH = stitchWidth / 2;
  const STITCH_HEIGHT = stitchWidth * stitchAspect;

  return DS.data.map((node, index) => {
    const i = index % DS.width;
    const j = (index - i) / DS.width;

    const chartRow = j < rowMap.length ? rowMap[j] : stitchChart.height;

    let z = 0;
    if (node[0] == stitches.KNIT) {
      z = BED_OFFSET;
    }
    if (node[0] == stitches.PURL) {
      z = -BED_OFFSET;
    }

    return {
      pos: {
        x: i * HALF_STITCH,
        y: chartRow * STITCH_HEIGHT,
        z: z,
      },
      f: {
        x: 0,
        y: 0,
      },
      v: {
        x: 0,
        y: 0,
      },
    };
  });
}

type Yarn3DSegment = {
  source: [number, number];
  target: [number, number];
  sourceIndex: number;
  targetIndex: number;
  restLength: number;
  row: number;
  layer: [number, number];
};

export function buildSegmentData(
  DS: DSType,
  yarnPaths: Record<string, [number, number, number, number][]>,
  nodes: Yarn3DNode[],
  stitchWidth: number = 1,
  stitchAspect: number = 0.75
): Record<string, Yarn3DSegment[]> {
  const maxStack: number = (DS as any).maxCNStack;

  const links: Record<string, Yarn3DSegment[]> = Object.fromEntries(
    Object.keys(yarnPaths).map((yarnIndex) => [yarnIndex, []])
  );

  Object.entries(yarnPaths).forEach(([yarnIndex, yarnPath]) => {
    for (let index = 0; index < yarnPath.length - 1; index++) {
      const [sourceI, sourceJ, sourceRow, sourceLayer] = yarnPath[index];
      const [targetI, targetJ, targetRow, targetLayer] = yarnPath[index + 1];

      let sourceIndex = sourceI + sourceJ * DS.width;
      let targetIndex = targetI + targetJ * DS.width;

      const source = DS.CN(sourceI, sourceJ);
      const target = DS.CN(targetI, targetJ);

      // Check the yarn path index list - the first element is always a head and the second is always a leg.
      let sourceLeg = source[4][1] === index;
      let targetLeg = target[4][1] === index + 1;

      const loop = sourceLeg == targetLeg;
      const leg = sourceLeg != targetLeg;

      const sourceOddity = sourceI % 2 != 0;
      const targetOddity = targetI % 2 != 0;

      const paritiesEqual = sourceOddity == targetOddity;

      let startLayer: number | undefined, endLayer: number | undefined;

      if (source[0] == stitches.KNIT) {
        if (paritiesEqual || (leg && !paritiesEqual && sourceJ > targetJ)) {
          // treat as knit leg
          startLayer = sourceLeg
            ? 4 * maxStack
            : 4 * maxStack - 2 * sourceLayer;
        } else {
          // treat as knit loop
          startLayer = sourceLeg
            ? 2 * maxStack + 1
            : 4 * maxStack - 2 * sourceLayer - 1;
        }
      } else if (source[0] == stitches.PURL) {
        if (paritiesEqual || (leg && !paritiesEqual && sourceJ > targetJ)) {
          // treat as purl leg
          startLayer = sourceLeg ? 1 : 2 * maxStack - 2 * sourceLayer - 1;
        } else {
          // treat as purl loop
          startLayer = sourceLeg
            ? 2 * maxStack
            : 2 * maxStack - 2 * sourceLayer;
        }
      }

      if (target[0] == stitches.KNIT) {
        if (paritiesEqual || (leg && !paritiesEqual && targetJ > sourceJ)) {
          // treat as knit leg
          endLayer = targetLeg ? 4 * maxStack : 4 * maxStack - 2 * targetLayer;
        } else {
          // treat as knit loop
          endLayer = targetLeg
            ? 2 * maxStack + 1
            : 4 * maxStack - 2 * targetLayer - 1;
        }
      } else if (target[0] == stitches.PURL) {
        if (paritiesEqual || (leg && !paritiesEqual && targetJ > sourceJ)) {
          // treat as purl leg
          endLayer = targetLeg ? 1 : 2 * maxStack - 2 * targetLayer - 1;
        } else {
          // treat as purl loop
          endLayer = targetLeg ? 2 * maxStack : 2 * maxStack - 2 * targetLayer;
        }
      }

      // Special case for the selvage edge
      if (sourceRow != targetRow) {
        if (source[0] == stitches.KNIT) {
          startLayer = sourceLeg ? 1 : 2 * maxStack - 2 * sourceLayer - 1;
        } else if (source[0] == stitches.PURL) {
          startLayer = sourceLeg
            ? 2 * maxStack + 1
            : 4 * maxStack - 2 * sourceLayer - 1;
        }

        if (target[0] == stitches.KNIT) {
          endLayer = targetLeg ? 1 : 2 * maxStack - 2 * targetLayer - 1;
        } else if (source[0] == stitches.PURL) {
          endLayer = targetLeg
            ? 2 * maxStack + 1
            : 4 * maxStack - 2 * sourceLayer - 1;
        }
      }
      if (targetRow && sourceRow != targetRow) {
        if (source[0] == stitches.KNIT) {
          startLayer = 2 * maxStack;
        }

        if (target[0] == stitches.KNIT) {
          endLayer = 2 * maxStack;
        }
      }

      if (startLayer == undefined) {
        startLayer = 2 * maxStack;
      }

      if (endLayer == undefined) {
        endLayer = 2 * maxStack;
      }

      let restLength = loop
        ? Vec2.mag(Vec2.sub(
            [nodes[sourceIndex].pos.x, nodes[sourceIndex].pos.y],
            [nodes[targetIndex].pos.x, nodes[targetIndex].pos.y]
          )) * stitchAspect * 0.7
        : Vec2.mag(Vec2.sub(
            [nodes[sourceIndex].pos.x, nodes[sourceIndex].pos.y],
            [nodes[targetIndex].pos.x, nodes[targetIndex].pos.y]
          )) * 0.7;

      links[yarnIndex].push({
        source: [sourceI, sourceJ],
        target: [targetI, targetJ],
        sourceIndex,
        targetIndex,
        restLength,
        row: targetRow,
        layer: [startLayer, endLayer],
      });
    }
  });

  return links;
}
