import { GLOBAL_STATE, dispatch } from "../state";
import { devicePixelBoundingBox } from "../utils";
import {
  MIN_SCALE,
  MAX_SCALE,
  MIN_SIM_SCALE,
  MAX_SIM_SCALE,
} from "../constants";
import type { Vec2 } from "../types";

export function toggleFullscreen(): void {
  const doc = window.document;
  const docEl = doc.documentElement as any;

  const requestFullScreen =
    docEl.requestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.webkitRequestFullScreen ||
    docEl.msRequestFullscreen;
  const cancelFullScreen =
    (doc as any).exitFullscreen ||
    (doc as any).mozCancelFullScreen ||
    (doc as any).webkitExitFullscreen ||
    (doc as any).msExitFullscreen;

  if (
    !(doc as any).fullscreenElement &&
    !(doc as any).mozFullScreenElement &&
    !(doc as any).webkitFullscreenElement &&
    !(doc as any).msFullscreenElement
  ) {
    requestFullScreen.call(docEl);
  } else {
    cancelFullScreen.call(doc);
  }
}

export function centerZoom(scale: number): void {
  const bbox = document.getElementById("desktop")!.getBoundingClientRect();

  zoomAtPoint([bbox.width / 2, bbox.height / 2], scale);
}

export function centerZoomSimulation(scale: number): void {
  const bbox = document
    .getElementById("sim-container")!
    .getBoundingClientRect();

  zoomSimulationAtPoint([bbox.width / 2, bbox.height / 2], scale);
}

export function zoomSimulationAtPoint(pt: Vec2, simScale: number): void {
  if (simScale < MIN_SIM_SCALE || simScale > MAX_SIM_SCALE) return;

  const startX = (pt[0] - GLOBAL_STATE.simPan[0]) / GLOBAL_STATE.simScale;
  const startY = (pt[1] - GLOBAL_STATE.simPan[1]) / GLOBAL_STATE.simScale;

  dispatch({
    simScale,
    simPan: [pt[0] - startX * simScale, pt[1] - startY * simScale],
  });
}

export function zoomAtPoint(pt: Vec2, scale: number): void {
  if (scale < MIN_SCALE || scale > MAX_SCALE) return;

  const startX = (pt[0] - GLOBAL_STATE.chartPan[0]) / GLOBAL_STATE.scale;
  const startY = (pt[1] - GLOBAL_STATE.chartPan[1]) / GLOBAL_STATE.scale;

  dispatch({
    scale,
    chartPan: [pt[0] - startX * scale, pt[1] - startY * scale],
  });
}

export function fitChart(): void {
  const { width, height } = devicePixelBoundingBox(
    document.getElementById("desktop")!
  );

  const scale = Math.floor(
    0.9 *
      Math.min(
        Math.floor(width / GLOBAL_STATE.chart.width),
        Math.floor(height / GLOBAL_STATE.chart.height)
      )
  );

  dispatch({
    scale,
    chartPan: [
      (width - scale * GLOBAL_STATE.chart.width) / 2 / devicePixelRatio,
      (height - scale * GLOBAL_STATE.chart.height) / 2 / devicePixelRatio,
    ],
  });
}

export function sizeCanvasToBitmap(
  canvas: HTMLCanvasElement,
  bitmapWidth: number,
  bitmapHeight: number
): void {
  canvas.width = GLOBAL_STATE.scale * bitmapWidth;
  canvas.height = GLOBAL_STATE.scale * bitmapHeight;
  canvas.style.width = `${
    (GLOBAL_STATE.scale * bitmapWidth) / devicePixelRatio
  }px`;

  canvas.style.height = `${
    (GLOBAL_STATE.scale * bitmapHeight) / devicePixelRatio
  }px`;
}
