import { sizeCanvasToBitmap } from "../actions/zoomFit";

export function drawGrid(gridCanvas) {
  return ({ state }) => {
    let { scale, chart, grid } = state;

    let width = chart.width;
    let height = chart.height;

    function draw() {
      if (!grid) return;
      const ctx = gridCanvas.getContext("2d");

      if (scale < 15) {
        ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        return;
      }
      ctx.save();

      ctx.translate(-0.5, -0.5);

      ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        ctx.moveTo(x * scale, 0);
        ctx.lineTo(x * scale, height * scale + 1);
      }

      for (let y = 0; y < height; y++) {
        ctx.moveTo(0, y * scale);
        ctx.lineTo(width * scale + 1, y * scale);
      }

      ctx.stroke();
      ctx.restore();
    }

    sizeCanvasToBitmap(gridCanvas, width, height);
    draw();

    return {
      syncState(state) {
        if (
          scale != state.scale ||
          width != state.chart.width ||
          height != state.chart.height ||
          grid != state.grid
        ) {
          width = state.chart.width;
          height = state.chart.height;
          scale = state.scale;
          grid = state.grid;

          sizeCanvasToBitmap(gridCanvas, width, height);
          draw();
        }
      },
    };
  };
}
