import { GLOBAL_STATE, dispatch } from "../state";
import { colorSequencePosAtCoords } from "../utils";

function brushColor(e: PointerEvent, colorCanvas: HTMLElement): void {
  let pos = colorSequencePosAtCoords(e, colorCanvas);
  dispatch({
    yarnSequence: GLOBAL_STATE.yarnSequence.brush(pos, GLOBAL_STATE.activeYarn),
  });

  function move(e: PointerEvent): void {
    const newPos = colorSequencePosAtCoords(e, colorCanvas);
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
    colorCanvas.removeEventListener("pointermove", move as EventListener);
    colorCanvas.removeEventListener("pointerup", end);
    colorCanvas.removeEventListener("pointerleave", end);
  }

  colorCanvas.addEventListener("pointermove", move as EventListener);
  colorCanvas.addEventListener("pointerup", end);
  colorCanvas.addEventListener("pointerleave", end);
}

function resizeColorCanvas(e: PointerEvent): void {
  const startSequence = GLOBAL_STATE.yarnSequence;
  const start = e.clientY;

  document.body.classList.add("grabbing");
  (e.target as HTMLElement).classList.remove("grab");

  function end(): void {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move as EventListener);
    window.removeEventListener("pointerup", end);

    (e.target as HTMLElement).classList.add("grab");
  }

  function move(e: PointerEvent): void {
    let newSize =
      startSequence.height +
      Math.floor(((start - e.clientY) / GLOBAL_STATE.scale) * devicePixelRatio);

    if (newSize < 1 || newSize == GLOBAL_STATE.yarnSequence.height) return;

    dispatch({
      yarnSequence: startSequence.resize(1, newSize, GLOBAL_STATE.activeYarn),
    });
  }

  window.addEventListener("pointermove", move as EventListener);
  window.addEventListener("pointerup", end);
}

export function colorSequencePointerInteraction(
  colorCanvas: HTMLElement,
  resizeDragger: HTMLElement
): void {
  colorCanvas.addEventListener("pointerdown", (e: PointerEvent) => {
    brushColor(e, colorCanvas);
  });

  resizeDragger.addEventListener("pointerdown", (e: PointerEvent) => {
    resizeColorCanvas(e);
  });
}
