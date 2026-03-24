import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";
import { zoomAtPoint } from "../actions/zoomFit";
import type { Vec2 } from "../types";

function pan(e: PointerEvent, target: HTMLElement): void {
  const startPos: Vec2 = [e.clientX, e.clientY];
  const startPan = GLOBAL_STATE.chartPan;

  function move(e: PointerEvent): void {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos[0] - e.clientX;
      const dy = startPos[1] - e.clientY;

      dispatch({ chartPan: [startPan[0] - dx, startPan[1] - dy] });
    }
  }

  function end(): void {
    target.removeEventListener("pointermove", move as EventListener);
    target.removeEventListener("pointerup", end);
    target.removeEventListener("pointerleave", end);
  }

  target.addEventListener("pointermove", move as EventListener);
  target.addEventListener("pointerup", end);
  target.addEventListener("pointerleave", end);
}

export function desktopPointerPanZoom(desktop: HTMLElement): void {
  desktop.addEventListener("pointerdown", (e: PointerEvent) => {
    if (
      e.target == desktop ||
      (e.target as HTMLElement).id == "symbol-canvas"
    ) {
      pan(e, desktop);
    }
  });

  desktop.addEventListener("pointermove", (e: PointerEvent) => {
    const pos = posAtCoords(e, desktop);
    if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
      dispatch({ pos });
    }
  });

  desktop.addEventListener("pointerleave", () => {
    dispatch({ pos: [-1, -1] });
  });

  desktop.addEventListener("wheel", (e: WheelEvent) => {
    const bounds = desktop.getBoundingClientRect();
    let scale: number;

    if (Math.sign(e.deltaY) < 0) {
      scale = GLOBAL_STATE.reverseScroll
        ? GLOBAL_STATE.scale - 1
        : GLOBAL_STATE.scale + 1;
    } else {
      scale = GLOBAL_STATE.reverseScroll
        ? GLOBAL_STATE.scale + 1
        : GLOBAL_STATE.scale - 1;
    }
    zoomAtPoint(
      [e.clientX - bounds.left, e.clientY - bounds.top],
      scale
    );
  });
}
