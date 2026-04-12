import type { GlobalState, ComponentFactory } from "../types";
import type { Bimp } from "../../../shared/Bimp";

export function drawYarnColors(
  yarnColorCanvas: HTMLCanvasElement
): ComponentFactory {
  return ({ state }) => {
    let { scale, yarnPalette, yarnSequence, chart } = state;

    let lastDrawn: Bimp | null = null;
    let chartWidth = chart.width;
    let chartHeight = chart.height;

    let yarnHeight = yarnSequence.height;

    function draw(): void {
      const ctx = yarnColorCanvas.getContext("2d")!;

      for (let y = 0; y < chartHeight; y++) {
        const paletteIndex = yarnSequence.pixel(
          0,
          (chartHeight - y - 1) % yarnHeight
        );

        if (
          lastDrawn == null ||
          lastDrawn.pixel(0, (chartHeight - y - 1) % yarnHeight) !=
            paletteIndex
        ) {
          ctx.fillStyle = yarnPalette[paletteIndex];
          ctx.fillRect(0, y * scale, chartWidth * scale, scale);
        }
      }
      lastDrawn = yarnSequence;
    }

    lastDrawn = null;

    draw();

    return {
      syncState(state: GlobalState) {
        yarnSequence = state.yarnSequence;

        if (
          chartWidth != state.chart.width ||
          chartHeight != state.chart.height ||
          yarnHeight != state.yarnSequence.height ||
          scale != state.scale
        ) {
          chartWidth = state.chart.width;
          chartHeight = state.chart.height;
          yarnHeight = state.yarnSequence.height;
          scale = state.scale;

          lastDrawn = null;
        }

        if (yarnPalette != state.yarnPalette) {
          yarnPalette = state.yarnPalette;
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
