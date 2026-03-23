import { GLOBAL_STATE } from "../state";
import { simulate } from "../simulation/topDownYarnSimulation";
import { Pattern } from "../simulation/Pattern";

function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

function r() {
  if (GLOBAL_STATE.simDraw) GLOBAL_STATE.simDraw();
  requestAnimationFrame(r);
}

export function drawYarns() {
  if (GLOBAL_STATE.showTimeNeedleView) return;
  if (GLOBAL_STATE.stopSim) GLOBAL_STATE.stopSim();

  let { stopSim, relax, draw } = simulate(
    new Pattern(
      GLOBAL_STATE.machineChart,
      GLOBAL_STATE.yarnSequence,
      GLOBAL_STATE.rowMap
    ),
    GLOBAL_STATE.simScale
  );

  GLOBAL_STATE.relax = relax;
  GLOBAL_STATE.simStop = stopSim;
  GLOBAL_STATE.simDraw = draw;
}

export function runSimulation() {
  return () => {
    const debouncedRun = debounce(drawYarns, 30);

    drawYarns();
    r();

    return {
      syncState(state, changes) {
        if (!state.simLive) return;
        const found = [
          "yarnPalette",
          "yarnSequence",
          "machineChart",
          "showTimeNeedleView",
        ].some((key) => changes.includes(key));

        if (found) {
          debouncedRun();
        }

        if (changes.includes("simScale")) {
          drawYarns();
        }
      },
    };
  };
}
