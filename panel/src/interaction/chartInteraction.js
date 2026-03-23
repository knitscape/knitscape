import { GLOBAL_STATE, dispatch } from "../state";
import { pan } from "./chartPanZoom";

import {
  boundaryModePointerDown,
  boundaryModeContextMenu,
} from "./boundaryInteraction";
import { pathModePointerDown, pathModeContextMenu } from "./pathInteraction";
import { selectBox } from "./select";

export function chartPointerDown(e) {
  if (e.which == 2) {
    pan(e);
    return;
  }

  const { interactionMode } = GLOBAL_STATE;

  if (GLOBAL_STATE.locked) return;

  if (interactionMode == "path") {
    pathModePointerDown(e);
  } else if (interactionMode == "boundary") {
    boundaryModePointerDown(e);
  } else if (interactionMode == "block") {
    dispatch({ stitchSelect: null }); // clear current selection
    selectBox(e);
  } else {
    pan(e);
  }
}

export function chartContextMenu(e) {
  e.preventDefault();
  const { interactionMode } = GLOBAL_STATE;

  if (interactionMode == "path") {
    pathModeContextMenu(e);
  } else if (interactionMode == "boundary") {
    boundaryModeContextMenu(e);
  }
}
