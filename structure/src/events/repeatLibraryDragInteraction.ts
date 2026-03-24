import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";
import type { Vec2 } from "../types";

function dragInRepeat(e: DragEvent, repeatLibraryIndex: number): void {
  const canvas = document.getElementById("symbol-canvas")!;

  function addRepeat(e: Event): void {
    canvas.removeEventListener("drop", addRepeat);
    canvas.removeEventListener("dragover", addRepeat);

    const pos = posAtCoords(e as DragEvent, canvas);

    const newBitmap = GLOBAL_STATE.repeatLibrary[repeatLibraryIndex].bitmap;

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats,
        {
          bitmap: newBitmap,
          area: [newBitmap.width, newBitmap.height] as Vec2,
          pos: [pos[0], GLOBAL_STATE.chart.height - pos[1]] as Vec2,
        },
      ],
      editingRepeat: GLOBAL_STATE.repeats.length,
    });
  }

  function dragOver(e: Event): void {
    e.preventDefault();
  }

  canvas.addEventListener("dragover", dragOver);
  canvas.addEventListener("drop", addRepeat);
}

export function repeatLibraryDragInteraction(
  repeatLibraryContainer: HTMLElement
): void {
  repeatLibraryContainer.addEventListener("dragstart", (e: DragEvent) => {
    dragInRepeat(
      e,
      Number((e.target as HTMLElement).dataset.repeatlibraryindex)
    );
  });
}
