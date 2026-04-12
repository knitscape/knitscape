import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import type { RepeatToolFn } from "../actions/repeatEditingTools";
import type { Vec2 } from "../types";

function editRepeat(
  repeatCanvas: HTMLElement,
  tool: RepeatToolFn
): void {
  let pos = GLOBAL_STATE.repeatPos;
  const onMove = tool(0, pos);
  if (!onMove) return;

  function move(): void {
    const newPos = GLOBAL_STATE.repeatPos;
    if (newPos[0] == pos[0] && newPos[1] == pos[1]) return;
    onMove!(newPos);
    pos = newPos;
  }

  function end(): void {
    repeatCanvas.removeEventListener("touchmove", move);
    repeatCanvas.removeEventListener("touchend", end);
    repeatCanvas.removeEventListener("touchcancel", end);
  }

  repeatCanvas.addEventListener("touchmove", move);
  repeatCanvas.addEventListener("touchend", end);
  repeatCanvas.addEventListener("touchcancel", end);
}

function resizeRepeat(e: { clientX: number; clientY: number; target: EventTarget | null }): void {
  const startBitmap = GLOBAL_STATE.repeats[0].bitmap;
  const startPos: Vec2 = [e.clientX, e.clientY];
  const resizeDragger = e.target as HTMLElement;

  document.body.classList.add("grabbing");
  resizeDragger.classList.remove("grab");

  const end = (): void => {
    document.body.classList.remove("grabbing");

    window.removeEventListener("touchmove", onmove as EventListener);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e: TouchEvent): void => {
    const newWidth =
      startBitmap.width -
      Math.floor(
        (startPos[0] - e.touches[0].clientX) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    const newHeight =
      startBitmap.height +
      Math.floor(
        (startPos[1] - e.touches[0].clientY) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    if (newHeight < 1 || newWidth < 1) return;

    dispatch({
      repeats: [
        {
          bitmap: startBitmap.vFlip().resize(newWidth, newHeight).vFlip(),
        },
      ],
    });
  };

  window.addEventListener("touchmove", onmove as EventListener);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

export function repeatTouchInteraction(repeatContainer: HTMLElement): void {
  repeatContainer.addEventListener("touchstart", (e: TouchEvent) => {
    const classList = (e.target as HTMLElement).classList;

    if (classList.contains("resize-repeat")) {
      resizeRepeat(e.touches[0]);
    } else if (classList.contains("repeat-canvas")) {
      const touch = e.touches[0];
      const pos = posAtCoords(touch, e.target as Element) as Vec2;
      dispatch({ repeatPos: pos });

      const activeTool = GLOBAL_STATE.activeTool;
      if (activeTool in repeatEditingTools) {
        editRepeat(
          e.target as HTMLElement,
          repeatEditingTools[activeTool]
        );
      }
    }
  });

  repeatContainer.addEventListener("touchmove", (e: TouchEvent) => {
    if ((e.target as HTMLElement).classList.contains("repeat-canvas")) {
      const pos = posAtCoords(e.touches[0], e.target as Element) as Vec2;
      if (GLOBAL_STATE.repeatPos[0] != pos[0] || GLOBAL_STATE.repeatPos[1] != pos[1]) {
        dispatch({ repeatPos: pos });
      }
    }
  });
}
