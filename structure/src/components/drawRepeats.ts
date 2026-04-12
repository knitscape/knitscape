import { GLOBAL_STATE } from "../state";
import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";
import type { GlobalState, ComponentFactory, SymbolName } from "../types";
import type { Bimp } from "../lib/Bimp";

function clearLastDrawn(lastDrawn: { bitmap: Bimp | null }[]): void {
  for (const repeat of lastDrawn) {
    repeat.bitmap = null;
  }
}

function buildSymbolCache(
  scale: number,
  lineWidth: number
): Map<SymbolName, OffscreenCanvas> {
  const cache = new Map<SymbolName, OffscreenCanvas>();
  for (const symbol of Object.keys(SYMBOL_PATHS) as SymbolName[]) {
    const offscreen = new OffscreenCanvas(scale, scale);
    const octx = offscreen.getContext("2d")!;
    octx.imageSmoothingEnabled = false;
    octx.translate(-0.5, -0.5);
    octx.scale(scale, scale);
    octx.lineWidth = 0.01 * lineWidth;
    if (SYMBOL_BITS[symbol]) {
      octx.fillStyle = "#fff";
      octx.strokeStyle = "#000";
    } else {
      octx.fillStyle = "#000";
      octx.strokeStyle = "#fff";
    }
    octx.fillRect(0, 0, 1, 1);
    octx.stroke(SYMBOL_PATHS[symbol]);
    cache.set(symbol, offscreen);
  }
  return cache;
}

export function drawRepeats(): ComponentFactory {
  return ({ state }) => {
    let { scale, symbolMap, repeats, symbolLineWidth } = state;

    let lastDrawn = repeats.map((repeat) => {
      return { bitmap: null as Bimp | null, pos: [...repeat.pos] };
    });

    let symbolCache = buildSymbolCache(scale, symbolLineWidth);

    function scaleAll(
      repeatIndex: number,
      width: number,
      height: number
    ): void {
      const canvases = [
        document.getElementById(`repeat-${repeatIndex}`),
        document.getElementById(`repeat-${repeatIndex}-grid`),
        document.getElementById(`repeat-${repeatIndex}-outline`),
      ];

      canvases.forEach((canvas) => {
        if (canvas == null) {
          lastDrawn[repeatIndex].bitmap = null;
          return;
        }
        (canvas as HTMLCanvasElement).width = GLOBAL_STATE.scale * width;
        (canvas as HTMLCanvasElement).height = GLOBAL_STATE.scale * height;
        canvas.style.width = `${
          (GLOBAL_STATE.scale * width) / devicePixelRatio
        }px`;
        canvas.style.height = `${
          (GLOBAL_STATE.scale * height) / devicePixelRatio
        }px`;
      });
    }

    function drawGrid(repeatIndex: number): void {
      if (!GLOBAL_STATE.grid) return;

      const gridCanvas = document.getElementById(
        `repeat-${repeatIndex}-grid`
      ) as HTMLCanvasElement;
      const ctx = gridCanvas.getContext("2d")!;
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

    function draw(repeatIndex: number): void {
      const canvas = document.getElementById(
        `repeat-${repeatIndex}`
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.resetTransform();

      const repeat = repeats[repeatIndex].bitmap;

      for (let y = 0; y < repeat.height; y++) {
        for (let x = 0; x < repeat.width; x++) {
          const paletteIndex = repeat.pixel(x, y);

          if (
            lastDrawn[repeatIndex].bitmap == null ||
            lastDrawn[repeatIndex].bitmap!.pixel(x, y) != paletteIndex
          ) {
            const symbol = symbolMap[paletteIndex];
            const dx = x * scale;
            const dy = y * scale;

            ctx.clearRect(dx, dy, scale, scale);
            ctx.drawImage(symbolCache.get(symbol)!, dx, dy);
          }
        }
      }
      lastDrawn[repeatIndex].bitmap = repeat;
    }

    function drawAll(): void {
      lastDrawn = repeats.map((repeat) => {
        return { bitmap: null as Bimp | null, pos: [...repeat.pos] };
      });
      for (let repeatIndex = 0; repeatIndex < repeats.length; repeatIndex++) {
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
      syncState(state: GlobalState) {
        repeats = state.repeats;

        if (lastDrawn.length != repeats.length) {
          drawAll();
        }

        if (
          symbolLineWidth != state.symbolLineWidth ||
          symbolMap != state.symbolMap
        ) {
          symbolLineWidth = state.symbolLineWidth;
          symbolMap = state.symbolMap;
          symbolCache = buildSymbolCache(scale, symbolLineWidth);
          clearLastDrawn(lastDrawn);
        }

        if (scale != state.scale) {
          scale = state.scale;
          symbolCache = buildSymbolCache(scale, symbolLineWidth);
          clearLastDrawn(lastDrawn);

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
          const repeat = repeats[repeatIndex];

          if (
            lastDrawn[repeatIndex].bitmap == null ||
            repeat.bitmap.width != lastDrawn[repeatIndex].bitmap!.width ||
            repeat.bitmap.height != lastDrawn[repeatIndex].bitmap!.height
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
