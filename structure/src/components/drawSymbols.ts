import { SYMBOL_PATHS, SYMBOL_BITS } from "../constants";
import type { GlobalState, ComponentFactory, SymbolName } from "../types";
import type { Bimp } from "@shared/Bimp";

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
      octx.fillRect(0, 0, 1, 1);
    }
    octx.stroke(SYMBOL_PATHS[symbol]);
    cache.set(symbol, offscreen);
  }
  return cache;
}

export function drawSymbols(symbolCanvas: HTMLCanvasElement): ComponentFactory {
  return ({ state }) => {
    let { scale, symbolMap, chart, symbolLineWidth } = state;

    let lastDrawn: Bimp | null = null;
    let width = chart.width;
    let height = chart.height;
    let symbolCache = buildSymbolCache(scale, symbolLineWidth);

    function draw(): void {
      const ctx = symbolCanvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.resetTransform();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const paletteIndex = chart.pixel(x, y);

          if (lastDrawn == null || lastDrawn.pixel(x, y) != paletteIndex) {
            const symbol = symbolMap[paletteIndex];
            const dx = x * scale;
            const dy = (height - y - 1) * scale;

            ctx.clearRect(dx, dy, scale, scale);
            ctx.drawImage(symbolCache.get(symbol)!, dx, dy);
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
          symbolLineWidth != state.symbolLineWidth ||
          symbolMap != state.symbolMap
        ) {
          width = state.chart.width;
          height = state.chart.height;
          scale = state.scale;
          symbolLineWidth = state.symbolLineWidth;
          symbolMap = state.symbolMap;

          symbolCache = buildSymbolCache(scale, symbolLineWidth);
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
