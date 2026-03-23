import { GLOBAL_STATE, dispatch } from "../state";
import { rasterizeChart } from "../charting/evalChart";
import { bBoxAllBoundaries } from "../charting/helpers";
import { scheduleChart } from "../charting/planner";

function debounce(callback, wait) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

function evalChart() {
  const { boundaries, regions, blocks, paths, showTimeNeedleView } =
    GLOBAL_STATE;

  let { stitchChart, yarnChart, machineChart, yarnSequence, rowMap } =
    rasterizeChart(boundaries, regions, blocks, paths);

  if (showTimeNeedleView) {
    const { passes, yarns } = scheduleChart(machineChart, yarnSequence);
    dispatch({
      chart: stitchChart,
      yarnChart,
      machineChart,
      yarnSequence,
      rowMap,
      bbox: bBoxAllBoundaries(boundaries),
      passSchedule: passes,
      yarnSchedule: yarns,
    });
  } else {
    dispatch({
      chart: stitchChart,
      yarnChart,
      machineChart,
      yarnSequence,
      rowMap,
      bbox: bBoxAllBoundaries(boundaries),
    });
  }
}

export function chartEvalSubscriber() {
  return () => {
    const debouncedEval = debounce(evalChart, 30);

    evalChart();

    return {
      syncState(state, changes) {
        const found = [
          "boundaries",
          "regions",
          "blocks",
          "paths",
          "tucks",
          "showTimeNeedleView",
        ].some((key) => changes.includes(key));

        if (found) {
          debouncedEval();
        }
      },
    };
  };
}
