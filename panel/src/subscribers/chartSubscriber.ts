import { drawChart } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
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

          setCanvasSize(
            document.getElementById("chart-canvas") as HTMLCanvasElement,
            Math.round(state.cellWidth * width),
            Math.round(state.cellHeight * height)
          );

          lastStitch = null;
          lastYarn = null;
        }

        if (lastStitch != state.chart || lastYarn != state.yarnChart) {
          drawChart(
            document.getElementById("chart-canvas") as HTMLCanvasElement,
            state.colorMode,
            state.chart,
            state.yarnChart,
            state.yarnPalette,
            scale,
            scale * state.cellAspect,
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
