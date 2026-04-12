import { html } from "lit-html";
import {
  downloadJSON,
  downloadSilverKnitTxt,
  downloadKniterate,
  downloadPunchcard,
} from "../actions/exporters";

import { punchCardSVG } from "../punchcard";

import { GLOBAL_STATE, dispatch } from "../state";

export function downloadModal() {
  return html` <div class="modal">
    <h2>Download Pattern</h2>
    <div class="modal-content">
      <button class="btn solid" @click=${() => downloadJSON()}>
        Pattern JSON
      </button>
      <button class="btn solid" @click=${() => downloadSilverKnitTxt()}>
        TXT (Silver Knit)
      </button>
      <button class="btn solid" @click=${() => downloadKniterate()}>
        Kniterate TXT Import
      </button>

      <h3>Punchcard</h3>

      <label class="form-control range">
        Vertical Repeats
        <input
          type="range"
          name="line-width"
          min="1"
          max="10"
          .value=${String(GLOBAL_STATE.punchVerticalRepeats)}
          @input=${(e: Event) =>
            dispatch({
              punchVerticalRepeats: Number(
                (e.target as HTMLInputElement).value
              ),
              rows:
                Number((e.target as HTMLInputElement).value) *
                GLOBAL_STATE.repeats[0].bitmap.height,
            })} />
      </label>

      <button class="btn solid" @click=${() => downloadPunchcard()}>
        Download Punchcard SVG
      </button>

      <div class="punchcard-preview">${punchCardSVG()}</div>
    </div>
  </div>`;
}
