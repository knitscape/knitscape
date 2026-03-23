import { drawChart } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";

export function chartSubscriber() {
  return ({ state }) => {
    let { scale, chart, colorMode, yarnPalette, yarnChart } = state;

    let width = chart.width;
    let height = chart.height;

    let lastYarn = yarnChart;
    let lastStitch = chart;

    return {
      syncState(state) {
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
            document.getElementById("chart-canvas"),
            Math.round(state.cellWidth * width),
            Math.round(state.cellHeight * height)
          );

          lastStitch = null;
          lastYarn = null;
        }

        if (lastStitch != state.chart || lastYarn != state.yarnChart) {
          drawChart(
            document.getElementById("chart-canvas"),
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
