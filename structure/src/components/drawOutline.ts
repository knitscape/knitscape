import type { GlobalState, ComponentFactory, Vec2 } from "../types";

export function drawOutline(
  outlineCanvas: HTMLCanvasElement,
  inner: string = "#000",
  outer: string = "#fff"
): ComponentFactory {
  return ({ state }) => {
    let { scale, pos, chart } = state;
    let width = chart.width;
    let height = chart.height;

    function draw(): void {
      const ctx = outlineCanvas.getContext("2d")!;

      if (pos[0] < 0 || pos[1] < 0) {
        ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);
        return;
      }

      ctx.resetTransform();

      ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

      ctx.translate(-0.5, -0.5);

      ctx.strokeStyle = outer;
      ctx.strokeRect(
        pos[0] * scale + 1,
        pos[1] * scale + 1,
        scale - 2,
        scale - 2
      );

      ctx.strokeStyle = inner;
      ctx.strokeRect(
        pos[0] * scale + 2,
        pos[1] * scale + 2,
        scale - 4,
        scale - 4
      );
    }

    return {
      syncState(state: GlobalState) {
        if (
          scale != state.scale ||
          width != state.chart.width ||
          height != state.chart.height
        ) {
          scale = state.scale;
          width = state.chart.width;
          height = state.chart.height;
          pos = null as unknown as Vec2;
        }
        if (state.pos != pos) {
          pos = state.pos;
          draw();
        }
      },
    };
  };
}
