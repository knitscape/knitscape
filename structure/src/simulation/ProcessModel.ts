import type { Pattern } from "./Pattern";

const ECN = "ECN";
const PCN = "PCN";
const ACN = "ACN";
const UACN = "UACN";

const KNIT = "K";
const PURL = "P";
const TUCK = "T";
const MISS = "M";

type ContactEntry = [string | null, string, [number, number]];

class ContactNeighborhood {
  width: number;
  height: number;
  contacts: ContactEntry[];

  constructor(m: number, n: number, populateFirstRow: boolean = true) {
    this.width = 2 * m;
    this.height = n + 1;

    this.contacts = Array.from({ length: this.width * this.height }, (): ContactEntry => [
      null,
      ECN,
      [null as unknown as number, null as unknown as number],
    ]);

    if (populateFirstRow) {
      for (let i = 0; i < this.width; i++) {
        this.setAV(i, 0, PCN);
        this.setMV(i, 0, [0, 0]);
      }
    }
  }

  getST(i: number, j: number): string | null {
    return this.neighborhood(i, j)[0];
  }

  setSt(i: number, j: number, st: string): void {
    this.neighborhood(i, j)[0] = st;
  }

  getAV(i: number, j: number): string {
    return this.neighborhood(i, j)[1];
  }

  setAV(i: number, j: number, cnType: string): void {
    this.neighborhood(i, j)[1] = cnType;
  }

  getMV(i: number, j: number): [number, number] {
    return this.neighborhood(i, j)[2];
  }

  getDeltaI(i: number, j: number): number {
    return this.neighborhood(i, j)[2][0];
  }

  getDeltaJ(i: number, j: number): number {
    return this.neighborhood(i, j)[2][1];
  }

  setMV(i: number, j: number, mv: [number, number]): void {
    this.neighborhood(i, j)[2] = mv;
  }

  setDeltaJ(i: number, j: number, deltaJ: number): void {
    this.neighborhood(i, j)[2][1] = deltaJ;
  }

  setDeltaI(i: number, j: number, deltaI: number): void {
    this.neighborhood(i, j)[2][0] = deltaI;
  }

  neighborhood(i: number, j: number): ContactEntry {
    return this.contacts[j * this.width + i];
  }
}

export class ProcessModel {
  instructions: Pattern;
  width: number;
  height: number;
  cn: ContactNeighborhood;

  constructor(pattern: Pattern) {
    this.instructions = pattern;
    this.width = pattern.width;
    this.height = pattern.height;
    this.cn = new ContactNeighborhood(this.width, this.height);
    this.populateContacts();
  }

  handleKPLower(i: number, j: number, op: string): void {
    this.cn.setSt(i, j, op);

    const AV = this.cn.getAV(i, j);
    const MV = this.cn.getMV(i, j);

    if (AV == PCN && MV[0] === 0) {
      this.cn.setAV(i, j, ACN);
    }

    if (AV == UACN) {
      if (
        (this.cn.getAV(i + 1, j - 1) == ACN &&
          this.cn.getMV(i + 1, j - 1)[1] == 0) ||
        (this.cn.getAV(i - 1, j - 1) == ACN &&
          this.cn.getMV(i - 1, j - 1)[1] == 0)
      ) {
        this.cn.setAV(i, j, ACN);
      }

      if (this.cn.getAV(i, j - 1) == PCN) {
        this.cn.setAV(i, j - 1, ACN);
      }
    }
  }

  handleKPUpper(i: number, j: number): void {
    this.cn.setMV(i, j + 1, [0, 0]);

    if (this.cn.getAV(i, j) == ACN) {
      this.cn.setAV(i, j + 1, PCN);
    } else {
      this.cn.setAV(i, j + 1, UACN);
    }

    if (this.cn.getAV(i, j) == UACN) {
      let found = false;
      let search = 0;
      let iter = 0;

      while (!found) {
        if (j - search < 0) {
          break;
        }
        if (this.cn.getAV(i, j - search) === "PCN") {
          found = true;
          this.cn.setAV(i, j - search, ACN);
        }
        search++;
        iter++;
        if (iter > 1000) {
          console.error("COULDN'T FIND STITCH");
          break;
        }
      }
    }
  }

  handleTuckMissUpper(i: number, j: number, op: string): void {
    if (op == TUCK) {
      this.cn.setAV(i, j + 1, UACN);
      this.cn.setMV(i, j + 1, [0, 0]);
    } else if (op == MISS) {
      this.cn.setAV(i, j + 1, ECN);
      this.cn.setMV(i, j + 1, [0, -1]);
    }
  }

  handleTuckMissLower(i: number, j: number, op: string): void {
    const AV = this.cn.getAV(i, j);
    if (AV == PCN || AV == UACN) {
      this.cn.setDeltaJ(i, j, 1);
    } else if (AV == ECN) {
      let found = false;
      let search = 0;
      let iter = 0;
      while (!found) {
        const deltaJ = this.cn.getMV(i, j - search)[1];
        if (deltaJ > 0) {
          this.cn.setDeltaJ(i, j - search, deltaJ + 1);
          found = true;
        }
        search++;
        iter++;
        if (iter > 1000) {
          console.error("COULDN'T FIND STITCH");
          break;
        }
      }
    }
  }

  handleOp(i: number, j: number, op: string, offset: number): void {
    if (op == KNIT || op == PURL) {
      this.handleKPLower(i, j, op);
      this.handleKPLower(i + offset, j, op);

      this.handleKPUpper(i, j);
      this.handleKPUpper(i + offset, j);
    }

    if (op == TUCK || op == MISS) {
      this.handleTuckMissLower(i, j, op);
      this.handleTuckMissLower(i + offset, j, op);

      this.handleTuckMissUpper(i, j, op);
      this.handleTuckMissUpper(i + offset, j, op);
    }
  }

  processRow(n: number, ltr: boolean): void {
    if (ltr) {
      for (let m = 0; m < this.width; m++) {
        const op = this.instructions.op(m, n) as string;
        this.handleOp(2 * m, n, op, 1);
      }
    } else {
      for (let m = this.width - 1; m >= 0; m--) {
        const op = this.instructions.op(m, n) as string;
        this.handleOp(2 * m + 1, n, op, -1);
      }
    }
  }

  populateContacts(): void {
    let movingRight = true;
    for (let n = 0; n < this.height; n++) {
      this.processRow(n, movingRight);
      movingRight = !movingRight;
    }
  }
}
