import { drawStitchBlock, drawYarnBlock } from "../charting/drawing";
import { setCanvasSize } from "../utilities/misc";
import { bBoxAllBoundaries } from "../charting/helpers";

function clearLastDrawn(blocks) {
  return blocks.map((block) => {
    return { bitmap: null, pos: [...block.pos], width: null, height: null };
  });
}

function rescaleAll(blocks, editMode, cellWidth, cellHeight) {
  blocks.forEach((block, blockIndex) => {
    let bitmap = editMode == "stitch" ? block.stitchBlock : block.yarnBlock;
    setCanvasSize(
      document.querySelector(`[data-blockindex="${blockIndex}"]`),
      Math.round(bitmap.width * cellWidth),
      Math.round(bitmap.height * cellHeight)
    );
  });
}

export function blockSubscriber() {
  return ({ state }) => {
    let { scale, blocks, blockEditMode, colorMode, interactionMode } = state;

    let lastDrawn = clearLastDrawn(blocks);

    return {
      syncState(state) {
        if (
          Object.keys(lastDrawn).length != Object.keys(state.blocks).length ||
          scale != state.scale ||
          blockEditMode != state.blockEditMode ||
          blocks != state.blocks ||
          colorMode != state.colorMode ||
          interactionMode != state.interactionMode
        ) {
          scale = state.scale;
          blockEditMode = state.blockEditMode;
          blocks = state.blocks;
          colorMode = state.colorMode;
          interactionMode = state.interactionMode;

          if (interactionMode != "block") return;

          rescaleAll(
            state.blocks,
            state.blockEditMode,
            state.cellWidth,
            state.cellHeight
          );
          lastDrawn = clearLastDrawn(state.blocks);
        }

        state.blocks.forEach((block, blockIndex) => {
          let bitmap =
            blockEditMode == "stitch" ? block.stitchBlock : block.yarnBlock;

          if (
            lastDrawn[blockIndex].width != bitmap.width ||
            lastDrawn[blockIndex].height != bitmap.height
          ) {
            setCanvasSize(
              document.querySelector(`[data-blockindex="${blockIndex}"]`),
              Math.round(bitmap.width * state.cellWidth),
              Math.round(bitmap.height * state.cellHeight)
            );

            lastDrawn[blockIndex].width = bitmap.width;
            lastDrawn[blockIndex].height = bitmap.height;
          }

          if (lastDrawn[blockIndex].bitmap != bitmap) {
            const bbox = bBoxAllBoundaries(state.boundaries);

            let offset = [block.pos[0] - bbox.xMin, block.pos[1] - bbox.yMin];

            if (blockEditMode == "stitch") {
              drawStitchBlock(
                document.querySelector(`[data-blockindex="${blockIndex}"]`),
                state.colorMode,
                bitmap,
                offset,
                state.yarnChart,
                state.chart,
                state.yarnPalette,
                scale,
                scale * state.cellAspect,
                lastDrawn[blockIndex].bitmap
              );
            } else if (blockEditMode == "yarn") {
              drawYarnBlock(
                document.querySelector(`[data-blockindex="${blockIndex}"]`),
                bitmap,
                offset,
                state.yarnChart,
                state.yarnPalette,
                scale,
                scale * state.cellAspect,
                lastDrawn[blockIndex].bitmap
              );
            }
            lastDrawn[blockIndex].bitmap = bitmap;
          }
        });
      },
    };
  };
}
