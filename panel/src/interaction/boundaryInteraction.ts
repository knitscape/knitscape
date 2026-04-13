import { GLOBAL_STATE, dispatch } from "../state";
import { stitches } from "@shared/stitches";
import { editingTools } from "../charting/editingTools";
import { pan } from "./chartPanZoom";
import { selectBox } from "./select";
import { Bimp } from "@shared/Bimp";
import type { Vec2, Region } from "../types";

export function boundaryModePointerDown(e: PointerEvent) {
  const cl = (e.target as HTMLElement).classList;

  if (cl.contains("point")) {
    dragBoundaryPoint(e);
  } else if (cl.contains("path")) {
    dragBoundaryLine(e);
  } else if (cl.contains("boundary")) {
    if (e.shiftKey) {
      if (e.shiftKey) {
        dispatch({ selectedBoundary: null });
        selectBox(e);
      }
    } else if (
      GLOBAL_STATE.selectedBoundary == Number((e.target as HTMLElement).dataset.boundaryindex)
    ) {
      dragBoundary(e);
    } else {
      beginDrag(e);
    }
  } else {
    beginDrag(e);
  }
}

export function bringBoundaryToFront(boundaryIndex: number) {
  const updatedBoundaries = [...GLOBAL_STATE.boundaries];
  const updatedRegions = [...GLOBAL_STATE.regions];

  let boundary = updatedBoundaries.splice(boundaryIndex, 1);
  let region = updatedRegions.splice(boundaryIndex, 1);

  updatedBoundaries.splice(GLOBAL_STATE.boundaries.length - 1, 0, boundary[0]);
  updatedRegions.splice(GLOBAL_STATE.boundaries.length - 1, 0, region[0]);

  dispatch({
    boundaries: updatedBoundaries,
    regions: updatedRegions,
    selectedBoundary: GLOBAL_STATE.boundaries.length - 1,
  });
}

export function sendBoundaryToBack(boundaryIndex: number) {
  const updatedBoundaries = [...GLOBAL_STATE.boundaries];
  const updatedRegions = [...GLOBAL_STATE.regions];

  let boundary = updatedBoundaries.splice(boundaryIndex, 1);
  let region = updatedRegions.splice(boundaryIndex, 1);

  updatedBoundaries.splice(0, 0, boundary[0]);
  updatedRegions.splice(0, 0, region[0]);

  dispatch({
    boundaries: updatedBoundaries,
    regions: updatedRegions,
    selectedBoundary: 0,
  });
}

export function lowerBoundary(boundaryIndex: number) {
  if (boundaryIndex <= 0) return;
  const updatedBoundaries = [...GLOBAL_STATE.boundaries];
  const updatedRegions = [...GLOBAL_STATE.regions];

  let boundary = updatedBoundaries.splice(boundaryIndex, 1);
  let region = updatedRegions.splice(boundaryIndex, 1);

  updatedBoundaries.splice(boundaryIndex - 1, 0, boundary[0]);
  updatedRegions.splice(boundaryIndex - 1, 0, region[0]);

  dispatch({
    boundaries: updatedBoundaries,
    regions: updatedRegions,
    selectedBoundary: boundaryIndex - 1,
  });
}

export function raiseBoundary(boundaryIndex: number) {
  if (boundaryIndex >= GLOBAL_STATE.boundaries.length - 1) return;
  const updatedBoundaries = [...GLOBAL_STATE.boundaries];
  const updatedRegions = [...GLOBAL_STATE.regions];

  let boundary = updatedBoundaries.splice(boundaryIndex, 1);
  let region = updatedRegions.splice(boundaryIndex, 1);

  updatedBoundaries.splice(boundaryIndex + 1, 0, boundary[0]);
  updatedRegions.splice(boundaryIndex + 1, 0, region[0]);

  dispatch({
    boundaries: updatedBoundaries,
    regions: updatedRegions,
    selectedBoundary: boundaryIndex + 1,
  });
}

export function boundaryModeContextMenu(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("point")) {
    deletePoint(e);
  } else if ((e.target as HTMLElement).classList.contains("path")) {
    addPoint(e);
  }
}

export function setBoundaryJoinMode(boundaryIndex: number, mode: string) {
  const updatedRegions = [...GLOBAL_STATE.regions];
  updatedRegions[boundaryIndex].joinMode = mode;
  dispatch({ regions: updatedRegions });
}

export function setBoundaryShaping(boundaryIndex: number, shaping: number) {
  const updatedRegions = [...GLOBAL_STATE.regions];
  updatedRegions[boundaryIndex].shaping = shaping;
  dispatch({ regions: updatedRegions });
}

export function removeBoundary(index: number) {
  const { boundaries, regions } = GLOBAL_STATE;

  if (boundaries.length == 1) {
    alert("You need at least one boundary!");
    return;
  }

  dispatch(
    {
      boundaries: boundaries
        .slice(0, index)
        .concat(boundaries.slice(index + 1)),
      regions: regions.slice(0, index).concat(regions.slice(index + 1)),
      selectedBoundary: null,
      blockEditMode: null,
    },
    true
  );
}

export function addBoundary() {
  const { boundaries, regions, stitchSelect } = GLOBAL_STATE;
  if (!stitchSelect) return;
  const [[xMin, yMin], [xMax, yMax]] = stitchSelect;

  boundaries.push([
    [xMin, yMin],
    [xMin, yMax],
    [xMax, yMax],
    [xMax, yMin],
  ]);

  regions.push({
    pos: [
      xMin + Math.floor((xMax - xMin) / 2),
      yMin + Math.floor((yMax - yMin) / 2),
    ] as Vec2,
    shaping: 0,
    joinMode: "none",
    yarnBlock: new Bimp(1, 1, [0]),
    stitchBlock: new Bimp(1, 1, [stitches.TRANSPARENT]),
  });

  dispatch({
    boundaries,
    regions,
    selectedBoundary: boundaries.length - 1,
    stitchSelect: null,
    interactionMode: "boundary",
    selectedBlock: null,
  });
}

export function duplicateBoundary(boundaryindex: number) {
  const updatedBoundaries = [...GLOBAL_STATE.boundaries];
  const updatedRegions = [...GLOBAL_STATE.regions];

  const regionToCopy = updatedRegions[boundaryindex];

  const regionCopy: Region = {
    shaping: regionToCopy.shaping,
    joinMode: regionToCopy.joinMode,
    pos: [...regionToCopy.pos] as Vec2,
    yarnBlock: regionToCopy.yarnBlock,
    stitchBlock: regionToCopy.stitchBlock,
  };

  const boundaryCopy = [...updatedBoundaries[boundaryindex]] as typeof updatedBoundaries[number];

  updatedRegions.push(regionCopy);
  updatedBoundaries.push(boundaryCopy);
  dispatch({
    regions: updatedRegions,
    boundaries: updatedBoundaries,
    selectedBoundary: updatedBoundaries.length - 1,
  });
}

function addPoint(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  const {
    scale,
    cellAspect,
    boundaries,
    chartPan: { x, y },
  } = GLOBAL_STATE;

  let pt: Vec2 = [
    Math.round((e.clientX - rect.left - x) / scale),
    Math.round((rect.height - (e.clientY - rect.top) - y) / scale / cellAspect),
  ];

  let newBounds = [...boundaries];
  newBounds[boundaryIndex].splice(pointIndex + 1, 0, pt);

  dispatch({ boundaries: newBounds });
}

function deletePoint(e: MouseEvent) {
  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  let newBounds = [...GLOBAL_STATE.boundaries];
  newBounds[boundaryIndex].splice(pointIndex, 1);

  dispatch({
    boundaries: newBounds,
  });
}

function dragBoundaryPoint(e: PointerEvent) {
  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  const [x, y] = GLOBAL_STATE.boundaries[boundaryIndex][pointIndex];
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { scale, cellAspect, boundaries } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / scale);
      let dy = Math.round((startPos.y - e.clientY) / scale / cellAspect);

      if (last[0] == dx && last[1] == dy) return;

      let newBounds = [...boundaries];

      newBounds[boundaryIndex][pointIndex] = [x - dx, y + dy];

      last = [dx, dy];

      dispatch({
        boundaries: newBounds,
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

function dragBoundaryLine(e: PointerEvent) {
  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);
  const pointIndex = Number((e.target as HTMLElement).dataset.index);

  const boundary = GLOBAL_STATE.boundaries[boundaryIndex];

  const [x0, y0] = boundary[pointIndex];
  const [x1, y1] = boundary[(pointIndex + 1) % boundary.length];
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };

  dispatch({ transforming: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight, boundaries } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let newBounds = [...boundaries];

      newBounds[boundaryIndex][pointIndex] = [x0 - dx, y0 + dy];
      newBounds[boundaryIndex][(pointIndex + 1) % boundary.length] = [
        x1 - dx,
        y1 + dy,
      ];

      last = [dx, dy];

      dispatch({
        boundaries: newBounds,
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

function dragBoundary(e: PointerEvent) {
  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);

  if (GLOBAL_STATE.selectedBoundary != boundaryIndex) return;

  const startBounds = GLOBAL_STATE.boundaries[boundaryIndex];
  const startPos = { x: e.clientX, y: e.clientY };

  const [fillX, fillY] = GLOBAL_STATE.regions[boundaryIndex].pos;

  let last = [0, 0];
  dispatch({ transforming: true });
  document.body.classList.add("moving");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { scale, cellAspect, boundaries } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / scale);
      let dy = Math.round((startPos.y - e.clientY) / scale / cellAspect);

      if (last[0] == dx && last[1] == dy) return;

      let newBounds = [...boundaries];
      newBounds[boundaryIndex] = startBounds.map(([x, y]) => [x - dx, y + dy] as Vec2);
      last = [dx, dy];

      let updatedRegions = [...GLOBAL_STATE.regions];
      updatedRegions[boundaryIndex].pos = [fillX - dx, fillY + dy] as Vec2;
      dispatch({
        boundaries: newBounds,
        regions: updatedRegions,
      });
    }
  }

  function end() {
    document.body.classList.remove("moving");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

function selectBoundary(e: PointerEvent) {
  const boundaryIndex = Number((e.target as HTMLElement).dataset.boundaryindex);

  dispatch({ selectedBoundary: boundaryIndex, stitchSelect: null }, true);
}

export function resizeFillBlock(e: PointerEvent, direction: string) {
  const { selectedBoundary, regions, blockEditMode } = GLOBAL_STATE;
  if (selectedBoundary === null) return;
  const { stitchBlock, yarnBlock, pos } = regions[selectedBoundary];

  const bmp = blockEditMode == "stitch" ? stitchBlock : yarnBlock;
  const [x, y] = pos;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true, locked: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { scale, cellAspect } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / scale);
      let dy = Math.round((startPos.y - e.clientY) / scale / cellAspect);

      if (last[0] == dx && last[1] == dy) return;

      let updatedBlock: Bimp | undefined;
      let updatedPos: Vec2 = [...pos] as Vec2;

      let fill: number;
      if (blockEditMode == "stitch") {
        fill = regions.length == 1 ? stitches.KNIT : stitches.TRANSPARENT;
      } else {
        fill = 0;
      }

      if (direction == "up") {
        let newHeight = bmp.height + dy;
        if (newHeight < 1) return;

        updatedBlock = bmp.resize(bmp.width, newHeight, fill);
      } else if (direction == "right") {
        let newWidth = bmp.width - dx;
        if (newWidth < 1) return;

        updatedBlock = bmp.resize(newWidth, bmp.height, fill);
      } else if (direction == "down") {
        let newHeight = bmp.height - dy;
        if (newHeight < 1) return;

        updatedBlock = bmp.vFlip().resize(bmp.width, newHeight, fill).vFlip();
        updatedPos = [x, y + dy];
      } else if (direction == "left") {
        let newWidth = bmp.width + dx;
        if (newWidth < 1) return;

        updatedBlock = bmp.hFlip().resize(newWidth, bmp.height, fill).hFlip();
        updatedPos = [x - dx, y];
      }

      if (!updatedBlock) return;

      last = [dx, dy];

      let updatedRegions = [...regions];
      updatedRegions[selectedBoundary!].pos = updatedPos;

      if (blockEditMode == "stitch") {
        updatedRegions[selectedBoundary!].stitchBlock = updatedBlock;
      } else {
        updatedRegions[selectedBoundary!].yarnBlock = updatedBlock;
      }

      dispatch({
        regions: updatedRegions,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false, locked: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

function beginDrag(e: PointerEvent) {
  const startPos = { x: e.clientX, y: e.clientY };

  if (e.shiftKey) {
    dispatch({ selectedBoundary: null });
    selectBox(e);
  }

  let moved = false;

  dispatch({ transforming: true });

  function move(moveEvent: PointerEvent) {
    let dx = Math.abs(startPos.x - moveEvent.clientX);
    let dy = Math.abs(startPos.y - moveEvent.clientY);

    if (moveEvent.buttons == 0) {
      end(moveEvent);
    } else if (!moved) {
      if (dx > 5 || dy > 5) {
        moved = true;
      }
    } else {
      dispatch({ selectedBoundary: null });
      end(moveEvent);
      selectBox(moveEvent);
    }
  }

  function end(e: PointerEvent) {
    if (!moved && (e.target as HTMLElement).classList.contains("boundary")) {
      selectBoundary(e);
    }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

function blockPos(e: PointerEvent) {
  let bbox = document
    .getElementById("block-fill-canvas")!
    .getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - bbox.left) / GLOBAL_STATE.cellWidth),
    y: Math.floor((bbox.bottom - e.clientY) / GLOBAL_STATE.cellHeight),
  };
}

export function moveBoundaryFill(e: PointerEvent) {
  const { selectedBoundary, regions } = GLOBAL_STATE;
  if (selectedBoundary === null) return;
  const { pos } = regions[selectedBoundary];

  const [x, y] = pos;
  let last = [0, 0];

  const startPos = { x: e.clientX, y: e.clientY };
  dispatch({ transforming: true, locked: true });
  document.body.classList.add("grabbing");

  function move(e: PointerEvent) {
    if (e.buttons == 0) {
      end();
    } else {
      const { cellWidth, cellHeight } = GLOBAL_STATE;

      let dx = Math.round((startPos.x - e.clientX) / cellWidth);
      let dy = Math.round((startPos.y - e.clientY) / cellHeight);

      if (last[0] == dx && last[1] == dy) return;

      let updatedRegions = [...regions];

      updatedRegions[selectedBoundary!].pos = [x - dx, y + dy] as Vec2;

      last = [dx, dy];

      dispatch({
        regions: updatedRegions,
      });
    }
  }

  function end() {
    document.body.classList.remove("grabbing");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
    dispatch({ transforming: false, locked: false });
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function editBoundaryFill(e: PointerEvent) {
  if (e.which == 2) {
    pan(e);
    return;
  }
  const {
    selectedBoundary,
    regions,
    blockEditMode,
    activeBlockTool,
    activeSymbol,
    activeYarn,
  } = GLOBAL_STATE;

  if (selectedBoundary === null) return;

  const tool = (editingTools as Record<string, Function>)[activeBlockTool];
  if (!tool) return;

  const { stitchBlock, yarnBlock } = regions[selectedBoundary];
  const stitchEdit = blockEditMode == "stitch";
  let pos = blockPos(e);

  dispatch({ locked: true });
  let startBlock = stitchEdit ? stitchBlock : yarnBlock;

  let onMove = tool(startBlock, pos, stitchEdit ? activeSymbol : activeYarn);
  if (!onMove) return;

  let updatedRegions = [...regions];

  if (stitchEdit) {
    updatedRegions[selectedBoundary].stitchBlock = onMove(pos);
  } else {
    updatedRegions[selectedBoundary].yarnBlock = onMove(pos);
  }
  dispatch({
    regions: updatedRegions,
  });

  function move(moveEvent: PointerEvent) {
    if (moveEvent.buttons == 0) {
      end();
    } else {
      let newPos = blockPos(moveEvent);

      if (newPos.x == pos.x && newPos.y == pos.y) return;

      let updatedRegions = [...regions];

      if (stitchEdit) {
        updatedRegions[selectedBoundary!].stitchBlock = onMove(newPos);
      } else {
        updatedRegions[selectedBoundary!].yarnBlock = onMove(newPos);
      }
      dispatch({
        regions: updatedRegions,
      });

      pos = newPos;
    }
  }

  function end() {
    dispatch({ locked: false });

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}
