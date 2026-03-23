import { GLOBAL_STATE, dispatch } from "../state";
import { MIN_SIM_SCALE, MAX_SIM_SCALE } from "../constants";

export function centerZoomSimulation(scale) {
  let bbox = document.getElementById("sim-container").getBoundingClientRect();

  zoomSimulationAtPoint({ x: bbox.width / 2, y: bbox.height / 2 }, scale);
}

export function zoomSimulationAtPoint(pt, simScale) {
  if (simScale < MIN_SIM_SCALE || simScale > MAX_SIM_SCALE) return;

  const start = {
    x: (pt.x - GLOBAL_STATE.simPan.x) / GLOBAL_STATE.simScale,
    y: (pt.y - GLOBAL_STATE.simPan.y) / GLOBAL_STATE.simScale,
  };

  dispatch({
    simScale,
    simPan: {
      x: pt.x - start.x * simScale,
      y: pt.y - start.y * simScale,
    },
  });
}

export function simPan(e) {
  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = GLOBAL_STATE.simPan;

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos.x - e.clientX;
      const dy = startPos.y - e.clientY;

      dispatch({ simPan: { x: startPan.x - dx, y: startPan.y - dy } });
    }
  }

  function end() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function simZoom(e) {
  let simScale;

  const bounds = e.currentTarget.getBoundingClientRect();

  if (Math.sign(e.deltaY) < 0) {
    simScale = GLOBAL_STATE.reverseScroll
      ? GLOBAL_STATE.simScale * 0.9
      : GLOBAL_STATE.simScale * 1.1;
  } else {
    simScale = GLOBAL_STATE.reverseScroll
      ? GLOBAL_STATE.simScale * 1.1
      : GLOBAL_STATE.simScale * 0.9;
  }

  zoomSimulationAtPoint(
    {
      x: (e.clientX - bounds.left) / 2,
      y: (e.clientY - bounds.top) / 2,
    },
    simScale
  );
}
