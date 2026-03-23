import { SYMBOL_DATA } from "../constants";

export function drawSymbolPicker() {
  return ({ state }) => {
    let { symbolMap, symbolLineWidth } = state;

    function draw() {
      symbolMap.forEach((symbol) => {
        const { path, color, stroke } = SYMBOL_DATA[symbol];
        if (path) {
          const canvas = document.querySelector(`[data-symbol=${symbol}]`);
          canvas.width = 50;
          canvas.height = 50;
          const ctx = canvas.getContext("2d");

          ctx.scale(50, 50);
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          ctx.lineWidth = 0.01 * symbolLineWidth;
          if (stroke) ctx.strokeStyle = stroke;
          ctx.stroke(path);
        }
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
