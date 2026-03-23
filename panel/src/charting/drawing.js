import { SYMBOL_DATA, STITCH_MAP, BACK_OPS } from "../constants";
const TRANSPARENT = "#dfdfdf7f";
const DIM = "#0000002a";

export function drawChart(
  canvas,
  mode,
  stitchChart,
  yarnChart,
  yarnPalette,
  cellWidth,
  cellHeight,
  lastDrawn = null,
  lastYarn = null
) {
  const { width, height } = stitchChart;

  const ctx = canvas.getContext("2d");
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

export function drawYarnBlock(
  blockCanvas,
  yarnBlock,
  [offX, offY],
  globalYarns,
  yarnPalette,
  cellWidth,
  cellHeight,
  lastDrawn = null
) {
  const { width, height } = yarnBlock;

  const ctx = blockCanvas.getContext("2d");
  ctx.lineWidth = 0.03;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let yarnIndex = yarnBlock.pixel(x, y);

      if (lastDrawn == null || lastDrawn.pixel(x, y) != yarnIndex) {
        ctx.save();
        ctx.translate(x * cellWidth, (height - y - 1) * cellHeight);
        ctx.scale(cellWidth, cellHeight);

        if (yarnIndex == 0) {
          ctx.fillStyle =
            yarnPalette[globalYarns.pixel(x + offX, y + offY) - 1];
        } else {
          ctx.fillStyle = yarnPalette[yarnIndex - 1];
        }

        ctx.fillRect(0, 0, 1, 1);
        if (yarnIndex == 0) {
          ctx.fillStyle = TRANSPARENT;
          ctx.fillRect(0, 0, 1, 1);
        }
        ctx.restore();
      }
    }
  }
}

export function drawStitchBlock(
  blockCanvas,
  mode,
  stitchBlock,
  [offX, offY],
  globalYarns,
  globalStitches,
  yarnPalette,
  cellWidth,
  cellHeight,
  lastDrawn = null
) {
  const { width, height } = stitchBlock;

  const ctx = blockCanvas.getContext("2d");
  ctx.lineWidth = 0.03;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let stitchIndex = stitchBlock.pixel(x, y);

      if (lastDrawn == null || lastDrawn.pixel(x, y) != stitchIndex) {
        ctx.save();
        ctx.translate(x * cellWidth, (height - y - 1) * cellHeight);
        ctx.scale(cellWidth, cellHeight);

        let operation = STITCH_MAP[stitchIndex];
        let op;

        if (operation == "TRANSPARENT") {
          op = STITCH_MAP[globalStitches.pixel(x + offX, y + offY)];
        } else {
          op = operation;
        }

        let path = null;

        if (SYMBOL_DATA[op]) {
          if (mode == "operation") {
            ctx.fillStyle = SYMBOL_DATA[op].color;
            path = SYMBOL_DATA[op].path;
            ctx.fillRect(0, 0, 1, 1);
          } else if (mode == "yarn") {
            let yarnIndex = globalYarns.pixel(x + offX, y + offY) - 1;

            ctx.fillStyle =
              yarnIndex >= 0 ? yarnPalette[yarnIndex] : TRANSPARENT;
            path = SYMBOL_DATA[op].path;
          }
          ctx.fillRect(0, 0, 1, 1);

          if (BACK_OPS.has(op)) {
            // Dim any back bed operations
            ctx.fillStyle = DIM;
            ctx.fillRect(0, 0, 1, 1);
          }
        } else {
          ctx.fillStyle = "transparent";
          ctx.fillRect(0, 0, 1, 1);
        }

        if (path) ctx.stroke(path);

        if (operation == "TRANSPARENT") {
          ctx.fillStyle = TRANSPARENT;
          ctx.fillRect(0, 0, 1, 1);
        }

        ctx.restore();
      }
    }
  }
}
