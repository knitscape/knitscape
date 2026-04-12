import { GLOBAL_STATE, dispatch, undo } from "../state";
import { toolData } from "../constants";

const ctrlShortcuts: Record<string, () => void> = {
  a: () => console.log("select all?"),
  z: () => undo(),
  s: () => dispatch({ showDownload: true }),
};

const hotkeys: Record<string, () => void> = {
  ...Object.fromEntries(
    Object.entries(toolData).map(([toolId, td]) => [
      td.hotkey,
      () => dispatch({ activeTool: toolId as any }),
    ])
  ),

  g: () => dispatch({ grid: !GLOBAL_STATE.grid }),

  Escape: () =>
    dispatch({
      showLibrary: false,
      showSettings: false,
      showDownload: false,
    }),
};

function symbolSwitch(index: number): void {
  if (index <= GLOBAL_STATE.symbolMap.length) dispatch({ activeSymbol: index });
}

export function addKeypressListeners(): void {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key.toLowerCase() in ctrlShortcuts) {
      e.preventDefault();
      ctrlShortcuts[e.key.toLowerCase()]();
    } else if (e.key in hotkeys) hotkeys[e.key]();
    else if (/^[0-9]$/i.test(e.key)) symbolSwitch(Number(e.key) - 1);

    const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
    newHeldKeys.add(e.key);
    dispatch({ heldKeys: newHeldKeys });
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    const newHeldKeys = new Set(GLOBAL_STATE.heldKeys);
    newHeldKeys.delete(e.key);
    dispatch({ heldKeys: newHeldKeys });
  });
}
