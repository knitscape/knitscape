import { GLOBAL_STATE, dispatch } from "../state";

function dragInRepeat(e: DragEvent, repeatLibraryIndex: number): void {
  const canvas = document.getElementById("symbol-canvas")!;

  function replaceRepeat(e: Event): void {
    canvas.removeEventListener("drop", replaceRepeat);
    canvas.removeEventListener("dragover", dragOver);

    const newBitmap = GLOBAL_STATE.repeatLibrary[repeatLibraryIndex].bitmap;

    dispatch({
      repeats: [{ bitmap: newBitmap }],
    });
  }

  function dragOver(e: Event): void {
    e.preventDefault();
  }

  canvas.addEventListener("dragover", dragOver);
  canvas.addEventListener("drop", replaceRepeat);
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
