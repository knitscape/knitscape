import { GLOBAL_STATE } from "../state";
import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";

export function drawSymbols(symbolCanvas) {
  return ({ state }) => {
    let { scale, symbolMap, chart, symbolLineWidth } = state;

    let lastDrawn = null;
    let width = chart.width;
    let height = chart.height;

    function draw() {
      // Draws only the pixels that have changed
      const ctx = symbolCanvas.getContext("2d");

      ctx.lineWidth = 0.01 * symbolLineWidth;

      ctx.resetTransform();
      ctx.translate(-0.5, -0.5);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let paletteIndex = chart.pixel(x, y);

          if (lastDrawn == null || lastDrawn.pixel(x, y) != paletteIndex) {
            const symbol = symbolMap[paletteIndex];

            ctx.save();
            ctx.translate(x * scale, (height - y - 1) * scale);
            ctx.scale(scale, scale);

            ctx.clearRect(0, 0, 1, 1);

            if (SYMBOL_BITS[symbol]) {
              // if the symbol would be true (i.e., slip or tuck), add a white background
              // to represent that it would not show the yarn in that row
              // TODO: make this a setting? what is the best way to represent this?
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
      syncState(state) {
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
