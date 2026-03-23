export function sizeCanvasToBitmap(canvas, width, height, scale) {
  canvas.width = scale * width;
  canvas.height = scale * height;

  canvas.style.width = `${(scale * width) / devicePixelRatio}px`;
  canvas.style.height = `${(scale * height) / devicePixelRatio}px`;
}

export function resizeCanvases(canvases) {
  return ({ state }) => {
    let { scale, chart } = state;

    let width = chart.width;
    let height = chart.height;

    function syncCanvases() {
      canvases.forEach((canvas) => {
        sizeCanvasToBitmap(canvas, width, height, scale);
      });
    }

    return {
      syncState(state) {
        if (
          width != state.chart.width ||
          height != state.chart.height ||
          scale != state.scale
        ) {
          width = state.chart.width;
          height = state.chart.height;
          scale = state.scale;

          syncCanvases();
        }
      },
    };
  };
}
