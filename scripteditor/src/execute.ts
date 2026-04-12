import { Bimp } from "../../shared/Bimp";
import { stitches } from "../../panel/src/constants";

export interface ScriptResult {
  stitches: Bimp;
  yarns: Bimp;
  palette: string[];
}

export function runScript(code: string): ScriptResult {
  // eslint-disable-next-line no-new-func
  const fn = new Function("Bimp", "STITCHES", code);
  const result = fn(Bimp, stitches);

  if (!result || typeof result !== "object") {
    throw new Error("Script must return an object");
  }
  if (!(result.stitches instanceof Bimp)) {
    throw new Error("result.stitches must be a Bimp instance");
  }
  if (!(result.yarns instanceof Bimp)) {
    throw new Error("result.yarns must be a Bimp instance");
  }
  if (
    result.stitches.width !== result.yarns.width ||
    result.stitches.height !== result.yarns.height
  ) {
    throw new Error(
      `stitches and yarns must have the same dimensions (got ${result.stitches.width}x${result.stitches.height} vs ${result.yarns.width}x${result.yarns.height})`
    );
  }
  if (!Array.isArray(result.palette)) {
    throw new Error("result.palette must be an array of color strings");
  }

  return result as ScriptResult;
}

/** Derive a per-row yarn sequence from the yarn chart (dominant non-zero yarn per row). */
export function yarnSequenceFromChart(yarnChart: Bimp): number[] {
  const sequence: number[] = [];
  for (let y = 0; y < yarnChart.height; y++) {
    const counts = new Map<number, number>();
    let maxYarn = 1;
    let maxCount = 0;
    for (let x = 0; x < yarnChart.width; x++) {
      const v = yarnChart.pixel(x, y);
      if (v > 0) {
        const c = (counts.get(v) ?? 0) + 1;
        counts.set(v, c);
        if (c > maxCount) {
          maxCount = c;
          maxYarn = v;
        }
      }
    }
    sequence.push(maxYarn);
  }
  return sequence;
}
