const KNIT = "K";
const PURL = "P";
const TUCK = "T";
const MISS = "M";

const ECN = "ECN";
const PCN = "PCN";
const ACN = "ACN";
const UACN = "UACN";

interface DS {
  width: number;
  height: number;
  getST(i: number, j: number): string | null;
  getAV(i: number, j: number): string;
  getMV(i: number, j: number): [number, number];
  getDeltaJ(i: number, j: number): number;
  setAV(i: number, j: number, av: string): void;
}

export interface ContactNode {
  index: number;
  st: string | null;
  cn: string;
  mv: [number, number];
  i?: number;
  j?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface YarnPathLink {
  source: number | ContactNode;
  target: number | ContactNode;
  linkType: string;
  row: number;
  index: number;
  layer: string;
}

export interface YarnPathNode {
  cnIndex: number;
  i: number;
  j: number;
  row: number;
  cnType: string;
  angle: number | null;
  normal: [number, number];
}

type YarnPathEntry = [number, number, number, string];

function followTheYarn(DS: DS): YarnPathEntry[] {
  let i = 0,
    j = 0,
    legNode = true,
    currentStitchRow = 0;
  const yarnPath: YarnPathEntry[] = [];

  while (j < DS.height) {
    const movingRight = currentStitchRow % 2 == 0;
    const evenI = i % 2 == 0;
    const side = movingRight === evenI ? "F" : "L";

    if (addToList(i, j, legNode, yarnPath, DS)) {
      let location: YarnPathEntry;
      if (legNode) {
        location = [i, j, currentStitchRow, side + "L"];
      } else {
        const final = finalLocation(i, j, DS);
        location = [final.i, final.j, currentStitchRow, side + "H"];
      }

      yarnPath.push(location);
    }

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

function addToList(
  i: number,
  j: number,
  legNode: boolean,
  yarnPath: YarnPathEntry[],
  DS: DS
): boolean {
  if (legNode) {
    return DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL;
  } else {
    const AV = DS.getAV(i, j);

    if (AV == ECN) {
      return false;
    } else if (AV == UACN) {
      let m: number, n: number;
      if (i % 2 != j % 2) {
        [m, n] = yarnPath.at(-1)!;
      } else {
        const check = nextCN(i, j, legNode, j - 1, DS);
        m = check.i;
        n = check.j;
      }
      const final = finalLocation(i, j, DS);

      if (n < final.j) {
        DS.setAV(i, j, ACN);
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
}

function finalLocation(
  i: number,
  j: number,
  DS: DS
): { i: number; j: number } {
  const [di, dj] = DS.getMV(i, j);

  if (j == DS.height - 1) {
    return { i, j };
  } else if (di != 0) {
    return finalLocationRecursive(i + di, j, DS);
  } else {
    return finalLocationRecursive(i, j + dj, DS);
  }
}

function finalLocationRecursive(
  i: number,
  j: number,
  DS: DS
): { i: number; j: number } {
  if (DS.getST(i, j) == KNIT || DS.getST(i, j) == PURL) {
    return { i, j };
  } else if (j == DS.height - 1) {
    return { i, j };
  } else {
    return finalLocationRecursive(i, j + DS.getDeltaJ(i, j), DS);
  }
}

function nextCN(
  i: number,
  j: number,
  legNode: boolean,
  currentStitchRow: number,
  DS: DS
): { i: number; j: number; legNode: boolean; currentStitchRow: number } {
  const movingRight = currentStitchRow % 2 == 0;
  const evenI = i % 2 == 0;

  let iNext = i;
  let jNext = j;
  let nextLegNode = legNode;

  if (legNode) {
    if (movingRight) {
      if (evenI) {
        jNext = j + 1;
        nextLegNode = false;
      } else {
        iNext = i + 1;
      }
    } else {
      if (evenI) {
        iNext = i - 1;
      } else {
        jNext = j + 1;
        nextLegNode = false;
      }
    }
  } else {
    if (movingRight) {
      if (evenI) {
        iNext = i + 1;
      } else {
        jNext = j - 1;
        nextLegNode = true;
      }
    } else {
      if (evenI) {
        jNext = j - 1;
        nextLegNode = true;
      } else {
        iNext = i - 1;
      }
    }
  }

  if (iNext < 0 || iNext >= DS.width) {
    return {
      i: i,
      j: j + 1,
      legNode: true,
      currentStitchRow: currentStitchRow + 1,
    };
  }

  return {
    i: iNext,
    j: jNext,
    legNode: nextLegNode,
    currentStitchRow: currentStitchRow,
  };
}

function calcLayer(
  nodes: ContactNode[],
  source: number,
  target: number,
  linkType: string
): string {
  if (nodes[source].st == "K" && nodes[target].st == "K") {
    if (linkType == "LHLL" || linkType == "FLFH") return "front";
    else return "back";
  } else if (nodes[source].st == "P" && nodes[target].st == "P") {
    if (linkType == "LHLL" || linkType == "FLFH") return "back";
    else return "front";
  } else return "mid";
}

export class YarnModel {
  width: number;
  height: number;
  cns: DS;
  contactNodes: ContactNode[];
  yarnPath: YarnPathEntry[];

  constructor(cns: DS & { contacts: [string | null, string, [number, number]][] }) {
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

  yarnPathToLinks(): YarnPathLink[] {
    let source = 0;
    let last = this.yarnPath[0][3];
    const links: YarnPathLink[] = [];

    this.yarnPath.forEach(([i, j, stitchRow, headOrLeg], index) => {
      if (index == 0) return;
      const target = j * this.width + i;
      const linkType = last + headOrLeg;
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

  makeNice(): YarnPathNode[] {
    return this.yarnPath.map(([i, j, stitchRow, headOrLeg]) => {
      return {
        cnIndex: j * this.width + i,
        i: i,
        j: j,
        row: stitchRow,
        cnType: headOrLeg,
        angle: null,
        normal: [0, 0] as [number, number],
      };
    });
  }
}
