import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";

import { repeatEditingTools } from "../actions/repeatEditingTools";

function getRepeatIndex(elem) {
  elem = elem.parentNode;
  while (elem) {
    if (elem.hasAttribute("data-repeatindex"))
      return Number(elem.dataset.repeatindex);
    elem = elem.parentNode;
  }
  return null;
}

function editRepeat(repeatIndex, repeatCanvas, tool) {
  // tool onMove is not called unless pointer moves into another cell in the chart
  let pos = GLOBAL_STATE.repeatPos;
  dispatch({ transforming: true });

  let onMove = tool(repeatIndex, pos);
  if (!onMove) return;

  function move() {
    let newPos = GLOBAL_STATE.repeatPos;
    if (newPos.x == pos.x && newPos.y == pos.y) return;
    onMove(newPos);
    pos = newPos;
  }

  function end() {
    dispatch({ transforming: false });

    repeatCanvas.removeEventListener("touchmove", move);
    repeatCanvas.removeEventListener("touchend", end);
    repeatCanvas.removeEventListener("touchcancel", end);
  }

  repeatCanvas.addEventListener("touchmove", move);
  repeatCanvas.addEventListener("touchend", end);
  repeatCanvas.addEventListener("touchcancel", end);
}

function resizeRepeat(e, repeatIndex) {
  const startRepeat = GLOBAL_STATE.repeats[repeatIndex];
  const startPos = [e.clientX, e.clientY];
  const resizeDragger = e.target;
  dispatch({ transforming: true });

  document.body.classList.add("grabbing");
  resizeDragger.classList.remove("grab");

  const end = () => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e) => {
    let newWidth =
      startRepeat.bitmap.width -
      Math.floor(
        (startPos[0] - e.touches[0].clientX) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    let newHeight =
      startRepeat.bitmap.height +
      Math.floor(
        (startPos[1] - e.touches[0].clientY) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    if (newHeight == startRepeat.height && newWidth == startRepeat.width)
      return;

    if (newHeight < 1 || newWidth < 1) return;

    let pos = [...startRepeat.pos];
    if (newWidth + startRepeat.pos[0] < 1) pos[0] = -newWidth + 1;
    if (newHeight + startRepeat.pos[1] < 1) pos[1] = -newHeight + 1;

    let area = [
      newWidth > startRepeat.area[0] ? newWidth : startRepeat.area[0],
      newHeight > startRepeat.area[1] ? newHeight : startRepeat.area[1],
    ];

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
        {
          ...GLOBAL_STATE.repeats[repeatIndex],
          bitmap: startRepeat.bitmap
            .vFlip()
            .resize(newWidth, newHeight)
            .vFlip(),
          pos,
          area,
        },
        ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
      ],
    });
  };

  window.addEventListener("touchmove", onmove);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

function moveRepeat(e, repeatIndex) {
  let repeat = GLOBAL_STATE.repeats[repeatIndex];

  const startRepeatPos = [...GLOBAL_STATE.repeats[repeatIndex].pos];
  const startPos = [e.clientX, e.clientY];
  console.log(startPos);
  dispatch({ transforming: true });

  const end = () => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e) => {
    let newX =
      startRepeatPos[0] -
      Math.floor(
        (startPos[0] - e.touches[0].clientX) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    let newY =
      startRepeatPos[1] +
      Math.floor(
        (startPos[1] - e.touches[0].clientY) /
          (GLOBAL_STATE.scale / devicePixelRatio)
      );

    newX =
      newX < -(repeat.bitmap.width - 1) ? -(repeat.bitmap.width - 1) : newX;
    newY =
      newY < -(repeat.bitmap.height - 1) ? -(repeat.bitmap.height - 1) : newY;

    newX =
      newX > GLOBAL_STATE.chart.width - 1 ? GLOBAL_STATE.chart.width - 1 : newX;
    newY =
      newY > GLOBAL_STATE.chart.height - 1
        ? GLOBAL_STATE.chart.height - 1
        : newY;

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
        {
          ...repeat,
          pos: [newX, newY],
        },
        ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
      ],
    });
  };

  window.addEventListener("touchmove", onmove);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

function calcRepeatCoords(e, repeatContainer) {
  if (GLOBAL_STATE.editingRepeat < 0) {
    const { x, y } = posAtCoords(e, repeatContainer);

    if (GLOBAL_STATE.pos.x != x || GLOBAL_STATE.pos.y != y) {
      dispatch({ pos: { x, y } });
    }
  } else {
    const { x, y } = posAtCoords(e, e.target);

    if (GLOBAL_STATE.pos.x != x || GLOBAL_STATE.pos.y != y) {
      dispatch({ repeatPos: { x, y } });
    }
  }
}

function editRepeatArea(e, repeatIndex, direction) {
  let repeat = GLOBAL_STATE.repeats[repeatIndex];
  const startSize = direction == "x" ? repeat.area[0] : repeat.area[1];
  const startPos = [e.clientX, e.clientY];

  dispatch({ transforming: true });
  const end = () => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e) => {
    let newSize, updated;
    if (direction == "x") {
      newSize =
        startSize -
        Math.floor(
          (startPos[0] - e.touches[0].clientX) /
            (GLOBAL_STATE.scale / devicePixelRatio)
        );

      newSize = newSize < repeat.bitmap.width ? repeat.bitmap.width : newSize;

      updated = {
        ...GLOBAL_STATE.repeats[repeatIndex],
        area: [newSize, GLOBAL_STATE.repeats[repeatIndex].area[1]],
      };
    } else {
      newSize =
        startSize +
        Math.floor(
          (startPos[1] - e.touches[0].clientY) /
            (GLOBAL_STATE.scale / devicePixelRatio)
        );

      newSize = newSize < repeat.bitmap.height ? repeat.bitmap.height : newSize;
      updated = {
        ...GLOBAL_STATE.repeats[repeatIndex],
        area: [GLOBAL_STATE.repeats[repeatIndex].area[0], newSize],
      };
    }

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
        updated,
        ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
      ],
    });
  };

  window.addEventListener("touchmove", onmove);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

export function repeatTouchInteraction(repeatContainer) {
  repeatContainer.addEventListener("touchstart", (e) => {
    calcRepeatCoords(e.touches[0], repeatContainer);

    const repeatIndex = getRepeatIndex(e.target);
    let classList = e.target.classList;

    if (
      GLOBAL_STATE.editingRepeat != repeatIndex &&
      classList.contains("repeat-canvas")
    ) {
      // If we're not editing this repeat, begin editing it
      dispatch({ editingRepeat: repeatIndex });
      return;
    }

    if (classList.contains("resize-repeat")) {
      // interacting with dragger
      resizeRepeat(e.touches[0], repeatIndex);
    } else if (classList.contains("repeat-area-dragger")) {
      // interacting with dragger
      if (classList.contains("x-axis")) {
        editRepeatArea(e.touches[0], repeatIndex, "x");
      } else {
        editRepeatArea(e.touches[0], repeatIndex, "y");
      }
    } else if (classList.contains("repeat-canvas")) {
      // interacting with canvas
      const activeTool = GLOBAL_STATE.activeTool;

      if (activeTool in repeatEditingTools) {
        editRepeat(repeatIndex, e.target, repeatEditingTools[activeTool]);
      } else if (activeTool == "move") {
        moveRepeat(e.touches[0], repeatIndex);
      } else {
        console.console.warn(`Uh oh, ${activeTool} is not a tool`);
      }
    }
  });

  repeatContainer.addEventListener("touchmove", (e) => {
    calcRepeatCoords(e.touches[0], repeatContainer);
  });
}
