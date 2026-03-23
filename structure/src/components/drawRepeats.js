import { GLOBAL_STATE } from "../state";
import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";

function clearLastDrawn(lastDrawn) {
  for (const repeat of lastDrawn) {
    repeat.bitmap = null;
  }
}

function sizeCanvasToBitmap(canvas, bitmapWidth, bitmapHeight) {
  canvas.width = GLOBAL_STATE.scale * bitmapWidth;
  canvas.height = GLOBAL_STATE.scale * bitmapHeight;
  canvas.style.width = `${
    (GLOBAL_STATE.scale * bitmapWidth) / devicePixelRatio
  }px`;

  canvas.style.height = `${
    (GLOBAL_STATE.scale * bitmapHeight) / devicePixelRatio
  }px`;
}

export function drawRepeats() {
  return ({ state }) => {
    let { scale, symbolMap, repeats, symbolLineWidth } = state;

    let lastDrawn = repeats.map((repeat) => {
      return { bitmap: null, pos: [...repeat.pos] };
    });

    function scaleAll(repeatIndex, width, height) {
      let canvases = [
        document.getElementById(`repeat-${repeatIndex}`),
        document.getElementById(`repeat-${repeatIndex}-grid`),
        document.getElementById(`repeat-${repeatIndex}-outline`),
      ];

      canvases.forEach((canvas) => {
        if (canvas == null) {
          lastDrawn[repeatIndex].bitmap = null;
          return;
        }
        canvas.width = GLOBAL_STATE.scale * width;
        canvas.height = GLOBAL_STATE.scale * height;
        canvas.style.width = `${
          (GLOBAL_STATE.scale * width) / devicePixelRatio
        }px`;
        canvas.style.height = `${
          (GLOBAL_STATE.scale * height) / devicePixelRatio
        }px`;
      });
    }

    function drawGrid(repeatIndex) {
      if (!GLOBAL_STATE.grid) return;

      const gridCanvas = document.getElementById(`repeat-${repeatIndex}-grid`);
      const ctx = gridCanvas.getContext("2d");
      const width = repeats[repeatIndex].bitmap.width;
      const height = repeats[repeatIndex].bitmap.height;

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

    function draw(repeatIndex) {
      // Draws only the pixels that have changed
      const ctx = document
        .getElementById(`repeat-${repeatIndex}`)
        .getContext("2d");
      ctx.imageSmoothingEnabled = false;

      ctx.lineWidth = 0.01 * symbolLineWidth;

      ctx.resetTransform();
      ctx.translate(-0.5, -0.5);

      const repeat = repeats[repeatIndex].bitmap;

      for (let y = 0; y < repeat.height; y++) {
        for (let x = 0; x < repeat.width; x++) {
          let paletteIndex = repeat.pixel(x, y);

          if (
            lastDrawn[repeatIndex].bitmap == null ||
            lastDrawn[repeatIndex].bitmap.pixel(x, y) != paletteIndex
          ) {
            const symbol = symbolMap[paletteIndex];

            ctx.save();
            ctx.translate(x * scale, y * scale);
            ctx.scale(scale, scale);

            ctx.clearRect(0, 0, 1, 1);

            if (SYMBOL_BITS[symbol]) {
              // color the repeat black and white according to operations
              // TODO: make this a setting? what is the best way to represent this?
              ctx.fillStyle = "#fff";
              ctx.strokeStyle = "#000";
            } else {
              ctx.fillStyle = "#000";
              ctx.strokeStyle = "#fff";
            }
            ctx.fillRect(0, 0, 1, 1);

            ctx.stroke(SYMBOL_PATHS[symbol]);

            ctx.restore();
          }
        }
      }
      lastDrawn[repeatIndex].bitmap = repeat;
    }

    function drawAll() {
      lastDrawn = repeats.map((repeat) => {
        return { bitmap: null, pos: [...repeat.pos] };
      });
      for (let repeatIndex = 0; repeatIndex < repeats.length; repeatIndex++) {
        // positionRepeat(repeatIndex);
        scaleAll(
          repeatIndex,
          repeats[repeatIndex].bitmap.width,
          repeats[repeatIndex].bitmap.height
        );

        draw(repeatIndex);
        drawGrid(repeatIndex);
      }
    }

    return {
      syncState(state) {
        repeats = state.repeats;

        if (lastDrawn.length != repeats.length) {
          // A repeat was added or removed
          drawAll();
        }

        if (symbolLineWidth != state.symbolLineWidth) {
          // We will want to redraw everything
          symbolLineWidth = state.symbolLineWidth;
          clearLastDrawn(lastDrawn);
        }

        if (scale != state.scale) {
          // We will want to redraw everything
          scale = state.scale;
          clearLastDrawn(lastDrawn);

          // And scale the canvases
          for (
            let repeatIndex = 0;
            repeatIndex < repeats.length;
            repeatIndex++
          ) {
            scaleAll(
              repeatIndex,
              repeats[repeatIndex].bitmap.width,
              repeats[repeatIndex].bitmap.height
            );
            drawGrid(repeatIndex);
          }
        }

        for (let repeatIndex = 0; repeatIndex < repeats.length; repeatIndex++) {
          let repeat = repeats[repeatIndex];

          if (
            lastDrawn[repeatIndex].bitmap == null ||
            repeat.bitmap.width != lastDrawn[repeatIndex].bitmap.width ||
            repeat.bitmap.height != lastDrawn[repeatIndex].bitmap.height
          ) {
            scaleAll(
              repeatIndex,
              repeats[repeatIndex].bitmap.width,
              repeats[repeatIndex].bitmap.height
            );

            drawGrid(repeatIndex);

            lastDrawn[repeatIndex].bitmap = null;
          }

          if (lastDrawn[repeatIndex].bitmap != repeat.bitmap) {
            draw(repeatIndex);
          }
        }
      },
    };
  };
}
