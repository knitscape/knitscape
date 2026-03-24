import { GLOBAL_STATE, dispatch } from "../state";
import type { Vec2 } from "../types";

function pan(e: Touch, sim: HTMLElement): void {
  const startPos: Vec2 = [e.clientX, e.clientY];
  const startPan = GLOBAL_STATE.simPan;

  function move(e: TouchEvent): void {
    const dx = startPos[0] - e.touches[0].clientX;
    const dy = startPos[1] - e.touches[0].clientY;

    dispatch({ simPan: [startPan[0] - dx, startPan[1] - dy] });
  }

  function end(): void {
    sim.removeEventListener("touchmove", move as EventListener);
    sim.removeEventListener("touchcancel", end);
    sim.removeEventListener("touchend", end);
  }

  sim.addEventListener("touchmove", move as EventListener);
  sim.addEventListener("touchcancel", end);
  sim.addEventListener("touchend", end);
}

export function simulationTouchInteraction(simContainer: HTMLElement): void {
  simContainer.addEventListener("touchstart", (e: TouchEvent) => {
    pan(e.touches[0], simContainer);
  });
}
