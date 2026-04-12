import { SYMBOL_DATA } from "../constants";
import type { GlobalState, StateObserver } from "../types";

export function drawSymbolPicker() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    const stateAny = state as any;
    let { symbolMap, symbolLineWidth } = stateAny;

    function draw() {
      if (!symbolMap) return;
      symbolMap.forEach((symbol: string) => {
        const { path, color, stroke } = SYMBOL_DATA[symbol];
        if (path) {
          const canvas = document.querySelector(`[data-symbol=${symbol}]`) as HTMLCanvasElement | null;
          if (!canvas) return;
          canvas.width = 50;
          canvas.height = 50;
          const ctx = canvas.getContext("2d")!;

          ctx.scale(50, 50);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          ctx.lineWidth = 0.01 * (symbolLineWidth ?? 1);
          if (stroke) ctx.strokeStyle = stroke;
          ctx.stroke(path);
        }
      });
    }

    draw();

    return {
      syncState(state: GlobalState) {
        const s = state as any;
        if (symbolLineWidth != s.symbolLineWidth) {
          symbolLineWidth = s.symbolLineWidth;
          draw();
        }
      },
    };
  };
}
