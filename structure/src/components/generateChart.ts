import { dispatch } from "../state";
import { Bimp } from "../lib/Bimp";
import type { GlobalState, ComponentFactory } from "../types";

export function generateChart(): ComponentFactory {
  return ({ state }) => {
    let repeats = state.repeats;
    let chartWidth = state.chart.width;
    let chartHeight = state.chart.height;

    function regen(): void {
      const { bitmap } = repeats[0];
      dispatch({ chart: Bimp.fromTile(chartWidth, chartHeight, bitmap.vFlip()) });
    }
    regen();
    return {
      syncState(state: GlobalState) {
        if (
          repeats != state.repeats ||
          chartWidth != state.chart.width ||
          chartHeight != state.chart.height
        ) {
          repeats = state.repeats;
          chartWidth = state.chart.width;
          chartHeight = state.chart.height;
          regen();
        }
      },
    };
  };
}
