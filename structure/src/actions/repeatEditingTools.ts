import { GLOBAL_STATE, dispatch } from "../state";
import type { Bimp } from "@shared/Bimp";
import type { Vec2 } from "../types";

function dispatchRepeatBitmap(repeatIndex: number, bitmap: Bimp): void {
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

export type RepeatToolFn = (
  repeatIndex: number,
  startPos: Vec2
) => ((newPos: Vec2) => void) | void;

function brush(repeatIndex: number, startPos: Vec2): (newPos: Vec2) => void {
  function onMove(newPos: Vec2): void {
    const updated = GLOBAL_STATE.repeats[repeatIndex].bitmap.line(
      startPos,
      newPos,
      GLOBAL_STATE.activeSymbol
    );

    startPos = newPos;
    dispatchRepeatBitmap(repeatIndex, updated);
  }

  onMove(startPos);
  return onMove;
}

function flood(repeatIndex: number, startPos: Vec2): (newPos: Vec2) => void {
  function onMove(newPos: Vec2): void {
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

function rect(repeatIndex: number, startPos: Vec2): (newPos: Vec2) => void {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;

  function onMove(newPos: Vec2): void {
    const updated = startBitmap.rect(
      startPos,
      newPos,
      GLOBAL_STATE.activeSymbol
    );

    dispatchRepeatBitmap(repeatIndex, updated);
  }
  onMove(startPos);
  return onMove;
}

function line(repeatIndex: number, startPos: Vec2): (newPos: Vec2) => void {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;
  function onMove(newPos: Vec2): void {
    const updated = startBitmap.line(
      startPos,
      newPos,
      GLOBAL_STATE.activeSymbol
    );

    dispatchRepeatBitmap(repeatIndex, updated);
  }

  onMove(startPos);
  return onMove;
}

function shift(repeatIndex: number, startPos: Vec2): (newPos: Vec2) => void {
  const startBitmap = GLOBAL_STATE.repeats[repeatIndex].bitmap;

  function onMove(newPos: Vec2): void {
    dispatchRepeatBitmap(
      repeatIndex,
      startBitmap.shift(startPos[0] - newPos[0], startPos[1] - newPos[1])
    );
  }
  onMove(startPos);
  return onMove;
}

export const repeatEditingTools: Record<string, RepeatToolFn> = {
  brush,
  flood,
  line,
  rect,
  shift,
};
