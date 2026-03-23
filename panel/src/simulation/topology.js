import { stitches, cnStates, MAX_H_SHIFT, MAX_V_SHIFT } from "../constants";

function checkForTransfers(i, j, DS) {
  let iMin = i - MAX_H_SHIFT < 0 ? 0 : i - MAX_H_SHIFT;
  let iMax = i + MAX_H_SHIFT >= DS.width ? DS.width - 1 : i + MAX_H_SHIFT;

  const transferredCNs = [];
  for (let ii = iMin; ii <= iMax; ii++) {
    let di = DS.MV(ii, j)[0];

    if (di == null) continue;
    if (ii + di == i) {
      transferredCNs.push([ii, j]);
    }
  }

  return transferredCNs;
}

function heldCNS(i, j, DS) {
  // Looking at CN i,j, looks down the column to find any held CNs (loops still on the needle or transferred to the needle)
  let heldCNsList = [];

  let jj = j;

  while (jj >= 0) {
    const [_, AV, MV] = DS.CN(i, jj);
    const transferredCNsList = checkForTransfers(i, jj, DS);

    if (
      (AV == cnStates.ECN && MV[0] == null && MV[1] == null) || // looking at an empty stitch
      (AV == cnStates.ECN && MV[0] == 0 && MV[1] == -1) || // looking at a miss stitch
      (AV == cnStates.PCN && transferredCNsList.length > 0) // there is a PCN here
    ) {
      heldCNsList = heldCNsList.concat(transferredCNsList);

      let dj = j - jj;
      if (MV[0] == null && MV[1] == null) {
        DS.setMV(i, jj, [0, dj]);
      } else {
        DS.CN(i, jj)[2][1] = dj;
      }
    } else if (AV == cnStates.UACN && transferredCNsList.length > 0) {
      // We don't adjust the dj of a UACN - is this right?
      heldCNsList = heldCNsList.concat(transferredCNsList);
    } else {
      return heldCNsList;
    }

    jj = jj - 1;
  }

  return heldCNsList;
}

function lowerNeighborIsAnchored(i, j, DS) {
  const cnRight = DS.CN(i + 1, j - 1);
  const cnLeft = DS.CN(i - 1, j - 1);
  if (
    (cnRight[1] == cnStates.ACN &&
      cnRight[2][0] == 0 &&
      cnRight[2][1] == 0 &&
      i + 1 < DS.width) ||
    (cnLeft[1] == cnStates.ACN &&
      cnLeft[2][0] == 0 &&
      cnLeft[2][1] == 0 &&
      i > 0)
  ) {
    // if lower neighbor is an ACN that wasn't moved, it is actually anchored. return true
    return true;
  }
  return false;
}

function kpLower(i, j, st, DS) {
  const [_, AV, MV] = DS.CN(i, j);

  // Always set the st value
  DS.setST(i, j, st);

  if (AV == cnStates.PCN) {
    if (MV[0] != 0) {
      // it was a loop that was transferred - we do nothing
    } else {
      // Get any  CNs transferred in this row
      const heldCNS = checkForTransfers(i, j, DS);
      // Normal knit/purl into another knit/purl. actualizes any CNs on the needle
      for (const [ii, jj] of heldCNS) {
        if (DS.AV(ii, jj) == cnStates.PCN) {
          DS.setAV(ii, jj, cnStates.ACN);
        }
      }
    }
  } else if (AV == cnStates.UACN) {
    // Find any PCNS on the needle and anchor them
    const held = heldCNS(i, j, DS);
    for (const [ii, jj] of held) {
      if (DS.AV(ii, jj) == cnStates.PCN) DS.setAV(ii, jj, cnStates.ACN);
    }

    if (lowerNeighborIsAnchored(i, j, DS)) DS.setAV(i, j, cnStates.ACN);
  } else if (AV == cnStates.ECN) {
    const held = heldCNS(i, j, DS);

    for (const [ii, jj] of held) {
      let AV = DS.AV(ii, jj);
      if (AV == cnStates.PCN) {
        DS.setAV(ii, jj, cnStates.ACN);
      } else if (AV == cnStates.UACN) {
        if (lowerNeighborIsAnchored(ii, jj, DS)) DS.setAV(ii, jj, cnStates.ACN);
      }
    }
  }
}

function missUpper(i, j, DS) {
  DS.setAV(i, j + 1, cnStates.ECN);
  DS.setMV(i, j + 1, [0, -1]);
}

function tuckUpper(i, j, DS) {
  DS.setAV(i, j + 1, cnStates.UACN);
  DS.setMV(i, j + 1, [0, 0]);
}

function tuckMissLower(i, j, DS) {
  if (DS.MV(i, j)[1] > -1) {
    // if we're not tucking or slipping above a previous slip, set delta J to one to indicate that the
    // CN has moved up one row.
    DS.MV(i, j)[1] = 1;
  } else {
    // Special case if we are doing a miss stitch above a miss stitch
    // Look down the column to find a CN where delta J is positive and increment it to indicate that it has moved up another row
    let found = false;
    let jCurrent = j;
    while (jCurrent > 0 && !found) {
      if (DS.MV(i, jCurrent)[1] > 0) {
        DS.MV(i, jCurrent)[1] += 1;
        found = true;
      }
      jCurrent = jCurrent - 1;
    }
  }
}

function kpUpper(i, j, DS) {
  // Initialize MV to [0,0]
  DS.setMV(i, j + 1, [0, 0]);

  const [_, AV, MV] = DS.CN(i, j);

  // Figure out the AV
  if (AV == cnStates.ACN && MV[0] == 0 && MV[1] == 0) {
    // if the j cell has an ACN and has not moved, the j+1 cell becomes a PCN
    DS.setAV(i, j + 1, cnStates.PCN);
  } else {
    DS.setAV(i, j + 1, cnStates.UACN);
  }
}

function transferUpper(i, j, di, DS) {
  // Initialize MV to [di,0]

  if (i + di < 0 || i + di >= DS.width) {
    console.error("Error! Attempting to transfer outside pattern bounds");
    return;
  }

  DS.setMV(i, j + 1, [di, 0]);
  DS.setAV(i, j + 1, cnStates.UACN);
}

function processStitch(st, iFirst, iSecond, j, DS) {
  if (st == stitches.KNIT || st == stitches.PURL) {
    kpLower(iFirst, j, st, DS);
    kpLower(iSecond, j, st, DS);

    kpUpper(iFirst, j, DS);
    kpUpper(iSecond, j, DS);
  } else if (st == stitches.FT || st == stitches.BT) {
    tuckMissLower(iFirst, j, DS);
    tuckMissLower(iSecond, j, DS);

    tuckUpper(iFirst, j, DS);
    tuckUpper(iSecond, j, DS);
  } else if (st == stitches.FM || st == stitches.BM) {
    tuckMissLower(iFirst, j, DS);
    tuckMissLower(iSecond, j, DS);

    missUpper(iFirst, j, DS);
    missUpper(iSecond, j, DS);

    // Transfers
  } else if (st == stitches.FXL1) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, -2, DS);
    transferUpper(iSecond, j, -2, DS);
  } else if (st == stitches.BXL1) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, -2, DS);
    transferUpper(iSecond, j, -2, DS);
  } else if (st == stitches.FXR1) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, 2, DS);
    transferUpper(iSecond, j, 2, DS);
  } else if (st == stitches.BXR1) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, 2, DS);
    transferUpper(iSecond, j, 2, DS);
  } else if (st == stitches.FXL2) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, -4, DS);
    transferUpper(iSecond, j, -4, DS);
  } else if (st == stitches.BXL2) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, -4, DS);
    transferUpper(iSecond, j, -4, DS);
  } else if (st == stitches.FXR2) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, 4, DS);
    transferUpper(iSecond, j, 4, DS);
  } else if (st == stitches.BXR2) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, 4, DS);
    transferUpper(iSecond, j, 4, DS);
  } else if (st == stitches.FXL3) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, -6, DS);
    transferUpper(iSecond, j, -6, DS);
  } else if (st == stitches.BXL3) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, -6, DS);
    transferUpper(iSecond, j, -6, DS);
  } else if (st == stitches.FXR3) {
    kpLower(iFirst, j, stitches.KNIT, DS);
    kpLower(iSecond, j, stitches.KNIT, DS);

    transferUpper(iFirst, j, 6, DS);
    transferUpper(iSecond, j, 6, DS);
  } else if (st == stitches.BXR3) {
    kpLower(iFirst, j, stitches.PURL, DS);
    kpLower(iSecond, j, stitches.PURL, DS);

    transferUpper(iFirst, j, 6, DS);
    transferUpper(iSecond, j, 6, DS);
  } else if (st == stitches.EMPTY) {
    // do nothing
  } else {
    console.error(`Stitch operation ${st} not supported`);
  }
}

function populateGrid(pattern, DS) {
  for (let n = 0; n < pattern.height; n++) {
    const j = n;

    if (pattern.carriagePasses[n] == "right") {
      // left to right
      for (let m = 0; m < pattern.width; m++) {
        const st = pattern.op(m, n); // get current operation
        processStitch(st, 2 * m, 2 * m + 1, j, DS);
      }
    } else if (pattern.carriagePasses[n] == "left") {
      // right to left
      for (let m = pattern.width - 1; m > -1; m--) {
        const st = pattern.op(m, n);
        processStitch(st, 2 * m + 1, 2 * m, j, DS);
      }
    }
  }
}

export function populateDS(pattern, populateFirstRow = true) {
  let width = 2 * pattern.width;
  let height = pattern.height + 1;

  let grid = Array.from({ length: width * height }, () => [
    null, // ST, stitch type
    cnStates.ECN, // AV, Actualization value
    [null, null], // MV, Movement vector
    [], // CNL, CN List
    [], // YP, Yarn path index list
    [], // CNO, the order of all CNs at this location
  ]);

  if (populateFirstRow) {
    for (let i = 0; i < 2 * pattern.width; i++) {
      if (
        pattern.op(Math.floor(i / 2), 0) == stitches.KNIT ||
        pattern.op(Math.floor(i / 2), 0) == stitches.PURL
      ) {
        grid[i][1] = cnStates.PCN;
        grid[i][2] = [0, 0];
        grid[i][4] = [-1];
      }
    }
  }

  const DS = {
    width,
    height,
    data: grid,
    get length() {
      return this.data.length;
    },
    CN(i, j) {
      return this.data[j * width + i];
    },
    ST(i, j) {
      return this.CN(i, j)[0];
    },
    AV(i, j) {
      return this.CN(i, j)[1];
    },
    MV(i, j) {
      return this.CN(i, j)[2];
    },
    CNL(i, j) {
      return this.CN(i, j)[3];
    },
    YPI(i, j) {
      return this.CN(i, j)[4];
    },
    CNO(i, j) {
      return this.CN(i, j)[5];
    },
    setST(i, j, st) {
      this.CN(i, j)[0] = st;
    },
    setAV(i, j, av) {
      this.CN(i, j)[1] = av;
    },
    setMV(i, j, mv) {
      this.CN(i, j)[2] = mv;
    },
    setCNL(i, j, cnl) {
      this.CN(i, j)[3] = cnl;
    },
    setYPI(i, j, ypi) {
      this.CN(i, j)[4] = ypi;
    },
    setCNO(i, j, cno) {
      this.CN(i, j)[5] = cno;
    },
  };

  populateGrid(pattern, DS);

  return DS;
}

export function followTheYarn(DS, rowDirections) {
  let i = 0,
    j = 0,
    legNode = true,
    currentStitchRow = 0,
    yarnPathIndex = 0;

  const yarnPath = [];

  while (j < DS.height) {
    if (addToList(i, j, legNode, yarnPath, DS, rowDirections)) {
      const CNL = acnsAt(i, j, DS); // Find the ACNs at this location
      DS.setCNL(i, j, CNL);

      let cnLoc;

      if (legNode) {
        // leg nodes do not move, use the current i,j
        cnLoc = [i, j];

        // Add the current yarn path index to all ACNs at this node.
        for (const [ii, jj] of CNL) {
          DS.YPI(ii, jj).push(yarnPathIndex);
        }
      } else {
        // head nodes might move, find final (i,j) location of the node
        cnLoc = finalLocation(i, j, DS);

        // Add the current yarn path index to the head node
        DS.YPI(i, j).push(yarnPathIndex);
      }

      yarnPath.push([...cnLoc, currentStitchRow]);

      yarnPathIndex++;
    }

    // figure out which CN to process next
    ({ i, j, legNode, currentStitchRow } = nextCN(
      i,
      j,
      legNode,
      currentStitchRow,
      DS,
      rowDirections
    ));
  }
  return yarnPath;
}

function addToList(i, j, legNode, yarnPath, DS, rowDirections) {
  // determines whether to add a contact node to the yarn path
  if (legNode) {
    // if it is a leg node, calculate the number of ACNs at that location

    if (acnsAt(i, j, DS).length > 0) {
      // if there is an anchored CN there, return true
      return true;
    }
    return false;
  } else {
    // head node
    let AV = DS.AV(i, j);

    if (AV == cnStates.ECN) {
      return false;
    } else if (AV == cnStates.UACN) {
      let m, n, row, part;

      const movingRight = rowDirections[j - 1] == "right";
      const evenI = i % 2 == 0;

      if (movingRight != evenI) {
        // if parities are different, we look backward in the yarn path
        [m, n, row, part] = yarnPath.at(-1);
      } else {
        // When the parities are the same, the check looks forward along the yarn
        let found = false;
        let iCurrent = i;
        let jCurrent = j;
        let legNodeCurrent = legNode;
        let rowCurrent = j - 1;

        while (!found) {
          const check = nextCN(
            iCurrent,
            jCurrent,
            legNodeCurrent,
            rowCurrent,
            DS,
            rowDirections
          );

          if (check.i >= DS.width || check.j >= DS.height) {
            console.error(
              `Error! Couldn't find the next CN when checking CN (${i}, ${j})`
            );
            break;
          }

          if (
            addToList(
              check.i,
              check.j,
              check.legNode,
              yarnPath,
              DS,
              rowDirections
            )
          ) {
            found = true;
            [m, n] = finalLocation(check.i, check.j, DS);
          }

          iCurrent = check.i;
          jCurrent = check.j;
          legNodeCurrent = check.legNode;
          rowCurrent = check.currentStitchRow;
        }
      }

      // Determine final location
      const [_, jFinal] = finalLocation(i, j, DS);

      if (n <= jFinal) {
        // if this CN is anchored, update it to ACN
        if (j < DS.height - 1) {
          DS.setAV(i, j, cnStates.ACN);
        }

        return true;
      } else {
        return false;
      }
    } else {
      // it is an ACN or PCN
      return true;
    }
  }
}

function finalLocation(i, j, DS) {
  // determines where ACNs in the CN[i,j] grid end up in the yarn[i,j] grid
  const [di, dj] = DS.MV(i, j);

  if (di == 0 && dj == 0) {
    return [i, j];
  } else if (di != 0) {
    // move horizontally
    return finalLocationRecursive(i + di, j, DS);
  } else {
    // move vertically
    return finalLocationRecursive(i, j + dj, DS);
  }
}

function finalLocationRecursive(i, j, DS) {
  if (i < 0 || i >= DS.width || j < 0 || j >= DS.height) {
    console.warn(`Trying to move outside chart bounds`);
    console.log(i, j);
  }

  const cn = DS.CN(i, j);

  if (cn[0] == stitches.KNIT || cn[0] == stitches.PURL) {
    // CN is actualized with a knit or purl stitch
    return [i, j];
  } else if (cn[2][0] == null && cn[2][1] == null) {
    return [i, j];
  } else if (j == DS.height - 1) {
    // CNs in the last row don't move
    return [i, j];
  } else {
    // Otherwise we need to accumulate vertical movement
    return finalLocationRecursive(i, j + cn[2][1], DS);
  }
}

function acnsAt(i, j, DS) {
  // determines which ACNs are positioned at location (i,j) in the CN grid

  if (i >= DS.width || j >= DS.height) return [];

  const maxHorizontal = 6; // 3 needles * 2 CNs/needle
  const maxVertical = 10; // vertical shift

  let iMin = i - maxHorizontal < 0 ? 0 : i - maxHorizontal;
  let iMax = i + maxHorizontal >= DS.width ? DS.width - 1 : i + maxHorizontal;
  let jMin = j - maxVertical < 0 ? 0 : j - maxVertical;
  let jMax = j;

  const ACNList = [];
  for (let jj = jMin; jj <= jMax; jj++) {
    for (let ii = iMin; ii <= iMax; ii++) {
      let [iFinal, jFinal] = finalLocation(ii, jj, DS);
      if (iFinal == i && jFinal == j && DS.AV(ii, jj) == cnStates.ACN) {
        ACNList.push([ii, jj]);
      }
    }
  }
  return ACNList;
}

function nextCN(i, j, legNode, currentStitchRow, DS, rowDirections) {
  // determines which CN to process next. CNs are processed in a square wave order

  const movingRight = rowDirections[currentStitchRow] == "right";
  const evenI = i % 2 == 0;

  let iNext = i;
  let jNext = j;
  let nextLegNode = legNode;

  if (legNode) {
    if (movingRight) {
      if (evenI) {
        // left leg node going right; move up to head node
        jNext = j + 1;
        nextLegNode = false;
      } else {
        // right leg node going right; move right to next leg node
        iNext = i + 1;
      }
    } else {
      // moving Left
      if (evenI) {
        // left leg node going left; move left to next leg node
        iNext = i - 1;
      } else {
        // right leg node going left; move up to head node
        jNext = j + 1;
        nextLegNode = false;
      }
    }
  } else {
    // looking at a head node
    if (movingRight) {
      if (evenI) {
        // left head node going right; move right to next head node
        iNext = i + 1;
      } else {
        // right head node going right; move down to leg node
        jNext = j - 1;
        nextLegNode = true;
      }
    } else {
      // moving Left
      if (evenI) {
        // left head node going left; move down to left node
        jNext = j - 1;
        nextLegNode = true;
      } else {
        // right head node going left; move left to next head node
        iNext = i - 1;
      }
    }
  }

  if (iNext < 0 || iNext >= DS.width) {
    // if the next i would be over the pattern edge move up one row:
    const nextRowIsRight = rowDirections[currentStitchRow + 1] == "right";
    return {
      i: nextRowIsRight ? 0 : DS.width - 1, // original i
      j: currentStitchRow + 1, // original j+1
      legNode: true, // will be leg node
      currentStitchRow: currentStitchRow + 1, // next stitch row
    };
  }

  return {
    i: iNext,
    j: jNext,
    legNode: nextLegNode,
    currentStitchRow: currentStitchRow,
  };
}

function determineRule(rowJ, pattern) {
  let rule = [];
  let currentRow = Array.from(
    pattern.ops.slice((rowJ - 1) * pattern.width, rowJ * pattern.width)
  );

  const frontTransfers = [
    stitches.FXL1,
    stitches.FXL2,
    stitches.FXL3,
    stitches.FXR1,
    stitches.FXR2,
    stitches.FXR3,
  ];

  const backTransfers = [
    stitches.BXL1,
    stitches.BXL2,
    stitches.BXL3,
    stitches.BXR1,
    stitches.BXR2,
    stitches.BXR3,
  ];

  if (currentRow.some((r) => frontTransfers.includes(r))) {
    // if front transfers in current row
    rule = [
      stitches.KNIT,
      stitches.FXL1,
      stitches.BXL1,
      stitches.FXR1,
      stitches.BXR1,
      stitches.FXL2,
      stitches.BXL2,
      stitches.FXR2,
      stitches.BXR2,
      stitches.FXL3,
      stitches.BXL3,
      stitches.FXR3,
      stitches.BXR3,
      stitches.PURL,
    ];
  } else if (currentRow.some((r) => backTransfers.includes(r))) {
    // else if back transfers in current row
    rule = [
      stitches.KNIT,
      stitches.BXL3,
      stitches.BXR3,
      stitches.BXL2,
      stitches.BXR2,
      stitches.BXL1,
      stitches.BXR1,
      stitches.PURL,
    ];
  } else {
    rule = [stitches.KNIT, stitches.PURL];
  }

  if (currentRow.includes(stitches.FT)) {
    // Front tuck has highest precedence
    rule.splice(0, 0, stitches.FT);
  }

  if (currentRow.includes(stitches.BT)) {
    // Back tuck has lowest precedence
    rule.push(stitches.BT);
  }
  return rule;
}

function cnsAt(i, j, DS) {
  // determines which CNS are positioned at location (i,j) in the CN grid
  if (i >= DS.width || j >= DS.height) return [];

  let iMin = i - MAX_H_SHIFT < 0 ? 0 : i - MAX_H_SHIFT;
  let iMax = i + MAX_H_SHIFT >= DS.width ? DS.width - 1 : i + MAX_H_SHIFT;
  let jMin = j - MAX_V_SHIFT < 0 ? 0 : j - MAX_V_SHIFT;
  let jMax = j;

  const cnList = [];
  for (let jj = jMin; jj <= jMax; jj++) {
    for (let ii = iMin; ii <= iMax; ii++) {
      let [iFinal, jFinal] = finalLocation(ii, jj, DS);
      if (iFinal == i && jFinal == j) {
        cnList.push([ii, jj]);
      }
    }
  }
  return cnList;
}

export function orderCNs(DS, pattern) {
  for (let jj = 0; jj < DS.height; jj++) {
    for (let ii = 0; ii < DS.width; ii++) {
      DS.setCNO(ii, jj, cnOrderAt(ii, jj, pattern, DS));
    }
  }
}

export function cnOrderAt(i, j, pattern, DS) {
  let orderedCNs = [];
  let CNList = cnsAt(i, j, DS);
  if (CNList.length == 0) {
    // console.debug(`No CNs at location ${i}, ${j}`);
    return orderedCNs;
  }
  // console.log("-------------------------------------------------------");

  let pairs = cnStitchPairs(CNList, pattern); // Get the stitches that create each CN at location (i,j)
  pairs.toSorted((a, b) => a[1] - b[1]); // sort pairs by J
  return yarnOrderRecursive(pairs, pattern, orderedCNs);
}

function yarnOrderRecursive(sortedCNStitchPairs, pattern, orderedCNs) {
  if (sortedCNStitchPairs.length != 0) {
    let currentRow = [];
    let smallestJ = sortedCNStitchPairs[0][1];
    let rule = determineRule(smallestJ, pattern);
    // console.log("sorted cn stitch pairs", JSON.stringify(sortedCNStitchPairs));
    // console.log("smallestJ", smallestJ);
    // console.log("RULE", rule);

    let processed = 0;

    for (const [i, j, stitch] of sortedCNStitchPairs) {
      if (j == smallestJ) {
        currentRow.push([i, j, stitch]);
        processed++;
      } else break;
    }

    // console.log("ORDERED CNS BEFORE", JSON.stringify(orderedCNs));

    sortedCNStitchPairs.splice(0, processed); // delete the CN stitch pairs about to be processed
    if (rule.at(-1) == stitches.BT) {
      orderedCNs = orderRowCNs(currentRow, rule).concat(orderedCNs);
    } else {
      orderedCNs = orderedCNs.concat(orderRowCNs(currentRow, rule));
    }
    // console.log("ORDERED CNS AFTer", JSON.stringify(orderedCNs));
    return yarnOrderRecursive(sortedCNStitchPairs, pattern, orderedCNs);
  }

  return orderedCNs;
}

function orderRowCNs(currentRow, rule) {
  let stitchIndexCNPairs = [];
  let orderedCNs = [];

  for (const [i, j, stitch] of currentRow) {
    // console.log(stitch);
    // console.log(i, j, rule.indexOf(stitch));
    stitchIndexCNPairs.push([rule.indexOf(stitch), i, j]);
  }

  // Order by the index of stitches in the precedence rule
  let sortedStitchIndexCNPairs = stitchIndexCNPairs.toSorted(
    (a, b) => a[0] - b[0]
  );

  // console.log("SORTED", JSON.stringify(sortedStitchIndexCNPairs));

  for (const [index, i, j] of sortedStitchIndexCNPairs) {
    orderedCNs.push([i, j]);
  }
  return orderedCNs;
}

function cnStitchPairs(cnList, pattern) {
  let pairs = [];

  for (const [cnI, cnJ] of cnList) {
    let n = cnJ - 1;
    let m;
    if (cnI % 2 == 0) {
      m = cnI / 2;
    } else {
      m = (cnI - 1) / 2;
    }
    pairs.push([cnI, cnJ, pattern.op(m, n)]);
  }

  return pairs;
}
