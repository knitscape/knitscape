import { html } from "lit-html";
import { GLOBAL_STATE } from "../state";

let scale = 15;
let x = 35;
let y = 0;

export function timeNeedleView() {
  const { passSchedule, yarnSchedule, yarnPalette } = GLOBAL_STATE;
  return html`<div id="time-needle-pane" @wheel=${zoom} @pointerdown=${pan}>
    <div
      class="yarn-assignments"
      style="height: ${Math.round(
        passSchedule.length * scale
      )}px; transform: translateY(${y}px)">
      ${yarnSchedule.map(
        (yarn, index) =>
          html`<div style="--color: ${yarnPalette[yarn - 1]}" class="yarn-cell">
            <!-- <span>${index}</span> -->
          </div>`
      )}
    </div>
    <div
      class="time-needle-container"
      style="height: ${passSchedule.length *
      scale}px; transform: translate(${x}px, ${y}px)">
      <img id="timeneedlebitmap" />
    </div>
  </div> `;
}

function zoomAtPoint(pt, newScale) {
  if (newScale < 1 || newScale > 100) return;
  const start = {
    x: (pt.x - x) / scale,
    y: (pt.y - y) / scale,
  };

  scale = newScale;
  x = Math.round(pt.x - start.x * newScale);
  y = Math.round(pt.y - start.y * newScale);
}

function zoom(e) {
  let newScale;

  const bounds = e.currentTarget.getBoundingClientRect();

  if (Math.sign(e.deltaY) < 0) {
    newScale = GLOBAL_STATE.reverseScroll ? scale * 0.9 : scale * 1.1;
  } else {
    newScale = GLOBAL_STATE.reverseScroll ? scale * 1.1 : scale * 0.9;
  }

  zoomAtPoint(
    {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    },
    newScale
  );
}

function pan(e) {
  e.preventDefault();
  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = { x, y };

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos.x - e.clientX;
      const dy = startPos.y - e.clientY;

      x = Math.round(startPan.x - dx);
      y = Math.round(startPan.y - dy);
    }
  }

  function end() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}
