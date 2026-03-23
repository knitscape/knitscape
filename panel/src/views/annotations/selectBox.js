import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";

import { GLOBAL_STATE, dispatch } from "../../state";
import { addBlock } from "../../interaction/blockInteraction";
import { addBoundary } from "../../interaction/boundaryInteraction";

export function stitchSelectBox() {
  const {
    stitchSelect: [bl, tr],
    cellWidth,
    cellHeight,
    interactionMode,
  } = GLOBAL_STATE;
  if (interactionMode == "path") return;
  return html`<div
    class="stitch-select-box"
    style="width: ${(tr[0] - bl[0]) * cellWidth}px; height: ${(tr[1] - bl[1]) *
    cellHeight}px; left: ${bl[0] * cellWidth}px; bottom: ${bl[1] *
    cellHeight}px;">
    <svg>
      <rect class="stitch-select" width="100%" height="100%"></rect>
    </svg>
    <div class="select-tools">
      ${when(
        interactionMode == "block",
        () => html`<button class="add-block" @click=${addBlock}>
          <i class="fa-solid fa-plus"></i>
          block
        </button>`
      )}
      ${when(
        interactionMode == "boundary",
        () => html`<button class="add-block" @click=${addBoundary}>
          <i class="fa-solid fa-plus"></i>
          boundary
        </button>`
      )}
      <button
        class="add-block"
        @click=${() => dispatch({ stitchSelect: null })}>
        <i class="fa-solid fa-cancel"></i>
        cancel
      </button>
    </div>
  </div>`;
}
