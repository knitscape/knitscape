import { drawChart } from "../charting/drawing";
import type { GlobalState, StateObserver } from "../types";
import type { Bimp } from "../../../shared/Bimp";

export function chartSubscriber() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    let { scale, chart, colorMode, yarnPalette, yarnChart } = state;

    let width = chart?.width ?? 0;
    let height = chart?.height ?? 0;

    let lastYarn: Bimp | null = yarnChart;
    let lastStitch: Bimp | null = chart;

    return {
      syncState(state: GlobalState) {
        if (!state.chart || !state.yarnChart || !state.yarnPalette) return;

        if (
          scale != state.scale ||
          width != state.chart.width ||
          height != state.chart.height ||
          colorMode != state.colorMode ||
          yarnPalette != state.yarnPalette
        ) {
          width = state.chart.width;
          height = state.chart.height;
          scale = state.scale;
          colorMode = state.colorMode;
          yarnPalette = state.yarnPalette;

          const dpr = window.devicePixelRatio || 1;
          const cssW = Math.round(state.cellWidth * width);
          const cssH = Math.round(state.cellHeight * height);
          const canvas = document.getElementById("chart-canvas") as HTMLCanvasElement;
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);

          lastStitch = null;
          lastYarn = null;
        }

        if (lastStitch != state.chart || lastYarn != state.yarnChart) {
          const dpr = window.devicePixelRatio || 1;
          drawChart(
            document.getElementById("chart-canvas") as HTMLCanvasElement,
            state.colorMode,
            state.chart,
            state.yarnChart,
            state.yarnPalette,
            scale * dpr,
            scale * state.cellAspect * dpr,
            lastStitch,
            lastYarn
          );

          lastYarn = state.yarnChart;
          lastStitch = state.chart;
        }
      },
    };
  };
}
