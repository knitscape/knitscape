import type { NodeType, ResolvedSegment, RelaxSettings } from "./types";

// Hot-loop arithmetic is inlined at the scalar level: every helper that would
// allocate a fresh [x, y, z] in a naive implementation is expanded in place.
// This keeps the inner iteration allocation-free so it doesn't churn the GC.
//
// Matches the semantics of the Vec3 helpers exactly — in particular,
// `normalize([0,0,0])` resolves to zero (not NaN), via a length threshold.

const EPS = 1e-5;

export function yarnRelaxation(settings: RelaxSettings) {
  let ALPHA = 1;
  let running = true;

  function applyYarnForce(
    nodes: NodeType[],
    seg: ResolvedSegment,
    K_YARN: number
  ): void {
    const cn1 = nodes[seg.source];
    const cn2 = nodes[seg.target];
    const p1 = cn1.pos;
    const p2 = cn2.pos;
    const so = seg.sourceOffset;
    const to = seg.targetOffset;

    // currentLength = |p2 - p1|
    const dpx = p2[0] - p1[0];
    const dpy = p2[1] - p1[1];
    const dpz = p2[2] - p1[2];
    const currentLength = Math.sqrt(dpx * dpx + dpy * dpy + dpz * dpz);

    const forceMag = K_YARN * (currentLength - seg.restLength);

    // direction = normalize((p1 + so) - (p2 + to))
    const ox = p1[0] + so[0] - p2[0] - to[0];
    const oy = p1[1] + so[1] - p2[1] - to[1];
    const oz = p1[2] + so[2] - p2[2] - to[2];
    const oLen = Math.sqrt(ox * ox + oy * oy + oz * oz);
    if (oLen <= EPS) return; // normalize would zero out → no force

    const s = (-forceMag * ALPHA) / oLen;
    const fx = ox * s;
    const fy = oy * s;
    const fz = oz * s;

    const f1 = cn1.f;
    f1[0] += fx;
    f1[1] += fy;
    f1[2] += fz;
    const f2 = cn2.f;
    f2[0] -= fx;
    f2[1] -= fy;
    f2[2] -= fz;
  }

  // Discrete Elastic Rod bending at one interior polyline vertex.
  //
  // Three consecutive offset-points p0, p1, p2 (each = node.pos + offset)
  // define two edges e0 = p1-p0, e1 = p2-p1. The turning angle
  //   θ = atan2(|e0 × e1|, e0 · e1)
  // is 0 when the rod is straight, π when fully reversed.
  //
  // Bending energy (isotropic, zero rest curvature):
  //   E = k_b · θ² / l̄,     l̄ = (|e0| + |e1|) / 2
  //
  // Force at each endpoint points perpendicular to its incident edge,
  // inside the bending plane, toward "straighter":
  //   F0 = -(2 k_b θ)/(l̄ · |e0|) · (b × t0)
  //   F2 = -(2 k_b θ)/(l̄ · |e1|) · (b × t1)
  //   F1 = -(F0 + F2)                    (net force = 0; translational inv.)
  //
  // where b = unit(e0 × e1), t0 = e0/|e0|, t1 = e1/|e1|. Forces on the
  // offset-points are applied to the underlying NODE centers — nodes don't
  // carry orientation DOFs, so the offset lever arm doesn't add a torque.
  function bending(
    nodes: NodeType[],
    n0: number,
    o0: number[],
    n1: number,
    o1: number[],
    n2: number,
    o2: number[]
  ): void {
    const p0 = nodes[n0].pos;
    const p1 = nodes[n1].pos;
    const p2 = nodes[n2].pos;

    const e0x = p1[0] + o1[0] - p0[0] - o0[0];
    const e0y = p1[1] + o1[1] - p0[1] - o0[1];
    const e0z = p1[2] + o1[2] - p0[2] - o0[2];
    const e1x = p2[0] + o2[0] - p1[0] - o1[0];
    const e1y = p2[1] + o2[1] - p1[1] - o1[1];
    const e1z = p2[2] + o2[2] - p1[2] - o1[2];

    const l0 = Math.sqrt(e0x * e0x + e0y * e0y + e0z * e0z);
    const l1 = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z);
    if (l0 <= EPS || l1 <= EPS) return;

    const cx = e0y * e1z - e0z * e1y;
    const cy = e0z * e1x - e0x * e1z;
    const cz = e0x * e1y - e0y * e1x;
    const crossMag = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (crossMag <= EPS) return; // parallel/antiparallel → binormal undefined

    const dot = e0x * e1x + e0y * e1y + e0z * e1z;
    const theta = Math.atan2(crossMag, dot);
    if (theta <= EPS) return;

    // b = unit(e0 × e1)
    const invC = 1 / crossMag;
    const bx = cx * invC;
    const by = cy * invC;
    const bz = cz * invC;

    // t0 = e0/l0, t1 = e1/l1 — inlined with 1/l0 and 1/l1 into the coeffs.
    const lBar = 0.5 * (l0 + l1);
    const k = 2 * settings.tYarn * ALPHA * theta / lBar;
    const c0 = -k / l0; // scales (b × t0) = (b × e0) / l0 → extra /l0 factor
    const c2 = -k / l1;

    // b × e0 (we use e0 rather than t0 and absorb the extra /l0 into c0)
    const bxe0x = by * e0z - bz * e0y;
    const bxe0y = bz * e0x - bx * e0z;
    const bxe0z = bx * e0y - by * e0x;
    const bxe1x = by * e1z - bz * e1y;
    const bxe1y = bz * e1x - bx * e1z;
    const bxe1z = bx * e1y - by * e1x;

    const f0x = (c0 / l0) * bxe0x;
    const f0y = (c0 / l0) * bxe0y;
    const f0z = (c0 / l0) * bxe0z;
    const f2x = (c2 / l1) * bxe1x;
    const f2y = (c2 / l1) * bxe1y;
    const f2z = (c2 / l1) * bxe1z;

    const fn0 = nodes[n0].f;
    const fn1 = nodes[n1].f;
    const fn2 = nodes[n2].f;
    fn0[0] += f0x;
    fn0[1] += f0y;
    fn0[2] += f0z;
    fn2[0] += f2x;
    fn2[1] += f2y;
    fn2[2] += f2z;
    // F1 = -(F0 + F2) — keeps net force zero
    fn1[0] -= f0x + f2x;
    fn1[1] -= f0y + f2y;
    fn1[2] -= f0z + f2z;
  }

  function updatePositions(nodes: NodeType[]): void {
    const decay = settings.velocityDecay;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const v = node.v;
      const pos = node.pos;
      const f = node.f;
      const vx = (v[0] + f[0]) * decay;
      const vy = (v[1] + f[1]) * decay;
      const vz = (v[2] + f[2]) * decay;
      v[0] = vx;
      v[1] = vy;
      v[2] = vz;
      pos[0] += vx;
      pos[1] += vy;
      pos[2] += vz;
      f[0] = 0;
      f[1] = 0;
      f[2] = 0;
    }
  }

  function tick(
    yarns: Record<string, ResolvedSegment[]>,
    nodes: NodeType[]
  ): void {
    const { iterations, kYarn, alphaTarget, alphaMin } = settings;
    const alphaDecay = 1 - Math.pow(Math.max(alphaMin, 1e-9), 1 / 300);

    // Hoist the yarn list once per tick instead of once per iteration.
    const yarnList: ResolvedSegment[][] = [];
    for (const k in yarns) yarnList.push(yarns[k]);

    for (let k = 0; k < iterations; ++k) {
      ALPHA += (alphaTarget - ALPHA) * alphaDecay;

      for (let y = 0; y < yarnList.length; y++) {
        const segArr = yarnList[y];
        const n = segArr.length;

        // Stretching — one spring per segment.
        for (let s = 0; s < n; s++) {
          applyYarnForce(nodes, segArr[s], kYarn);
        }

        // Bending — the yarn is a 2N-point zig-zag polyline: each segment
        // contributes a source-offset point and a target-offset point, with
        // a "crossover" edge spanning the offset discontinuity at each
        // shared node. Interior vertices come in two flavors:
        //
        //   • crossover→body: prev segment's target-offset, this segment's
        //     source-offset, this segment's target-offset
        //   • body→crossover: this segment's source-offset, this segment's
        //     target-offset, next segment's source-offset
        //
        // Visiting each once covers all 2N-2 interior vertices with no
        // double counting.
        for (let s = 1; s < n; s++) {
          const prev = segArr[s - 1];
          const cur = segArr[s];
          bending(
            nodes,
            prev.target,
            prev.targetOffset,
            cur.source,
            cur.sourceOffset,
            cur.target,
            cur.targetOffset
          );
        }
        for (let s = 0; s + 1 < n; s++) {
          const cur = segArr[s];
          const next = segArr[s + 1];
          bending(
            nodes,
            cur.source,
            cur.sourceOffset,
            cur.target,
            cur.targetOffset,
            next.source,
            next.sourceOffset
          );
        }
      }

      updatePositions(nodes);
    }

    if (ALPHA < alphaMin) stop();
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
