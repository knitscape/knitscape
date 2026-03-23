import { populateDS, followTheYarn, orderCNs } from "./topology";
import { Vec2 } from "./utils/Vec2";
import { Vec3 } from "./utils/Vec3";

import { stitches } from "../constants";

export function generateTopology(stitchPattern) {
  const DS = populateDS(stitchPattern);

  orderCNs(DS, stitchPattern);

  let yarnPath = followTheYarn(DS, stitchPattern.carriagePasses);

  return { DS, yarnPath };
}

function getYarnPositionAtNode(DS, ypIndex, i, j) {
  let cnStack = DS.CNO(i, j);

  for (const [index, [ii, jj]] of cnStack.entries()) {
    // Yarn path always visits a node twice: once as a head, once as a leg
    let yarnPathIndicesAtNode = DS.YPI(ii, jj);

    if (yarnPathIndicesAtNode[0] == ypIndex) {
      // The first time a node is visited, it will be as head node which might
      // move in the fabric. So the z position will depend on the stack index
      // at the final location

      return { layer: cnStack.length - index, legNode: false };
    } else if (yarnPathIndicesAtNode[1] == ypIndex) {
      // The second time a node is visited will be to anchor the leg node.
      // Nothing will stack in front of it

      return { layer: 1, legNode: true };
    }
  }

  console.error(
    `Couldn't find the node position at yarn path index ${ypIndex}.`
  );
}

function initializeContactSegmentData(
  DS,
  yarnPath,
  stitchPattern,
  nodes,
  params
) {
  const segmentData = [];

  for (let ypIndex = 0; ypIndex < yarnPath.length; ypIndex++) {
    let [i, j, row] = yarnPath[ypIndex];
    let currIndex = i + j * DS.width;

    let { layer, legNode } = getYarnPositionAtNode(DS, ypIndex, i, j);
    let currentYarn = stitchPattern.yarnSequence[row];

    if (!(currentYarn in segmentData)) {
      segmentData[currentYarn] = [
        {
          source: currIndex,
          sourceOffset: [0, 0, 0],
          leg: [true, undefined],
          target: undefined,
          targetOffset: undefined,
          restLength: undefined,
        },
      ];
    }

    let loop = prev.leg[0] == prev.leg[1];

    prev.restLength = loop ? dist * 0.7 : STITCH_WIDTH * ASPECT * 0.7;
  }

  return segmentData;
}

export function computeYarnPathSpline(
  DS,
  yarnPath,
  stitchPattern,
  nodes,
  { ASPECT = 0.75, YARN_RADIUS = 0.2, STITCH_WIDTH = 1 }
) {
  const links = {};

  for (let ypIndex = 0; ypIndex < yarnPath.length; ypIndex++) {
    let [i, j, row] = yarnPath[ypIndex];
    let currIndex = i + j * DS.width;

    let { layer, legNode } = getYarnPositionAtNode(DS, ypIndex, i, j);
    let currentYarn = stitchPattern.yarnSequence[row];

    if (!(currentYarn in links)) {
      links[currentYarn] = [
        {
          source: currIndex,
          sourceOffset: [0, 0, 0],
          leg: [true, undefined],
          target: undefined,
          targetOffset: undefined,
          restLength: undefined,
        },
      ];
    }

    const isKnit = DS.ST(i, j) == stitches.KNIT;
    const evenI = i % 2 == 0;

    const movingRight = stitchPattern.carriagePasses[row] == "right";

    const sign = evenI ? 1 : -1;

    let xyBasis = legNode
      ? Vec2.normalize([sign, -1])
      : Vec2.normalize([-sign, 1]);

    xyBasis = Vec2.scale(xyBasis, YARN_RADIUS);

    let cn = nodes[currIndex];

    // const stackHeight = DS.CNO(i, j).length;

    /////////////////////////////
    //  X OFFSET
    /////////////////////////////
    // let dxFront = movingRight ? cn.q0[0] : cn.q1[0];
    // let dxBack = movingRight ? cn.q1[0] : cn.q0[0];

    let dxFront, dxBack;
    dxFront = xyBasis[0];
    dxBack = xyBasis[0];

    // dxFront =
    //   evenI == legNode
    //     ? xyBasis[0] + YARN_RADIUS / 6
    //     : xyBasis[0] - YARN_RADIUS / 6;
    // dxBack =
    //   evenI == legNode
    //     ? xyBasis[0] - YARN_RADIUS / 6
    //     : xyBasis[0] + YARN_RADIUS / 6;

    // if (legNode) {
    //   dxFront = base;
    //   dxBack = base;
    // } else {
    //   dxFront = base * (stackHeight - layer + 1);
    //   dxBack = base;
    // }

    /////////////////////////////
    //  Y OFFSET
    /////////////////////////////

    let dyFront, dyBack;
    // const beta = Math.PI / 8;
    // let yLayer = Math.sin(beta * layer) * (stackHeight - layer + 1);

    dyFront = -xyBasis[1];
    dyBack = xyBasis[1];

    // if (legNode) {
    //   let yLayer = Math.sin(beta * layer) * (stackHeight - layer + 1);

    //   dyFront = -xyBasis[1] * yLayer;
    //   dyBack = xyBasis[1] * yLayer;
    // } else {
    //   let yLayer = Math.sin(beta * layer) * (stackHeight - layer + 1);
    //   dyFront = -xyBasis[1] * yLayer;
    //   dyBack = xyBasis[1] * yLayer;
    // }

    /////////////////////////////
    //  ZOFFSET
    /////////////////////////////
    let dzFront, dzBack;
    dzFront = YARN_RADIUS / 2;
    dzBack = -YARN_RADIUS / 2;

    // dzFront = (layer / 2) * YARN_RADIUS + YARN_RADIUS / 2;
    // dzBack = (layer / 2) * YARN_RADIUS - YARN_RADIUS / 2;

    // if (legNode) {
    //   dzFront = (layer / 2) * YARN_RADIUS + YARN_RADIUS / 2;
    //   dzBack = (layer / 2) * YARN_RADIUS - YARN_RADIUS / 2;
    // } else {
    //   dzFront = (layer * YARN_RADIUS) / 2;
    //   dzBack = (-(stackHeight - layer) * YARN_RADIUS) / 2;
    // }

    /////////////////////////////
    //  SWAP
    /////////////////////////////
    if (DS.ST(i, j) != stitches.KNIT) {
      let temp = dyBack;
      dyBack = dyFront;
      dyFront = temp;

      let tempX = dxBack;
      dxBack = dxFront;
      dxFront = tempX;
    }

    let curr = links[currentYarn];
    let prev = curr.at(-1);
    prev.target = currIndex;
    prev.leg[1] = legNode;

    let next = {
      source: currIndex,
      sourceOffset: undefined,
      target: undefined,
      targetOffset: undefined,
      restLength: undefined,
      leg: [legNode, undefined],
    };
    curr.push(next);

    if (movingRight == evenI) {
      // First leg or head node of a loop
      if (legNode == isKnit) {
        // Back to front
        prev.targetOffset = [dxBack, dyBack, dzBack];
        next.sourceOffset = [dxFront, dyFront, dzFront];
      } else {
        // Front to back
        prev.targetOffset = [dxFront, dyFront, dzFront];
        next.sourceOffset = [dxBack, dyBack, dzBack];
      }
    } else {
      // last leg or head node of a loop
      if (legNode == isKnit) {
        // Front to back
        prev.targetOffset = [dxFront, dyFront, dzFront];
        next.sourceOffset = [dxBack, dyBack, dzBack];
      } else {
        // Back to front
        prev.targetOffset = [dxBack, dyBack, dzBack];
        next.sourceOffset = [dxFront, dyFront, dzFront];
      }
    }

    let dist = Vec3.magnitude(
      Vec3.subtract(nodes[prev.target].pos, nodes[prev.source].pos)
    );

    // prev.restLength = dist * 0.9;

    let loop = prev.leg[0] == prev.leg[1];

    prev.restLength = loop ? dist * 0.7 : STITCH_WIDTH * ASPECT * 0.7;

    if (prev.leg[0] && prev.leg[1]) {
      // Leg to leg.
      prev.restLength = dist;
    } else if (prev.leg[0] && !prev.leg[1]) {
      // Leg to head
      prev.restLength = STITCH_WIDTH * ASPECT * 0.7;
    } else if (!prev.leg[0] && !prev.leg[1]) {
      // Head to head
      prev.restLength = dist * 0.7;
    } else if (!prev.leg[0] && prev.leg[1]) {
      // Head to leg
      prev.restLength = STITCH_WIDTH * ASPECT * 0.7;
    }
  }

  Object.entries(links).forEach(([yarnIndex, linkArr]) => {
    const lastLink = linkArr.at(-1);

    lastLink.target = lastLink.source;
    lastLink.targetOffset = [0, 0, 0];

    let isLoop = lastLink.leg[0] == lastLink.leg[1];
    let dist = Vec3.magnitude(
      Vec3.subtract(nodes[lastLink.target].pos, nodes[lastLink.source].pos)
    );
    lastLink.restLength = isLoop ? dist * ASPECT * 0.6 : dist;
  });
  return links;
}

export function layoutNodes(
  DS,
  stitchPattern,
  { STITCH_WIDTH = 1, ASPECT = 0.75, BED_OFFSET = 0.2, YARN_RADIUS }
) {
  // Compute initial positions for yarn contact nodes based on
  // i (x), j (y), and bed (z).
  const HALF_STITCH = STITCH_WIDTH / 2;
  const STITCH_HEIGHT = STITCH_WIDTH * ASPECT;

  let { rowMap } = stitchPattern;
  return DS.data.map((node, index) => {
    const i = index % DS.width;
    const j = (index - i) / DS.width;

    const chartRow = j < rowMap.length ? rowMap[j] : rowMap[j - 1] + 1;
    let z = 0;
    if (node[0] == stitches.KNIT) {
      z = BED_OFFSET;
    } else if (node[0] == stitches.PURL) {
      z = -BED_OFFSET;
    }

    let movingRight = stitchPattern.carriagePasses[j] == "right";
    let numContacts = DS.CNO(i, j).length;

    let offset = Math.sqrt((numContacts * YARN_RADIUS * YARN_RADIUS) / 2);
    let side = movingRight == i % 2;
    let tlbr = [-offset, -offset, 0];
    let bltr = [offset, offset, 0];

    return {
      pos: [i * HALF_STITCH, chartRow * STITCH_HEIGHT, z],
      f: [0, 0, 0],
      v: [0, 0, 0],
      q0: side ? tlbr : bltr,
      q1: side ? bltr : tlbr,
    };
  });
}

export function segmentsToPoints(segmentArr, nodes) {
  let controlPoints = [];
  for (const { source, sourceOffset, target, targetOffset } of segmentArr) {
    const sourcePos = nodes[source].pos;

    controlPoints.push(...Vec3.add(sourcePos, sourceOffset));

    const targetPos = nodes[target].pos;

    controlPoints.push(...Vec3.add(targetPos, targetOffset));
  }
  return controlPoints;
}
