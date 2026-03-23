const KNIT = "K";
const PURL = "P";
const TUCK = "T";
const MISS = "M";

const ECN = "ECN";
const PCN = "PCN";
const ACN = "ACN";
const UACN = "UACN";

function followTheYarn(DS) {
  let i = 0,
    j = 0,
    legNode = true,
    currentStitchRow = 0;
  const yarnPath = [];

  while (j < DS.height) {
    const movingRight = currentStitchRow % 2 == 0;
    const evenI = i % 2 == 0;
    const side = movingRight === evenI ? "F" : "L";

    if (addToList(i, j, legNode, yarnPath, DS)) {
      let location;
      if (legNode) {
        // leg nodes do not move
        location = [i, j, currentStitchRow, side + "L"];
      } else {
        // head nodes might move, find final location
        const final = finalLocation(i, j, DS);

        location = [final.i, final.j, currentStitchRow, side + "H"];
      }

      yarnPath.push(location);
    }

    // figure out which CN to process next
    ({ i, j, legNode, currentStitchRow } = nextCN(
      i,
      j,
      legNode,
      currentStitchRow,
      DS
    ));
  }

  return yarnPath;
}

function addToList(i, j, legNode, yarnPath, DS) {
  // determines whether to add a contact node to the yarn path

  if (legNode) {
    // if it is a leg node
    return DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL;
  } else {
    // head node
    let AV = DS.getAV(i, j);

    if (AV == ECN) {
      return false;
    } else if (AV == UACN) {
      let m, n, row, part;
      if (i % 2 != j % 2) {
        // if parities are different, we look backward in the yarn path
        [m, n, row, part] = yarnPath.at(-1);
      } else {
        // When the parities are the same, the check looks forward along the yarn
        const check = nextCN(i, j, legNode, j - 1, DS);
        m = check.i;
        n = check.j;
      }
      // Determine final location
      const final = finalLocation(i, j, DS);

      if (n < final.j) {
        // if this CN is anchored
        DS.setAV(i, j, ACN); // update CN state
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
  const [di, dj] = DS.getMV(i, j);

  if (j == DS.height - 1) {
    return { i, j };
  } else if (di != 0) {
    // move horizontally
    return finalLocationRecursive(i + di, j, DS);
  } else {
    // move vertically
    return finalLocationRecursive(i, j + dj, DS);
  }
}

function finalLocationRecursive(i, j, DS) {
  // console.log(DS.getST(i, j));
  if (DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL) {
    // CN is actualized with a knit or purl stitch
    return { i, j };
  } else if (j == DS.height - 1) {
    // if we hit the top, return? Is this right?
    return { i, j };
  } else {
    // console.log(j + DS.getDeltaJ(i, j));
    // Otherwise we need to accumulate vertical movement
    return finalLocationRecursive(i, j + DS.getDeltaJ(i, j), DS);
  }
}

// function acnsAt(i, J, DS) {
// determines which ACNs are positioned at location (i,j) in the CN grid
// const ACNList = [];
// for all in 13*4
// check mv
// }

function nextCN(i, j, legNode, currentStitchRow, DS) {
  // determines which CN to process next. CNs are processed in a square wave order
  // and reverse direction each row (as a knitting carriage does)
  const movingRight = currentStitchRow % 2 == 0;
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
    return {
      i: i, // original i
      j: j + 1, // original j+1
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

function calcLayer(nodes, source, target, linkType) {
  if (nodes[source].st == "K" && nodes[target].st == "K") {
    if (linkType == "LHLL" || linkType == "FLFH") return "front";
    else return "back";
  } else if (nodes[source].st == "P" && nodes[target].st == "P") {
    if (linkType == "LHLL" || linkType == "FLFH") return "back";
    else return "front";
  } else return "mid";
}

export class YarnModel {
  // ok. start by making a grid of nodes. these are all of the contact neighborhoods.
  constructor(cns) {
    this.width = cns.width;
    this.height = cns.height;
    this.cns = cns;

    this.contactNodes = cns.contacts.map((cn, i) => {
      return {
        index: i,
        st: cn[0],
        cn: cn[1],
        mv: cn[2],
      };
    });

    this.yarnPath = followTheYarn(cns);
  }

  // There are four kinds of yarn CNS:
  // first head
  // last head
  // first leg
  //  last leg
  // they're NOT left and right - they depend on the direction the yarn is going

  yarnPathToLinks() {
    let source = 0;
    let last = this.yarnPath[0][3];
    const links = [];

    this.yarnPath.forEach(([i, j, stitchRow, headOrLeg], index) => {
      if (index == 0) return;
      let target = j * this.width + i;
      let linkType = last + headOrLeg;
      links.push({
        source: source,
        target: target,
        linkType,
        row: stitchRow,
        index: index - 1,
        layer: calcLayer(this.contactNodes, source, target, linkType),
      });
      source = target;
      last = headOrLeg;
    });

    return links;
  }

  makeNice() {
    return this.yarnPath.map(([i, j, stitchRow, headOrLeg]) => {
      // [flat CN index, stitchrow, headOrLeg, angle]
      return {
        cnIndex: j * this.width + i,
        i: i,
        j: j,
        row: stitchRow,
        cnType: headOrLeg,
        angle: null,
        normal: [0, 0],
      };
    });
  }
}
