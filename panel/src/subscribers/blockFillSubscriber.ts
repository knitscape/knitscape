import { drawStitchBlock, drawYarnBlock } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
import { bBoxAllBoundaries } from "../charting/helpers";
import type { GlobalState, StateObserver } from "../types";
import type { Bimp } from "../../../shared/Bimp";

export function blockFillSubscriber() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    let { scale, colorMode, yarnPalette, blockEditMode } = state;

    let lastDrawn: Bimp | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let posX: number | null = null;
    let posY: number | null = null;
    let yarnChart: Bimp | null = null;
    let globalStitchChart: Bimp | null = null;

    return {
      syncState(state: GlobalState) {
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

        let offset: [number, number] = [region.pos[0] - bbox.xMin, region.pos[1] - bbox.yMin];

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
            document.getElementById("block-fill-canvas") as HTMLCanvasElement,
            Math.round(currentBlock.width * state.cellWidth),
            Math.round(currentBlock.height * state.cellHeight)
          );

          lastDrawn = null;
        }

        if (lastDrawn != currentBlock) {
          if (state.blockEditMode == "stitch" && yarnChart && globalStitchChart && state.yarnPalette) {
            drawStitchBlock(
              document.getElementById("block-fill-canvas") as HTMLCanvasElement,
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
          } else if (state.blockEditMode == "yarn" && yarnChart && state.yarnPalette) {
            drawYarnBlock(
              document.getElementById("block-fill-canvas") as HTMLCanvasElement,
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
