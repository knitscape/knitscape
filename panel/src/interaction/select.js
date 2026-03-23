import { GLOBAL_STATE, dispatch } from "../state";
import { pointerPosInElement } from "../utilities/misc";

function pointerCell(e) {
  const { cellWidth, cellHeight, bbox } = GLOBAL_STATE;

  let [x, y] = pointerPosInElement(e, document.getElementById("chart-canvas"));

  return [
    Math.floor(x / cellWidth) + bbox.xMin,
    Math.floor(y / cellHeight) + bbox.yMin,
  ];
}

export function selectBox(e) {
  const [startX, startY] = pointerCell(e);
  let [lastX, lastY] = [startX, startY];

  dispatch({ transforming: true });
  document.body.classList.add("crosshair");

  function move(moveEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      const [currX, currY] = pointerCell(moveEvent);

      if (lastX == currX && lastY == currY) return;

      let [x0, x1] = [startX, currX].toSorted((a, b) => a - b);
      let [y0, y1] = [startY, currY].toSorted((a, b) => a - b);

      lastX = currX;
      lastY = currY;

      if (x0 == x1 || y0 == y1) return;

      dispatch({
        stitchSelect: [
          [x0, y0],
          [x1, y1],
        ],
      });
    }
  }

  function end() {
    document.body.classList.remove("crosshair");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}
