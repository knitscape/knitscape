import { SYMBOL_DATA, BACK_OPS } from "@shared/opData";
import type { Bimp } from "@shared/Bimp";

const DIM = "#0000002a";

// Control columns have constant widths (in CSS px) regardless of cellSize.
// Only their height (per row) scales with the program's cellSize.
const GUTTER_PX = 3;
const RACK_WIDTH = 26;
const YARN_WIDTH = 14;
const DIR_WIDTH = 18;
const ROW_NUM_DIGIT_PX = 8;
const ROW_NUM_PAD_PX = 6;
const CTRL_FONT_PX = 12;
const ARROW_FONT_PX = 13;

export type SidebarColumn = "rowNum" | "racking" | "yarn" | "direction";

export interface SidebarLayout {
  rowNumX: number;
  rowNumW: number;
  rackX: number;
  rackW: number;
  yarnX: number;
  yarnW: number;
  dirX: number;
  dirW: number;
  totalWidth: number;
}

export function sidebarLayout(height: number): SidebarLayout {
  const rowNumDigits = Math.max(2, String(height).length);
  const rowNumW = ROW_NUM_DIGIT_PX * rowNumDigits + ROW_NUM_PAD_PX;
  const rackX = rowNumW + GUTTER_PX;
  const yarnX = rackX + RACK_WIDTH + GUTTER_PX;
  const dirX = yarnX + YARN_WIDTH + GUTTER_PX;
  return {
    rowNumX: 0,
    rowNumW,
    rackX,
    rackW: RACK_WIDTH,
    yarnX,
    yarnW: YARN_WIDTH,
    dirX,
    dirW: DIR_WIDTH,
    totalWidth: dirX + DIR_WIDTH,
  };
}

export function sidebarColumnAt(
  x: number,
  layout: SidebarLayout
): SidebarColumn | null {
  if (x >= layout.rowNumX && x < layout.rowNumX + layout.rowNumW)
    return "rowNum";
  if (x >= layout.rackX && x < layout.rackX + layout.rackW) return "racking";
  if (x >= layout.yarnX && x < layout.yarnX + layout.yarnW) return "yarn";
  if (x >= layout.dirX && x < layout.dirX + layout.dirW) return "direction";
  return null;
}

function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function drawChart(
  sidebarCanvas: HTMLCanvasElement,
  opsCanvas: HTMLCanvasElement,
  ops: Bimp,
  yarnFeeder: (number | null)[],
  direction: ("left" | "right")[],
  racking: number[],
  palette: string[],
  cellSize: number
) {
  const { width, height } = ops;

  const layout = sidebarLayout(height);
  const sidebarWidth = layout.totalWidth;
  const opsWidth = width * cellSize;
  const totalHeight = height * cellSize;

  sizeCanvas(sidebarCanvas, sidebarWidth, totalHeight);
  sizeCanvas(opsCanvas, opsWidth, totalHeight);

  const sCtx = sidebarCanvas.getContext("2d")!;
  const oCtx = opsCanvas.getContext("2d")!;
  sCtx.clearRect(0, 0, sidebarWidth, totalHeight);
  oCtx.clearRect(0, 0, opsWidth, totalHeight);

  const styles = getComputedStyle(document.documentElement);
  const colBg = styles.getPropertyValue("--base2").trim() || "#2a2a2a";
  const colFg = styles.getPropertyValue("--base10").trim() || "#ccc";
  const colMuted = styles.getPropertyValue("--base7").trim() || "#888";

  const { rowNumX, rowNumW, rackX, yarnX, dirX } = layout;

  // Cap font sizes so text stays readable when cellSize gets large; floor so it
  // doesn't disappear when zoomed way out. Text still scales between those bounds.
  const ctrlFontPx = Math.min(CTRL_FONT_PX, Math.max(7, Math.round(cellSize * 0.55)));
  const arrowFontPx = Math.min(ARROW_FONT_PX, Math.max(8, Math.round(cellSize * 0.6)));

  for (let y = 0; y < height; y++) {
    const canvasY = (height - y - 1) * cellSize;

    // ── Row-number column ─────────────────────────────────────────────
    sCtx.save();
    sCtx.translate(rowNumX, canvasY);
    sCtx.fillStyle = colMuted;
    sCtx.font = `${ctrlFontPx}px monospace`;
    sCtx.textAlign = "right";
    sCtx.textBaseline = "middle";
    sCtx.fillText(String(y + 1), rowNumW - 2, cellSize / 2);
    sCtx.restore();

    // ── Racking column ────────────────────────────────────────────────
    const rack = racking[y] ?? 0;
    sCtx.save();
    sCtx.translate(rackX, canvasY);
    sCtx.fillStyle = colBg;
    sCtx.fillRect(0, 0, RACK_WIDTH, cellSize);
    sCtx.fillStyle = colFg;
    sCtx.font = `${ctrlFontPx}px monospace`;
    sCtx.textAlign = "center";
    sCtx.textBaseline = "middle";
    sCtx.fillText(String(rack), RACK_WIDTH / 2, cellSize / 2);
    sCtx.restore();

    // ── Yarn column ───────────────────────────────────────────────────
    const yarnIndex = yarnFeeder[y];
    sCtx.save();
    sCtx.translate(yarnX, canvasY);
    sCtx.fillStyle =
      yarnIndex == null || yarnIndex === 0
        ? "#555555"
        : (palette[yarnIndex - 1] ?? "#555555");
    sCtx.fillRect(0, 0, YARN_WIDTH, cellSize);
    sCtx.restore();

    // ── Direction column ──────────────────────────────────────────────
    sCtx.save();
    sCtx.translate(dirX, canvasY);
    sCtx.fillStyle = colBg;
    sCtx.fillRect(0, 0, DIR_WIDTH, cellSize);
    sCtx.fillStyle = colFg;
    sCtx.font = `${arrowFontPx}px sans-serif`;
    sCtx.textAlign = "center";
    sCtx.textBaseline = "middle";
    const dir = direction[y] ?? "right";
    const arrow = dir === "right" ? "\u2192" : "\u2190";
    sCtx.fillText(arrow, DIR_WIDTH / 2, cellSize / 2);
    sCtx.restore();

    // ── Operations grid ───────────────────────────────────────────────
    for (let x = 0; x < width; x++) {
      const opIndex = ops.pixel(x, y);
      const symbolData = SYMBOL_DATA[opIndex];

      oCtx.save();
      oCtx.translate(x * cellSize, canvasY);
      oCtx.scale(cellSize, cellSize);

      oCtx.fillStyle = symbolData?.color ?? "#555555";
      oCtx.fillRect(0, 0, 1, 1);

      if (BACK_OPS.has(opIndex)) {
        oCtx.fillStyle = DIM;
        oCtx.fillRect(0, 0, 1, 1);
      }

      oCtx.lineWidth = 0.03;
      if (symbolData?.path) oCtx.stroke(symbolData.path);

      oCtx.restore();
    }
  }
}
