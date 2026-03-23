import { stitches } from "../constants";
import { Bimp } from "../lib/Bimp";
import { GLOBAL_STATE } from "../state";

function processRow(yarnRow, stitchRow, direction, yarnSides) {
  let sequence = [];

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
        //Something is wrong here, debug this
        continue;
      }
      passes[currentPassIndex][loc] = currentStitch;

      // Check yarn at next location
      let nextLoc = direction == "right" ? loc + 1 : loc - 1;
      let nextYarn = yarnRow[nextLoc];

      // If the next yarn is different...
      if (nextYarn != undefined && nextYarn != 0 && nextYarn != currentYarn) {
        const nextPassIndex = sequence.indexOf(nextYarn);
        // Add a front at the current location to join the two pieces.
        // This is be the normal way to join intarsia.
        // TODO: These boundary conditions should not be hard coded.
        // What is a better way to do this ? Perhaps it is a setting on the yarn fill.
        if (GLOBAL_STATE.tucks) passes[nextPassIndex][loc] = stitches.FT;
      }
    }
  }

  return { passes, sequence };
}

export function yarnSeparation(stitchChart, yarnChart) {
  let st = stitchChart.make2d();
  let yc = yarnChart.make2d();
  let direction = "right";

  let yarnPasses = [];
  let yarnSequence = [];
  let rowMap = [];

  for (let rowIndex = 0; rowIndex < yc.length; rowIndex++) {
    let stitchRow = st[rowIndex];
    let yarnRow = yc[rowIndex];

    let { passes, sequence } = processRow(yarnRow, stitchRow, direction);
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
