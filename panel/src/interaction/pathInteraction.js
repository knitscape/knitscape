import { GLOBAL_STATE, dispatch } from "../state";
import { stitches } from "../constants";
import { editingTools } from "../charting/editingTools";
import { pan } from "./chartPanZoom";
import { Bimp } from "../lib/Bimp";
import { pointerPosInElement } from "../utilities/misc";

export function pathModePointerDown(e) {
  if (GLOBAL_STATE.transforming) return;

  const cl = e.target.classList;

  if (cl.contains("point")) {
    // point is only shown if the path is selected
    dragPathPoint(e);
  } else if (cl.contains("path")) {
    // path is only shown if the path is selected
    dragPathLine(e);
  } else if (cl.contains("background-path-hover")) {
    selectPath(e);
  } else if (GLOBAL_STATE.selectedPath == null) {
    drawPathLine(e);
  } else if (GLOBAL_STATE.selectedPath != null) {
    dispatch({ selectedPath: null, blockEditMode: null }, true);
  }
}

export function pathModeContextMenu(e) {
  if (e.target.classList.contains("point")) {
    removePathPoint(e);
  } else if (e.target.classList.contains("path")) {
    addPathPoint(e);
  }
}

export function bringPathToFront(pathIndex) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(GLOBAL_STATE.paths.length - 1, 0, path[0]);
  dispatch({
    paths: updatedPaths,
    selectedPath: GLOBAL_STATE.paths.length - 1,
  });
}

export function sendPathToBack(pathIndex) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(0, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: 0 });
}

export function lowerPath(pathIndex) {
  if (pathIndex <= 0) return;
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(pathIndex - 1, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: pathIndex - 1 });
}

export function raisePath(pathIndex) {
  if (pathIndex >= GLOBAL_STATE.paths.length - 1) return;
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(pathIndex + 1, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: pathIndex + 1 });
}

function selectPath(e) {
  const pathIndex = Number(e.target.dataset.pathindex);

  dispatch({ selectedPath: pathIndex }, true);
}

export function setPathTileMode(pathIndex, mode) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  updatedPaths[pathIndex].tileMode = mode;
  dispatch({ paths: updatedPaths });
}

export function duplicatePath(pathIndex) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  const pathToCopy = updatedPaths[pathIndex];

  const pathCopy = {
    tileMode: pathToCopy.tileMode,
    offset: [...pathToCopy.offset],
    pts: pathToCopy.pts.map((pt) => [...pt]),
    yarnBlock: pathToCopy.yarnBlock,
    stitchBlock: pathToCopy.stitchBlock,
  };
  updatedPaths.push(pathCopy);
  dispatch({ paths: updatedPaths });
}

function addPathPoint(e) {
  const rect = e.currentTarget.getBoundingClientRect();

  const pathIndex = Number(e.target.dataset.pathindex);
  const pointIndex = Number(e.target.dataset.index);

  const {
    scale,
    cellAspect,
    paths,
    chartPan: { x, y },
  } = GLOBAL_STATE;

  let pt = [
    Math.round((e.clientX - rect.left - x) / scale),
    Math.round((rect.height - (e.clientY - rect.top) - y) / scale / cellAspect),
  ];

  // TODO: Only add a point if it's more than a cell away from the nearest point?

  let newPaths = [...paths];
  newPaths[pathIndex].pts.splice(pointIndex + 1, 0, pt);

  dispatch({ paths: newPaths });
}

function removePathPoint(e) {
  const pathIndex = Number(e.target.dataset.pathindex);
  const pointIndex = Number(e.target.dataset.pointindex);

  let newPaths = [...GLOBAL_STATE.paths];

  if (newPaths[pathIndex].pts.length < 3) return;
  newPaths[pathIndex].pts.splice(pointIndex, 1);

  dispatch({ paths: newPaths });
}

export function removePath(index) {
  const { paths } = GLOBAL_STATE;

  dispatch(
    {
      paths: paths.slice(0, index).concat(paths.slice(index + 1)),
      selectedPath: null,
      blockEditMode: null,
    },
    true
  );
}

export function dragPathLine(e) {
  const pathIndex = Number(e.target.dataset.pathindex);
  const pointIndex = Number(e.target.dataset.index);

  const path = GLOBAL_STATE.paths[pathIndex];

  const pts = path.pts.map((pt) => [pt[0], pt[1]]);
  const [x0, y0] = path.pts[pointIndex];
  const [x1, y1] = path.pts[pointIndex + 1];
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };

  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight, paths } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...paths];

      if (e.shiftKey) {
        // If shift is pressed, just drag the segment
        updated[pathIndex].pts[pointIndex] = [x0 - dx, y0 + dy];
        updated[pathIndex].pts[pointIndex + 1] = [x1 - dx, y1 + dy];
      } else {
        // Otherwise drag the whole path
        for (let i = 0; i < updated[pathIndex].pts.length; i++) {
          updated[pathIndex].pts[i] = [pts[i][0] - dx, pts[i][1] + dy];
        }
      }

      last = [dx, dy];

      dispatch({
        paths: updated,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function dragPathPoint(e) {
  document.body.classList.add("grabbing");

  const pathIndex = Number(e.target.dataset.pathindex);
  const pointIndex = Number(e.target.dataset.pointindex);

  let [x, y] = GLOBAL_STATE.paths[pathIndex].pts[pointIndex];

  const startPos = { x: e.clientX, y: e.clientY };

  let last = [0, 0];
  dispatch({ transforming: true });

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight, paths } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...paths];

      updated[pathIndex].pts[pointIndex] = [x - dx, y + dy];
      last = [dx, dy];

      dispatch({
        paths: updated,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function resizePathTile(e, direction) {
  const { selectedPath, paths, blockEditMode } = GLOBAL_STATE;
  const { stitchBlock, yarnBlock, offset } = paths[selectedPath];

  const bmp = blockEditMode == "stitch" ? stitchBlock : yarnBlock;
  const fillColor = blockEditMode == "stitch" ? stitches.TRANSPARENT : 0;

  const [x, y] = offset;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updatedBlock;
      let updatedOffset = [...offset];

      if (direction == "up") {
        let newHeight = bmp.height + dy;
        if (newHeight < 1) return;

        updatedBlock = bmp.resize(bmp.width, newHeight, fillColor);
      } else if (direction == "right") {
        let newWidth = bmp.width - dx;
        if (newWidth < 1) return;

        updatedBlock = bmp.resize(newWidth, bmp.height, fillColor);
      } else if (direction == "down") {
        let newHeight = bmp.height - dy;
        if (newHeight < 1) return;

        updatedBlock = bmp
          .vFlip()
          .resize(bmp.width, newHeight, fillColor)
          .vFlip();
        updatedOffset = [x, y + dy];
      } else if (direction == "left") {
        let newWidth = bmp.width + dx;
        if (newWidth < 1) return;

        updatedBlock = bmp
          .hFlip()
          .resize(newWidth, bmp.height, fillColor)
          .hFlip();
        updatedOffset = [x - dx, y];
      }

      last = [dx, dy];

      let updated = [...paths];
      updated[selectedPath].offset = updatedOffset;

      // update either the stitch or yarn block
      if (blockEditMode == "stitch") {
        updated[selectedPath].stitchBlock = updatedBlock;
      } else {
        updated[selectedPath].yarnBlock = updatedBlock;
      }

      dispatch({
        paths: updated,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function movePathTile(e) {
  const { selectedPath, paths } = GLOBAL_STATE;
  const { offset } = paths[selectedPath];

  const [x, y] = offset;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...paths];

      paths[selectedPath].offset = [x - dx, y + dy];

      last = [dx, dy];

      dispatch({
        paths: updated,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

function tilePos(e) {
  let bbox = document
    .getElementById("path-tile-canvas")
    .getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - bbox.left) / GLOBAL_STATE.cellWidth),
    y: Math.floor((bbox.bottom - e.clientY) / GLOBAL_STATE.cellHeight),
  };
}

export function editPathTile(e) {
  if (e.which == 2) {
    pan(e);
    return;
  }
  const {
    selectedPath,
    paths,
    blockEditMode,
    activeBlockTool,
    activeSymbol,
    activeYarn,
  } = GLOBAL_STATE;

  let tool = editingTools[activeBlockTool];
  if (!tool) return;

  const { stitchBlock, yarnBlock } = paths[selectedPath];
  const stitchEdit = blockEditMode == "stitch";
  let pos = tilePos(e);

  dispatch({ transforming: true });
  let startBlock = stitchEdit ? stitchBlock : yarnBlock;

  // tool onMove is not called unless pointer moves into another cell in the chart
  let onMove = tool(startBlock, pos, stitchEdit ? activeSymbol : activeYarn);
  if (!onMove) return;

  let updatedPaths = [...paths];

  if (stitchEdit) {
    updatedPaths[selectedPath].stitchBlock = onMove(pos);
  } else {
    updatedPaths[selectedPath].yarnBlock = onMove(pos);
  }
  dispatch({
    paths: updatedPaths,
  });

  function move(moveEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      let newPos = tilePos(moveEvent);

      if (newPos.x == pos.x && newPos.y == pos.y) return;

      let updatedPaths = [...paths];

      if (stitchEdit) {
        updatedPaths[selectedPath].stitchBlock = onMove(newPos);
      } else {
        updatedPaths[selectedPath].yarnBlock = onMove(newPos);
      }
      dispatch({
        paths: updatedPaths,
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

export function drawPathLine(e) {
  const { transforming, paths } = GLOBAL_STATE;
  if (transforming) return;

  const startPos = { x: e.clientX, y: e.clientY };
  const startPoint = closestPointToMouse(e);
  document.body.classList.add("grabbing");

  const updatedPaths = [...paths];
  updatedPaths.push({
    pts: [[...startPoint], [...startPoint]],
    offset: [0, 0],
    yarnBlock: new Bimp(1, 1, [0]),
    stitchBlock: new Bimp(1, 1, [stitches.TRANSPARENT]),
    tileMode: "overlap",
  });

  dispatch({
    transforming: true,
    paths: updatedPaths,
    selectedPath: updatedPaths.length - 1,
    interactionMode: "path",
    stitchSelect: null,
    selectedBlock: null,
    blockEditMode: null,
  });

  function closestPointToMouse(e) {
    const { cellWidth, cellHeight, bbox } = GLOBAL_STATE;

    let [x, y] = pointerPosInElement(
      e,
      document.getElementById("chart-canvas")
    );

    return [
      Math.round(x / cellWidth) + bbox.xMin,
      Math.round(y / cellHeight) + bbox.yMin,
    ];
  }

  function move(e) {
    const { paths } = GLOBAL_STATE;

    const updatedPaths = [...paths];
    const pathIndex = paths.length - 1;
    const ptIndex = paths[pathIndex].pts.length - 1;

    updatedPaths[pathIndex].pts[ptIndex] = closestPointToMouse(e);

    dispatch({ paths: updatedPaths });
  }

  function clickToAddPoint(e) {
    const { paths } = GLOBAL_STATE;
    const updatedPaths = [...paths];
    updatedPaths[paths.length - 1].pts.push(closestPointToMouse(e));
    dispatch({ paths: updatedPaths });
  }

  function escapePath(e) {
    if (e.key == "Escape") {
      const updatedPaths = [...GLOBAL_STATE.paths];

      if (updatedPaths.at(-1).pts.length > 2) {
        updatedPaths[updatedPaths.length - 1].pts.pop();
        dispatch({ paths: updatedPaths });
      } else {
        updatedPaths.pop();
        dispatch({ paths: updatedPaths, selectedPath: null });
      }
      end();
    }
  }

  function checkMode(e) {
    const dx = startPos.x - e.clientX;
    const dy = startPos.y - e.clientY;

    if (dx < 10 && dy < 10) {
      // click to add points mode

      const updatedPaths = [...GLOBAL_STATE.paths];
      updatedPaths[updatedPaths.length - 1].pts.pop();
      dispatch({ paths: updatedPaths });

      window.addEventListener("click", clickToAddPoint);
      window.removeEventListener("pointerup", checkMode);
    } else {
      window.removeEventListener("pointerup", checkMode);
      end();
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    window.removeEventListener("click", clickToAddPoint);
    window.removeEventListener("keydown", escapePath);

    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", checkMode);
  window.addEventListener("pointerleave", end);
  window.addEventListener("keydown", escapePath);
}
