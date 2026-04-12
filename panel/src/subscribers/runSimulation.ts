import { GLOBAL_STATE } from "../state";
import { simulate } from "../simulation/topDownYarnSimulation";
import { Pattern } from "../simulation/Pattern";
import type { GlobalState, StateObserver } from "../types";

let simDraw: (() => void) | undefined;
let simStop: (() => void) | undefined;
export let relax: (() => void) | undefined;

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
  requestAnimationFrame(r);
}

export function drawYarns() {
  if (GLOBAL_STATE.showTimeNeedleView) return;
  if (simStop) simStop();

  if (!GLOBAL_STATE.machineChart || !GLOBAL_STATE.rowMap) return;

  const result = simulate(
    new Pattern(
      GLOBAL_STATE.machineChart,
      GLOBAL_STATE.yarnSequence,
      GLOBAL_STATE.rowMap
    )
  );

  relax = result.relax;
  simStop = result.stopSim;
  simDraw = result.draw;
}

export function runSimulation() {
  return (): StateObserver => {
    const debouncedRun = debounce(drawYarns, 30);

    drawYarns();
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
