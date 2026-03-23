import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { editYarnColor, deleteYarn, addRandomYarn } from "../charting/yarn";

export function yarnPane() {
  const { cellHeight, chartPan, chart, bbox, yarnPalette, yarnExpanded } =
    GLOBAL_STATE;

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
        ${yarnPalette.map(
          (color, index) =>
            html`<div
              class="edit-yarn yarn-cell"
              style="--color: ${color};"
              @click=${(e) => editYarnColor(e, index)}>
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

export function yarnSequence() {
  let { yarnChart, yarnPalette, scale, cellAspect } = GLOBAL_STATE;
  if (!yarnChart) return;
  let cellHeight = scale * cellAspect;

  let yarn2d = yarnChart.make2d();

  const yarns = [];
  for (let row = 0; row < yarnChart.height; row++) {
    yarns.push(html`<div
      data-yarnrow=${row}
      class="yarn-row"
      style="gap: ${cellHeight < 10 ? 0 : 1}px">
      ${yarnPalette.map(
        (yarn, index) =>
          html`<div
            data-yarnindex=${index}
            class="yarn-cell ${yarn2d[row].includes(index + 1)
              ? "active"
              : "inactive"}"
            style="--color: ${yarn}"></div>`
      )}
    </div>`);
  }

  return yarns;
}
