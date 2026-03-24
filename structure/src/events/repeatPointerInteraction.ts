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
    dispatch({ transforming: false });

    repeatCanvas.removeEventListener("pointermove", move as EventListener);
    repeatCanvas.removeEventListener("pointerup", end);
    repeatCanvas.removeEventListener("pointerleave", end);
  }

  repeatCanvas.addEventListener("pointermove", move as EventListener);
  repeatCanvas.addEventListener("pointerup", end);
  repeatCanvas.addEventListener("pointerleave", end);
}

function resizeRepeat(e: PointerEvent, repeatIndex: number): void {
  const startRepeat = GLOBAL_STATE.repeats[repeatIndex];
  const startPos: Vec2 = [e.clientX, e.clientY];
  const resizeDragger = e.target as HTMLElement;
  dispatch({ transforming: true });

  document.body.classList.add("grabbing");
  resizeDragger.classList.remove("grab");

  const end = (): void => {
    dispatch({ transforming: false });

    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", onmove as EventListener);
    window.removeEventListener("pointerup", end);

    resizeDragger.classList.add("grab");
  };

  const onmove = (e: PointerEvent): void => {
    let newWidth =
      startRepeat.bitmap.width -
      Math.floor(
        (startPos[0] - e.clientX) / (GLOBAL_STATE.scale / devicePixelRatio)
      );

    let newHeight =
      startRepeat.bitmap.height +
      Math.floor(
        (startPos[1] - e.clientY) / (GLOBAL_STATE.scale / devicePixelRatio)
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

  window.addEventListener("pointermove", onmove as EventListener);
  window.addEventListener("pointerup", end);
}

export function moveRepeat(e: PointerEvent, repeatIndex: number): void {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];

  const startRepeatPos: Vec2 = [...repeat.pos];
  const startPos: Vec2 = [e.clientX, e.clientY];
  dispatch({ transforming: true });

  const end = (): void => {
    dispatch({ transforming: false });

    window.removeEventListener("pointermove", onmove as EventListener);
    window.removeEventListener("pointerup", end);
  };

  const onmove = (e: PointerEvent): void => {
    let newX =
      startRepeatPos[0] -
      Math.floor(
        (startPos[0] - e.clientX) / (GLOBAL_STATE.scale / devicePixelRatio)
      );

    let newY =
      startRepeatPos[1] +
      Math.floor(
        (startPos[1] - e.clientY) / (GLOBAL_STATE.scale / devicePixelRatio)
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

  window.addEventListener("pointermove", onmove as EventListener);
  window.addEventListener("pointerup", end);
}

function editRepeatArea(
  e: PointerEvent,
  repeatIndex: number,
  direction: "x" | "y"
): void {
  const repeat = GLOBAL_STATE.repeats[repeatIndex];
  const startSize = direction == "x" ? repeat.area[0] : repeat.area[1];
  const startPos: Vec2 = [e.clientX, e.clientY];
  const moveDragger = e.target as HTMLElement;

  dispatch({ transforming: true });

  document.body.classList.add("grabbing");
  moveDragger.classList.remove("grab");

  const end = (): void => {
    dispatch({ transforming: false });

    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", onmove as EventListener);
    window.removeEventListener("pointerup", end);

    moveDragger.classList.add("grab");
  };

  const onmove = (e: PointerEvent): void => {
    let newSize: number;
    let updated;
    if (direction == "x") {
      newSize =
        startSize -
        Math.floor(
          (startPos[0] - e.clientX) / (GLOBAL_STATE.scale / devicePixelRatio)
        );

      newSize = newSize < repeat.bitmap.width ? repeat.bitmap.width : newSize;

      updated = {
        ...repeat,
        area: [newSize, GLOBAL_STATE.repeats[repeatIndex].area[1]] as Vec2,
      };
    } else {
      newSize =
        startSize +
        Math.floor(
          (startPos[1] - e.clientY) / (GLOBAL_STATE.scale / devicePixelRatio)
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

  window.addEventListener("pointermove", onmove as EventListener);
  window.addEventListener("pointerup", end);
}

export function repeatPointerInteraction(repeatContainer: HTMLElement): void {
  repeatContainer.addEventListener("pointerdown", (e: PointerEvent) => {
    const repeatIndex = getRepeatIndex(e.target as HTMLElement);
    const classList = (e.target as HTMLElement).classList;

    if (
      GLOBAL_STATE.editingRepeat != repeatIndex &&
      classList.contains("repeat-canvas")
    ) {
      console.log("NOW EDITING REPEAT", repeatIndex);
      dispatch({ editingRepeat: repeatIndex! });
      return;
    }

    if (classList.contains("resize-repeat")) {
      resizeRepeat(e, repeatIndex!);
    } else if (classList.contains("repeat-area-dragger")) {
      if (classList.contains("x-axis")) {
        editRepeatArea(e, repeatIndex!, "x");
      } else {
        editRepeatArea(e, repeatIndex!, "y");
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
        moveRepeat(e, repeatIndex!);
      } else {
        console.warn(`Uh oh, ${activeTool} is not a tool`);
      }
    }
  });

  repeatContainer.addEventListener("pointermove", (e: PointerEvent) => {
    if (GLOBAL_STATE.editingRepeat < 0) {
      const pos = posAtCoords(e, repeatContainer);

      if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
        dispatch({ pos });
      }
    } else {
      const pos = posAtCoords(e, e.target as Element);

      if (GLOBAL_STATE.pos[0] != pos[0] || GLOBAL_STATE.pos[1] != pos[1]) {
        dispatch({ repeatPos: pos });
      }
    }
  });
}
