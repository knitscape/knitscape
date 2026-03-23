import { GLOBAL_STATE, dispatch } from "../state";
import { posAtCoords } from "../utils";

function dragInRepeat(e, repeatLibraryIndex) {
  const canvas = document.getElementById("symbol-canvas");

  function addRepeat(e) {
    canvas.removeEventListener("drop", addRepeat);
    canvas.removeEventListener("dragover", addRepeat);

    let pos = posAtCoords(e, canvas);

    const newBitmap = GLOBAL_STATE.repeatLibrary[repeatLibraryIndex].bitmap;

    dispatch({
      repeats: [
        ...GLOBAL_STATE.repeats,
        {
          bitmap: newBitmap,
          area: [newBitmap.width, newBitmap.height],
          pos: [pos.x, GLOBAL_STATE.chart.height - pos.y],
        },
      ],
      editingRepeat: GLOBAL_STATE.repeats.length,
    });
  }

  function dragOver(e) {
    e.preventDefault();
  }

  canvas.addEventListener("dragover", dragOver);
  canvas.addEventListener("drop", addRepeat);
}

export function repeatLibraryDragInteraction(repeatLibraryContainer) {
  repeatLibraryContainer.addEventListener("dragstart", (e) => {
    dragInRepeat(e, Number(e.target.dataset.repeatlibraryindex));
  });
}
