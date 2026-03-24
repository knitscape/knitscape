import { GLOBAL_STATE, dispatch } from "../state";
import { colorSequencePosAtCoords } from "../utils";
import type { Vec2 } from "../types";

function brushColor(e: TouchEvent, colorCanvas: HTMLElement): void {
  let pos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
  dispatch({
    yarnSequence: GLOBAL_STATE.yarnSequence.brush(pos, GLOBAL_STATE.activeYarn),
  });

  function move(e: TouchEvent): void {
    const newPos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
    if (newPos[0] == pos[0] && newPos[1] == pos[1]) return;

    const updated = GLOBAL_STATE.yarnSequence.line(
      pos,
      newPos,
      GLOBAL_STATE.activeYarn
    );

    dispatch({ yarnSequence: updated });

    pos = newPos;
  }

  function end(): void {
    dispatch({ transforming: false });

    colorCanvas.removeEventListener("touchmove", move as EventListener);
    colorCanvas.removeEventListener("touchcancel", end);
    colorCanvas.removeEventListener("touchend", end);
  }

  colorCanvas.addEventListener("touchmove", move as EventListener);
  colorCanvas.addEventListener("touchcancel", end);
  colorCanvas.addEventListener("touchend", end);
}

function resizeColorCanvas(e: TouchEvent): void {
  const startSequence = GLOBAL_STATE.yarnSequence;
  const start = e.touches[0].clientY;

  const end = (): void => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove as EventListener);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e: TouchEvent): void => {
    let newSize =
      startSequence.height +
      Math.floor(
        ((start - e.touches[0].clientY) / GLOBAL_STATE.scale) * devicePixelRatio
      );
    if (newSize < 1 || newSize == startSequence.height) return;

    dispatch({
      yarnSequence: startSequence.resize(1, newSize, GLOBAL_STATE.activeYarn),
    });
  };

  window.addEventListener("touchmove", onmove as EventListener);
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
}

export function colorSequenceTouchInteraction(
  canvas: HTMLElement,
  resizeDragger: HTMLElement
): void {
  canvas.addEventListener("touchstart", (e: TouchEvent) => {
    dispatch({ transforming: true });

    brushColor(e, canvas);
  });

  resizeDragger.addEventListener("touchstart", (e: TouchEvent) => {
    dispatch({ transforming: true });

    resizeColorCanvas(e);
  });
}
