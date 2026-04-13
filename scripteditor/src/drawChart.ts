import { SYMBOL_DATA, BACK_OPS } from "@shared/chartSymbols";
import { STITCH_MAP } from "@shared/stitches";
import type { Bimp } from "@shared/Bimp";
import type { ColorMode } from "@shared/chartSymbols";

const DIM = "#0000002a";

export function drawChart(
  canvas: HTMLCanvasElement,
  mode: ColorMode,
  stitchChart: Bimp,
  yarnChart: Bimp,
  yarnPalette: string[],
  cellWidth: number,
  cellHeight: number,
  lastDrawn: Bimp | null = null,
  lastYarn: Bimp | null = null
) {
  const { width, height } = stitchChart;

  const ctx = canvas.getContext("2d")!;
  ctx.lineWidth = 0.03;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let stitchIndex = stitchChart.pixel(x, y);
      let yarnIndex = yarnChart.pixel(x, y);

      if (
        lastDrawn == null ||
        lastYarn == null ||
        lastDrawn.pixel(x, y) != stitchIndex ||
        lastYarn.pixel(x, y) != yarnIndex
      ) {
        ctx.save();
        ctx.translate(x * cellWidth, (height - y - 1) * cellHeight);
        ctx.scale(cellWidth, cellHeight);

        const operation = STITCH_MAP[stitchIndex];

        if (mode == "operation") {
          ctx.fillStyle = SYMBOL_DATA[operation].color;
          ctx.fillRect(0, 0, 1, 1);
        } else if (mode == "yarn") {
          if (yarnIndex == 0) {
            ctx.fillStyle = SYMBOL_DATA.EMPTY.color;
          } else {
            ctx.fillStyle = yarnPalette[yarnIndex - 1];
          }
          ctx.fillRect(0, 0, 1, 1);

          if (BACK_OPS.has(operation)) {
            // Dim any back bed operations
            ctx.fillStyle = DIM;
            ctx.fillRect(0, 0, 1, 1);
          }
        }

        const { path } = SYMBOL_DATA[operation];

        if (path) ctx.stroke(path);

        ctx.restore();
      }
    }
  }
}
