import { html } from "lit-html";
import { loadLibraryPattern } from "../actions/importers";
import { GLOBAL_STATE } from "../state";

export function libraryModal() {
  return html` <div id="library-modal" class="modal">
    <h2>Pattern Library</h2>
    <div class="modal-content">
      ${Object.entries(GLOBAL_STATE.patternLibrary).map(
        ([path, _]) =>
          html`<div class="library-item">
            <span>${path.split("/").at(-1).split(".")[0]}</span>
            <button class="btn solid" @click=${() => loadLibraryPattern(path)}>
              <i class="fa-solid fa-upload"></i>
            </button>
          </div>`
      )}
    </div>
  </div>`;
}
