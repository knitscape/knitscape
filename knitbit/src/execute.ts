import { Bimp } from "@shared/Bimp";
import { Op } from "@shared/opData";
import type { KnittingProgram } from "./simulation/types";

export function runScript(code: string): KnittingProgram {
  // eslint-disable-next-line no-new-func
  const fn = new Function("Bimp", "Op", code);
  const result = fn(Bimp, Op);

  if (!result || typeof result !== "object") {
    throw new Error("Script must return an object");
  }
  if (!(result.ops instanceof Bimp)) {
    throw new Error("result.ops must be a Bimp instance");
  }
  if (!Array.isArray(result.yarnFeeder)) {
    throw new Error("result.yarnFeeder must be an array");
  }
  if (result.direction !== undefined && !Array.isArray(result.direction)) {
    throw new Error("result.direction must be an array (or omitted)");
  }
  if (!Array.isArray(result.palette)) {
    throw new Error("result.palette must be an array of color strings");
  }

  const width = result.ops.width;
  const height = result.ops.height;

  // Default racking to all zeros if not provided
  const racking: number[] = result.racking ?? new Array(height).fill(0);

  const direction: ("left" | "right")[] = result.direction
    ? result.direction
    : inferDirections(result.yarnFeeder, height);

  return {
    width,
    height,
    ops: result.ops,
    yarnFeeder: result.yarnFeeder,
    direction,
    racking,
    palette: result.palette,
  };
}

// Infer a direction array from the yarn-feeder sequence.
//   • Each yarn starts moving "right" on its first row, then flips every
//     subsequent time it's used.
//   • Transfer-only rows (yarnFeeder === null) take the opposite direction
//     of the previous row — or "right" if they're first.
function inferDirections(
  yarnFeeder: (number | null)[],
  height: number
): ("left" | "right")[] {
  const out: ("left" | "right")[] = [];
  const lastDirByYarn = new Map<number, "left" | "right">();
  let prevDir: "left" | "right" | null = null;
  for (let row = 0; row < height; row++) {
    const y = yarnFeeder[row];
    let dir: "left" | "right";
    if (y == null) {
      dir = prevDir === "right" ? "left" : "right";
    } else {
      const last = lastDirByYarn.get(y);
      dir = last === undefined ? "right" : last === "right" ? "left" : "right";
      lastDirByYarn.set(y, dir);
    }
    out.push(dir);
    prevDir = dir;
  }
  return out;
}
