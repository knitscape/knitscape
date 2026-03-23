import { GLOBAL_STATE, dispatch } from "../state";
import { pan } from "./chartPanZoom";
import { editingTools } from "../charting/editingTools";
import { stitches } from "../constants";
import { Bimp } from "../lib/Bimp";

function blockPos(e, blockIndex) {
  let bbox = document
    .querySelector(`[data-blockindex="${blockIndex}"]`)
    .getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - bbox.left) / GLOBAL_STATE.cellWidth),
    y: Math.floor((bbox.bottom - e.clientY) / GLOBAL_STATE.cellHeight),
  };
}

export function addBlock() {
  const { stitchSelect, blocks } = GLOBAL_STATE;

  let [bl, tr] = stitchSelect;
  let [width, height] = [tr[0] - bl[0], tr[1] - bl[1]];

  let updated = [...blocks];
  updated.push({
    pos: bl,
    stitchBlock: Bimp.empty(width, height, stitches.TRANSPARENT),
    yarnBlock: Bimp.empty(width, height, 0),
  });

  dispatch(
    {
      stitchSelect: null,
      blocks: updated,
      selectedBlock: updated.length - 1,
      interactionMode: "block",
    },
    true
  );
}

export function removeBlock(blockIndex) {
  const updated = [...GLOBAL_STATE.blocks];
  updated.splice(blockIndex, 1);

  dispatch(
    {
      blocks: updated,
      selectedBlock: null,
    },
    true
  );
}

export function resizeBlock(e, blockIndex, direction) {
  const { blocks, blockEditMode, activeSymbol, activeYarn } = GLOBAL_STATE;

  const blockType = blockEditMode == "stitch" ? "stitchBlock" : "yarnBlock";
  const fill = blockEditMode == "stitch" ? stitches.TRANSPARENT : 0;
  const bmp = blocks[blockIndex][blockType];
  const [x, y] = blocks[blockIndex].pos;

  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true, locked: true });

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { scale, cellAspect, blocks } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / scale);
      let dy = Math.round((startPos.y - e.clientY) / scale / cellAspect);

      if (last[0] == dx && last[1] == dy) return;

      let updatedBlocks = [...blocks];

      if (direction == "up") {
        let newHeight = bmp.height + dy;
        if (newHeight < 1) return;

        updatedBlocks[blockIndex][blockType] = bmp.resize(
          bmp.width,
          newHeight,
          fill
        );
      } else if (direction == "right") {
        let newWidth = bmp.width - dx;
        if (newWidth < 1) return;

        updatedBlocks[blockIndex][blockType] = bmp.resize(
          newWidth,
          bmp.height,
          fill
        );
      } else if (direction == "down") {
        let newHeight = bmp.height - dy;
        if (newHeight < 1) return;

        updatedBlocks[blockIndex][blockType] = bmp
          .vFlip()
          .resize(bmp.width, newHeight, fill)
          .vFlip();
        updatedBlocks[blockIndex].pos = [x, y + dy];
      } else if (direction == "left") {
        let newWidth = bmp.width + dx;
        if (newWidth < 1) return;

        updatedBlocks[blockIndex][blockType] = bmp
          .hFlip()
          .resize(newWidth, bmp.height, fill)
          .hFlip();
        updatedBlocks[blockIndex].pos = [x - dx, y];
      }

      last = [dx, dy];

      dispatch({
        blocks: updatedBlocks,
      });
    }
  }

  function end() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false, locked: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function moveBlock(e, blockIndex) {
  const [x, y] = GLOBAL_STATE.blocks[blockIndex].pos;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { scale, cellAspect, blocks } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / scale);
      let dy = Math.round((startPos.y - e.clientY) / scale / cellAspect);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...blocks];
      updated[blockIndex].pos = [x - dx, y + dy];

      last = [dx, dy];

      dispatch({ blocks: updated });
    }
  }

  function end() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function editBlock(e, blockIndex) {
  if (e.which == 2) {
    pan(e);
    return;
  }

  const { blocks, blockEditMode, activeBlockTool, activeSymbol, activeYarn } =
    GLOBAL_STATE;
  const blockType = blockEditMode == "stitch" ? "stitchBlock" : "yarnBlock";

  let tool = editingTools[activeBlockTool];
  if (!tool) return;

  let pos = blockPos(e, blockIndex);

  dispatch({ transforming: true });
  let startBlock = blocks[blockIndex][blockType];

  let onMove = tool(
    startBlock,
    pos,
    blockEditMode == "stitch" ? activeSymbol : activeYarn
  );
  if (!onMove) return;

  let init = [...blocks];
  init[blockIndex][blockType] = onMove(pos);

  dispatch({
    blocks: init,
  });

  function move(moveEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      let newPos = blockPos(moveEvent, blockIndex);

      if (newPos.x == pos.x && newPos.y == pos.y) return;

      let updated = [...blocks];
      updated[blockIndex][blockType] = onMove(newPos);

      dispatch({
        blocks: updated,
      });
      pos = newPos;
    }
  }

  function end() {
    dispatch({ transforming: false });

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

// export function blockPointerDown(e, blockIndex) {
//   if (e.which == 2) {
//     pan(e);
//     return;
//   }

//   const activeTool = GLOBAL_STATE.activeBlockTool;

//   if (activeTool in editingTools) {
//     editBlock(e, blockIndex, editingTools[activeTool]);
//   }
// }
