import { sizeCanvasToBitmap } from "../actions/zoomFit";

export function yarnSequenceCanvas({ canvas }) {
  return ({ state }) => {
    let { scale, yarnSequence, yarnPalette } = state;

    let width = yarnSequence.width;
    let height = yarnSequence.height;
    let lastDrawn = null;

    function draw() {
      const ctx = canvas.getContext("2d");

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let paletteIndex = yarnSequence.pixel(x, height - y - 1);

          if (
            lastDrawn == null ||
            lastDrawn.pixel(x, height - y - 1) != paletteIndex
          ) {
            ctx.translate(x * scale, y * scale);

            ctx.fillStyle = yarnPalette[paletteIndex];

            ctx.clearRect(0, 0, scale, scale);
            ctx.fillRect(0, 0, scale, scale);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
        }
      }
      lastDrawn = yarnSequence;
    }

    sizeCanvasToBitmap(canvas, width, height, scale);
    draw();

    return {
      syncState(state) {
        if (yarnPalette != state.yarnPalette) {
          yarnPalette = state.yarnPalette;
          lastDrawn = null;
        }

        if (
          scale != state.scale ||
          width != state.yarnSequence.width ||
          height != state.yarnSequence.height
        ) {
          width = state.yarnSequence.width;
          height = state.yarnSequence.height;
          scale = state.scale;

          sizeCanvasToBitmap(canvas, width, height, scale);
          lastDrawn = null;
        }

        if (lastDrawn != state.yarnSequence) {
          yarnSequence = state.yarnSequence;
          draw();
        }
      },
    };
  };
}
