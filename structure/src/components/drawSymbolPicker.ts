import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";
import type { GlobalState, ComponentFactory, SymbolName } from "../types";

export function drawSymbolPicker(): ComponentFactory {
  return ({ state }) => {
    let { symbolMap, symbolLineWidth } = state;

    function draw(): void {
      symbolMap.forEach((symbol: SymbolName) => {
        const canvas = document.querySelector(
          `[data-symbol=${symbol}]`
        ) as HTMLCanvasElement;
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext("2d")!;

        ctx.scale(50, 50);
        ctx.imageSmoothingEnabled = false;
        ctx.lineWidth = 0.01 * symbolLineWidth;

        if (SYMBOL_BITS[symbol]) {
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#000";
        } else {
          ctx.fillStyle = "#000";
          ctx.strokeStyle = "#fff";
        }
        ctx.fillRect(0, 0, 1, 1);
        ctx.stroke(SYMBOL_PATHS[symbol]);
      });
    }

    draw();

    return {
      syncState(state: GlobalState) {
        if (symbolLineWidth != state.symbolLineWidth) {
          symbolLineWidth = state.symbolLineWidth;

          draw();
        }
      },
    };
  };
}
