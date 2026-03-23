import { GLOBAL_STATE } from "../../state";
import { uploadWorkspace } from "../../utilities/importers";
import { html } from "lit-html";

export function uploadModal() {
  return html` <div class="modal">
    <h2>Upload</h2>
    <div class="modal-content">
      <button class="btn solid" @click=${() => uploadWorkspace(GLOBAL_STATE)}>
        Workspace JSON
      </button>
    </div>
  </div>`;
}
