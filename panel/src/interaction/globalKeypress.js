import { GLOBAL_STATE, dispatch, undo } from "../state";
import { toolData } from "../constants";
import { closeModals } from "../utilities/misc";
import { removeBlock } from "./blockInteraction";
import { removeBoundary } from "./boundaryInteraction";
import { removePath } from "./pathInteraction";

function escapeEverything() {
  if (GLOBAL_STATE.transforming) return;

  dispatch(
    {
      selectedBlock: null,
      selectedBoundary: null,
      selectedPath: null,
      stitchSelect: null,
      blockEditMode: null,
    },
    true
  );
  closeModals();
}

function deleteSelected() {
  let { selectedBlock, selectedBoundary, selectedPath } = GLOBAL_STATE;

  if (selectedBlock != null) {
    removeBlock(selectedBlock);
  } else if (selectedBoundary != null) {
    removeBoundary(selectedBoundary);
  } else if (selectedPath != null) {
    removePath(selectedPath);
  }
}

const ctrlShortcuts = {
  z: () => undo(),
};

const hotkeys = {
  // grab the tools from the global tool constants and reformat them for the hotkeymap
  ...Object.fromEntries(
    Object.entries(toolData).map(([toolId, toolData]) => [
      toolData.hotkey,
      () => dispatch({ interactionMode: toolId }),
    ])
  ),

  // UI
  Escape: escapeEverything,
  Delete: deleteSelected,
};

function numberPressed(num) {
  // number key was pressed
  console.debug(`${num} key pressed`);
}

export function globalKeydown(e) {
  if (e.ctrlKey && e.key.toLowerCase() in ctrlShortcuts) {
    e.preventDefault();
    ctrlShortcuts[e.key.toLowerCase()]();
  } else if (e.key in hotkeys) hotkeys[e.key]();
  else if (/^[0-9]$/i.test(e.key)) numberPressed(Number(e.key));

  const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
  newHeldKeys.add(e.key);

  dispatch({ heldKeys: newHeldKeys });
}

export function globalKeyup(e) {
  const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
  newHeldKeys.delete(e.key);
  dispatch({ heldKeys: newHeldKeys });
}

// export function addKeypressListeners() {
//   window.addEventListener("keydown", (e) => {
//     if (e.ctrlKey && e.key.toLowerCase() in ctrlShortcuts) {
//       e.preventDefault();
//       ctrlShortcuts[e.key.toLowerCase()]();
//     } else if (e.key in hotkeys) hotkeys[e.key]();
//     else if (/^[0-9]$/i.test(e.key)) numberPressed(Number(e.key));

//     const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
//     newHeldKeys.add(e.key);

//     dispatch({ heldKeys: newHeldKeys });
//   });

//   window.addEventListener("keyup", (e) => {
//     const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
//     newHeldKeys.delete(e.key);
//     dispatch({ heldKeys: newHeldKeys });
//   });
// }
