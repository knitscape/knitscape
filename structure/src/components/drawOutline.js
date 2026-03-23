import { GLOBAL_STATE } from "../state";

export function drawOutline(outlineCanvas, inner = "#000", outer = "#fff") {
  return ({ state }) => {
    let { scale, pos, chart } = state;
    let width = chart.width;
    let height = chart.height;

    function draw() {
      const ctx = outlineCanvas.getContext("2d");

      if (pos.x < 0 || pos.y < 0 || GLOBAL_STATE.editingRepeat >= 0) {
        ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);
        return;
      }

      ctx.resetTransform();

      ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

      ctx.translate(-0.5, -0.5);

      ctx.strokeStyle = outer;
      ctx.strokeRect(
        pos.x * scale + 1,
        pos.y * scale + 1,
        scale - 2,
        scale - 2
      );

      ctx.strokeStyle = inner;
      ctx.strokeRect(
        pos.x * scale + 2,
        pos.y * scale + 2,
        scale - 4,
        scale - 4
      );
    }

    return {
      syncState(state) {
        if (
          scale != state.scale ||
          width != state.chart.width ||
          height != state.chart.height
        ) {
          // if the scale, width, or height have changed, we'll want to redraw
          scale = state.scale;
          width = state.chart.width;
          height = state.chart.height;
          pos = null;
        }
        if (state.pos != pos) {
          pos = state.pos;
          draw();
        }
      },
    };
  };
}
