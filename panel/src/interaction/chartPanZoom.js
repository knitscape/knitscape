import { GLOBAL_STATE, dispatch } from "../state";

export function pan(e) {
  const startPos = { x: e.clientX, y: e.clientY };
  const startPan = GLOBAL_STATE.chartPan;
  document.body.classList.add("moving");

  function move(e) {
    if (e.buttons == 0) {
      end();
    } else {
      const dx = startPos.x - e.clientX;
      const dy = startPos.y - e.clientY;

      dispatch({
        chartPan: {
          x: Math.floor(startPan.x - dx),
          y: Math.floor(startPan.y + dy),
        },
      });
    }
  }

  function end() {
    document.body.classList.remove("moving");

    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointerleave", end);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointerleave", end);
}

export function fitChart() {
  const { cellAspect, chart, bbox } = GLOBAL_STATE;

  const { width, height } = document
    .getElementById("svg-layer")
    .getBoundingClientRect();

  const scale = Math.floor(
    0.9 *
      Math.min(
        Math.floor(width / chart.width),
        Math.floor(height / (chart.height * cellAspect))
      )
  );

  const xOffset = (width - scale * chart.width) / 2;
  const yOffset = (height - scale * chart.height * cellAspect) / 2;

  dispatch({
    scale,
    cellWidth: scale,
    cellHeight: scale * cellAspect,
    chartPan: {
      x: Math.round(xOffset - bbox.xMin * scale),
      y: Math.round(yOffset - bbox.yMin * scale * cellAspect),
    },
  });
}

export function zoomAtPoint(pt, newScale) {
  const { chartPan, cellAspect, scale } = GLOBAL_STATE;

  const start = {
    x: (pt.x - chartPan.x) / scale,
    y: (pt.y - chartPan.y) / scale,
  };

  dispatch({
    scale: newScale,
    cellWidth: newScale,
    cellHeight: newScale * cellAspect,
    chartPan: {
      x: Math.round(pt.x - start.x * newScale),
      y: Math.round(pt.y - start.y * newScale),
    },
  });
}

export function centerZoom(newScale) {
  let bbox = document.getElementById("svg-layer").getBoundingClientRect();
  zoomAtPoint({ x: bbox.width / 2, y: bbox.height / 2 }, newScale);
}

export function zoom(e) {
  const bounds = e.currentTarget.getBoundingClientRect();
  let { scale } = GLOBAL_STATE;

  // Scale is the cell width in pixels.
  if (Math.sign(e.deltaY) < 0) {
    scale = GLOBAL_STATE.reverseScroll
      ? Math.floor(scale * 0.9)
      : Math.ceil(scale * 1.1);
  } else {
    scale = GLOBAL_STATE.reverseScroll
      ? Math.ceil(scale * 1.1)
      : Math.floor(scale * 0.9);
  }

  scale = scale < 2 ? 2 : scale;

  zoomAtPoint(
    {
      x: e.clientX - bounds.left,
      y: bounds.height - (e.clientY - bounds.top),
    },
    scale
  );
}
