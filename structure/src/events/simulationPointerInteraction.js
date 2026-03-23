import { GLOBAL_STATE, dispatch } from "../state";
import { zoomSimulationAtPoint } from "../actions/zoomFit";

function pan(e, sim) {
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
    sim.removeEventListener("pointermove", move);
    sim.removeEventListener("pointerup", end);
    sim.removeEventListener("pointerleave", end);
  }

  sim.addEventListener("pointermove", move);
  sim.addEventListener("pointerup", end);
  sim.addEventListener("pointerleave", end);
}

export function simulationPointerInteraction(simContainer) {
  simContainer.addEventListener("wheel", (e) => {
    let simScale;

    const bounds = simContainer.getBoundingClientRect();

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
  });

  simContainer.addEventListener("pointerdown", (e) => {
    dispatch({ editingRepeat: -1 });

    pan(e, simContainer);
  });
}
