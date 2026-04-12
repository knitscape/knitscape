import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { toggleFullscreen, currentlyFullscreen } from "../utilities/fullscreen";

export function taskbar() {
  const {
    showExampleLibrary,
    showDownload,
    showUpload,
    showSettings,
    showTimeNeedleView,
  } = GLOBAL_STATE;

  return html` <div id="taskbar">
    <h1 class="site-title">KnitScape</h1>
    <div class="button-group">
      <div class="radio-group">
        <button
          class="${showTimeNeedleView ? "selected" : ""}"
          @click=${() => dispatch({ showTimeNeedleView: true })}>
          program
        </button>
        <button
          class="${showTimeNeedleView ? "" : "selected"}"
          @click=${() => dispatch({ showTimeNeedleView: false })}>
          yarn
        </button>
      </div>

      <button
        class="btn icon ${showExampleLibrary ? "open" : ""}"
        @click=${() => dispatch({ showExampleLibrary: true })}>
        <i class="fa-solid fa-book"></i>
      </button>
      <button
        class="btn icon ${showDownload ? "open" : ""}"
        @click=${() => dispatch({ showDownload: true })}>
        <i class="fa-solid fa-download"></i>
      </button>
      <button
        class="btn icon ${showUpload ? "open" : ""}"
        @click=${() => dispatch({ showUpload: true })}>
        <i class="fa-solid fa-upload"></i>
      </button>
      <button
        class="btn icon ${showSettings ? "open" : ""}"
        @click=${() => dispatch({ showSettings: !showSettings })}>
        <i class="fa-solid fa-gear"></i>
      </button>
      <button class="btn icon" @click=${() => toggleFullscreen()}>
        <i
          class="fa-solid fa-${currentlyFullscreen()
            ? "down-left-and-up-right-to-center"
            : "up-right-and-down-left-from-center"}"></i>
      </button>
    </div>
  </div>`;
}
