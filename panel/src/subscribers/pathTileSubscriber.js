import { drawStitchBlock, drawYarnBlock } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
import { bBoxAllBoundaries } from "../charting/helpers";

export function pathTileSubscriber() {
  return ({ state }) => {
    let { scale, colorMode, yarnPalette, blockEditMode } = state;

    let lastDrawn = null;
    let width = null;
    let height = null;
    let offX = null;
    let offY = null;
    let yarnChart = null;
    let globalStitchChart = null;

    return {
      syncState(state) {
        if (state.selectedPath == null || state.blockEditMode == null) {
          lastDrawn = null;
          width = null;
          height = null;
          return;
        }

        let canvas = document.getElementById("path-tile-canvas");
        if (!canvas) return;

        let path = state.paths[state.selectedPath];
        let currentBlock =
          state.blockEditMode == "stitch" ? path.stitchBlock : path.yarnBlock;

        const bbox = bBoxAllBoundaries(state.boundaries);

        let globalBlockOffset = [
          path.pts[0][0] + path.offset[0] - bbox.xMin,
          path.pts[0][1] + path.offset[1] - bbox.yMin,
        ];

        if (
          scale != state.scale ||
          width != currentBlock.width ||
          height != currentBlock.height ||
          colorMode != state.colorMode ||
          yarnPalette != state.yarnPalette ||
          blockEditMode != state.blockEditMode ||
          yarnChart != state.yarnChart ||
          globalStitchChart != state.chart ||
          offX != path.offset[0] ||
          offY != path.offset[1]
        ) {
          width = currentBlock.width;
          height = currentBlock.height;
          scale = state.scale;
          colorMode = state.colorMode;
          yarnPalette = state.yarnPalette;
          blockEditMode = state.blockEditMode;
          offX = path.offset[0];
          offY = path.offset[1];
          yarnChart = state.yarnChart;
          globalStitchChart = state.chart;
          setCanvasSize(
            canvas,
            Math.round(currentBlock.width * state.cellWidth),
            Math.round(currentBlock.height * state.cellHeight)
          );

          lastDrawn = null;
        }

        if (lastDrawn != currentBlock) {
          if (state.blockEditMode == "stitch") {
            drawStitchBlock(
              canvas,
              state.colorMode,
              currentBlock,
              globalBlockOffset,
              yarnChart,
              globalStitchChart,
              state.yarnPalette,
              scale,
              scale * state.cellAspect,
              lastDrawn
            );
          } else if (state.blockEditMode == "yarn") {
            drawYarnBlock(
              canvas,
              currentBlock,
              globalBlockOffset,
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
