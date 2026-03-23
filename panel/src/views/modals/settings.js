import { html } from "lit-html";
import { GLOBAL_STATE, dispatch, undo } from "../../state";

export function settingsModal() {
  return html` <div id="settings-modal" class="modal">
    <h2>Settings</h2>

    <div class="modal-content">
      <label class="form-control toggle">
        <input
          type="checkbox"
          ?checked=${GLOBAL_STATE.reverseScroll}
          @change=${(e) => dispatch({ reverseScroll: e.target.checked })} />
        Invert Scroll
      </label>
      <label class="form-control">
        K yarn
        <input
          class="input"
          type="number"
          min="0.01"
          max="0.2"
          step="0.01"
          .value=${String(GLOBAL_STATE.kYarn)}
          @change=${(e) => dispatch({ kYarn: Number(e.target.value) })} />
      </label>
      <button
        class="btn solid"
        style="align-self: center;"
        @click=${() => window.open("https://github.com/knitscape/knitscape")}>
        <i class="fa-brands fa-github"></i>
      </button>
    </div>
  </div>`;
}
