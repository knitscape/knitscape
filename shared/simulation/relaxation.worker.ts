import { yarnRelaxation } from "./relaxation";
import { segmentsToPoints } from "./layout";
import type {
  NodeType,
  RelaxSettings,
  ResolvedSegment,
  SegmentType,
} from "./types";

// ─── Message types ────────────────────────────────────────────────────────────

export type WorkerInit = {
  type: "init";
  nodes: NodeType[];
  segments: Record<number, SegmentType[]>;
  settings: RelaxSettings;
};

export type WorkerCommand =
  | WorkerInit
  | { type: "setSettings"; settings: Partial<RelaxSettings> }
  | { type: "start" }
  | { type: "restart" }
  | { type: "stop" };

export type WorkerTick = {
  type: "tick";
  pts: Record<number, Float32Array>;
  alpha: number;
  tickMs: number;
  running: boolean;
};

// ─── Worker state ─────────────────────────────────────────────────────────────

let nodes: NodeType[] = [];
let segments: Record<number, SegmentType[]> = {};
let yarnKeys: number[] = [];
let settings: RelaxSettings | null = null;
let sim: ReturnType<typeof yarnRelaxation> | undefined;
let looping = false;

// ─── Message handling ─────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init":
      if (sim) sim.stop();
      looping = false;
      sim = undefined;
      nodes = msg.nodes;
      segments = msg.segments;
      yarnKeys = Object.keys(segments).map(Number);
      settings = msg.settings;
      // Send an initial frame so the main thread has pts before relax starts.
      postTick(false);
      break;

    case "setSettings":
      // Mutate in place — the yarnRelaxation closure captures `settings` by
      // reference, so updates take effect on the next tick without rebuilding.
      if (settings) Object.assign(settings, msg.settings);
      break;

    case "start":
      if (!settings) return;
      if (!sim) sim = yarnRelaxation(settings);
      startLoop();
      break;

    case "restart":
      if (!settings) return;
      if (sim) sim.stop();
      sim = yarnRelaxation(settings);
      startLoop();
      break;

    case "stop":
      if (sim) sim.stop();
      looping = false;
      break;
  }
};

// ─── Tick loop ────────────────────────────────────────────────────────────────

function startLoop() {
  if (looping) return;
  looping = true;
  tickLoop();
}

function tickLoop() {
  if (!looping || !sim) return;
  if (!sim.running()) {
    looping = false;
    postTick(false);
    return;
  }
  const start = performance.now();
  sim.tick(
    segments as unknown as Record<string, ResolvedSegment[]>,
    nodes
  );
  const tickMs = performance.now() - start;
  postTick(true, tickMs);
  // setTimeout 0 yields so incoming messages (setSettings, stop, …) are
  // handled between ticks instead of being starved by a tight while-loop.
  setTimeout(tickLoop, 0);
}

function postTick(stillRunning: boolean, tickMs = 0) {
  const pts: Record<number, Float32Array> = {};
  const transferables: ArrayBuffer[] = [];
  for (const k of yarnKeys) {
    const arr = new Float32Array(segmentsToPoints(segments[k], nodes));
    pts[k] = arr;
    transferables.push(arr.buffer);
  }
  const payload: WorkerTick = {
    type: "tick",
    pts,
    alpha: sim?.alpha() ?? 1,
    tickMs,
    running: stillRunning,
  };
  (self as unknown as Worker).postMessage(payload, transferables);
}
