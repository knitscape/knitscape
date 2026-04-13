import { GLOBAL_STATE, dispatch } from "../state";
import { stitches } from "@shared/stitches";
import { editingTools } from "../charting/editingTools";
import { pan } from "./chartPanZoom";
import { Bimp } from "@shared/Bimp";
import { pointerPosInElement } from "../utilities/misc";
import type { Vec2, KnitPath } from "../types";

export function pathModePointerDown(e: PointerEvent) {
  if (GLOBAL_STATE.transforming) return;

  const cl = (e.target as HTMLElement).classList;

  if (cl.contains("point")) {
    dragPathPoint(e);
  } else if (cl.contains("path")) {
    dragPathLine(e);
  } else if (cl.contains("background-path-hover")) {
    selectPath(e);
  } else if (GLOBAL_STATE.selectedPath == null) {
    drawPathLine(e);
  } else if (GLOBAL_STATE.selectedPath != null) {
    dispatch({ selectedPath: null, blockEditMode: null }, true);
  }
}

export function pathModeContextMenu(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("point")) {
    removePathPoint(e);
  } else if ((e.target as HTMLElement).classList.contains("path")) {
    addPathPoint(e);
  }
}

export function bringPathToFront(pathIndex: number) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(GLOBAL_STATE.paths.length - 1, 0, path[0]);
  dispatch({
    paths: updatedPaths,
    selectedPath: GLOBAL_STATE.paths.length - 1,
  });
}

export function sendPathToBack(pathIndex: number) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(0, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: 0 });
}

export function lowerPath(pathIndex: number) {
  if (pathIndex <= 0) return;
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(pathIndex - 1, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: pathIndex - 1 });
}

export function raisePath(pathIndex: number) {
  if (pathIndex >= GLOBAL_STATE.paths.length - 1) return;
  const updatedPaths = [...GLOBAL_STATE.paths];
  let path = updatedPaths.splice(pathIndex, 1);
  updatedPaths.splice(pathIndex + 1, 0, path[0]);
  dispatch({ paths: updatedPaths, selectedPath: pathIndex + 1 });
}

function selectPath(e: PointerEvent) {
  const pathIndex = Number((e.target as HTMLElement).dataset.pathindex);
  dispatch({ selectedPath: pathIndex }, true);
}

export function setPathTileMode(pathIndex: number, mode: string) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  updatedPaths[pathIndex].tileMode = mode;
  dispatch({ paths: updatedPaths });
}

export function duplicatePath(pathIndex: number) {
  const updatedPaths = [...GLOBAL_STATE.paths];
  const pathToCopy = updatedPaths[pathIndex];

  const pathCopy: KnitPath = {
    tileMode: pathToCopy.tileMode,
    offset: [...pathToCopy.offset] as Vec2,
    pts: pathToCopy.pts.map((pt) => [...pt] as Vec2),
    yarnBlock: pathToCopy.yarnBlock,
    stitchBlock: pathToCopy.stitchBlock,
  };
  updatedPaths.push(pathCopy);
  dispatch({ paths: updatedPaths });
}

function addPathPoint(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

  const pathIndex = Number((e.target as HTMLElement).dataset.pathindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  const {
    scale,
    cellAspect,
    paths,
    chartPan: { x, y },
  } = GLOBAL_STATE;

  let pt: Vec2 = [
    Math.round((e.clientX - rect.left - x) / scale),
    Math.round((rect.height - (e.clientY - rect.top) - y) / scale / cellAspect),
  ];

  let newPaths = [...paths];
  newPaths[pathIndex].pts.splice(pointIndex + 1, 0, pt);

  dispatch({ paths: newPaths });
}

function removePathPoint(e: MouseEvent) {
  const pathIndex = Number((e.target as HTMLElement).dataset.pathindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.pointindex);

  let newPaths = [...GLOBAL_STATE.paths];

  if (newPaths[pathIndex].pts.length < 3) return;
  newPaths[pathIndex].pts.splice(pointIndex, 1);

  dispatch({ paths: newPaths });
}

export function removePath(index: number) {
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

export function dragPathLine(e: PointerEvent) {
  const pathIndex = Number((e.target as HTMLElement).dataset.pathindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  const path = GLOBAL_STATE.paths[pathIndex];

  const pts = path.pts.map((pt) => [pt[0], pt[1]] as Vec2);
  const [x0, y0] = path.pts[pointIndex];
  const [x1, y1] = path.pts[pointIndex + 1];
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };

  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight, paths } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...paths];

      if (e.shiftKey) {
        updated[pathIndex].pts[pointIndex] = [x0 - dx, y0 + dy];
        updated[pathIndex].pts[pointIndex + 1] = [x1 - dx, y1 + dy];
      } else {
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

export function dragPathPoint(e: PointerEvent) {
  document.body.classList.add("grabbing");

  const pathIndex = Number((e.target as HTMLElement).dataset.pathindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.pointindex);

  let [x, y] = GLOBAL_STATE.paths[pathIndex].pts[pointIndex];

  const startPos = { x: e.clientX, y: e.clientY };

  let last = [0, 0];
  dispatch({ transforming: true });

  function move(e: PointerEvent) {
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

export function resizePathTile(e: PointerEvent, direction: string) {
  const { selectedPath, paths, blockEditMode } = GLOBAL_STATE;
  if (selectedPath === null) return;
  const { stitchBlock, yarnBlock, offset } = paths[selectedPath];

  const bmp = blockEditMode == "stitch" ? stitchBlock : yarnBlock;
  const fillColor = blockEditMode == "stitch" ? stitches.TRANSPARENT : 0;

  const [x, y] = offset;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updatedBlock: Bimp | undefined;
      let updatedOffset: Vec2 = [...offset] as Vec2;

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
        updatedBlock = bmp.vFlip().resize(bmp.width, newHeight, fillColor).vFlip();
        updatedOffset = [x, y + dy];
      } else if (direction == "left") {
        let newWidth = bmp.width + dx;
        if (newWidth < 1) return;
        updatedBlock = bmp.hFlip().resize(newWidth, bmp.height, fillColor).hFlip();
        updatedOffset = [x - dx, y];
      }

      if (!updatedBlock) return;

      last = [dx, dy];

      let updated = [...paths];
      updated[selectedPath!].offset = updatedOffset;

      if (blockEditMode == "stitch") {
        updated[selectedPath!].stitchBlock = updatedBlock;
      } else {
        updated[selectedPath!].yarnBlock = updatedBlock;
      }

      dispatch({ paths: updated });
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

export function movePathTile(e: PointerEvent) {
  const { selectedPath, paths } = GLOBAL_STATE;
  if (selectedPath === null) return;
  const { offset } = paths[selectedPath];

  const [x, y] = offset;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updated = [...paths];

      updated[selectedPath!].offset = [x - dx, y + dy] as Vec2;

      last = [dx, dy];

      dispatch({ paths: updated });
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

function tilePos(e: PointerEvent) {
  let bbox = document
    .getElementById("path-tile-canvas")!
    .getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - bbox.left) / GLOBAL_STATE.cellWidth),
    y: Math.floor((bbox.bottom - e.clientY) / GLOBAL_STATE.cellHeight),
  };
}

export function editPathTile(e: PointerEvent) {
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

  if (selectedPath === null) return;

  const tool = (editingTools as Record<string, Function>)[activeBlockTool];
  if (!tool) return;

  const { stitchBlock, yarnBlock } = paths[selectedPath];
  const stitchEdit = blockEditMode == "stitch";
  let pos = tilePos(e);

  dispatch({ transforming: true });
  let startBlock = stitchEdit ? stitchBlock : yarnBlock;

  let onMove = tool(startBlock, pos, stitchEdit ? activeSymbol : activeYarn);
  if (!onMove) return;

  let updatedPaths = [...paths];

  if (stitchEdit) {
    updatedPaths[selectedPath].stitchBlock = onMove(pos);
  } else {
    updatedPaths[selectedPath].yarnBlock = onMove(pos);
  }
  dispatch({ paths: updatedPaths });

  function move(moveEvent: PointerEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      let newPos = tilePos(moveEvent);

      if (newPos.x == pos.x && newPos.y == pos.y) return;

      let updatedPaths = [...paths];

      if (stitchEdit) {
        updatedPaths[selectedPath!].stitchBlock = onMove(newPos);
      } else {
        updatedPaths[selectedPath!].yarnBlock = onMove(newPos);
      }
      dispatch({ paths: updatedPaths });

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

export function drawPathLine(e: PointerEvent) {
  const { transforming, paths } = GLOBAL_STATE;
  if (transforming) return;

  const startPos = { x: e.clientX, y: e.clientY };
  const startPoint = closestPointToMouse(e);
  document.body.classList.add("grabbing");

  const updatedPaths = [...paths];
  updatedPaths.push({
    pts: [[...startPoint] as Vec2, [...startPoint] as Vec2],
    offset: [0, 0] as Vec2,
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

  function closestPointToMouse(e: PointerEvent): Vec2 {
    const { cellWidth, cellHeight, bbox } = GLOBAL_STATE;

    let [x, y] = pointerPosInElement(
      e,
      document.getElementById("chart-canvas")!
    );

    return [
      Math.round(x / cellWidth) + bbox.xMin,
      Math.round(y / cellHeight) + bbox.yMin,
    ];
  }

  function move(e: PointerEvent) {
    const { paths } = GLOBAL_STATE;

    const updatedPaths = [...paths];
    const pathIndex = paths.length - 1;
    const ptIndex = paths[pathIndex].pts.length - 1;

    updatedPaths[pathIndex].pts[ptIndex] = closestPointToMouse(e);

    dispatch({ paths: updatedPaths });
  }

  function clickToAddPoint(e: MouseEvent) {
    const { paths } = GLOBAL_STATE;
    const updatedPaths = [...paths];
    updatedPaths[paths.length - 1].pts.push(closestPointToMouse(e as unknown as PointerEvent));
    dispatch({ paths: updatedPaths });
  }

  function escapePath(e: KeyboardEvent) {
    if (e.key == "Escape") {
      const updatedPaths = [...GLOBAL_STATE.paths];

      if (updatedPaths.at(-1)!.pts.length > 2) {
        updatedPaths[updatedPaths.length - 1].pts.pop();
        dispatch({ paths: updatedPaths });
      } else {
        updatedPaths.pop();
        dispatch({ paths: updatedPaths, selectedPath: null });
      }
      end();
    }
  }

  function checkMode(e: PointerEvent) {
    const dx = startPos.x - e.clientX;
    const dy = startPos.y - e.clientY;

    if (dx < 10 && dy < 10) {
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
