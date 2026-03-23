export const editingTools = { brush, flood, rect, line, shift };

function brush(bitmap, startPos, value) {
  function onMove(newPos) {
    bitmap = bitmap.line(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      value
    );

    startPos = newPos;
    return bitmap;
  }

  return onMove;
}

function flood(bitmap, startPos, value) {
  function onMove(newPos) {
    bitmap = bitmap.flood(newPos, value);
    startPos = newPos;
    return bitmap;
  }

  return onMove;
}

function rect(bitmap, startPos, value) {
  function onMove(newPos) {
    return bitmap.rect(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      value
    );
  }
  return onMove;
}

function line(bitmap, startPos, value) {
  function onMove(newPos) {
    return bitmap.line(
      { x: startPos.x, y: startPos.y },
      { x: newPos.x, y: newPos.y },
      value
    );
  }
  return onMove;
}

function shift(bitmap, startPos, value) {
  function onMove(newPos) {
    return bitmap.shift(startPos.x - newPos.x, startPos.y - newPos.y);
  }
  return onMove;
}
