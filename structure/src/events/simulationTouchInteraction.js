import { GLOBAL_STATE, dispatch } from "../state";

function pan(e, sim) {
  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = GLOBAL_STATE.simPan;

  function move(e) {
    const dx = startPos.x - e.touches[0].clientX;
    const dy = startPos.y - e.touches[0].clientY;

    dispatch({ simPan: { x: startPan.x - dx, y: startPan.y - dy } });
  }

  function end() {
    sim.removeEventListener("touchmove", move);
    sim.removeEventListener("touchcancel", end);
    sim.removeEventListener("touchend", end);
  }

  sim.addEventListener("touchmove", move);
  sim.addEventListener("touchcancel", end);
  sim.addEventListener("touchend", end);
}

export function simulationTouchInteraction(simContainer) {
  simContainer.addEventListener("touchstart", (e) => {
    pan(e.touches[0], simContainer);
  });
}
