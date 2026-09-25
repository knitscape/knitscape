import { Op } from "@shared/opData";
import type {
  KnittingProgram,
  LayoutMode,
  TopologyNode,
  TopologyResult,
} from "./types";

interface Loop {
  id: number;
}

/**
 * Total meaningful program steps — knits, tucks, and transfers. Misses
 * are skipped since they don't affect bed state or create geometry.
 * Used as the max for the program scrubber.
 */
export function countStitches(program: KnittingProgram): number {
  const pixels = program.ops.pixels;
  let n = 0;
  for (let i = 0; i < pixels.length; i++) {
    const op = pixels[i];
    if (op !== Op.MISS && op !== Op.EMPTY) n++;
  }
  return n;
}

export function generateTopology(
  program: KnittingProgram,
  mode: LayoutMode = "technical",
  maxStitch: number = Infinity
): TopologyResult {
  const { width, height } = program;
  const gridWidth = 2 * width;
  const gridHeight = height + 1;
  const stopAt = Math.max(0, maxStitch);

  // Needle bed state — each needle holds a stack of loops (bottom → top)
  const frontBed: Loop[][] = Array.from({ length: width }, () => []);
  const backBed: Loop[][] = Array.from({ length: width }, () => []);

  // Output nodes and per-yarn paths
  const nodes: TopologyNode[] = [];
  const yarnPathMap = new Map<number, number[]>();

  // Track how many contact nodes are stacked at each grid position.
  // Used to assign stackIndex to each new node. stackSize is filled in
  // during a post-processing pass once all nodes exist.
  const stackAt = new Map<string, number>();

  function addNode(
    gridI: number,
    gridJ: number,
    row: number,
    bed: "front" | "back",
    isLeg: boolean
  ): number {
    const key = `${gridI},${gridJ}`;
    const stackIndex = stackAt.get(key) || 0;
    stackAt.set(key, stackIndex + 1);

    const idx = nodes.length;
    nodes.push({ gridI, gridJ, row, bed, isLeg, stackIndex, stackSize: -1, layer: 0 });
    return idx;
  }

  // Track where the most recent loop heads sit on each needle.
  // When a new stitch is formed, its legs must interlock at that position.
  // We track both the gridJ (row) and the source needle index, because
  // transfers move loops laterally — the legs must be placed at the
  // source needle's gridI to interlock with the transferred loop's heads.
  interface HeadPos {
    j: number;
    needle: number;
  }
  const lastHead = {
    front: Array.from({ length: width }, (_, i): HeadPos => ({ j: 0, needle: i })),
    back: Array.from({ length: width }, (_, i): HeadPos => ({ j: 0, needle: i })),
  };

  // Indices of the topology nodes representing the current top-of-stack
  // head nodes on each needle. Tucks push these up a row by mutating
  // their gridJ directly (since a tuck physically lifts the loop stack).
  const currentHeads = {
    front: Array.from({ length: width }, (): number[] => []),
    back: Array.from({ length: width }, (): number[] => []),
  };

  let nextLoopId = 0;

  // ── Initialise: pre-populate the front bed with one loop per needle ──────
  for (let n = 0; n < width; n++) {
    frontBed[n] = [{ id: nextLoopId++ }];
  }

  // ── Process each program row ─────────────────────────────────────────────
  // Each non-miss op (knit, tuck, or transfer) counts as one scrubbable
  // step. We stop once we've processed `stopAt` of them. Misses are free
  // (they don't change state) and don't consume a step.
  let stitchCount = 0;
  let currentRacking = 0;
  const compressed = mode === "compressed";
  // Compressed mode: needles whose held loop a yarn has floated past
  // (MISS) since it was last knit, e.g. a slip stitch.
  const missed = {
    front: new Array<boolean>(width).fill(false),
    back: new Array<boolean>(width).fill(false),
  };
  // Front needles that received a loop from a racked back→front transfer
  // in the current run of transfer rows (used to layer cable crosses).
  let placedThisBlock = new Map<number, number>(); // needle → row
  outer: for (let row = 0; row < height; row++) {
    const dir = program.direction[row];
    const yarn = program.yarnFeeder[row];
    const rack = program.racking[row];
    currentRacking = rack;
    if (yarn != null) placedThisBlock = new Map();

    // Compressed mode counts rows per needle: a new loop's heads sit one
    // row above the loop it's knit through, so rows that don't touch a
    // needle (other carriers, held needles, transfer rows) add no height.
    // The row's level is the highest head any of its stitches will make.
    // A needle that fell behind because a yarn floated past it (a slip
    // stitch) stretches its held loop up to meet the row, since the float
    // pulls it along with its neighbors. A needle no yarn passed (EMPTY:
    // held for short rows, or another carrier's section) keeps its height,
    // so a short-row wedge shows up as a stepped edge, not long loops.
    let rowLevel = 0;
    if (compressed) {
      for (let n = 0; n < width; n++) {
        const op = program.ops.pixel(n, row);
        // Empty needles have nothing to stretch, so they don't set the level.
        if ((op === Op.FKNIT || op === Op.FTUCK) && frontBed[n].length > 0) {
          rowLevel = Math.max(rowLevel, lastHead.front[n].j + 1);
        } else if ((op === Op.BKNIT || op === Op.BTUCK) && backBed[n].length > 0) {
          rowLevel = Math.max(rowLevel, lastHead.back[n].j + 1);
        }
      }
    }

    // Traverse needles in carriage direction
    const needles =
      dir === "right"
        ? Array.from({ length: width }, (_, i) => i)
        : Array.from({ length: width }, (_, i) => width - 1 - i);

    // Ensure a yarn path array exists — skip for transfer-only rows
    // (yarn === null), which have no yarn in the carrier.
    let path: number[] | null = null;
    if (yarn != null) {
      if (!yarnPathMap.has(yarn)) yarnPathMap.set(yarn, []);
      path = yarnPathMap.get(yarn)!;
    }

    for (const n of needles) {
      if (stitchCount >= stopAt) break outer;

      const op = program.ops.pixel(n, row);

      // ── MISS / EMPTY: no needle action at this cell ──────────────────
      // MISS = yarn floats past; EMPTY = nothing happens at all (used in
      // transfer rows where most cells aren't transferring).
      // Technical: in a non-transfer row the fabric still grows one row
      // around this needle, so any loop currently held here should stretch
      // up to the new row level. We mutate existing head nodes (and the
      // lastHead tracker) so the NEXT knit on this needle has its legs
      // right at the lifted heads — instead of reaching down across many
      // rows. Compressed mode defers this to the next knit (see rowLevel).
      if (op === Op.MISS || op === Op.EMPTY) {
        if (yarn != null && compressed && op === Op.MISS) {
          if (frontBed[n].length > 0) missed.front[n] = true;
          if (backBed[n].length > 0) missed.back[n] = true;
        }
        if (yarn != null && !compressed) {
          const liftTarget = row + 1;
          for (const bed of ["front", "back"] as const) {
            const heads = currentHeads[bed][n];
            if (heads.length === 0) continue;
            for (const idx of heads) {
              if (nodes[idx].gridJ < liftTarget) {
                nodes[idx].gridJ = liftTarget;
              }
            }
            if (lastHead[bed][n].j < liftTarget) {
              lastHead[bed][n].j = liftTarget;
            }
          }
        }
        continue;
      }

      // ── Drops: remove the loop head from the specified bed ──────────
      if (op === Op.FDROP) {
        frontBed[n] = [];
        lastHead.front[n] = { j: compressed ? lastHead.front[n].j : row + 1, needle: n };
        currentHeads.front[n] = [];
        stitchCount++;
        continue;
      }
      if (op === Op.BDROP) {
        backBed[n] = [];
        lastHead.back[n] = { j: compressed ? lastHead.back[n].j : row + 1, needle: n };
        currentHeads.back[n] = [];
        stitchCount++;
        continue;
      }

      // ── Transfers: move loops between beds ───────────────────────────
      // We mutate the existing head nodes so they reflect where the loop
      // physically is now — bed flips, and gridI shifts by the needle
      // delta so the rendered loop follows the transfer (combined with
      // the racking-based back-bed shift applied in layout).
      if (op === Op.FTB) {
        const dest = n + rack;
        if (dest >= 0 && dest < width) {
          backBed[dest].push(...frontBed[n]);
          frontBed[n] = [];
          // lastHead.needle tracks the CURRENT home of the loop's heads
          // so later knits place their heads at that needle's gridI.
          // After mutation, the heads live at dest, so reflect that.
          lastHead.back[dest] = { j: lastHead.front[n].j, needle: dest };
          const moved = currentHeads.front[n];
          const deltaI = (dest - n) * 2;
          for (const idx of moved) {
            nodes[idx].bed = "back";
            nodes[idx].gridI += deltaI;
          }
          currentHeads.back[dest] = moved;
          currentHeads.front[n] = [];
          missed.back[dest] = missed.front[n];
          missed.front[n] = false;
        }
        stitchCount++;
        continue;
      }
      if (op === Op.BTF) {
        const dest = n - rack;
        if (dest >= 0 && dest < width) {
          frontBed[dest].push(...backBed[n]);
          backBed[n] = [];
          lastHead.front[dest] = { j: lastHead.back[n].j, needle: dest };
          const moved = currentHeads.back[n];
          const deltaI = (dest - n) * 2;
          // A loop returned to the front at a rack sweeps across the needles
          // between its old and new positions. It passes over loops still on
          // the back bed there, and under ones already returned to the front
          // in this run of transfers — so in a cable, the group moved back
          // first ends up on top. Loops moving in this same row shift
          // together and don't cross each other.
          let layer = 0;
          if (rack !== 0) {
            const lo = Math.min(n, dest);
            const hi = Math.max(n, dest);
            for (let m = lo; m <= hi; m++) {
              const movingNow = program.ops.pixel(m, row) === Op.BTF;
              if (backBed[m].length > 0 && !movingNow) layer = 1;
            }
            if (layer === 0) {
              for (let m = lo; m <= hi; m++) {
                const placedRow = placedThisBlock.get(m);
                if (placedRow !== undefined && placedRow !== row) layer = -1;
              }
            }
            placedThisBlock.set(dest, row);
          }
          for (const idx of moved) {
            nodes[idx].bed = "front";
            nodes[idx].gridI += deltaI;
            if (layer !== 0) nodes[idx].layer = layer;
          }
          currentHeads.front[dest] = moved;
          currentHeads.back[n] = [];
          missed.front[dest] = missed.back[n];
          missed.back[n] = false;
        }
        stitchCount++;
        continue;
      }

      // ── Knit or Tuck: create contact nodes ───────────────────────────
      const isFront = op === Op.FKNIT || op === Op.FTUCK;
      const isKnit = op === Op.FKNIT || op === Op.BKNIT;
      const bed: "front" | "back" = isFront ? "front" : "back";
      const bedArray = isFront ? frontBed : backBed;

      // Legs interlock where the previous loop's heads are (gridJ may
      // differ from the current row when needles were missed).
      // After a transfer, the previous loop's heads are at the SOURCE
      // needle's gridI — the head nodes of the new stitch use that
      // position so the peak of the loop shows the lateral displacement,
      // while the legs anchor at the current needle.
      const prev = lastHead[bed][n];
      const hasPrevLoop = bedArray[n].length > 0;
      let legRow = prev.j;
      // Compressed: a slipped loop that fell behind the row stretches up
      // to meet it (see rowLevel).
      if (compressed && hasPrevLoop && missed[bed][n] && legRow < rowLevel - 1) {
        legRow = rowLevel - 1;
        for (const idx of currentHeads[bed][n]) nodes[idx].gridJ = legRow;
      }
      missed[bed][n] = false;
      // Technical: heads at current program row (shows time evolution).
      // Compressed: heads one row above the loop they're knit through; a
      // knit onto an empty needle has no loop below, so it joins the row.
      const headRow = !compressed
        ? row + 1
        : hasPrevLoop
          ? legRow + 1
          : Math.max(rowLevel, legRow + 1);

      // Sub-needle positions for legs (current needle — where stitch anchors)
      const iFirst = dir === "right" ? 2 * n : 2 * n + 1;
      const iSecond = dir === "right" ? 2 * n + 1 : 2 * n;

      // Sub-needle positions for heads (source needle — may differ after transfer)
      const srcN = prev.needle;
      const headFirst = dir === "right" ? 2 * srcN : 2 * srcN + 1;
      const headSecond = dir === "right" ? 2 * srcN + 1 : 2 * srcN;

      if (isKnit) {
        // A knit's legs interlock through the *previous* loop's heads on
        // this needle. If the needle is empty (e.g. after a drop for
        // pointelle, or first-row knits with no cast-on), there's nothing
        // to interlock with, so skip the legs entirely — the yarn just
        // lays a floating head across the needle.
        const head1 = addNode(headFirst, headRow, row, bed, false);
        const head2 = addNode(headSecond, headRow, row, bed, false);
        if (hasPrevLoop) {
          const leg1 = addNode(iFirst, legRow, row, bed, true);
          const leg2 = addNode(iSecond, legRow, row, bed, true);
          if (path) path.push(leg1, head1, head2, leg2);
        } else {
          if (path) path.push(head1, head2);
        }

        // Knock off old loops, replace with new loop
        bedArray[n] = [{ id: nextLoopId++ }];

        lastHead[bed][n] = { j: headRow, needle: n };
        currentHeads[bed][n] = [head1, head2];
      } else {
        // Tuck: yarn is laid into the latch and pressed against the
        // existing loop's heads. It doesn't form a new loop — it just
        // rides on top, physically lifting the existing heads to sit
        // with the tuck. newJ matches the knit's headRow for this mode.
        const newJ = compressed ? headRow : prev.j + 1;
        for (const idx of currentHeads[bed][n]) {
          nodes[idx].gridJ = newJ;
        }

        const head1 = addNode(headFirst, newJ, row, bed, false);
        const head2 = addNode(headSecond, newJ, row, bed, false);
        if (path) path.push(head1, head2);

        // Accumulate on the needle without removing existing loops.
        bedArray[n].push({ id: nextLoopId++ });

        lastHead[bed][n] = { j: newJ, needle: prev.needle };
        currentHeads[bed][n].push(head1, head2);
      }

      stitchCount++;
    }
  }

  // ── Post-process: fill in stackSize for every node ───────────────────────
  // Recompute from final node positions because tucks mutate gridJ after
  // nodes are created, leaving stackAt out of date.
  const finalStackAt = new Map<string, number>();
  for (const node of nodes) {
    const key = `${node.gridI},${node.gridJ}`;
    finalStackAt.set(key, (finalStackAt.get(key) || 0) + 1);
  }
  for (const node of nodes) {
    node.stackSize = finalStackAt.get(`${node.gridI},${node.gridJ}`) || 1;
  }

  // ── Build output ─────────────────────────────────────────────────────────
  const yarnPaths = Array.from(yarnPathMap.entries()).map(
    ([yarnIndex, nodeIndices]) => ({ yarnIndex, nodeIndices })
  );

  return { gridWidth, gridHeight, nodes, yarnPaths, currentRacking };
}
