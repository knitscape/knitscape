const ECN = "ECN";
const PCN = "PCN";
const ACN = "ACN";
const UACN = "UACN";

const KNIT = "K";
const PURL = "P";
const TUCK = "T";
const MISS = "M";

class ContactNeighborhood {
  constructor(m, n, populateFirstRow = true) {
    this.width = 2 * m;
    this.height = n + 1;

    // Initialize empty contact neighborhood data structure: 2m x (n+1)
    this.contacts = Array.from({ length: this.width * this.height }, () => [
      null,
      ECN,
      [null, null],
    ]);

    if (populateFirstRow) {
      for (let i = 0; i < this.width; i++) {
        this.setAV(i, 0, PCN);
        this.setMV(i, 0, [0, 0]);
      }
    }
  }

  getST(i, j) {
    return this.neighborhood(i, j)[0];
  }

  setSt(i, j, st) {
    this.neighborhood(i, j)[0] = st;
  }

  getAV(i, j) {
    return this.neighborhood(i, j)[1];
  }

  // AV: Actualization Value
  setAV(i, j, cnType) {
    this.neighborhood(i, j)[1] = cnType;
  }

  getMV(i, j) {
    return this.neighborhood(i, j)[2];
  }

  getDeltaI(i, j) {
    return this.neighborhood(i, j)[2][0];
  }

  getDeltaJ(i, j) {
    return this.neighborhood(i, j)[2][1];
  }

  // MV: Movement vector
  setMV(i, j, mv) {
    this.neighborhood(i, j)[2] = mv;
  }

  setDeltaJ(i, j, deltaJ) {
    this.neighborhood(i, j)[2][1] = deltaJ;
  }

  setDeltaI(i, j, deltaI) {
    this.neighborhood(i, j)[2][0] = deltaI;
  }

  neighborhood(i, j) {
    return this.contacts[j * this.width + i];
  }
}

export class ProcessModel {
  constructor(pattern) {
    this.instructions = pattern;
    this.width = pattern.width; // num cols, M
    this.height = pattern.height; // num rows, N
    this.cn = new ContactNeighborhood(this.width, this.height);
    this.populateContacts();
  }

  handleKPLower(i, j, op) {
    // Set ST
    this.cn.setSt(i, j, op);

    // Leave MV unchanged

    // Figure out how to handle AV
    const AV = this.cn.getAV(i, j);
    const MV = this.cn.getMV(i, j);

    // Actualize PCN with no deltaI
    if (AV == PCN && MV[0] === 0) {
      this.cn.setAV(i, j, ACN);
    }

    if (AV == UACN) {
      // If knitting into UACN, first check the prior row on either side
      if (
        (this.cn.getAV(i + 1, j - 1) == ACN &&
          this.cn.getMV(i + 1, j - 1)[1] == 0) ||
        (this.cn.getAV(i - 1, j - 1) == ACN &&
          this.cn.getMV(i - 1, j - 1)[1] == 0)
      ) {
        // if it holds an ACN that wasn't moved, it is actually anchored. change this row to ACN
        this.cn.setAV(i, j, ACN);
      }

      if (this.cn.getAV(i, j - 1) == PCN) {
        this.cn.setAV(i, j - 1, ACN);
      }
    }
    if (AV == ECN) {
      // Otherwise do not change
    }
  }

  handleKPUpper(i, j) {
    // ST remains null for upper CN

    // Set upper CN MV
    this.cn.setMV(i, j + 1, [0, 0]);

    if (this.cn.getAV(i, j) == ACN) {
      // set to PCN if lower is ACN
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

  handleTuckMissUpper(i, j, op) {
    if (op == TUCK) {
      this.cn.setAV(i, j + 1, UACN);
      this.cn.setMV(i, j + 1, [0, 0]);
    } else if (op == MISS) {
      this.cn.setAV(i, j + 1, ECN);
      this.cn.setMV(i, j + 1, [0, -1]);
    }
  }

  handleTuckMissLower(i, j, op) {
    const AV = this.cn.getAV(i, j);
    if (AV == PCN || AV == UACN) {
      // Set deltaJ to one to indicate that the CN has moved up
      this.cn.setDeltaJ(i, j, 1);
    } else if (AV == ECN) {
      // Special case if we are doing a miss stitch above a miss stitch
      // Look down the column to find where the delta J is positive, and increment it.
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

  handleOp(i, j, op, offset) {
    if (op == KNIT || op == PURL) {
      // lower pair
      this.handleKPLower(i, j, op);
      this.handleKPLower(i + offset, j, op);

      // upper pair
      this.handleKPUpper(i, j, op);
      this.handleKPUpper(i + offset, j, op);
    }

    if (op == TUCK || op == MISS) {
      // lower pair
      this.handleTuckMissLower(i, j, op);
      this.handleTuckMissLower(i + offset, j, op);

      // upper pair
      this.handleTuckMissUpper(i, j, op);
      this.handleTuckMissUpper(i + offset, j, op);
    }
  }

  processRow(n, ltr) {
    if (ltr) {
      // left to right
      for (let m = 0; m < this.width; m++) {
        const op = this.instructions.op(m, n); // get current operation

        this.handleOp(2 * m, n, op, 1);
      }
    } else {
      // right to left
      for (let m = this.width - 1; m >= 0; m--) {
        const op = this.instructions.op(m, n);

        this.handleOp(2 * m + 1, n, op, -1);
      }
    }
  }

  populateContacts() {
    let movingRight = true;
    for (let n = 0; n < this.height; n++) {
      // do something each row
      this.processRow(n, movingRight);
      movingRight = !movingRight;
    }
  }
}
