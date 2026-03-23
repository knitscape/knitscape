import { html } from "lit-html";
import { map } from "lit-html/directives/map.js";

import { GLOBAL_STATE, dispatch } from "../state";

const styles = html`<style>
  #debug-pane {
    display: flex;
    flex-direction: column;
  }
  #debug-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #1a1919;
    padding: 4px;
  }

  #debug-header > h3 {
    margin: 0;
  }

  #debug-header > button {
    display: flex;
    padding: 0;
    border: 0;
    outline: 0;
    background-color: transparent;
    color: #939292;
    font-size: large;
    cursor: pointer;
  }

  #debug-header > button:hover {
    color: red;
  }

  #debug-content {
    display: grid;
    grid-template-columns: auto auto;
    gap: 1px;
    background-color: #1a1919;
    color: #dadada;
    flex-basis: 350px;
    overflow-y: auto;
  }

  #debug-content > * {
    background-color: #2c2c2c;
    padding: 5px;
  }

  #debug-content > h4 {
    margin: 0;
    text-align: right;
    white-space: nowrap;
  }

  .chip-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    font-weight: bold;
    padding: 4px;
    border-radius: 5px;
    background: #5e5e5e;
    paint-order: stroke fill;
    text-shadow: 1px 0 0 black, 0 1px 0 black, -1px 0 0 black, 0 -1px 0 black;
    box-shadow: 0 0 2px black;
  }

  .number-field {
    font-size: large;
    font-weight: bold;
    font-family: monospace;
  }

  .bool-field {
    font-size: large;
    font-weight: bold;
    font-family: monospace;
    background-color: rgba(177, 211, 111, 1);
  }
</style>`;

export function debugPane() {
  return html`${styles}
    <div id="debug-pane">
      <div id="debug-header">
        <h3>Debug</h3>
        <button @click=${() => dispatch({ debug: false })}>
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
      </div>
      <div id="debug-content">
        <h4>Scale</h4>
        <span>
          <span class="number-field">${GLOBAL_STATE.scale}</span> pixels per
          pixel
        </span>
        <h4>x pos</h4>
        <span class="number-field">${GLOBAL_STATE.pos.x}</span>
        <h4>y pos</h4>
        <span class="number-field">${GLOBAL_STATE.pos.y}</span>
        <h4>Active Tool</h4>
        <span class="text-field">${GLOBAL_STATE.activeTool}</span>
        <h4>Active Color</h4>
        <span class="number-field">${GLOBAL_STATE.activeColor}</span>
        <h4>Device Pixel Ratio</h4>
        <span>
          <span class="number-field">${devicePixelRatio}</span> device pixel(s)
          per CSS pixel
        </span>
        <h4>Color Palette</h4>
        <div class="chip-container">
          ${map(
            GLOBAL_STATE.yarnPalette,
            (rgba) =>
              html`<code class="chip" style="background:${rgba};"
                >${rgba}</code
              >`
          )}
        </div>
        <h4>Snapshot Length</h4>
        <span class="number-field">${GLOBAL_STATE.snapshots.length}</span>
        <h4>Held Keys</h4>
        <div class="chip-container">
          ${GLOBAL_STATE.heldKeys.size > 0
            ? map(
                GLOBAL_STATE.heldKeys,
                (key) => html`<span class="chip">${key}</span>`
              )
            : html`<span class="chip">none</span>`}
        </div>
        <h4>Grid</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.grid
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.grid}</span
          >
        </div>
        <h4>Editing Palette</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.editingPalette
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.editingPalette}</span
          >
        </div>
        <h4>Show Settings</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.showSettings
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.showSettings}</span
          >
        </div>
        <h4>Show download</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.showDownload
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.showDownload}</span
          >
        </div>
        <h4>Show debug</h4>
        <div class="chip-container">
          <span
            class="chip"
            style="background:${GLOBAL_STATE.debug
              ? "rgb(79 161 50)"
              : "rgb(194 55 68)"};"
            >${GLOBAL_STATE.debug}</span
          >
        </div>
      </div>
    </div>`;
}
