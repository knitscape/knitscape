import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";
import type { GlobalState, ComponentFactory } from "../types";
import type { Bimp } from "../lib/Bimp";

export function drawSymbols(symbolCanvas: HTMLCanvasElement): ComponentFactory {
  return ({ state }) => {
    let { scale, symbolMap, chart, symbolLineWidth } = state;

    let lastDrawn: Bimp | null = null;
    let width = chart.width;
    let height = chart.height;

    function draw(): void {
      const ctx = symbolCanvas.getContext("2d")!;

      ctx.lineWidth = 0.01 * symbolLineWidth;

      ctx.resetTransform();
      ctx.translate(-0.5, -0.5);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const paletteIndex = chart.pixel(x, y);

          if (lastDrawn == null || lastDrawn.pixel(x, y) != paletteIndex) {
            const symbol = symbolMap[paletteIndex];

            ctx.save();
            ctx.translate(x * scale, (height - y - 1) * scale);
            ctx.scale(scale, scale);

            ctx.clearRect(0, 0, 1, 1);

            if (SYMBOL_BITS[symbol]) {
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, 1, 1);
            }

            ctx.stroke(SYMBOL_PATHS[symbol]);

            ctx.restore();
          }
        }
      }
      lastDrawn = chart;
    }

    lastDrawn = null;

    draw();

    return {
      syncState(state: GlobalState) {
        if (
          width != state.chart.width ||
          height != state.chart.height ||
          scale != state.scale ||
          symbolLineWidth != state.symbolLineWidth
        ) {
          width = state.chart.width;
          height = state.chart.height;
          scale = state.scale;
          symbolLineWidth = state.symbolLineWidth;

          lastDrawn = null;
        }

        if (lastDrawn != state.chart) {
          chart = state.chart;
          draw();
        }
      },
    };
  };
}
