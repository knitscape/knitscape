import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";

import { GLOBAL_STATE, dispatch } from "../../state";
import {
  editBlock,
  resizeBlock,
  moveBlock,
} from "../../interaction/blockInteraction";

export function blocks() {
  const { blocks, cellWidth, cellHeight, selectedBlock } = GLOBAL_STATE;
  return blocks.map(
    (block, blockIndex) =>
      html`<div
        class="block"
        style="left: ${Math.round(block.pos[0] * cellWidth) -
        1}px; bottom: ${Math.round(block.pos[1] * cellHeight)}px;">
        <canvas
          data-blockindex=${blockIndex}
          @pointerdown=${(e) => {
            if (selectedBlock == blockIndex) editBlock(e, blockIndex);
          }}></canvas>
        <div class="block-inset-shadow"></div>
        ${when(
          selectedBlock == blockIndex,
          () => draggers(blockIndex),
          () => html` <div class="hover-overlay">
            <button
              class=" btn solid"
              @click=${() => dispatch({ selectedBlock: blockIndex })}>
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>`
        )}
      </div>`
  );
}

function draggers(blockIndex) {
  return html`<button
      class="move-block"
      @pointerdown=${(e) => moveBlock(e, blockIndex)}>
      <i class="fa-solid fa-arrows-up-down-left-right"></i>
    </button>
    <button
      class="dragger up"
      @pointerdown=${(e) => resizeBlock(e, blockIndex, "up")}>
      <i class="fa-solid fa-angle-up"></i>
    </button>
    <button
      class="dragger down"
      @pointerdown=${(e) => resizeBlock(e, blockIndex, "down")}>
      <i class="fa-solid fa-angle-down"></i>
    </button>
    <button
      class="dragger left"
      @pointerdown=${(e) => resizeBlock(e, blockIndex, "left")}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
    <button
      class="dragger right"
      @pointerdown=${(e) => resizeBlock(e, blockIndex, "right")}>
      <i class="fa-solid fa-angle-right"></i>
    </button>`;
}
