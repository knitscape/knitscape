import { stitches } from "../constants";

const FRONT = new Set([
  stitches.KNIT,
  stitches.FXR1,
  stitches.FXR2,
  stitches.FXR3,
  stitches.FXL1,
  stitches.FXL2,
  stitches.FXL3,
]);

const BACK = new Set([
  stitches.PURL,
  stitches.BXR1,
  stitches.BXR2,
  stitches.BXR3,
  stitches.BXL1,
  stitches.BXL2,
  stitches.BXL3,
]);

const FRONT_TO_BACK = new Set([
  stitches.FTB,
  stitches.FL1,
  stitches.FL2,
  stitches.FL3,
  stitches.FR1,
  stitches.FR2,
  stitches.FR3,
]);

const BACK_TO_FRONT = new Set([
  stitches.BTF,
  stitches.BL1,
  stitches.BL2,
  stitches.BL3,
  stitches.BR1,
  stitches.BR2,
  stitches.BR3,
]);

const TRANSFERS = [
  stitches.FXR1,
  stitches.FXR2,
  stitches.FXR3,
  stitches.FXL1,
  stitches.FXL2,
  stitches.FXL3,
  stitches.BXR1,
  stitches.BXR2,
  stitches.BXR3,
  stitches.BXL1,
  stitches.BXL2,
  stitches.BXL3,
];

const TRANSFER_SET = new Set(TRANSFERS);

const OFFSETS = [1, 2, 3, -1, -2, -3, 1, 2, 3, -1, -2, -3];

const RACKINGS = [
  [stitches.FTB, stitches.BTF],
  [stitches.BL1, stitches.FL1],
  [stitches.BL2, stitches.FL2],
  [stitches.BL3, stitches.FL3],
  [stitches.BR1, stitches.FR1],
  [stitches.BR2, stitches.FR2],
  [stitches.BR3, stitches.FR3],
];

function staggerBedTransfers(bedTransfers) {
  let transfers = [];
  let FTBEven, FTBOdd, BTFEven, BTFOdd;

  for (let i = 0; i < bedTransfers.length; i++) {
    let op = bedTransfers[i];
    if (FRONT_TO_BACK.has(op)) {
      if (i % 2 == 0) {
        if (FTBEven == undefined) {
          FTBEven = new Array(bedTransfers.length).fill(0);
          transfers.push(FTBEven);
        }

        FTBEven[i] = op;
      } else {
        if (FTBOdd == undefined) {
          FTBOdd = new Array(bedTransfers.length).fill(0);
          transfers.push(FTBOdd);
        }

        FTBOdd[i] = op;
      }
    } else if (BACK_TO_FRONT.has(op)) {
      if (i % 2 == 0) {
        if (BTFEven == undefined) {
          BTFEven = new Array(bedTransfers.length).fill(0);
          transfers.push(BTFEven);
        }
        BTFEven[i] = op;
      } else {
        if (BTFOdd == undefined) {
          BTFOdd = new Array(bedTransfers.length).fill(0);
          transfers.push(BTFOdd);
        }
        BTFOdd[i] = op;
      }
    }
  }

  return transfers;
}

function resolveOffsets(pass, offsets) {
  let bedTransfers = new Array(pass.length).fill(0);

  let seenOffsets = new Set();

  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] != 0) {
      seenOffsets.add(offsets[i]);
      if (pass[i] == stitches.KNIT) {
        bedTransfers[i] = stitches.FTB;
      } else if (pass[i] == stitches.PURL) {
        bedTransfers[i] = stitches.BTF;
      }
    }
  }

  const swapSides = staggerBedTransfers(bedTransfers);

  const rackings = Array.from(seenOffsets);
  rackings.sort((a, b) => Math.abs(a) - Math.abs(b));
  const rackedTransfers = [];

  for (const currentRacking of rackings) {
    let transfersAtRacking = new Array(pass.length).fill(0);

    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] == currentRacking) {
        if (pass[i] == stitches.KNIT) {
          transfersAtRacking[i] = RACKINGS.at(currentRacking)[0];
        } else if (pass[i] == stitches.PURL) {
          transfersAtRacking[i] = RACKINGS.at(currentRacking)[1];
        }
      }
    }
    rackedTransfers.push(...staggerBedTransfers(transfersAtRacking));
  }

  return [...swapSides, ...rackedTransfers];
}

export function scheduleChart(machineChart, yarnSequence) {
  let rows = machineChart.make2d();

  let passes = [];
  let yarns = [];

  for (let j = 0; j < machineChart.height; j++) {
    let transferPasses = [];
    let row = rows[j];
    let knitPass = new Array(machineChart.width).fill(stitches.EMPTY);
    let loopOffsets = new Array(machineChart.width).fill(0);
    let containsOffsets = false;

    for (let i = 0; i < row.length; i++) {
      let op = row[i];

      if (!TRANSFER_SET.has(op)) {
        // If it's not a transfer, pass directly through
        knitPass[i] = op;
      } else if (TRANSFER_SET.has(op)) {
        containsOffsets = true;
        if (FRONT.has(op)) {
          knitPass[i] = stitches.KNIT;
        } else if (BACK.has(op)) {
          knitPass[i] = stitches.PURL;
        }

        loopOffsets[i] = OFFSETS[TRANSFERS.indexOf(op)];
      }
    }

    if (containsOffsets) {
      transferPasses = resolveOffsets(knitPass, loopOffsets);
    }
    passes.push(knitPass, ...transferPasses);
    yarns.push(yarnSequence[j], ...Array(transferPasses.length).fill(0));
  }

  return { passes, yarns };
}
