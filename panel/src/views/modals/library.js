import { GLOBAL_STATE } from "../../state";
import { loadExampleWorkspace } from "../../utilities/importers";
import { html } from "lit-html";

export function libraryModal() {
  return html` <div class="modal">
    <h2>Examples</h2>
    <div class="modal-content">
      ${Object.entries(GLOBAL_STATE.exampleLibrary).map(
        ([path, _]) =>
          html`<div class="library-item">
            <span>${path.split("/").at(-1).split(".")[0]}</span>
            <button
              class="btn solid"
              @click=${() => loadExampleWorkspace(path)}>
              <i class="fa-solid fa-upload"></i>
            </button>
          </div>`
      )}
    </div>
  </div>`;
}
