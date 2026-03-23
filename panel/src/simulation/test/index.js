import { html, render } from "lit-html";
import Split from "split.js";
import { Bimp } from "../../lib/Bimp";

import { drawGraph } from "./topologyGraph";
import { stitches } from "../../constants";

const stitchList = Object.entries(stitches).map(
  ([stitchName, stitchID]) => stitchName
);

let GLOBAL_STATE = {
  scale: 60,
  activeTool: "brush",
  activeStitch: 0,
  yarnSequence: [0],
  // Fig 7
  // pattern: new Bimp(
  //   5,
  //   6,
  //   [
  //     1, 1, 1, 1, 1, 1, 1, 1, 10, 1, 1, 10, 5, 1, 1, 1, 1, 5, 3, 1, 1, 1, 1, 1,
  //     1, 1, 1, 1, 1, 1,
  //   ]
  // ),

  // Fig 6
  // pattern: new Bimp(
  //   6,
  //   6,
  //   [
  //     1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 5, 5, 1, 1, 1, 1, 7, 1, 10, 1,
  //     1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  //   ]
  // ),

  // Fashioned increase
  // pattern: new Bimp(
  //   8,
  //   10,
  //   [
  //     1, 1, 1, 1, 0, 0, 0, 0, 1, 7, 7, 7, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1,
  //     1, 7, 7, 7, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 7, 7, 7, 0, 0, 1, 1,
  //     1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 7, 7, 7, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  //     1, 1, 1, 1, 1,
  //   ]
  // ),

  // Loop order analysis example
  // pattern: new Bimp(
  //   6,
  //   6,
  //   [
  //     1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 7, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  //     1, 13, 1, 16, 1, 1, 1, 1, 1, 1, 1,
  //   ]
  // ),

  // pattern: new Bimp(
  //   6,
  //   6,
  //   [
  //     2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 3, 6, 5, 17, 1, 1, 1, 1, 1, 1, 1,
  //     2, 7, 7, 2, 2, 2, 1, 1, 1, 1, 1, 1,
  //   ]
  // ),

  // pattern: new Bimp(
  //   7,
  //   7,
  //   [
  //     1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1, 2, 2, 2, 1,
  //     1, 1, 1, 2, 2, 2, 1, 5, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  //   ]
  // ),

  pattern: new Bimp(5, 3, [1, 1, 1, 1, 1, 1, 7, 7, 1, 1, 1, 1, 1, 1, 1]),
};
function uploadFile() {
  let fileInputElement = document.createElement("input");

  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  fileInputElement.onchange = (e) => {
    let file = e.target.files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = () => {
      loadChart(JSON.parse(fileReader.result));
    };
  };
  document.body.removeChild(fileInputElement);
}

function calcYarnIndex(patternRowIndex) {
  return GLOBAL_STATE.yarnSequence[
    patternRowIndex % GLOBAL_STATE.yarnSequence.length
  ];
}

function loadChart(pattern) {
  GLOBAL_STATE.chart = generateChart(pattern);
  GLOBAL_STATE.nextRow = 0;
  GLOBAL_STATE.yarnSequence = pattern.yarnSequence.pixels;
  GLOBAL_STATE.yarnPalette = pattern.yarnPalette;
  GLOBAL_STATE.leftCam = -Math.floor(GLOBAL_STATE.chart[0].length / 2);
}

function stitchView(m, n) {
  const symbol = stitchList[GLOBAL_STATE.pattern.pixel(m, n)];

  return html`<div
    class="stitch"
    data-stindex=${m + n * GLOBAL_STATE.pattern.width}
    style="width: ${GLOBAL_STATE.scale}px;">
    ${symbol}
  </div>`;
}

function buildStitches(row) {
  const width = GLOBAL_STATE.pattern.width;

  let stitches = [];
  for (let i = 0; i < width; i++) {
    stitches.push(stitchView(i, row));
  }

  return stitches;
}

function rowView(row) {
  let fontSize = GLOBAL_STATE.scale - 2;
  fontSize = fontSize > 20 ? 20 : fontSize;

  return html`<div class="row" style="height: ${GLOBAL_STATE.scale}px;">
    <div class="row-label left white" style="font-size: ${fontSize}px">
      ${row}
    </div>
    ${buildStitches(row)}
    <div class="row-label right white" style="font-size: ${fontSize}px">
      ${row}
    </div>
  </div>`;
}

function buildRows() {
  const rows = [];
  for (let row = 0; row < GLOBAL_STATE.pattern.height; row++) {
    rows.push(rowView(row));
  }
  return rows;
}

function stitchSelect() {
  return html`<div class="stitch-select-container">
    ${stitchList.map(
      (st, index) =>
        html`<div
          class="stitch-select ${GLOBAL_STATE.activeStitch == index
            ? "selected"
            : ""}"
          @click=${() => (GLOBAL_STATE.activeStitch = index)}>
          ${st}
        </div>`
    )}
  </div>`;
}

function chartInteraction(e) {
  let st = e.target.closest(".stitch");
  if (!st) return;
  const stIndex = Number(st.dataset.stindex);
  GLOBAL_STATE.pattern = GLOBAL_STATE.pattern.indexedBrush(
    stIndex,
    GLOBAL_STATE.activeStitch
  );

  console.log(Array.from(GLOBAL_STATE.pattern.pixels));

  drawGraph(GLOBAL_STATE.pattern, "#topology-graph-container");
}

function updateChartWidth(newWidth) {
  GLOBAL_STATE.pattern = GLOBAL_STATE.pattern.resize(
    newWidth,
    GLOBAL_STATE.pattern.height,
    stitches.KNIT
  );
  drawGraph(GLOBAL_STATE.pattern, "#topology-graph-container");
}

function updateChartHeight(newHeight) {
  GLOBAL_STATE.pattern = GLOBAL_STATE.pattern.resize(
    GLOBAL_STATE.pattern.width,
    newHeight,
    stitches.KNIT
  );
  drawGraph(GLOBAL_STATE.pattern, "#topology-graph-container");
}

function chartView() {
  return html`
    <div class="toolbar">
      <button @click=${() => uploadFile()}>Load KnitScape Chart</button>

      <input
        type="range"
        @input=${(e) => {
          GLOBAL_STATE.scale = e.target.value;
        }} />
    </div>
    <div class="chart-size-controls">
      <label>Width</label>
      <input
        class="input"
        type="number"
        .value=${GLOBAL_STATE.pattern.width}
        @change=${(e) => updateChartWidth(Number(e.target.value))}
        min="3"
        max="1000" />
      <label>Height</label>
      <input
        class="input"
        type="number"
        .value=${GLOBAL_STATE.pattern.height}
        @change=${(e) => updateChartHeight(Number(e.target.value))}
        min="2"
        max="1000" />
    </div>
    ${stitchSelect()}
    <div class="chart-container">
      <div class="chart" @click=${(e) => chartInteraction(e)}>
        ${buildRows()}
      </div>
    </div>
  `;
}

function view() {
  return html`<div class="split">
    <div id="pattern-editor-container">${chartView()}</div>
    <div id="topology-graph-container"></div>
  </div>`;
}

function r() {
  render(view(), document.body);
  window.requestAnimationFrame(r);
}

function init() {
  r();

  Split(["#pattern-editor-container", "#topology-graph-container"], {
    sizes: [50, 50],
    minSize: 100,
    gutterSize: 11,
  });
  drawGraph(GLOBAL_STATE.pattern, "#topology-graph-container");
}

window.onload = init;
