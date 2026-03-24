import { GLOBAL_STATE, dispatch } from "../state";
import { zoomSimulationAtPoint } from "../actions/zoomFit";
import type { Vec2 } from "../types";

function pan(e: PointerEvent, sim: HTMLElement): void {
  const startPos: Vec2 = [e.clientX, e.clientY];
  const startPan = GLOBAL_STATE.simPan;

  function move(e: PointerEvent): void {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos[0] - e.clientX;
      const dy = startPos[1] - e.clientY;

      dispatch({ simPan: [startPan[0] - dx, startPan[1] - dy] });
    }
  }

  function end(): void {
    sim.removeEventListener("pointermove", move as EventListener);
    sim.removeEventListener("pointerup", end);
    sim.removeEventListener("pointerleave", end);
  }

  sim.addEventListener("pointermove", move as EventListener);
  sim.addEventListener("pointerup", end);
  sim.addEventListener("pointerleave", end);
}

export function simulationPointerInteraction(simContainer: HTMLElement): void {
  simContainer.addEventListener("wheel", (e: WheelEvent) => {
    let simScale: number;

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
      [(e.clientX - bounds.left) / 2, (e.clientY - bounds.top) / 2],
      simScale
    );
  });

  simContainer.addEventListener("pointerdown", (e: PointerEvent) => {
    dispatch({ editingRepeat: -1 });

    pan(e, simContainer);
  });
}
