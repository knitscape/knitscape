import { stitches } from "@shared/stitches";
import { Bimp } from "@shared/Bimp";

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
) {
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

  const machineChart = new Bimp(
    yarnPasses[0].length,
    yarnPasses.length,
    yarnPasses.flat()
  );

  return { machineChart, yarnSequence, rowMap };
}
