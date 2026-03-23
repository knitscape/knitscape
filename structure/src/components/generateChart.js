import { GLOBAL_STATE, dispatch } from "../state";
import { Bimp } from "../lib/Bimp";
export function generateChart() {
  return ({ state }) => {
    let repeats = state.repeats;
    function regen() {
      let chart = Bimp.empty(
        GLOBAL_STATE.chart.width,
        GLOBAL_STATE.chart.height,
        0
      );
      for (const repeat of repeats) {
        let tiled = Bimp.fromTile(
          repeat.area[0],
          repeat.area[1],
          repeat.bitmap.vFlip()
        ).vFlip();
        chart = chart.overlay(tiled, repeat.pos);
      }
      dispatch({ chart });
    }
    regen();
    return {
      syncState(state) {
        if (repeats != state.repeats) {
          repeats = state.repeats;
          regen();
        }
      },
    };
  };
}
