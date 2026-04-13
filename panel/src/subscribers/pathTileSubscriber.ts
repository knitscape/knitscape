import { drawStitchBlock, drawYarnBlock } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
import { bBoxAllBoundaries } from "../charting/helpers";
import type { GlobalState, StateObserver } from "../types";
import type { Bimp } from "@shared/Bimp";

export function pathTileSubscriber() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    let { scale, colorMode, yarnPalette, blockEditMode } = state;

    let lastDrawn: Bimp | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let offX: number | null = null;
    let offY: number | null = null;
    let yarnChart: Bimp | null = null;
    let globalStitchChart: Bimp | null = null;

    return {
      syncState(state: GlobalState) {
        if (state.selectedPath == null || state.blockEditMode == null) {
          lastDrawn = null;
          width = null;
          height = null;
          return;
        }

        let canvas = document.getElementById("path-tile-canvas") as HTMLCanvasElement | null;
        if (!canvas) return;

        let path = state.paths[state.selectedPath];
        let currentBlock =
          state.blockEditMode == "stitch" ? path.stitchBlock : path.yarnBlock;

        const bbox = bBoxAllBoundaries(state.boundaries);

        let globalBlockOffset: [number, number] = [
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
          if (state.blockEditMode == "stitch" && yarnChart && globalStitchChart && state.yarnPalette) {
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
          } else if (state.blockEditMode == "yarn" && yarnChart && state.yarnPalette) {
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
