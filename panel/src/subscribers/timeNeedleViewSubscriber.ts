import { GLOBAL_STATE } from "../state";
import { bmp_lib } from "../lib/bmp";
import { hexToRgb } from "@shared/hexToRgb";
import { SYMBOL_DATA } from "@shared/chartSymbols";
import type { GlobalState, StateObserver } from "../types";

function renderTimeNeedle(passSchedule: number[][]) {
  if (!passSchedule || passSchedule.length == 0) return;
  const im = document.getElementById("timeneedlebitmap");
  if (!im) return;
  const bmp2d = passSchedule.toReversed();
  const rgbPalette = Object.values(SYMBOL_DATA).map(({ color }) =>
    hexToRgb(color)
  );

  bmp_lib.render(im, bmp2d, rgbPalette);
}

export function timeNeedleSubscriber() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    let { showTimeNeedleView, passSchedule } = state;

    if (showTimeNeedleView && passSchedule) renderTimeNeedle(passSchedule);

    return {
      syncState(state: GlobalState, changes?: string[]) {
        if (changes?.includes("showTimeNeedleView")) {
          if (!state.showTimeNeedleView) {
            return;
          } else {
            renderTimeNeedle(state.passSchedule);
          }
        }
        if (changes?.includes("passSchedule"))
          renderTimeNeedle(state.passSchedule);
      },
    };
  };
}
