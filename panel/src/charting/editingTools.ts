import type { Bimp, Vec2 } from "../../../shared/Bimp";

interface Pos {
  x: number;
  y: number;
}

function posToVec2(pos: Pos): Vec2 {
  return [pos.x, pos.y];
}

export const editingTools = { brush, flood, rect, line, shift };

function brush(bitmap: Bimp, startPos: Pos, value: number) {
  function onMove(newPos: Pos): Bimp {
    bitmap = bitmap.line(posToVec2(startPos), posToVec2(newPos), value);
    startPos = newPos;
    return bitmap;
  }

  return onMove;
}

function flood(bitmap: Bimp, startPos: Pos, value: number) {
  function onMove(newPos: Pos): Bimp {
    bitmap = bitmap.flood(posToVec2(newPos), value);
    startPos = newPos;
    return bitmap;
  }

  return onMove;
}

function rect(bitmap: Bimp, startPos: Pos, value: number) {
  function onMove(newPos: Pos): Bimp {
    return bitmap.rect(posToVec2(startPos), posToVec2(newPos), value);
  }
  return onMove;
}

function line(bitmap: Bimp, startPos: Pos, value: number) {
  function onMove(newPos: Pos): Bimp {
    return bitmap.line(posToVec2(startPos), posToVec2(newPos), value);
  }
  return onMove;
}

function shift(bitmap: Bimp, startPos: Pos, _value: number) {
  function onMove(newPos: Pos): Bimp {
    return bitmap.shift(startPos.x - newPos.x, startPos.y - newPos.y);
  }
  return onMove;
}
