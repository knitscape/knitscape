import { GLOBAL_STATE } from "../../state";
import {
  downloadWorkspace,
  downloadKniterate,
  downloadTimeNeedleBMP,
} from "../../utilities/exporters";
import { html } from "lit-html";

export function downloadModal() {
  return html` <div class="modal">
    <h2>Download</h2>
    <div class="modal-content">
      <button class="btn solid" @click=${() => downloadWorkspace(GLOBAL_STATE)}>
        Workspace JSON
      </button>
      <button class="btn solid" @click=${() => downloadKniterate(GLOBAL_STATE)}>
        Kniterate TXT
      </button>
      <button
        class="btn solid"
        @click=${() => downloadTimeNeedleBMP(GLOBAL_STATE.passSchedule)}>
        Time Needle BMP
      </button>
    </div>
  </div>`;
}
