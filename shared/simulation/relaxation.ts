import { Vec3 } from "../Vec3";
import type { DSType, NodeType, ResolvedSegment } from "./types";

export function yarnRelaxation(
  kYarn = 0.4,
  tYarn = 0.01,
  alphaMin = 0.001,
  alphaTarget = 0,
  iterations = 4,
  velocityDecay = 0.5
) {
  let ALPHA = 1;
  let ALPHA_MIN = alphaMin;
  let ALPHA_TARGET = alphaTarget;
  let ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300);

  let running = true;

  function applyYarnForce(nodes: NodeType[], seg: ResolvedSegment, K_YARN: number): void {
    let cn1 = nodes[seg.source];
    let cn2 = nodes[seg.target];

    let offset1 = Vec3.add(cn1.pos, seg.sourceOffset);
    let offset2 = Vec3.add(cn2.pos, seg.targetOffset);

    let p1 = cn1.pos;
    let p2 = cn2.pos;

    const currentLength = Vec3.magnitude(Vec3.subtract(p2, p1));

    const forceMagnitude = K_YARN * (currentLength - seg.restLength);

    const direction = Vec3.normalize(Vec3.subtract(offset1, offset2));

    const force = Vec3.scale(direction, -forceMagnitude * ALPHA);

    cn1.f = Vec3.add(cn1.f, force);
    cn2.f = Vec3.subtract(cn2.f, force);
  }

  function torsion(nodes: NodeType[], seg1: ResolvedSegment, seg2: ResolvedSegment, seg3: ResolvedSegment): void {
    let p0 = Vec3.add(nodes[seg1.target].pos, seg1.targetOffset);
    let p1 = Vec3.add(nodes[seg2.source].pos, seg2.sourceOffset);
    let p2 = Vec3.add(nodes[seg2.target].pos, seg2.targetOffset);
    let p3 = Vec3.add(nodes[seg3.source].pos, seg3.sourceOffset);

    let v01 = Vec3.subtract(p1, p0);
    let v12 = Vec3.subtract(p2, p1);
    let v23 = Vec3.subtract(p3, p2);

    // unit tangents
    let T01 = Vec3.normalize(v01);
    let T12 = Vec3.normalize(v12);
    let T23 = Vec3.normalize(v23);

    let B1 = Vec3.cross(T01, T12);
    let B2 = Vec3.cross(T12, T23);

    let omega = -Math.acos(Vec3.dot(Vec3.normalize(B1), Vec3.normalize(B2)));
    if (Vec3.dot(T12, Vec3.cross(B1, B2)) < 0) {
      omega = -omega;
    }

    let mag = 0;

    if (!isNaN(omega)) {
      mag = tYarn * ALPHA * omega;
    }

    if (mag == 0) return;

    let CN1 = nodes[seg2.source];
    let CN2 = nodes[seg2.target];

    let f1 = Vec3.scale(Vec3.normalize(B1), mag);
    let f2 = Vec3.scale(Vec3.normalize(B2), -mag);

    CN1.f = Vec3.add(CN1.f, f1);
    CN2.f = Vec3.add(CN2.f, f2);
  }

  function updateContactNodePositions(DS: DSType, nodes: NodeType[]): void {
    nodes.forEach((node: NodeType, index: number) => {
      let i = index % DS.width;
      let j = Math.floor(index / DS.width);

      node.v = Vec3.scale(Vec3.add(node.v, node.f), velocityDecay);
      node.pos = Vec3.add(node.pos, node.v);
      // clear accumulated forces for next tick
      node.f = [0, 0, 0];
    });
  }

  function tick(yarns: Record<string, ResolvedSegment[]>, DS: DSType, nodes: NodeType[]): void {
    for (var k = 0; k < iterations; ++k) {
      ALPHA += (ALPHA_TARGET - ALPHA) * ALPHA_DECAY;
      // Accumulate forces to nodes
      Object.entries(yarns).forEach(([_yarnIndex, segArr]: [string, ResolvedSegment[]]) => {
        // segment-related forces
        for (let segIndex = 0; segIndex < segArr.length; segIndex++) {
          applyYarnForce(nodes, segArr[segIndex], kYarn);
        }

        for (let segIndex = 1; segIndex + 1 < segArr.length; segIndex++) {
          torsion(
            nodes,
            segArr[segIndex - 1],
            segArr[segIndex],
            segArr[segIndex + 1]
          );
        }
      });

      updateContactNodePositions(DS, nodes);
    }

    if (ALPHA < ALPHA_MIN) {
      stop();
    }
  }

  function stop(): void {
    running = false;
  }

  return {
    tick,
    stop,
    alpha: () => ALPHA,
    running: () => running,
  };
}
