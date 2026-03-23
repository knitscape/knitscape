import { GLOBAL_STATE } from "../state";
import { SYMBOL_PATHS } from "../constants";

export function drawSymbolPicker(symbolCanvas) {
  return ({ state }) => {
    let { symbolMap, symbolLineWidth } = state;

    function draw() {
      symbolMap.forEach((symbol) => {
        const canvas = document.querySelector(`[data-symbol=${symbol}]`);
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");

        ctx.scale(50, 50);
        ctx.imageSmoothingEnabled = false;

        ctx.lineWidth = 0.01 * symbolLineWidth;

        ctx.stroke(SYMBOL_PATHS[symbol]);
      });
    }

    draw();

    return {
      syncState(state) {
        if (symbolLineWidth != state.symbolLineWidth) {
          symbolLineWidth = state.symbolLineWidth;

          draw();
        }
      },
    };
  };
}
