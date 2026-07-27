import type {
  KnittingProgram,
  TopologyResult,
  NodeType,
  SegmentType,
  YarnSegments,
} from "./types";
import { Vec2 } from "@shared/Vec2";
import { Vec3 } from "@shared/Vec3";
import { Op } from "@shared/opData";

// ─── Layout: convert topology nodes to 3D positions ──────────────────────────
//
// Multiple TopologyNodes can share the same (gridI, gridJ) grid position
// (e.g. a head-node from row r and a leg-node from row r+1). In the old
// system these mapped to a single physical NodeType. We preserve that:
// one NodeType per unique grid position, with a mapping array so
// computeYarnPathSpline can resolve topology indices → physical indices.

export interface LayoutResult {
  nodes: NodeType[];
  /** Maps topology-node index → physical NodeType index. */
  nodeMap: number[];
}

export function layoutNodes(
  topology: TopologyResult,
  program: KnittingProgram,
  {
    STITCH_WIDTH = 1,
    ASPECT = 0.75,
    BED_OFFSET = 0.2,
    YARN_RADIUS = 0.2,
  }: {
    STITCH_WIDTH?: number;
    ASPECT?: number;
    BED_OFFSET?: number;
    YARN_RADIUS?: number;
  }
): LayoutResult {
  const HALF_STITCH = STITCH_WIDTH / 2;
  const STITCH_HEIGHT = STITCH_WIDTH * ASPECT;

  // Racking shifts the entire back bed horizontally. FTB convention is
  // dest = n + rack (loop goes straight across at current racking), which
  // means back[N] physically sits at front[N - rack]. So positive rack
  // shifts the back bed LEFT.
  const backShift = -topology.currentRacking * STITCH_WIDTH;

  const posMap = new Map<string, number>(); // "bed,gridI,gridJ" → physical index
  const nodes: NodeType[] = [];
  const nodeMap: number[] = [];

  for (let i = 0; i < topology.nodes.length; i++) {
    const topo = topology.nodes[i];
    // Bed is part of the key: front/back nodes at the same grid position
    // live at different z and shouldn't merge (especially once racking
    // shifts the back bed into the front bed's x range).
    const key = `${topo.bed},${topo.gridI},${topo.gridJ}`;

    if (posMap.has(key)) {
      nodeMap[i] = posMap.get(key)!;
    } else {
      const physIdx = nodes.length;
      posMap.set(key, physIdx);
      nodeMap[i] = physIdx;

      // Only pin the node to a bed if the op at its needle is a knit. Tucks,
      // misses start at z=0
      const needle = Math.floor(topo.gridI / 2);
      const op = program.ops.pixel(needle, topo.row);
      const isKnit = op === Op.FKNIT || op === Op.BKNIT;
      const z = isKnit ? (topo.bed === "front" ? BED_OFFSET : -BED_OFFSET) : 0;
      const numContacts = topo.stackSize;
      const offset = Math.sqrt(
        (numContacts * YARN_RADIUS * YARN_RADIUS) / 2
      );

      const dir = program.direction[topo.row] ?? "right";
      const evenI = topo.gridI % 2 === 0;
      const side = (dir === "right") === evenI;

      const tlbr = [-offset, -offset, 0];
      const bltr = [offset, offset, 0];

      const xShift = topo.bed === "back" ? backShift : 0;

      nodes.push({
        pos: [topo.gridI * HALF_STITCH + xShift, topo.gridJ * STITCH_HEIGHT, z],
        f: [0, 0, 0],
        v: [0, 0, 0],
        q0: side ? tlbr : bltr,
        q1: side ? bltr : tlbr,
      });
    }
  }

  return { nodes, nodeMap };
}

// ─── Yarn segments: connect consecutive nodes in each yarn path ──────────────

export function computeYarnPathSpline(
  topology: TopologyResult,
  program: KnittingProgram,
  nodes: NodeType[],
  nodeMap: number[],
  {
    ASPECT = 0.75,
    YARN_RADIUS = 0.2,
    STITCH_WIDTH = 1,
  }: { ASPECT?: number; YARN_RADIUS?: number; STITCH_WIDTH?: number }
): YarnSegments {
  const links: YarnSegments = {};

  for (const { yarnIndex, nodeIndices } of topology.yarnPaths) {
    if (nodeIndices.length === 0) continue;

    const segArr: SegmentType[] = [];
    links[yarnIndex] = segArr;

    const firstTopo = topology.nodes[nodeIndices[0]];
    segArr.push({
      source: nodeMap[nodeIndices[0]],
      sourceOffset: [0, 0, 0],
      leg: [firstTopo.isLeg, undefined],
      target: undefined,
      targetOffset: undefined,
      restLength: undefined,
    });


    for (let k = 0; k < nodeIndices.length; k++) {
      const topoIdx = nodeIndices[k];
      const physIdx = nodeMap[topoIdx];
      const topo = topology.nodes[topoIdx];

      const dir = program.direction[topo.row] ?? "right";
      const evenI = topo.gridI % 2 === 0;
      const isFront = topo.bed === "front";
      const legNode = topo.isLeg;

      const sign = evenI ? 1 : -1;
      let xyBasis = legNode
        ? Vec2.normalize([sign, -1])
        : Vec2.normalize([-sign, 1]);
      xyBasis = Vec2.scale(xyBasis, YARN_RADIUS);

      let dxFront = xyBasis[0];
      let dxBack = xyBasis[0];
      let dyFront = -xyBasis[1];
      let dyBack = xyBasis[1];
      const dzFront = YARN_RADIUS / 2;
      const dzBack = -YARN_RADIUS / 2;

      if (!isFront) {
        [dyFront, dyBack] = [dyBack, dyFront];
        [dxFront, dxBack] = [dxBack, dxFront];
      }

      // Close the previous segment
      const prev = segArr[segArr.length - 1];
      prev.target = physIdx;
      prev.leg[1] = legNode;

      // Open a new segment from this node
      const next: SegmentType = {
        source: physIdx,
        sourceOffset: undefined,
        target: undefined,
        targetOffset: undefined,
        restLength: undefined,
        leg: [legNode, undefined],
      };
      segArr.push(next);

      const movingRight = dir === "right";

      if (movingRight === evenI) {
        if (legNode === isFront) {
          prev.targetOffset = [dxBack, dyBack, dzBack];
          next.sourceOffset = [dxFront, dyFront, dzFront];
        } else {
          prev.targetOffset = [dxFront, dyFront, dzFront];
          next.sourceOffset = [dxBack, dyBack, dzBack];
        }
      } else {
        if (legNode === isFront) {
          prev.targetOffset = [dxFront, dyFront, dzFront];
          next.sourceOffset = [dxBack, dyBack, dzBack];
        } else {
          prev.targetOffset = [dxBack, dyBack, dzBack];
          next.sourceOffset = [dxFront, dyFront, dzFront];
        }
      }

      const dist = Vec3.magnitude(
        Vec3.subtract(nodes[prev.target!].pos, nodes[prev.source].pos)
      );

      if (prev.leg[0] && prev.leg[1]) {
        prev.restLength = dist;
      } else if (prev.leg[0] && !prev.leg[1]) {
        prev.restLength = STITCH_WIDTH * ASPECT * 0.7;
      } else if (!prev.leg[0] && !prev.leg[1]) {
        prev.restLength = dist * 0.7;
      } else {
        prev.restLength = STITCH_WIDTH * ASPECT * 0.7;
      }
    }

    // Close the last segment (self-referencing)
    const last = segArr[segArr.length - 1];
    last.target = last.source;
    last.targetOffset = [0, 0, 0];
    const dist = Vec3.magnitude(
      Vec3.subtract(nodes[last.target!].pos, nodes[last.source].pos)
    );
    const isLoop = last.leg[0] === last.leg[1];
    last.restLength = isLoop ? dist * ASPECT * 0.6 : dist;
  }

  return links;
}
