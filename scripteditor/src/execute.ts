import { Bimp } from "@shared/Bimp";
import { stitches } from "@shared/stitches";

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

