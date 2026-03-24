import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";
import { repeatEditingTools } from "../actions/repeatEditingTools";
import type { RepeatToolFn } from "../actions/repeatEditingTools";
import type { Vec2 } from "../types";

function getRepeatIndex(elem: HTMLElement): number | null {
  let el: HTMLElement | null = elem.parentNode as HTMLElement;
  while (el) {
    if (el.hasAttribute && el.hasAttribute("data-repeatindex"))
      return Number((el as HTMLElement).dataset.repeatindex);
    el = el.parentNode as HTMLElement | null;
  }
  return null;
}

function editRepeat(
  repeatIndex: number,
  repeatCanvas: HTMLElement,
  tool: RepeatToolFn
): void {
  let pos = GLOBAL_STATE.repeatPos;
  dispatch({ transforming: true });

  const onMove = tool(repeatIndex, pos);
  if (!onMove) return;

  function move(): void {
    const newPos = GLOBAL_STATE.repeatPos;
    if (newPos[0] == pos[0] && newPos[1] == pos[1]) return;
    onMove!(newPos);
    pos = newPos;
  }

  function end(): void {
    dispatch({ transforming: false });

    repeatCanvas.removeEventListener("touchmove", move);
    repeatCanvas.removeEventListener("touchend", end);
    repeatCanvas.removeEventListener("touchcancel", end);
  }

  repeatCanvas.addEventListener("touchmove", move);
  repeatCanvas.addEventListener("touchend", end);
  repeatCanvas.addEventListener("touchcancel", end);
}

function resizeRepeat(
  e: { clientX: number; clientY: number; target: EventTarget | null },
  repeatIndex: number
): void {
  const startRepeat = GLOBAL_STATE.repeats[repeatIndex];
  const startPos: Vec2 = [e.clientX, e.clientY];
  const resizeDragger = e.target as HTMLElement;
  dispatch({ transforming: true });

  document.body.classList.add("grabbing");
  resizeDragger.classList.remove("grab");

  const end = (): void => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove as EventListener);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e: TouchEvent): void => {
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

    if (newHeight < 1 || newWidth < 1) return;

    const pos: Vec2 = [...startRepeat.pos];
    if (newWidth + startRepeat.pos[0] < 1) pos[0] = -newWidth + 1;
    if (newHeight + startRepeat.pos[1] < 1) pos[1] = -newHeight + 1;

    const area: Vec2 = [
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

  window.addEventListener("touchmove", onmove as EventListener);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

function moveRepeat(
  e: { clientX: number; clientY: number },
  repeatIndex: number
): void {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];

  const startRepeatPos: Vec2 = [...GLOBAL_STATE.repeats[repeatIndex].pos];
  const startPos: Vec2 = [e.clientX, e.clientY];
  console.log(startPos);
  dispatch({ transforming: true });

  const end = (): void => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove as EventListener);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e: TouchEvent): void => {
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
          pos: [newX, newY] as Vec2,
        },
        ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
      ],
    });
  };

  window.addEventListener("touchmove", onmove as EventListener);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

function calcRepeatCoords(
  e: { clientX: number; clientY: number },
  repeatContainer: HTMLElement
): void {
  if (GLOBAL_STATE.editingRepeat < 0) {
    const pos = posAtCoords(e, repeatContainer);

    if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
      dispatch({ pos });
    }
  } else {
    const pos = posAtCoords(e, e as unknown as Element);

    if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
      dispatch({ repeatPos: pos });
    }
  }
}

function editRepeatArea(
  e: { clientX: number; clientY: number },
  repeatIndex: number,
  direction: "x" | "y"
): void {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];
  const startSize = direction == "x" ? repeat.area[0] : repeat.area[1];
  const startPos: Vec2 = [e.clientX, e.clientY];

  dispatch({ transforming: true });
  const end = (): void => {
    dispatch({ transforming: false });

    window.removeEventListener("touchmove", onmove as EventListener);
    window.removeEventListener("touchend", end);
    window.removeEventListener("touchcancel", end);
  };

  const onmove = (e: TouchEvent): void => {
    let newSize: number;
    let updated;
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
        area: [newSize, GLOBAL_STATE.repeats[repeatIndex].area[1]] as Vec2,
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
        area: [GLOBAL_STATE.repeats[repeatIndex].area[0], newSize] as Vec2,
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

  window.addEventListener("touchmove", onmove as EventListener);
  window.addEventListener("touchcancel", end);
  window.addEventListener("touchend", end);
}

export function repeatTouchInteraction(repeatContainer: HTMLElement): void {
  repeatContainer.addEventListener("touchstart", (e: TouchEvent) => {
    calcRepeatCoords(e.touches[0], repeatContainer);

    const repeatIndex = getRepeatIndex(e.target as HTMLElement);
    const classList = (e.target as HTMLElement).classList;

    if (
      GLOBAL_STATE.editingRepeat != repeatIndex &&
      classList.contains("repeat-canvas")
    ) {
      dispatch({ editingRepeat: repeatIndex! });
      return;
    }

    if (classList.contains("resize-repeat")) {
      resizeRepeat(e.touches[0], repeatIndex!);
    } else if (classList.contains("repeat-area-dragger")) {
      if (classList.contains("x-axis")) {
        editRepeatArea(e.touches[0], repeatIndex!, "x");
      } else {
        editRepeatArea(e.touches[0], repeatIndex!, "y");
      }
    } else if (classList.contains("repeat-canvas")) {
      const activeTool = GLOBAL_STATE.activeTool;

      if (activeTool in repeatEditingTools) {
        editRepeat(
          repeatIndex!,
          e.target as HTMLElement,
          repeatEditingTools[activeTool]
        );
      } else if (activeTool == "move") {
        moveRepeat(e.touches[0], repeatIndex!);
      } else {
        console.warn(`Uh oh, ${activeTool} is not a tool`);
      }
    }
  });

  repeatContainer.addEventListener("touchmove", (e: TouchEvent) => {
    calcRepeatCoords(e.touches[0], repeatContainer);
  });
}
