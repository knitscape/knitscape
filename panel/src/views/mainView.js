import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { GLOBAL_STATE } from "../state";

import { taskbar } from "./taskbar";
import { simulationView } from "./simulationPane";
import { chartPaneView } from "./chartPane";
import { timeNeedleView } from "./timeNeedlePane";
import { yarnPane } from "./yarnPane";

import { closeModals } from "../utilities/misc";
import { libraryModal } from "./modals/library";
import { downloadModal } from "./modals/download";
import { uploadModal } from "./modals/upload";
import { settingsModal } from "./modals/settings";

export function mainView() {
  return html`
    ${taskbar()} ${when(GLOBAL_STATE.showDownload, downloadModal)}
    ${when(GLOBAL_STATE.showUpload, uploadModal)}
    ${when(GLOBAL_STATE.showExampleLibrary, libraryModal)}
    ${when(GLOBAL_STATE.showSettings, settingsModal)}
    <div id="site" @pointerdown=${closeModals}>
      <div id="chart-pane">${yarnPane()} ${chartPaneView()}</div>
      <div id="view-pane">
        ${when(GLOBAL_STATE.showTimeNeedleView, timeNeedleView, simulationView)}
      </div>
    </div>
  `;
}
