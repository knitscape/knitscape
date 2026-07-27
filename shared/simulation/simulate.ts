import { hexToRgb } from "../hexToRgb";
import { segmentsToPoints, generateTopology, computeYarnPathSpline, layoutNodes } from "./layout";
import {
  DEFAULT_RELAX_SETTINGS,
  type StitchPatternType,
  type RelaxSettings,
} from "./types";
import type { WorkerCommand, WorkerTick } from "./relaxation.worker";

import { noodleRenderer } from "./renderer";

let renderer = noodleRenderer;

const YARN_DIAMETER = 0.27;
const STITCH_WIDTH = 1;
const BED_OFFSET = 0.1;

export interface SimulateOptions {
  canvas: HTMLCanvasElement;
  yarnPalette: string[];
  cellAspect: number;
  resetCamera?: boolean;
  relaxSettings?: RelaxSettings;
}

export function simulate(
  stitchPattern: StitchPatternType,
  options: SimulateOptions
) {
  const ASPECT = options.cellAspect;
  const params = {
    YARN_RADIUS: YARN_DIAMETER / 2,
    STITCH_WIDTH,
    ASPECT,
    BED_OFFSET,
  };

  const canvas = options.canvas;
  const relaxSettings: RelaxSettings =
    options.relaxSettings ?? { ...DEFAULT_RELAX_SETTINGS };

  // Worker state mirrored on the main thread for the UI readouts.
  let lastTickMs = 0;
  let currentAlpha = 1;
  let running = false;
  let everStarted = false;
  // Set when start/restart is sent, cleared by the first tick that reports
  // running. Guards against a pre-start frame landing after start and
  // making the UI think relaxation already converged.
  let pendingStart = false;
  let geometryDirty = false;

  const t0 = performance.now();

  const { DS, yarnPath } = generateTopology(stitchPattern);

  const nodes = layoutNodes(DS, stitchPattern, params);

  const segments = computeYarnPathSpline(
    DS,
    yarnPath,
    stitchPattern,
    nodes,
    params
  );

  const topologyMs = performance.now() - t0;

  const yarnPalette = options.yarnPalette;
  const yarnData = Object.entries(segments).map(([yarnIndex, segmentArr]) => {
    return {
      yarnIndex: yarnIndex,
      pts: segmentsToPoints(segmentArr, nodes),
      diameter: YARN_DIAMETER,
      color: hexToRgb(yarnPalette[Number(yarnIndex) - 1]).map(
        (colorInt: number) => colorInt / 255
      ),
    };
  });

  renderer.init(yarnData, canvas, options.resetCamera ?? true);

  // ─── Worker wiring ──────────────────────────────────────────────────────────
  //
  // Relaxation ticks run off the main thread. `nodes`/`segments` are
  // structure-cloned into the worker on init, so the copies above are only
  // used for the initial geometry — every subsequent position comes back as
  // control points on the tick messages.

  const worker = new Worker(
    new URL("./relaxation.worker.ts", import.meta.url),
    { type: "module" }
  );

  const send = (msg: WorkerCommand, transfer?: Transferable[]) => {
    worker.postMessage(msg, transfer ?? []);
  };

  function sendInit() {
    send({
      type: "init",
      nodes,
      segments,
      settings: relaxSettings,
    });
  }

  worker.onmessage = (e: MessageEvent<WorkerTick>) => {
    const msg = e.data;
    if (msg.type !== "tick") return;

    for (const yd of yarnData) {
      const arr = msg.pts[Number(yd.yarnIndex)];
      // Float32Array → number[] because buildYarnCurve is typed for number[];
      // the copy is cheap next to a tick.
      if (arr) yd.pts = Array.from(arr);
    }
    geometryDirty = true;
    currentAlpha = msg.alpha;
    lastTickMs = msg.tickMs;

    if (msg.running) {
      pendingStart = false;
      running = true;
    } else if (!pendingStart) {
      running = false;
    }
  };

  sendInit();

  // ─── Public API ─────────────────────────────────────────────────────────────

  function draw() {
    // The tick loop lives in the worker; the main thread just keeps the
    // renderer fed with whatever control points arrived most recently.
    if (everStarted && geometryDirty) {
      renderer.updateYarnGeometry(yarnData);
      geometryDirty = false;
    }
    renderer.draw();
  }

  function relax() {
    if (everStarted) return;
    send({ type: "start" });
    running = true;
    pendingStart = true;
    everStarted = true;
  }

  function restart() {
    send({ type: "restart" });
    running = true;
    pendingStart = true;
    everStarted = true;
  }

  function stopSim() {
    send({ type: "stop" });
    running = false;
    pendingStart = false;
  }

  function isRelaxing() {
    return running;
  }

  function updateSettings(partial: Partial<RelaxSettings>) {
    Object.assign(relaxSettings, partial);
    send({ type: "setSettings", settings: partial });
  }

  function terminate() {
    worker.terminate();
  }

  return {
    relax,
    restart,
    stopSim,
    draw,
    isRelaxing,
    updateSettings,
    terminate,
    topologyMs,
    getTickMs: () => lastTickMs,
    getAlpha: () => currentAlpha,
    fitCamera: () => renderer.fitCamera(),
  };
}
