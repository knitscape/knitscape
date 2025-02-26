import { simulate } from "../simulation/yarnSimulation";
import { GLOBAL_STATE, dispatch } from "../state";
import { html } from "lit-html";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import { centerZoomSimulation } from "../actions/zoomFit";
let stopSim, relax;

export function simulationView() {
  return html`<div id="sim-pane">
    <div id="sim-container">
      <div class=${GLOBAL_STATE.flipped ? "mirrored" : ""}>
        <canvas
          id="back"
          class=${GLOBAL_STATE.flipped ? "top" : "bottom"}></canvas>
        <canvas id="mid" class="mid"></canvas>
        <canvas
          id="front"
          class=${GLOBAL_STATE.flipped ? "bottom" : "top"}></canvas>
      </div>
    </div>
    <div id="sim-controls" style="z-index: 10" class="panzoom-controls">
      <button @click=${relax} class="btn solid">relax</button>
      <button
        @click=${() => dispatch({ flipped: !GLOBAL_STATE.flipped })}
        class="btn solid">
        flip
      </button>
      <button
        class="btn icon"
        @click=${() => centerZoomSimulation(GLOBAL_STATE.simScale * 0.9)}>
        <i class="fa-solid fa-magnifying-glass-minus"></i>
      </button>
      <input
        type="range"
        min=${MIN_SIM_SCALE}
        max=${MAX_SIM_SCALE}
        step="0.1"
        .value=${String(GLOBAL_STATE.simScale)}
        @input=${(e) => centerZoomSimulation(Number(e.target.value))} />
      <button
        class="btn icon"
        @click=${() => centerZoomSimulation(GLOBAL_STATE.simScale * 1.1)}>
        <i class="fa-solid fa-magnifying-glass-plus"></i>
      </button>
      <button
        @click=${() => dispatch({ simPan: { x: 0, y: 0 }, simScale: 1 })}
        class="btn icon">
        <i class="fa-solid fa-expand"></i>
      </button>
    </div>
  </div>`;
}

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

export function stopSimulation() {
  if (stopSim) stopSim();
}

export function runSimulation() {
  return ({ state }) => {
    let queueSim = false;
    let redraw = null;

    function run() {
      queueSim = false;

      if (stopSim) stopSim();

      ({ stopSim, relax, redraw } = simulate(
        GLOBAL_STATE.chart,
        GLOBAL_STATE.yarnSequence.pixels,
        GLOBAL_STATE.yarnPalette,
        GLOBAL_STATE.simScale,
        GLOBAL_STATE.simPan,
      ));

    }

    const debouncedRun = debounce(run, 30);

    const robs = new ResizeObserver(() => { if (redraw) redraw() })
    robs.observe(window["sim-container"])

    return {
      syncState(state, changes) {
        const found = ["repeats", "yarnPalette", "yarnSequence", "chart"].some(
          (key) => changes.includes(key)
        );

        if (found) {
          debouncedRun();
        }

        if (changes.includes("simScale") || changes.includes("simPan")) {
          redraw(GLOBAL_STATE.simScale, GLOBAL_STATE.simPan);
        }
      },
    };
  };
}
