import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";

import { GLOBAL_STATE, dispatch } from "../state";
import { removeBlock } from "../interaction/blockInteraction";
import {
  bringBoundaryToFront,
  lowerBoundary,
  raiseBoundary,
  removeBoundary,
  sendBoundaryToBack,
  setBoundaryJoinMode,
  setBoundaryShaping,
  duplicateBoundary,
} from "../interaction/boundaryInteraction";
import {
  removePath,
  duplicatePath,
  setPathTileMode,
  raisePath,
  lowerPath,
  bringPathToFront,
  sendPathToBack,
} from "../interaction/pathInteraction";
import { boundaryBbox } from "../utilities/misc";

export function freeBlockToolbar() {
  const { blockEditMode, selectedBlock } = GLOBAL_STATE;

  if (selectedBlock == null)
    return html`
      <div class="toolbar-message">
        Select a block to edit it. Drag to add a new block.
      </div>
    </div> `;

  return html`<div class="mode-toolbar">
    <div class="h-group">
      <div class="has-dropdown">
        <button class="btn dropdown-toggle">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
        <div class="dropdown above">
          <button class="btn delete" @click=${() => removeBlock(selectedBlock)}>
            <i class="fa-solid fa-trash fa-sm"></i>
            Remove
          </button>
        </div>
      </div>
      <span class="toolbar-message">Editing block ${selectedBlock}</span>
    </div>

    <div class="has-dropdown">
      <button class="btn dropdown-toggle">edit</button>
      <div class="dropdown above align-right">
        <button
          class="btn ${blockEditMode == "yarn" ? "solid" : ""}"
          @click=${(e) => {
            dispatch({ blockEditMode: "yarn" }, true);
            e.target.blur();
          }}>
          yarn
        </button>
        <button
          class="btn ${blockEditMode == "stitch" ? "solid" : ""}"
          @click=${(e) => {
            dispatch({ blockEditMode: "stitch" }, true);
            e.target.blur();
          }}>
          stitch
        </button>
      </div>
    </div>
  </div>`;
}

export function pathToolbar() {
  const { blockEditMode, selectedPath, paths } = GLOBAL_STATE;

  if (selectedPath == null)
    return html`
      <div class="toolbar-message">
        Select a path to edit it. Drag to add a new path.
      </div>
    `;

  const currentPath = paths[selectedPath];

  return html`
    <div class="h-group">
      <div class="has-dropdown">
        <button class="btn dropdown-toggle">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
        <div class="dropdown above">
          <button class="btn delete" @click=${() => removePath(selectedPath)}>
            <i class="fa-solid fa-trash fa-sm"></i>
            Remove
          </button>
        </div>
      </div>
      <span class="toolbar-message">
        Editing ${blockEditMode != null ? `${blockEditMode} tile of ` : ""} path
        ${selectedPath}
      </span>
      <button class="btn" @click=${() => duplicatePath(selectedPath)}>
        <i class="fa-solid fa-copy"></i>
      </button>
      <button class="btn" @click=${() => sendPathToBack(selectedPath)}>
        <i class="fa-solid fa-arrows-down-to-line"></i>
      </button>
      <button class="btn" @click=${() => lowerPath(selectedPath)}>
        <i class="fa-solid fa-arrow-down"></i>
      </button>
      <button class="btn" @click=${() => raisePath(selectedPath)}>
        <i class="fa-solid fa-arrow-up"></i>
      </button>
      <button class="btn" @click=${() => bringPathToFront(selectedPath)}>
        <i class="fa-solid fa-arrows-up-to-line"></i>
      </button>
    </div>

    <div class="radio-group">
      <button
        class="${currentPath.tileMode == "overlap" ? "selected" : ""}"
        @click=${() => setPathTileMode(selectedPath, "overlap")}>
        overlap
      </button>
      <button
        class="${currentPath.tileMode == "tiled" ? "selected" : ""}"
        @click=${() => setPathTileMode(selectedPath, "tiled")}>
        tiled
      </button>
      <button
        class="${currentPath.tileMode == "xDiff" ? "selected" : ""}"
        @click=${() => setPathTileMode(selectedPath, "xDiff")}>
        X
      </button>
      <button
        class="${currentPath.tileMode == "yDiff" ? "selected" : ""}"
        @click=${() => setPathTileMode(selectedPath, "yDiff")}>
        Y
      </button>
    </div>

    <div class="h-group">
      <button
        class="btn ${blockEditMode == "yarn" ? "solid" : ""}"
        @click=${(e) => {
          dispatch({ blockEditMode: "yarn" }, true);
          e.target.blur();
        }}>
        yarn tile
      </button>
      <button
        class="btn ${blockEditMode == "stitch" ? "solid" : ""}"
        @click=${(e) => {
          dispatch({ blockEditMode: "stitch" }, true);
          e.target.blur();
        }}>
        stitch tile
      </button>
    </div>
  `;
}

export function boundaryToolbar() {
  const { blockEditMode, selectedBoundary, boundaries, regions } = GLOBAL_STATE;

  if (selectedBoundary == null)
    return html`
      <div class="toolbar-message">
        Select a boundary to edit it. Drag to add a new boundary.
      </div>
    `;

  let bbox = boundaryBbox(boundaries[selectedBoundary]);
  let region = regions[selectedBoundary];

  return html` <div class="h-group">
      <div class="has-dropdown">
        <button class="btn dropdown-toggle">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
        <div class="dropdown above">
          <button
            class="btn delete"
            @click=${() => removeBoundary(selectedBoundary)}>
            <i class="fa-solid fa-trash fa-sm"></i>
            Remove
          </button>
        </div>
      </div>
      <span class="toolbar-message">
        Editing ${blockEditMode != null ? `${blockEditMode} fill of ` : ""}
        boundary ${selectedBoundary}
      </span>
      <button class="btn" @click=${() => duplicateBoundary(selectedBoundary)}>
        <i class="fa-solid fa-copy"></i>
      </button>
      <button class="btn" @click=${() => sendBoundaryToBack(selectedBoundary)}>
        <i class="fa-solid fa-arrows-down-to-line"></i>
      </button>
      <button class="btn" @click=${() => lowerBoundary(selectedBoundary)}>
        <i class="fa-solid fa-arrow-down"></i>
      </button>
      <button class="btn" @click=${() => raiseBoundary(selectedBoundary)}>
        <i class="fa-solid fa-arrow-up"></i>
      </button>
      <button
        class="btn"
        @click=${() => bringBoundaryToFront(selectedBoundary)}>
        <i class="fa-solid fa-arrows-up-to-line"></i>
      </button>
    </div>

    <div class="radio-group">
      <span>yarn join</span>
      <!-- <button
        class="${region.joinMode == "none" ? "selected" : ""}"
        @click=${() => setBoundaryJoinMode(selectedBoundary, "none")}>
        none
      </button>
      <button
        class="${region.joinMode == "tucks" ? "selected" : ""}"
        @click=${() => setBoundaryJoinMode(selectedBoundary, "tucks")}>
        tucks
      </button> -->
      <button
        class="${GLOBAL_STATE.tucks ? "" : "selected"}"
        @click=${() => dispatch({ tucks: false })}>
        none
      </button>
      <button
        class="${GLOBAL_STATE.tucks ? "selected" : ""}"
        @click=${() => dispatch({ tucks: true })}>
        tucks
      </button>
      <span>shaping</span>
      <div class="chart-scale">
        <input
          class="input"
          type="number"
          min="0"
          max="7"
          step="1"
          .value=${String(region.shaping)}
          @change=${(e) => setBoundaryShaping(Number(e.target.value))} />
        <div class="spinners">
          <button
            @click=${() =>
              setBoundaryShaping(selectedBoundary, region.shaping + 1)}>
            <i class="fa-solid fa-angle-up fa-xs"></i>
          </button>
          <button
            @click=${() =>
              setBoundaryShaping(selectedBoundary, region.shaping - 1)}>
            <i class="fa-solid fa-angle-down fa-xs"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="h-group">
      <button
        class="btn ${blockEditMode == "yarn" ? "solid" : ""}"
        @click=${(e) => {
          dispatch({ blockEditMode: "yarn" }, true);
          e.target.blur();
        }}>
        yarn tile
      </button>
      <button
        class="btn ${blockEditMode == "stitch" ? "solid" : ""}"
        @click=${(e) => {
          dispatch({ blockEditMode: "stitch" }, true);
          e.target.blur();
        }}>
        stitch tile
      </button>
    </div>

    <span class="area-size">
      ${bbox.width}<i class="fa-solid fa-xmark fa-xs"></i>${bbox.height}
    </span>`;
}

export function modeToolbar() {
  const { interactionMode } = GLOBAL_STATE;
  return html`<div class="mode-toolbar">
    ${when(interactionMode == "boundary", boundaryToolbar)}
    ${when(interactionMode == "path", pathToolbar)}
    ${when(interactionMode == "block", freeBlockToolbar)}
  </div>`;
}
