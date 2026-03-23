import { GLOBAL_STATE } from "../state";
import { bmp_lib } from "../lib/bmp";
import { hexToRgb } from "../utilities/misc";
import { SYMBOL_DATA } from "../constants";

function renderTimeNeedle(passSchedule) {
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
  return ({ state }) => {
    let { showTimeNeedleView, passSchedule } = state;

    if (showTimeNeedleView && passSchedule) renderTimeNeedle(passSchedule);

    return {
      syncState(state, changes) {
        if (changes.includes("showTimeNeedleView")) {
          if (!state.showTimeNeedleView) {
            return;
          } else {
            renderTimeNeedle(state.passSchedule);
          }
        }
        if (changes.includes("passSchedule"))
          renderTimeNeedle(state.passSchedule);
      },
    };
  };
}
