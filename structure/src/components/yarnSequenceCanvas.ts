import { sizeCanvasToBitmap } from "./resizeCanvases";
import type { GlobalState, ComponentFactory } from "../types";
import type { Bimp } from "@shared/Bimp";

export function yarnSequenceCanvas(opts: {
  canvas: HTMLCanvasElement;
}): ComponentFactory {
  const { canvas } = opts;
  return ({ state }) => {
    let { scale, yarnSequence, yarnPalette } = state;

    let width = yarnSequence.width;
    let height = yarnSequence.height;
    let lastDrawn: Bimp | null = null;

    function draw(): void {
      const ctx = canvas.getContext("2d")!;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const paletteIndex = yarnSequence.pixel(x, height - y - 1);

          if (
            lastDrawn == null ||
            lastDrawn.pixel(x, height - y - 1) != paletteIndex
          ) {
            ctx.fillStyle = yarnPalette[paletteIndex];
            ctx.clearRect(x * scale, y * scale, scale, scale);
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
      lastDrawn = yarnSequence;
    }

    sizeCanvasToBitmap(canvas, width, height, scale);
    draw();

    return {
      syncState(state: GlobalState) {
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
