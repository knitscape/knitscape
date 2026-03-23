import { stitches } from "../constants";
import { Vec2 } from "../lib/Vec2";

const BED_OFFSET = 0.2;

export function layoutNodes(
  DS,
  stitchChart,
  rowMap,
  stitchWidth = 1,
  stitchAspect = 0.75
) {
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
        // y: (stitchChart.height - chartRow) * STITCH_HEIGHT,
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

export function buildSegmentData(
  DS,
  yarnPaths,
  nodes,
  stitchWidth = 1,
  stitchAspect = 0.75
) {
  const maxStack = DS.maxCNStack;

  // console.log("max CN stack:", maxStack);
  // console.log(stitchAspect, stitchWidth);
  const links = Object.fromEntries(
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

      let startLayer, endLayer;

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
        // console.log(target[0]);
        if (source[0] == stitches.KNIT) {
          startLayer = 2 * maxStack;
        }

        if (target[0] == stitches.KNIT) {
          endLayer = 2 * maxStack;
        }
      }

      if (startLayer == undefined) {
        // This happens at the top row?
        startLayer = 2 * maxStack;
      }

      if (endLayer == undefined) {
        // This happens at the top row?
        endLayer = 2 * maxStack;
      }

      let restLength = loop
        ? Vec2.mag(Vec2.sub(nodes[sourceIndex].pos, nodes[targetIndex].pos)) *
          stitchAspect *
          0.7
        : Vec2.mag(Vec2.sub(nodes[sourceIndex].pos, nodes[targetIndex].pos)) *
          0.7;
      // : (Math.abs(sourceI - targetI) / 2) * stitchWidth;

      // let restLength = Vec2.mag(
      //   Vec2.sub(nodes[sourceIndex].pos, nodes[targetIndex].pos)
      // );

      // console.log(stitchWidth * stitchAspect);
      links[yarnIndex].push({
        source: [sourceI, sourceJ],
        target: [targetI, targetJ],
        sourceIndex,
        targetIndex,
        // restLength: loop
        //   ? Vec2.mag(Vec2.sub(nodes[sourceIndex].pos, nodes[targetIndex].pos))
        //   : stitchWidth * stitchAspect,
        restLength,

        row: targetRow,
        layer: [startLayer, endLayer],
      });
    }
  });

  return links;
}

// function calcZ(stitchType, cnType) {
//   let zs;

//   if (cnType == "FL") {
//     zs = [-1, 1];
//   } else if (cnType == "LH") {
//     zs = [-1, 1];
//   } else if (cnType == "FH") {
//     zs = [1, -1];
//   } else if (cnType == "LL") {
//     zs = [1, -1];
//   }

//   if (isPurl(stitchType)) zs = [-zs[0], -zs[1]];

//   return zs;
// }

// function isHead(cnType) {
//   return cnType == "FH" || cnType == "LH";
// }

// function isPurl(stitchType) {
//   return stitchType === stitches.PURL;
// }

function yarnOffset(cnType, cnPos, prev, next, ltr, stitchType, yarnData) {
  const dist = yarnData.radius;
  const dx = prev.x - next.x;
  const dy = prev.y - next.y;

  const [zFirst, zLast] = calcZ(stitchType, cnType);

  let yarnSide = cnType == "FH" || cnType == "LL" ? ltr : !ltr;

  const alpha = yarnSide
    ? Math.atan2(dy * STITCH_ASPECT, -dx)
    : Math.atan2(-dy * STITCH_ASPECT, dx);

  const beta = Math.PI / 4;

  const signAlpha = ltr ? -1 : 1;
  const signBeta = isHead(cnType) ? 1 : -1;
  const signPurl = isPurl(stitchType) ? -1 : 1;

  return [
    cnPos.x + signAlpha * dist * Math.cos(alpha),
    cnPos.y +
      signAlpha * dist * Math.sin(alpha) -
      signBeta * signPurl * zFirst * dist * Math.sin(beta),
    dist * Math.sin(zFirst * beta),
    cnPos.x + signAlpha * dist * Math.cos(alpha),
    cnPos.y +
      signAlpha * dist * Math.sin(alpha) -
      signBeta * signPurl * zLast * dist * Math.sin(beta),
    dist * Math.sin(zLast * beta),
  ];
}

// export function calculateYarnPoints(chart, nodes, cnGrid, yarnPath, PARAMS) {
//   yarnPath.forEach(([i, j, row, cnType], index) => {
//     const currentPos = nodes[cnGrid.flatIndex(i, j)].pos;
//     const prev = yarnPath[index - 1];
//     const next = yarnPath[index + 1];

//     const yarnData = PARAMS.yarns[chart.yarnSequence[row]];

//     if (!prev || !next) {
//       // it's the first or last CN
//       yarnData.pts.push(currentPos.x, currentPos.y, 0);
//       return;
//     }

//     const prevCNPos = nodes[cnGrid.flatIndex(...prev)].pos;
//     const nextCNPos = nodes[cnGrid.flatIndex(...next)].pos;

//     const yarn2D = yarnOffset(
//       PARAMS,
//       cnType,
//       currentPos,
//       prevCNPos,
//       nextCNPos,
//       row % 2 == 0, //moving left or right
//       cnGrid.getST(i, j),
//       yarnData
//     );

//     yarnData.pts.push(...yarn2D);
//   });
// }
