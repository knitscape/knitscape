import { simulate } from "../simulation/yarnSimulation";
import { GLOBAL_STATE, dispatch } from "../state";
import { html } from "lit-html";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";
import { centerZoomSimulation } from "../actions/zoomFit";
import type { GlobalState, ComponentFactory } from "../types";

let stopSim: (() => void) | undefined;
let relax: (() => void) | undefined;
let reset: (() => void) | undefined;
let rescale: ((newScale: number) => void) | undefined;

export function simulationView() {
  return html`<div id="sim-pane">
    <div id="sim-container">
      <div
        style="transform: translate(${GLOBAL_STATE.simPan[0]}px, ${GLOBAL_STATE.simPan[1]}px)"
        class=${GLOBAL_STATE.flipped ? "mirrored" : ""}>
        <canvas
          id="back"
          class=${GLOBAL_STATE.flipped ? "top" : "bottom"}></canvas>
        <canvas id="mid" class="mid"></canvas>
        <canvas
          id="front"
          class=${GLOBAL_STATE.flipped ? "bottom" : "top"}></canvas>
      </div>
    </div>
    <div id="sim-controls" class="panzoom-controls">
      <button @click=${relax} class="btn solid">relax</button>
      <button @click=${reset} class="btn solid">reset</button>
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
        @input=${(e: Event) =>
          centerZoomSimulation(Number((e.target as HTMLInputElement).value))} />
      <button
        class="btn icon"
        @click=${() => centerZoomSimulation(GLOBAL_STATE.simScale * 1.1)}>
        <i class="fa-solid fa-magnifying-glass-plus"></i>
      </button>
      <button
        @click=${() => dispatch({ simPan: [0, 0], simScale: 1 })}
        class="btn icon">
        <i class="fa-solid fa-expand"></i>
      </button>
    </div>
  </div>`;
}

const debounce = (callback: (...args: any[]) => void, wait: number) => {
  let timeoutId: number | null = null;
  return (...args: any[]) => {
    window.clearTimeout(timeoutId!);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

export function runSimulation(): ComponentFactory {
  return () => {
    function run(): void {
      if (stopSim) stopSim();

      ({ stopSim, relax, reset, rescale } = simulate(
        GLOBAL_STATE.chart,
        GLOBAL_STATE.yarnSequence.pixels,
        GLOBAL_STATE.yarnPalette,
        GLOBAL_STATE.simScale
      ));
    }

    const debouncedRun = debounce(run, 30);

    run();

    return {
      syncState(state: GlobalState, changes?: string[]) {
        const found = ["repeats", "yarnPalette", "yarnSequence", "chart"].some(
          (key) => changes!.includes(key)
        );

        if (found) {
          debouncedRun();
        }

        if (changes!.includes("simScale")) {
          rescale!(state.simScale);
        }
      },
    };
  };
}
