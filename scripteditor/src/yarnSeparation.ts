import { stitches } from "@shared/stitches";
import { Bimp } from "@shared/Bimp";
import type { StitchPatternType } from "./simulation/types";

function processRow(
  yarnRow: number[],
  stitchRow: number[],
  direction: string,
  tucks: boolean
): { passes: number[][]; sequence: number[] } {
  let sequence: number[] = [];

  for (let i = 0; i < yarnRow.length; i++) {
    const loc = direction == "right" ? i : yarnRow.length - i - 1;
    const currentYarn = yarnRow[loc];
    if (!sequence.includes(currentYarn) && currentYarn != 0)
      sequence.push(currentYarn);
  }

  const passes = sequence.map(() => Array(yarnRow.length).fill(stitches.BM));

  for (let i = 0; i < yarnRow.length; i++) {
    const loc = direction == "right" ? i : yarnRow.length - i - 1;

    const currentYarn = yarnRow[loc];
    const currentStitch = stitchRow[loc];
    const currentPassIndex = sequence.indexOf(currentYarn);

    if (currentStitch == stitches.EMPTY) {
      // When it is an empty stitch, mark all passes as empty at this location
      passes.forEach((pass) => {
        pass[loc] = currentStitch;
      });
    } else {
      // Otherwise add this operation to the current pass
      if (currentPassIndex < 0) {
        continue;
      }
      passes[currentPassIndex][loc] = currentStitch;

      // Check yarn at next location
      let nextLoc = direction == "right" ? loc + 1 : loc - 1;
      let nextYarn = yarnRow[nextLoc];

      // If the next yarn is different...
      if (nextYarn != undefined && nextYarn != 0 && nextYarn != currentYarn) {
        const nextPassIndex = sequence.indexOf(nextYarn);
        // Add a front tuck at the current location to join the two pieces.
        if (tucks) passes[nextPassIndex][loc] = stitches.FT;
      }
    }
  }

  return { passes, sequence };
}

export function yarnSeparation(
  stitchChart: Bimp,
  yarnChart: Bimp,
  tucks: boolean = false
): StitchPatternType {
  let st = stitchChart.make2d();
  let yc = yarnChart.make2d();
  let direction = "right";

  let yarnPasses: number[][] = [];
  let yarnSequence: number[] = [];
  let rowMap: number[] = [];

  for (let rowIndex = 0; rowIndex < yc.length; rowIndex++) {
    let stitchRow = st[rowIndex];
    let yarnRow = yc[rowIndex];

    let { passes, sequence } = processRow(yarnRow, stitchRow, direction, tucks);
    yarnPasses = yarnPasses.concat(passes);
    yarnSequence.push(...sequence);
    rowMap.push(...Array(passes.length).fill(rowIndex));

    direction = direction == "right" ? "left" : "right";
  }

  const width = yarnPasses[0].length;
  const height = yarnPasses.length;
  const ops = new Uint8ClampedArray(yarnPasses.flat());
  const yarns = Array.from(
    yarnSequence.filter((v, i, arr) => arr.indexOf(v) === i)
  );
  const carriagePasses = rowMap.map((ogRow) =>
    ogRow % 2 == 0 ? "right" : "left"
  );

  return {
    width,
    height,
    ops,
    yarnSequence,
    rowMap,
    yarns,
    carriagePasses,
    op(x: number, y: number): number {
      if (x > width - 1 || x < 0 || y > height - 1 || y < 0) return -1;
      return ops[x + y * width] ?? -1;
    },
  };
}
