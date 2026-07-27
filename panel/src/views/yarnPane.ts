import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { editYarnColor, deleteYarn, addRandomYarn } from "../charting/yarn";
import type { Bimp } from "@shared/Bimp";

export function yarnPane() {
  const { cellHeight, chartPan, chart, bbox, yarnPalette, yarnExpanded } =
    GLOBAL_STATE;

  if (!chart || !yarnPalette) return;
  const chartHeight = Math.round(cellHeight * chart.height);
  const chartY = chartPan.y + Math.round(bbox.yMin * cellHeight);

  return html` <div
    class="yarn-panel ${yarnExpanded ? "expanded" : "collapsed"}">
    <div
      class="yarn-row-assignments"
      style="transform: translate(0px, ${-chartY}px);
      height: ${chartHeight}px;
      gap: ${cellHeight < 10 ? 0 : 1}px;">
      ${yarnSequence()}
    </div>

    <div class="manage-yarns">
      <div class="yarn-btns">
        <div @click=${() => dispatch({ yarnExpanded: !yarnExpanded })}>
          <i
            class="fa-solid ${yarnExpanded
              ? "fa-angles-left"
              : "fa-angles-right"}"></i>
        </div>
        <div @click=${addRandomYarn}>
          <i class="fa-solid fa-plus"></i>
        </div>
      </div>
      <div class="available-yarns">
        ${(yarnPalette ?? []).map(
          (color, index) =>
            html`<div
              class="edit-yarn yarn-cell"
              style="--color: ${color};"
              @click=${(e: Event) => editYarnColor(e, index)}>
              <i class="fa-solid fa-pen edit-yarn-icon"></i>
              <div class="delete-yarn">
                <button @click=${() => deleteYarn(index)}>
                  <i class="fa-solid fa-circle-xmark"></i>
                </button>
              </div>
            </div>`
        )}
      </div>
    </div>
  </div>`;
}

// Which yarns appear in each chart row. This is recomputed only when the yarn
// chart itself changes — yarnSequence() runs on every animation frame, and
// scanning the whole chart (plus a make2d() copy of it) each time dominated the
// frame budget on tall charts.
let rowYarnsCache: { chart: Bimp; count: number; rows: Set<number>[] } | null =
  null;

function rowYarns(yarnChart: Bimp, paletteLength: number): Set<number>[] {
  if (
    rowYarnsCache &&
    rowYarnsCache.chart === yarnChart &&
    rowYarnsCache.count === paletteLength
  ) {
    return rowYarnsCache.rows;
  }

  const { width, height, pixels } = yarnChart;
  const rows: Set<number>[] = new Array(height);

  for (let row = 0; row < height; row++) {
    const present = new Set<number>();
    const start = row * width;
    for (let x = 0; x < width; x++) present.add(pixels[start + x]);
    rows[row] = present;
  }

  rowYarnsCache = { chart: yarnChart, count: paletteLength, rows };
  return rows;
}

export function yarnSequence() {
  let { yarnChart, yarnPalette, scale, cellAspect } = GLOBAL_STATE;
  if (!yarnChart) return;
  let cellHeight = scale * cellAspect;

  const palette = yarnPalette ?? [];
  const rows = rowYarns(yarnChart, palette.length);
  const gap = cellHeight < 10 ? 0 : 1;

  const yarns = [];
  for (let row = 0; row < yarnChart.height; row++) {
    const present = rows[row];
    yarns.push(html`<div
      data-yarnrow=${row}
      class="yarn-row"
      style="gap: ${gap}px">
      ${palette.map(
        (yarn, index) =>
          html`<div
            data-yarnindex=${index}
            class="yarn-cell ${present.has(index + 1) ? "active" : "inactive"}"
            style="--color: ${yarn}"></div>`
      )}
    </div>`);
  }

  return yarns;
}
