import { GLOBAL_STATE, dispatch } from "../state";

function dispatchRepeatBitmap(repeatIndex, bitmap) {
  dispatch({
    repeats: [
      ...GLOBAL_STATE.repeats.slice(0, repeatIndex),
      {
        ...GLOBAL_STATE.repeats[repeatIndex],
        bitmap: bitmap,
      },
      ...GLOBAL_STATE.repeats.slice(repeatIndex + 1),
    ],
  });
}

function brush(repeatIndex, startPos) {
  function onMove(newPos) {
    const updated = GLOBAL_STATE.repeats[repeatIndex].bitmap.line(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeSymbol
    );

    startPos = newPos;
    dispatchRepeatBitmap(repeatIndex, updated);
  }

  onMove(startPos);
  return onMove;
}

function flood(repeatIndex, startPos) {
  function onMove(newPos) {
    dispatchRepeatBitmap(
      repeatIndex,
      GLOBAL_STATE.repeats[repeatIndex].bitmap.flood(
        newPos,
        GLOBAL_STATE.activeSymbol
      )
    );
  }

  onMove(startPos);
  return onMove;
}

function rect(repeatIndex, startPos) {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;

  function onMove(newPos) {
    const updated = startBitmap.rect(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeSymbol
    );

    dispatchRepeatBitmap(repeatIndex, updated);
  }
  onMove(startPos);
  return onMove;
}

function line(repeatIndex, startPos) {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;
  function onMove(newPos) {
    const updated = startBitmap.line(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      GLOBAL_STATE.activeSymbol
    );

    dispatchRepeatBitmap(repeatIndex, updated);
  }

  onMove(startPos);
  return onMove;
}

function shift(repeatIndex, startPos) {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;

  function onMove(newPos) {
    dispatchRepeatBitmap(
      repeatIndex,
      startBitmap.shift(startPos.x - newPos.x, startPos.y - newPos.y)
    );
  }
  onMove(startPos);
  return onMove;
}

export const repeatEditingTools = { brush, flood, line, rect, shift };
