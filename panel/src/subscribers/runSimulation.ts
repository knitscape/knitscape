import { GLOBAL_STATE } from "../state";
import { simulate } from "@shared/simulation/simulate";
import type { StitchPatternType } from "@shared/simulation/types";
import type { GlobalState, StateObserver } from "../types";

let simDraw: (() => void) | undefined;
let simStop: (() => void) | undefined;
let simRelax: (() => void) | undefined;
let simIsRelaxing: (() => boolean) | undefined;
export let fitCamera: (() => void) | undefined;
export let topologyMs = 0;
export let simState: "idle" | "relaxing" | "relaxed" = "idle";

function debounce(callback: (...args: unknown[]) => void, wait: number) {
  let timeoutId: number | null = null;
  return (...args: unknown[]) => {
    window.clearTimeout(timeoutId ?? undefined);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

function r() {
  if (simDraw) simDraw();

  if (simState === "relaxing" && simIsRelaxing && !simIsRelaxing()) {
    simState = "relaxed";
  }

  requestAnimationFrame(r);
}

export function relax() {
  if (simRelax) {
    simRelax();
    simState = "relaxing";
  }
}

export function resetSim() {
  drawYarns();
}

export function drawYarns(resetCamera = false) {
  if (GLOBAL_STATE.showTimeNeedleView) return;
  if (simStop) simStop();

  if (!GLOBAL_STATE.machineChart || !GLOBAL_STATE.rowMap) return;

  const bitmap = GLOBAL_STATE.machineChart;
  const yarnSequence = GLOBAL_STATE.yarnSequence;
  const rowMap = GLOBAL_STATE.rowMap;
  const ops = bitmap.pixels;
  const width = bitmap.width;
  const height = bitmap.height;

  const pattern: StitchPatternType = {
    ops,
    width,
    height,
    yarnSequence,
    rowMap,
    yarns: Array.from(yarnSequence.filter((v: number, i: number, arr: number[]) => arr.indexOf(v) === i)),
    carriagePasses: rowMap.map((ogRow: number) => ogRow % 2 == 0 ? "right" : "left"),
    op(x: number, y: number): number {
      if (x > width - 1 || x < 0 || y > height - 1 || y < 0) return -1;
      return (ops as Uint8ClampedArray).at(x + y * width) ?? -1;
    },
  };

  const result = simulate(pattern, {
    canvas: document.getElementById("sim-canvas") as HTMLCanvasElement,
    yarnPalette: GLOBAL_STATE.yarnPalette ?? [],
    cellAspect: GLOBAL_STATE.cellAspect ?? 1,
    resetCamera,
  });

  topologyMs = result.topologyMs;
  simRelax = result.relax;
  simIsRelaxing = result.isRelaxing;
  fitCamera = result.fitCamera;
  simStop = result.stopSim;
  simDraw = result.draw;
  simState = "idle";
}

export function runSimulation() {
  return (): StateObserver => {
    const debouncedRun = debounce(() => drawYarns(), 30);

    drawYarns(true);
    r();

    return {
      syncState(state: GlobalState, changes?: string[]) {
        if (!state.simLive) return;
        const found = [
          "yarnPalette",
          "yarnSequence",
          "machineChart",
          "showTimeNeedleView",
        ].some((key) => changes?.includes(key));

        if (found) {
          debouncedRun();
        }
      },
    };
  };
}
