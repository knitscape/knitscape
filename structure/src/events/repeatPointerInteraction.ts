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

  function move(moveEvent: PointerEvent): void {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      const newPos = GLOBAL_STATE.repeatPos;
      if (newPos[0] == pos[0] && newPos[1] == pos[1]) return;
      onMove!(newPos);
      pos = newPos;
    }
  }

  function end(): void {
    repeatCanvas.removeEventListener("pointermove", move as EventListener);
    repeatCanvas.removeEventListener("pointerup", end);
    repeatCanvas.removeEventListener("pointerleave", end);
  }

  repeatCanvas.addEventListener("pointermove", move as EventListener);
  repeatCanvas.addEventListener("pointerup", end);
  repeatCanvas.addEventListener("pointerleave", end);
}

function resizeRepeat(e: PointerEvent): void {
  const startBitmap = GLOBAL_STATE.repeats[0].bitmap;
  const startPos: Vec2 = [e.clientX, e.clientY];
  const resizeDragger = e.target as HTMLElement;

  document.body.classList.add("grabbing");
  resizeDragger.classList.remove("grab");

  const end = (): void => {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", onmove as EventListener);
    window.removeEventListener("pointerup", end);

    resizeDragger.classList.add("grab");
  };

  const onmove = (e: PointerEvent): void => {
    const newWidth =
      startBitmap.width -
      Math.floor(
        (startPos[0] - e.clientX) / (GLOBAL_STATE.scale / devicePixelRatio)
      );

    const newHeight =
      startBitmap.height +
      Math.floor(
        (startPos[1] - e.clientY) / (GLOBAL_STATE.scale / devicePixelRatio)
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

  window.addEventListener("pointermove", onmove as EventListener);
  window.addEventListener("pointerup", end);
}

export function repeatPointerInteraction(repeatContainer: HTMLElement): void {
  repeatContainer.addEventListener("pointerdown", (e: PointerEvent) => {
    const classList = (e.target as HTMLElement).classList;

    if (classList.contains("resize-repeat")) {
      resizeRepeat(e);
    } else if (classList.contains("repeat-canvas")) {
      const activeTool = GLOBAL_STATE.activeTool;

      if (activeTool in repeatEditingTools) {
        editRepeat(
          e.target as HTMLElement,
          repeatEditingTools[activeTool]
        );
      }
    }
  });

  repeatContainer.addEventListener("pointermove", (e: PointerEvent) => {
    if ((e.target as HTMLElement).classList.contains("repeat-canvas")) {
      const pos = posAtCoords(e, e.target as Element) as Vec2;
      if (GLOBAL_STATE.repeatPos[0] != pos[0] || GLOBAL_STATE.repeatPos[1] != pos[1]) {
        dispatch({ repeatPos: pos });
      }
    }
  });
}
