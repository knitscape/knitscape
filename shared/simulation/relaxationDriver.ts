import { noodleRenderer } from "./renderer";
import {
  DEFAULT_RELAX_SETTINGS,
  type NodeType,
  type RelaxSettings,
  type YarnData,
  type YarnSegments,
} from "./types";
import type { WorkerCommand, WorkerTick } from "./relaxation.worker";

const renderer = noodleRenderer;

export interface Geometry {
  nodes: NodeType[];
  segments: YarnSegments;
  yarnData: YarnData[];
}

export interface RelaxationDriverOptions {
  canvas: HTMLCanvasElement;
  resetCamera?: boolean;
  relaxSettings?: RelaxSettings;
}

/**
 * Owns the relaxation worker and the render loop for one piece of geometry.
 *
 * Everything here is independent of how the geometry was built, so each stitch
 * model only has to supply nodes + segments + yarn colors and can share this
 * driver. The worker lives next to this file so Vite's `new URL` worker
 * resolution stays a static relative path.
 */
export function createRelaxationDriver(
  initialGeometry: Geometry,
  options: RelaxationDriverOptions
) {
  const canvas = options.canvas;
  const relaxSettings: RelaxSettings = options.relaxSettings ?? {
    ...DEFAULT_RELAX_SETTINGS,
  };

  let geometry = initialGeometry;

  // Worker state mirrored on the main thread for the UI readouts.
  let lastTickMs = 0;
  let currentAlpha = 1;
  let running = false;
  let everStarted = false;
  // Set when start/restart is sent, cleared by the first tick that reports
  // running. Guards against a pre-start frame landing after start and making
  // the UI think relaxation already converged.
  let pendingStart = false;
  let geometryDirty = false;

  renderer.init(geometry.yarnData, canvas, options.resetCamera ?? true);

  const worker = new Worker(new URL("./relaxation.worker.ts", import.meta.url), {
    type: "module",
  });

  const send = (msg: WorkerCommand, transfer?: Transferable[]) => {
    worker.postMessage(msg, transfer ?? []);
  };

  function sendInit() {
    send({
      type: "init",
      nodes: geometry.nodes,
      segments: geometry.segments,
      settings: relaxSettings,
    });
  }

  worker.onmessage = (e: MessageEvent<WorkerTick>) => {
    const msg = e.data;
    if (msg.type !== "tick") return;

    for (const yd of geometry.yarnData) {
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

  function draw() {
    // The tick loop lives in the worker; the main thread just keeps the
    // renderer fed with whatever control points arrived most recently.
    if (everStarted && geometryDirty) {
      renderer.updateYarnGeometry(geometry.yarnData);
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

  /** Swap in freshly built geometry, reusing the same worker and canvas. */
  function rebuild(next: Geometry) {
    send({ type: "stop" });
    running = false;
    pendingStart = false;
    everStarted = false;
    geometryDirty = false;
    geometry = next;
    renderer.init(geometry.yarnData, canvas, false);
    sendInit();
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
    rebuild,
    terminate,
    getTickMs: () => lastTickMs,
    getAlpha: () => currentAlpha,
    fitCamera: () => renderer.fitCamera(),
  };
}
