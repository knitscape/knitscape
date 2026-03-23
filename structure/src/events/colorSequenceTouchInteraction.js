import { GLOBAL_STATE, dispatch } from "../state";
import { colorSequencePosAtCoords } from "../utils";

function brushColor(e, colorCanvas) {
  let pos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
  dispatch({
    yarnSequence: GLOBAL_STATE.yarnSequence.brush(
      { x: pos.x, y: pos.y },
      GLOBAL_STATE.activeYarn
    ),
  });

  function move(e) {
    let newPos = colorSequencePosAtCoords(e.touches[0], colorCanvas);
    if (newPos.x == pos.x && newPos.y == pos.y) return;

    const updated = GLOBAL_STATE.yarnSequence.line(
      { x: pos.x, y: pos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeYarn
    );

    dispatch({ yarnSequence: updated });

    pos = newPos;
  }

  function end() {
    dispatch({ transforming: false });

    colorCanvas.removeEventListener("touchmove", move);
    colorCanvas.removeEventListener("touchcancel", end);
    colorCanvas.removeEventListener("touchend", end);
  }

  colorCanvas.addEventListener("touchmove", move);
  colorCanvas.addEventListener("touchcancel", end);
  colorCanvas.addEventListener("touchend", end);
}

function resizeColorCanvas(e) {
  const startSequence = GLOBAL_STATE.yarnSequence;
  const start = e.touches[0].clientY;

  const end = () => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e) => {
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

  window.addEventListener("touchmove", onmove);
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
}

export function colorSequenceTouchInteraction(canvas, resizeDragger) {
  canvas.addEventListener("touchstart", (e) => {
    dispatch({ transforming: true });

    brushColor(e, canvas);
  });

  resizeDragger.addEventListener("touchstart", (e) => {
    dispatch({ transforming: true });

    resizeColorCanvas(e);
  });
}
