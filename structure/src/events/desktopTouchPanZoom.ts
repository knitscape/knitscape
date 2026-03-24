import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";
import type { Vec2 } from "../types";

export function desktopTouchPanZoom(desktop: HTMLElement): void {
  function pan(e: TouchEvent, target: HTMLElement): void {
    const startPos: Vec2 = [e.touches[0].clientX, e.touches[0].clientY];
    const startPan = GLOBAL_STATE.chartPan;

    function move(e: TouchEvent): void {
      const dx = startPos[0] - e.touches[0].clientX;
      const dy = startPos[1] - e.touches[0].clientY;

      dispatch({ chartPan: [startPan[0] - dx, startPan[1] - dy] });
    }

    function end(): void {
      target.removeEventListener("touchmove", move as EventListener);
      target.removeEventListener("touchcancel", end);
      target.removeEventListener("touchend", end);
    }

    target.addEventListener("touchmove", move as EventListener);
    target.addEventListener("touchcancel", end);
    target.addEventListener("touchend", end);
  }

  desktop.addEventListener("touchstart", (e: TouchEvent) => {
    const pos = posAtCoords(e.touches[0], desktop);

    if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
      dispatch({ pos });
    }

    if (
      (e.target as HTMLElement).id == "symbol-canvas" ||
      (e.target as HTMLElement).id == "desktop"
    )
      pan(e, desktop);
  });

  desktop.addEventListener("touchmove", (e: TouchEvent) => {
    const pos = posAtCoords(e.touches[0], desktop);
    if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
      dispatch({ pos });
    }
  });

  desktop.addEventListener("touchend", () => {
    dispatch({ pos: [-1, -1] });
  });

  desktop.addEventListener("touchcancel", () => {
    dispatch({ pos: [-1, -1] });
  });
}
