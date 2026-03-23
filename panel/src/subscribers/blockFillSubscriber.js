import { drawStitchBlock, drawYarnBlock } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
import { bBoxAllBoundaries } from "../charting/helpers";

export function blockFillSubscriber() {
  return ({ state }) => {
    let { scale, colorMode, yarnPalette, blockEditMode } = state;

    let lastDrawn = null;
    let width = null;
    let height = null;
    let posX = null;
    let posY = null;
    let yarnChart = null;
    let globalStitchChart = null;

    return {
      syncState(state) {
        if (state.selectedBoundary == null || state.blockEditMode == null) {
          lastDrawn = null;
          width = null;
          height = null;
          return;
        }

        let region = state.regions[state.selectedBoundary];
        let currentBlock =
          state.blockEditMode == "stitch"
            ? region.stitchBlock
            : region.yarnBlock;

        const bbox = bBoxAllBoundaries(state.boundaries);

        let offset = [region.pos[0] - bbox.xMin, region.pos[1] - bbox.yMin];

        if (
          scale != state.scale ||
          width != currentBlock.width ||
          height != currentBlock.height ||
          colorMode != state.colorMode ||
          yarnPalette != state.yarnPalette ||
          blockEditMode != state.blockEditMode ||
          yarnChart != state.yarnChart ||
          globalStitchChart != state.chart ||
          posX != region.pos[0] ||
          posY != region.pos[1]
        ) {
          width = currentBlock.width;
          height = currentBlock.height;
          scale = state.scale;
          colorMode = state.colorMode;
          yarnPalette = state.yarnPalette;
          blockEditMode = state.blockEditMode;
          posX = region.pos[0];
          posY = region.pos[1];
          yarnChart = state.yarnChart;
          globalStitchChart = state.chart;
          setCanvasSize(
            document.getElementById("block-fill-canvas"),
            Math.round(currentBlock.width * state.cellWidth),
            Math.round(currentBlock.height * state.cellHeight)
          );

          lastDrawn = null;
        }

        if (lastDrawn != currentBlock) {
          if (state.blockEditMode == "stitch") {
            drawStitchBlock(
              document.getElementById("block-fill-canvas"),
              state.colorMode,
              currentBlock,
              offset,
              yarnChart,
              globalStitchChart,
              state.yarnPalette,
              scale,
              scale * state.cellAspect,
              lastDrawn
            );
          } else if (state.blockEditMode == "yarn") {
            drawYarnBlock(
              document.getElementById("block-fill-canvas"),
              currentBlock,
              offset,
              yarnChart,
              state.yarnPalette,
              scale,
              scale * state.cellAspect,
              lastDrawn
            );
          }
          lastDrawn = currentBlock;
        }
      },
    };
  };
}
