import { html } from "lit-html";
import { ref } from "lit-html/directives/ref.js";
import { EXAMPLES } from "./examples";
import { createEditor, type BimpEditTarget, type PaletteEntry } from "./editor";
import type { LayoutMode, RelaxSettings } from "./simulation/types";
import { SYMBOL_DATA } from "@shared/opData";
import { Bimp } from "@shared/Bimp";
import type { SavedScript } from "./scripts";

export type ScriptId =
  | { type: "saved"; name: string }
  | { type: "example"; name: string };

export type SimState = "idle" | "relaxing" | "relaxed";

export type BimpTool = "brush" | "line" | "rect" | "flood";

export interface BimpEditState {
  exprFrom: number;
  exprTo: number;
  width: number;
  height: number;
  pixels: number[];
  palette?: PaletteEntry[];
  brushValue: number;
  activeTool: BimpTool;
  dragFrom: [number, number] | null;
  dragTo: [number, number] | null;
  cellSize: number;
}

export interface AppState {
  code: string;
  cellSize: number;
  statusText: string;
  statusClass: string;
  simState: SimState;
  topologyMs: number;
  tickMs: number;
  showHelp: boolean;
  showExamplePicker: boolean;
  layoutMode: LayoutMode;
  editingBimp: BimpEditState | null;
  maxStitch: number;
  totalStitches: number;
  autoRun: boolean;
  scriptId: ScriptId;
  showScriptPicker: boolean;
  savedScripts: Record<string, SavedScript>;
  relaxSettings: RelaxSettings;
  simShowSettings: boolean;
  simAlpha: number;
}

export interface ViewHandlers {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSelectExample: (i: number) => void;
  onToggleExamplePicker: () => void;
  onToggleScriptPicker: () => void;
  onLoadScript: (name: string) => void;
  onDeleteScript: (name: string) => void;
  onRenameCurrentScript: (newName: string) => void;
  onRelax: () => void;
  onReset: () => void;
  onFitCamera: () => void;
  onRun: () => void;
  onToggleHelp: () => void;
  onToggleLayoutMode: () => void;
  onScrub: (n: number) => void;
  onEditBimp: (target: BimpEditTarget) => void;
  onBimpCancel: () => void;
  onBimpSave: () => void;
  onBimpPointerDown: (x: number, y: number) => void;
  onBimpPointerMove: (x: number, y: number) => void;
  onBimpPointerUp: () => void;
  onBimpToolSelect: (tool: BimpTool) => void;
  onBimpShift: (dx: number, dy: number) => void;
  onBimpBrushSelect: (value: number) => void;
  onBimpResize: (width: number, height: number) => void;
  onBimpZoom: (delta: number) => void;
  onBimpPaletteColorChange: (index: number, color: string) => void;
  onBimpPaletteLabelChange: (index: number, label: string) => void;
  onBimpPaletteAdd: () => void;
  onToggleAutoRun: () => void;
  onDocChange: () => void;
  onDownloadBmp: () => void;
  onDownloadJson: () => void;
  onDownloadScript: () => void;
  onToggleSimSettings: () => void;
  onRelaxSettingChange: <K extends keyof RelaxSettings>(
    key: K,
    value: RelaxSettings[K]
  ) => void;
  onResetRelaxSettings: () => void;
}

const FALLBACK_COLORS: string[] = [
  SYMBOL_DATA[0].color,
  SYMBOL_DATA[1].color,
  SYMBOL_DATA[2].color,
  SYMBOL_DATA[3].color,
  SYMBOL_DATA[4].color,
  SYMBOL_DATA[5].color,
  SYMBOL_DATA[6].color,
  "#a8dadc",
  "#e63946",
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#264653",
  "#f1faee",
  "#457b9d",
  "#1d3557",
];

function colorFor(value: number, palette?: PaletteEntry[]): string {
  if (palette && value >= 0 && value < palette.length)
    return palette[value].color;
  return FALLBACK_COLORS[Math.max(0, value) % FALLBACK_COLORS.length];
}

export function view(state: AppState, handlers: ViewHandlers) {
  return html`
    <div class="flex flex-1 overflow-hidden min-h-0">
        <div id="editor-pane" class="flex flex-col overflow-hidden min-w-0">
          <div id="code-pane" class="flex flex-col overflow-hidden min-h-0 relative">
            <div
              class="shrink-0 flex items-center justify-between gap-2 py-[0.3rem] px-3 bg-[var(--base1)] [border-bottom:1px_solid_var(--base3)]">
              <span
                class="text-[0.82rem] [font-variation-settings:'wght'_700] tracking-[0.04em] text-[color:var(--accent)] shrink-0 mr-1 select-none">
                knitbit
              </span>
              ${state.scriptId.type === "saved"
                ? html`<input
                    type="text"
                    .value=${state.scriptId.name}
                    @change=${(e: Event) =>
                      handlers.onRenameCurrentScript(
                        (e.target as HTMLInputElement).value
                      )}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur();
                    }}
                    spellcheck="false"
                    class="min-w-0 w-[14rem] bg-transparent border border-transparent hover:border-[color:var(--base4)] focus:border-[color:var(--base5)] focus:bg-[var(--base2)] focus:outline-none rounded-[3px] py-[0.1rem] px-[0.35rem] text-[0.82rem] [font-variation-settings:'wght'_600] text-[color:var(--base13)]" />`
                : html`<span
                    class="text-[0.78rem] text-[color:var(--base7)] italic truncate"
                    title=${state.scriptId.name + " (example)"}>
                    ${state.scriptId.name}
                    <span class="text-[0.68rem] opacity-70">(example)</span>
                  </span>`}
              <div class="flex items-center gap-[0.3rem]">
                <button
                  class="flex items-center gap-[0.35rem] bg-[var(--base2)] border border-[color:var(--base4)] py-[0.2rem] px-[0.5rem] text-[0.72rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Load a saved script"
                  @click=${handlers.onToggleScriptPicker}>
                  <i class="fa-solid fa-folder-open"></i> Load
                </button>
                <button
                  class="flex items-center gap-[0.35rem] bg-[var(--base2)] border border-[color:var(--base4)] py-[0.2rem] px-[0.5rem] text-[0.72rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Load an example"
                  @click=${handlers.onToggleExamplePicker}>
                  <i class="fa-solid fa-book-open"></i> Load Example
                </button>
                <button
                  class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Download this script as a .js file"
                  @click=${handlers.onDownloadScript}>
                  <i class="fa-solid fa-download"></i>
                </button>
                <button
                  class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Help"
                  @click=${handlers.onToggleHelp}>
                  <i class="fa-solid fa-question"></i>
                </button>
              </div>
            </div>
            <div
              id="code-editor"
              ${ref((el) => {
                if (el && !el.querySelector(".cm-editor"))
                  createEditor(
                    el as HTMLElement,
                    state.code,
                    handlers.onRun,
                    handlers.onEditBimp,
                    handlers.onDocChange
                  );
              })}
              class="flex-1 w-full overflow-hidden bg-[var(--base0)]"></div>
            ${state.editingBimp ? bimpEditorPane(state.editingBimp, handlers) : ""}
            <div
              class="shrink-0 flex items-center gap-2 py-[0.3rem] px-3 bg-[var(--base1)] [border-top:1px_solid_var(--base3)]">
              <span
                class="flex-1 min-w-0 text-[0.78rem] whitespace-nowrap overflow-hidden text-ellipsis ${state.statusClass}">
                ${state.statusText}
              </span>
              <button
                class="flex items-center gap-[0.3rem] py-[0.2rem] px-[0.5rem] text-[0.72rem] rounded-[3px] cursor-pointer [transition:background_80ms,color_80ms] shrink-0 ${state.autoRun
                  ? "bg-[var(--accent)] text-white border-0 hover:brightness-110"
                  : "bg-[var(--base2)] border border-[color:var(--base4)] text-[color:var(--base10)] hover:bg-[var(--base4)] hover:text-[color:var(--base13)]"}"
                title=${state.autoRun
                  ? "Auto-run is ON \u2014 click to turn off"
                  : "Auto-run is OFF \u2014 click to run on every edit"}
                @click=${handlers.onToggleAutoRun}>
                <i class="fa-solid fa-bolt"></i> Auto
              </button>
              <button
                ?disabled=${state.autoRun}
                class="flex items-center gap-[0.4rem] [font-variation-settings:'wght'_600] py-[0.2rem] px-[0.6rem] text-[0.75rem] rounded-[3px] border-0 [transition:filter_80ms] shrink-0 ${state.autoRun
                  ? "bg-[var(--base3)] text-[color:var(--base7)] cursor-not-allowed"
                  : "bg-[var(--accent)] text-white cursor-pointer hover:brightness-110"}"
                title=${state.autoRun
                  ? "Auto-run is on \u2014 the script runs automatically"
                  : "Run script (Ctrl/Cmd+Enter)"}
                @click=${handlers.onRun}>
                <i class="fa-solid fa-play"></i> Run
                <span
                  class="text-[0.68rem] opacity-80 [font-variation-settings:'wght'_500]"
                  >\u2318\u21B5</span
                >
              </button>
            </div>
          </div>
          <div
            id="chart-pane"
            class="flex flex-col overflow-hidden min-h-0 bg-[var(--base1)] [border-top:1px_solid_var(--base3)]">
            <div
              id="chart-content"
              class="flex flex-1 overflow-hidden relative">
              <div
                id="chart-sidebar-wrap"
                class="shrink-0 overflow-hidden bg-[var(--base2)] [border-right:1px_solid_var(--base3)] cursor-grab">
                <div
                  id="chart-sidebar-inner"
                  class="px-2 py-3 will-change-transform">
                  <canvas id="chart-sidebar" class="block"></canvas>
                </div>
              </div>
              <div
                id="chart-scroll"
                class="flex-1 overflow-auto chart-scrollbar cursor-grab">
                <div class="px-3 py-3 w-max">
                  <div class="relative">
                    <canvas id="chart-canvas" class="block"></canvas>
                    <div
                      id="chart-col-highlight"
                      class="chart-col-highlight pointer-events-none absolute hidden"></div>
                    <div
                      id="chart-scrub-cell"
                      class="chart-scrub-cell pointer-events-none absolute hidden"></div>
                  </div>
                </div>
              </div>
              <div
                id="chart-row-highlight"
                class="chart-row-highlight pointer-events-none absolute left-0 right-0 hidden"></div>
              <div
                id="chart-scrub-row"
                class="chart-scrub-row pointer-events-none absolute left-0 right-0 hidden"></div>
            </div>
            ${state.totalStitches > 0
              ? html`<div
                  class="shrink-0 flex items-center gap-3 py-[0.35rem] px-3 bg-[var(--base1)] [border-top:1px_solid_var(--base3)]">
                  <span
                    class="text-[0.7rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] shrink-0">
                    Step
                  </span>
                  <input
                    type="range"
                    min="0"
                    max=${state.totalStitches}
                    step="1"
                    .value=${String(state.maxStitch)}
                    @input=${(e: Event) =>
                      handlers.onScrub(+(e.target as HTMLInputElement).value)}
                    class="flex-1 accent-[var(--accent)]" />
                  <span
                    class="font-mono text-[0.72rem] text-[color:var(--base10)] tabular-nums w-[5.5rem] text-right shrink-0">
                    ${state.maxStitch} / ${state.totalStitches}
                  </span>
                </div>`
              : ""}
            <div
              class="shrink-0 flex items-center justify-between gap-2 py-[0.3rem] px-3 bg-[var(--base1)] [border-top:1px_solid_var(--base3)]">
              <span
                id="chart-coord"
                class="font-mono text-[0.72rem] text-[color:var(--base7)] tabular-nums">
                &nbsp;
              </span>
              <div class="flex items-center gap-[0.3rem]">
                <details class="chart-menu relative">
                  <summary
                    class="list-none flex items-center gap-[0.3rem] h-[1.5rem] px-[0.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.72rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                    title="Download program data">
                    <i class="fa-solid fa-download text-[0.7rem]"></i>
                    <span>Download</span>
                    <i class="fa-solid fa-caret-down text-[0.6rem] opacity-70"></i>
                  </summary>
                  <div
                    class="absolute right-0 bottom-full mb-1 min-w-[11rem] bg-[var(--base2)] border border-[color:var(--base4)] rounded-[3px] shadow-lg z-20 overflow-hidden">
                    <button
                      class="block w-full text-left py-[0.35rem] px-[0.6rem] text-[0.78rem] text-[color:var(--base12)] bg-transparent border-0 cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                      @click=${(e: MouseEvent) => {
                        (
                          (e.currentTarget as HTMLElement).closest(
                            "details"
                          ) as HTMLDetailsElement
                        ).open = false;
                        handlers.onDownloadBmp();
                      }}>
                      Bitmap (.bmp)
                    </button>
                    <button
                      class="block w-full text-left py-[0.35rem] px-[0.6rem] text-[0.78rem] text-[color:var(--base12)] bg-transparent border-0 cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                      @click=${(e: MouseEvent) => {
                        (
                          (e.currentTarget as HTMLElement).closest(
                            "details"
                          ) as HTMLDetailsElement
                        ).open = false;
                        handlers.onDownloadJson();
                      }}>
                      Control data (.json)
                    </button>
                  </div>
                </details>
                <button
                  class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.7rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Zoom out"
                  @click=${handlers.onZoomOut}>
                  <i class="fa-solid fa-minus"></i>
                </button>
                <button
                  class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.7rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                  title="Zoom in"
                  @click=${handlers.onZoomIn}>
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          id="preview-pane"
          class="flex flex-col overflow-hidden min-w-0 bg-[var(--base1)]">
          <div
            class="shrink-0 flex items-center justify-between gap-2 py-[0.3rem] px-3 bg-[var(--base1)] [border-bottom:1px_solid_var(--base3)]">
            <span
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)]">
              Preview
            </span>
            <div class="flex items-center gap-[0.3rem]">
              <div
                class="flex border border-[color:var(--base4)] rounded-[3px] overflow-hidden"
                title="Toggle between technical (row-based) and compressed (per-needle count) layout">
                <button
                  class=${`py-[0.2rem] px-[0.55rem] text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.04em] uppercase text-[color:var(--base12)] cursor-pointer [transition:background_80ms] ${
                    state.layoutMode === "technical"
                      ? "bg-[var(--base4)]"
                      : "bg-[var(--base2)] hover:bg-[var(--base3)]"
                  }`}
                  @click=${() =>
                    state.layoutMode !== "technical" &&
                    handlers.onToggleLayoutMode()}>
                  technical
                </button>
                <button
                  class=${`py-[0.2rem] px-[0.55rem] text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.04em] uppercase text-[color:var(--base12)] cursor-pointer [transition:background_80ms] [border-left:1px_solid_var(--base4)] ${
                    state.layoutMode === "compressed"
                      ? "bg-[var(--base4)]"
                      : "bg-[var(--base2)] hover:bg-[var(--base3)]"
                  }`}
                  @click=${() =>
                    state.layoutMode !== "compressed" &&
                    handlers.onToggleLayoutMode()}>
                  compressed
                </button>
              </div>
              <button
                class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                title="Fit view"
                @click=${handlers.onFitCamera}>
                <i class="fa-solid fa-expand"></i>
              </button>
              ${state.simState === "idle"
                ? html`<button
                    class="flex items-center gap-[0.4rem] bg-[var(--accent)] text-white [font-variation-settings:'wght'_600] py-[0.2rem] px-[0.6rem] text-[0.75rem] rounded-[3px] border-0 cursor-pointer [transition:filter_80ms] hover:brightness-110"
                    title="Relax simulation"
                    @click=${handlers.onRelax}>
                    <i class="fa-solid fa-play"></i> Relax
                  </button>`
                : html`<button
                    class="flex items-center gap-[0.4rem] bg-[var(--accent)] text-white [font-variation-settings:'wght'_600] py-[0.2rem] px-[0.6rem] text-[0.75rem] rounded-[3px] border-0 cursor-pointer [transition:filter_80ms] hover:brightness-110"
                    title="Reset simulation to initial layout"
                    @click=${handlers.onReset}>
                    <i class="fa-solid fa-rotate-left"></i> Reset
                  </button>`}
            </div>
          </div>
          <div class="flex-1 min-h-0 relative">
            <canvas id="sim-canvas" class="block w-full h-full"></canvas>
            <div
              class="absolute top-2 left-2 flex flex-col gap-[0.15rem] font-mono text-[0.7rem] text-[color:var(--base8)] pointer-events-none">
              <span>topology: ${state.topologyMs.toFixed(1)}ms</span>
              ${state.simState !== "idle"
                ? html`<span>tick: ${state.tickMs.toFixed(1)}ms</span>`
                : ""}
              ${state.simState === "relaxing"
                ? html`<span>α: ${state.simAlpha.toFixed(3)}</span>`
                : ""}
            </div>
            ${simSettingsPanel(state, handlers)}
          </div>
        </div>
    </div>

    ${state.showHelp ? helpModal(handlers) : ""}
    ${state.showExamplePicker ? examplePickerModal(handlers) : ""}
    ${state.showScriptPicker ? scriptPickerModal(state, handlers) : ""}
  `;
}

interface SliderConfig {
  key: keyof RelaxSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const RELAX_SLIDERS: SliderConfig[] = [
  {
    key: "kYarn",
    label: "yarn stiffness",
    min: 0,
    max: 2,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "tYarn",
    label: "bending stiffness",
    min: 0,
    max: 0.1,
    step: 0.001,
    format: (v) => v.toFixed(3),
  },
  {
    key: "iterations",
    label: "iterations / frame",
    min: 1,
    max: 16,
    step: 1,
    format: (v) => v.toFixed(0),
  },
  {
    key: "velocityDecay",
    label: "velocity decay",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "alphaMin",
    label: "stop threshold (α)",
    min: 0,
    max: 0.1,
    step: 0.0005,
    format: (v) => (v === 0 ? "off" : v.toFixed(4)),
  },
];

function simSettingsPanel(state: AppState, handlers: ViewHandlers) {
  if (!state.simShowSettings) {
    return html`
      <button
        class="absolute top-2 right-2 flex items-center justify-center w-[1.75rem] h-[1.75rem] bg-[var(--base2)]/90 backdrop-blur border border-[color:var(--base4)] text-[0.8rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
        title="Simulation settings"
        @click=${handlers.onToggleSimSettings}>
        <i class="fa-solid fa-gear"></i>
      </button>
    `;
  }

  return html`
    <div
      class="absolute top-2 right-2 w-[16rem] bg-[var(--base1)]/95 backdrop-blur border border-[color:var(--base3)] rounded-[4px] shadow-xl flex flex-col">
      <div
        class="flex items-center justify-between gap-2 py-[0.4rem] px-3 [border-bottom:1px_solid_var(--base3)]">
        <span
          class="text-[0.7rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base10)]">
          Simulation
        </span>
        <div class="flex items-center gap-1">
          <button
            class="flex items-center justify-center h-[1.4rem] px-[0.4rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.65rem] rounded-[3px] text-[color:var(--base11)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
            title="Reset to defaults"
            @click=${handlers.onResetRelaxSettings}>
            reset
          </button>
          <button
            class="flex items-center justify-center w-[1.4rem] h-[1.4rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.7rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
            title="Close"
            @click=${handlers.onToggleSimSettings}>
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-[0.55rem] py-3 px-3">
        ${RELAX_SLIDERS.map((s) => {
          const value = state.relaxSettings[s.key];
          return html`
            <label class="flex flex-col gap-[0.2rem]">
              <div
                class="flex items-baseline justify-between text-[0.7rem] text-[color:var(--base11)]">
                <span>${s.label}</span>
                <span class="font-mono text-[color:var(--base12)]"
                  >${s.format(value)}</span
                >
              </div>
              <input
                type="range"
                min=${s.min}
                max=${s.max}
                step=${s.step}
                .value=${String(value)}
                class="w-full accent-[var(--accent)]"
                @input=${(e: Event) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  handlers.onRelaxSettingChange(s.key, v);
                }} />
            </label>
          `;
        })}
      </div>
    </div>
  `;
}

function scriptPickerModal(state: AppState, handlers: ViewHandlers) {
  const entries = Object.entries(state.savedScripts).sort(
    ([, a], [, b]) => b.updatedAt - a.updatedAt
  );
  return html`
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      @click=${(e: MouseEvent) => {
        if (e.target === e.currentTarget) handlers.onToggleScriptPicker();
      }}>
      <div
        class="bg-[var(--base1)] border border-[color:var(--base3)] rounded-[4px] shadow-xl w-[min(420px,100%)] max-h-[80vh] flex flex-col overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 py-[0.5rem] px-4 [border-bottom:1px_solid_var(--base3)] shrink-0">
          <span
            class="text-[0.78rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base10)]">
            Load script
          </span>
          <button
            class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
            title="Close"
            @click=${handlers.onToggleScriptPicker}>
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 py-[0.3rem]">
          ${entries.length === 0
            ? html`<div
                class="py-6 px-4 text-center text-[0.82rem] text-[color:var(--base7)] italic">
                No saved scripts yet.
              </div>`
            : entries.map(
                ([name, entry]) => html`<div
                  class="flex items-center gap-2 py-[0.25rem] pl-4 pr-2 [transition:background_80ms] hover:bg-[var(--base2)]">
                  <button
                    class="flex-1 min-w-0 text-left py-[0.3rem] bg-transparent border-0 text-[color:var(--base12)] cursor-pointer hover:text-[color:var(--base13)]"
                    @click=${() => handlers.onLoadScript(name)}>
                    <div class="text-[0.82rem] truncate">${name}</div>
                    <div
                      class="text-[0.68rem] text-[color:var(--base7)] tabular-nums">
                      ${new Date(entry.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <button
                    class="flex items-center justify-center w-[1.6rem] h-[1.6rem] bg-transparent border-0 text-[0.75rem] rounded-[3px] text-[color:var(--base7)] cursor-pointer [transition:background_80ms,color_80ms] hover:bg-[var(--base3)] hover:text-red-400 shrink-0"
                    title="Delete ${name}"
                    @click=${(e: MouseEvent) => {
                      e.stopPropagation();
                      handlers.onDeleteScript(name);
                    }}>
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>`
              )}
        </div>
      </div>
    </div>
  `;
}

function examplePickerModal(handlers: ViewHandlers) {
  return html`
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      @click=${(e: MouseEvent) => {
        if (e.target === e.currentTarget) handlers.onToggleExamplePicker();
      }}>
      <div
        class="bg-[var(--base1)] border border-[color:var(--base3)] rounded-[4px] shadow-xl w-[min(360px,100%)] max-h-[80vh] flex flex-col overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 py-[0.5rem] px-4 [border-bottom:1px_solid_var(--base3)] shrink-0">
          <span
            class="text-[0.78rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base10)]">
            Load example
          </span>
          <button
            class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
            title="Close"
            @click=${handlers.onToggleExamplePicker}>
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 py-[0.3rem]">
          ${EXAMPLES.map(
            (ex, i) => html`<button
              class="block w-full text-left py-[0.4rem] px-4 text-[0.82rem] bg-transparent border-0 text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base3)] hover:text-[color:var(--base13)]"
              @click=${() => handlers.onSelectExample(i)}>
              ${ex.name}
            </button>`
          )}
        </div>
      </div>
    </div>
  `;
}

function bimpEditorPane(edit: BimpEditState, handlers: ViewHandlers) {
  const { width, height, pixels, palette, brushValue } = edit;
  const cellSizePx = edit.cellSize;

  const brushValues: number[] = [];
  if (palette && palette.length > 0) {
    for (let i = 0; i < palette.length; i++) brushValues.push(i);
  } else {
    const seen = new Set<number>();
    for (const v of pixels) seen.add(v);
    for (let i = 0; i <= 6; i++) seen.add(i);
    const arr = Array.from(seen).sort((a, b) => a - b);
    brushValues.push(...arr);
  }

  return html`
    <div
      class="absolute inset-0 z-10 bg-[var(--base1)] flex flex-col overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 py-[0.4rem] px-3 [border-bottom:1px_solid_var(--base3)] shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base10)] shrink-0">
              Bitmap
            </span>
            <div class="flex items-center gap-[0.3rem]">
              <input
                type="number"
                min="1"
                max="64"
                step="1"
                .value=${String(width)}
                @change=${(e: Event) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (Number.isFinite(v)) handlers.onBimpResize(v, height);
                }}
                title="Width"
                class="w-[3rem] bg-[var(--base2)] border border-[color:var(--base4)] rounded-[3px] py-[0.1rem] px-[0.3rem] text-[0.76rem] font-mono text-[color:var(--base12)] text-right" />
              <span class="text-[color:var(--base7)] text-[0.76rem]">\u00D7</span>
              <input
                type="number"
                min="1"
                max="64"
                step="1"
                .value=${String(height)}
                @change=${(e: Event) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (Number.isFinite(v)) handlers.onBimpResize(width, v);
                }}
                title="Height"
                class="w-[3rem] bg-[var(--base2)] border border-[color:var(--base4)] rounded-[3px] py-[0.1rem] px-[0.3rem] text-[0.76rem] font-mono text-[color:var(--base12)] text-right" />
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="flex items-center gap-[2px]">
              <button
                class="flex items-center justify-center w-[1.6rem] h-[1.6rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.72rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                title="Zoom out"
                @click=${() => handlers.onBimpZoom(-4)}>
                <i class="fa-solid fa-minus"></i>
              </button>
              <button
                class="flex items-center justify-center w-[1.6rem] h-[1.6rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.72rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
                title="Zoom in"
                @click=${() => handlers.onBimpZoom(4)}>
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
            <button
              class="py-[0.2rem] px-[0.65rem] text-[0.76rem] rounded-[3px] bg-[var(--base2)] border border-[color:var(--base4)] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
              title="Close without saving"
              @click=${handlers.onBimpCancel}>
              Cancel
            </button>
            <button
              autofocus
              class="py-[0.2rem] px-[0.8rem] text-[0.76rem] [font-variation-settings:'wght'_600] rounded-[3px] bg-[var(--accent)] text-white border-0 cursor-pointer [transition:filter_80ms] hover:brightness-110"
              title="Save changes to source"
              @click=${handlers.onBimpSave}>
              Save
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4">
          <div class="flex items-center gap-3 flex-wrap">
            <span
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)]">
              Tool
            </span>
            ${(
              [
                { tool: "brush", icon: "fa-paintbrush", title: "Brush" },
                { tool: "line", icon: "fa-slash", title: "Line" },
                { tool: "rect", icon: "fa-vector-square", title: "Rectangle" },
                { tool: "flood", icon: "fa-fill-drip", title: "Flood fill" },
              ] as const
            ).map(
              (t) => html`<button
                class="flex items-center justify-center w-[2rem] h-[2rem] text-[0.8rem] rounded-[3px] cursor-pointer [transition:background_80ms,color_80ms] ${edit.activeTool ===
                t.tool
                  ? "bg-[var(--accent)] text-white border-0"
                  : "bg-[var(--base2)] border border-[color:var(--base4)] text-[color:var(--base10)] hover:bg-[var(--base3)] hover:text-[color:var(--base13)]"}"
                title=${t.title}
                @click=${() => handlers.onBimpToolSelect(t.tool)}>
                <i class="fa-solid ${t.icon}"></i>
              </button>`
            )}
            <span
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] ml-3">
              Shift
            </span>
            ${[
              { dx: -1, dy: 0, icon: "fa-arrow-left", title: "Shift left" },
              { dx: 1, dy: 0, icon: "fa-arrow-right", title: "Shift right" },
              { dx: 0, dy: -1, icon: "fa-arrow-up", title: "Shift up" },
              { dx: 0, dy: 1, icon: "fa-arrow-down", title: "Shift down" },
            ].map(
              (d) => html`<button
                class="flex items-center justify-center w-[1.6rem] h-[1.6rem] text-[0.72rem] rounded-[3px] cursor-pointer bg-[var(--base2)] border border-[color:var(--base4)] text-[color:var(--base10)] hover:bg-[var(--base3)] hover:text-[color:var(--base13)]"
                title=${d.title}
                @click=${() => handlers.onBimpShift(d.dx, d.dy)}>
                <i class="fa-solid ${d.icon}"></i>
              </button>`
            )}
          </div>

          <div class="flex items-start gap-3">
            <div class="flex flex-col gap-[0.3rem] shrink-0">
              ${brushValues.map((v) => {
                const bg = colorFor(v, palette);
                const isInPalette = !!palette && v < palette.length;
                const entry = isInPalette ? palette![v] : null;
                return html`<div class="flex items-center gap-2">
                  <div class="relative shrink-0">
                    <button
                      class="flex items-center justify-center w-[2rem] h-[2rem] text-[0.72rem] font-mono rounded-[3px] cursor-pointer ${brushValue ===
                      v
                        ? "outline outline-2 outline-[var(--accent)] outline-offset-1"
                        : "outline outline-1 outline-[color:var(--base4)]"}"
                      style="background: ${bg}; color: ${pickTextColor(bg)}"
                      title=${entry
                        ? `${v} \u2014 ${entry.label || entry.color}`
                        : `${v}`}
                      @click=${() => handlers.onBimpBrushSelect(v)}>
                      ${v}
                    </button>
                    ${entry
                      ? html`<label
                          class="absolute -bottom-[3px] -right-[3px] w-[0.9rem] h-[0.9rem] flex items-center justify-center rounded-full bg-[var(--base1)] border border-[color:var(--base4)] text-[0.55rem] text-[color:var(--base10)] cursor-pointer hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] [transition:background_80ms,color_80ms,border-color_80ms]"
                          title="Edit color ${v}"
                          @click=${(e: MouseEvent) => e.stopPropagation()}>
                          <i class="fa-solid fa-pencil"></i>
                          <input
                            type="color"
                            .value=${entry.color}
                            @input=${(e: Event) =>
                              handlers.onBimpPaletteColorChange(
                                v,
                                (e.target as HTMLInputElement).value
                              )}
                            class="sr-only" />
                        </label>`
                      : ""}
                  </div>
                  ${entry
                    ? html`<input
                        type="text"
                        .value=${entry.label}
                        placeholder="label"
                        spellcheck="false"
                        @change=${(e: Event) =>
                          handlers.onBimpPaletteLabelChange(
                            v,
                            (e.target as HTMLInputElement).value
                          )}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        class="w-[7rem] bg-transparent border border-transparent hover:border-[color:var(--base4)] focus:border-[color:var(--base5)] focus:bg-[var(--base2)] focus:outline-none rounded-[3px] py-[0.1rem] px-[0.3rem] text-[0.74rem] text-[color:var(--base12)]" />`
                    : ""}
                </div>`;
              })}
              <button
                class="flex items-center justify-center w-[2rem] h-[2rem] text-[0.9rem] rounded-[3px] cursor-pointer bg-[var(--base2)] border border-[color:var(--base4)] text-[color:var(--base10)] hover:bg-[var(--base3)] hover:text-[color:var(--base13)]"
                title="Add a palette color"
                @click=${() => handlers.onBimpPaletteAdd()}>
                +
              </button>
            </div>

            <canvas
              class="block cursor-crosshair select-none rounded-[3px] bg-[var(--base3)]"
              style="width: ${width * cellSizePx}px; height: ${height * cellSizePx}px;"
              ${ref((el) => {
                if (el) drawBimpCanvas(el as HTMLCanvasElement, edit, cellSizePx);
              })}
              @pointerdown=${(e: PointerEvent) => {
                e.preventDefault();
                const [cx, cy] = canvasToCell(e, cellSizePx, height);
                (e.currentTarget as HTMLCanvasElement).setPointerCapture(
                  e.pointerId
                );
                handlers.onBimpPointerDown(cx, cy);
              }}
              @pointermove=${(e: PointerEvent) => {
                if (!edit.dragFrom) return;
                const [cx, cy] = canvasToCell(e, cellSizePx, height);
                handlers.onBimpPointerMove(cx, cy);
              }}
              @pointerup=${(e: PointerEvent) => {
                (e.currentTarget as HTMLCanvasElement).releasePointerCapture(
                  e.pointerId
                );
                handlers.onBimpPointerUp();
              }}
              @pointercancel=${() => handlers.onBimpPointerUp()}
              @wheel=${(e: WheelEvent) => {
                if (!e.ctrlKey && !e.metaKey) return;
                e.preventDefault();
                handlers.onBimpZoom(e.deltaY < 0 ? 4 : -4);
              }}></canvas>
          </div>
        </div>
    </div>
  `;
}

function canvasToCell(
  e: PointerEvent,
  cellSize: number,
  height: number
): [number, number] {
  const canvas = e.currentTarget as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.clientWidth / rect.width;
  const scaleY = canvas.clientHeight / rect.height;
  const x = Math.floor(((e.clientX - rect.left) * scaleX) / cellSize);
  const yFromTop = Math.floor(((e.clientY - rect.top) * scaleY) / cellSize);
  // Flip so row 0 is at the bottom, matching how the knit chart reads.
  const y = height - 1 - yFromTop;
  return [x, y];
}

function getDisplayPixels(edit: BimpEditState): number[] {
  if (!edit.dragFrom || !edit.dragTo) return edit.pixels;
  if (edit.activeTool !== "line" && edit.activeTool !== "rect") {
    return edit.pixels;
  }
  const bimp = new Bimp(edit.width, edit.height, edit.pixels);
  const result =
    edit.activeTool === "line"
      ? bimp.line(edit.dragFrom, edit.dragTo, edit.brushValue)
      : bimp.rect(edit.dragFrom, edit.dragTo, edit.brushValue);
  return Array.from(result.pixels);
}

function drawBimpCanvas(
  canvas: HTMLCanvasElement,
  edit: BimpEditState,
  cellSize: number
): void {
  const { width, height, palette } = edit;
  const pixels = getDisplayPixels(edit);

  const dpr = window.devicePixelRatio || 1;
  const pxW = width * cellSize;
  const pxH = height * cellSize;
  if (canvas.width !== pxW * dpr || canvas.height !== pxH * dpr) {
    canvas.width = pxW * dpr;
    canvas.height = pxH * dpr;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y++) {
    const screenY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x];
      ctx.fillStyle = colorFor(v, palette);
      ctx.fillRect(x * cellSize, screenY * cellSize, cellSize, cellSize);
    }
  }

  if (cellSize >= 10) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, pxH);
    }
    for (let y = 0; y <= height; y++) {
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(pxW, y * cellSize + 0.5);
    }
    ctx.stroke();
  }

  if (cellSize >= 24) {
    ctx.font = `${Math.floor(cellSize * 0.35)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < height; y++) {
      const screenY = height - 1 - y;
      for (let x = 0; x < width; x++) {
        const v = pixels[y * width + x];
        ctx.fillStyle = pickTextColor(colorFor(v, palette));
        ctx.fillText(
          String(v),
          x * cellSize + cellSize / 2,
          screenY * cellSize + cellSize / 2
        );
      }
    }
  }
}

function pickTextColor(bg: string): string {
  const hex = bg.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return "var(--base13)";
  const expand = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#111" : "#fff";
}

function bimpMethodTable(title: string, rows: [string, string][]) {
  return html`<div class="mb-4">
    <h4
      class="text-[0.68rem] [font-variation-settings:'wght'_600] tracking-[0.06em] uppercase text-[color:var(--base8)] mb-1">
      ${title}
    </h4>
    <table class="w-full text-[0.78rem]">
      <tbody>
        ${rows.map(
          ([sig, desc]) => html`<tr class="align-top">
            <td
              class="py-[0.2rem] pr-4 font-mono text-[color:var(--base13)] whitespace-nowrap">
              ${sig}
            </td>
            <td class="py-[0.2rem] text-[color:var(--base10)]">${desc}</td>
          </tr>`
        )}
      </tbody>
    </table>
  </div>`;
}

function helpModal(handlers: ViewHandlers) {
  return html`
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      @click=${(e: MouseEvent) => {
        if (e.target === e.currentTarget) handlers.onToggleHelp();
      }}>
      <div
        class="bg-[var(--base1)] border border-[color:var(--base3)] rounded-[4px] shadow-xl w-[min(720px,100%)] max-h-[85vh] flex flex-col overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 py-[0.5rem] px-4 [border-bottom:1px_solid_var(--base3)] shrink-0">
          <span
            class="text-[0.78rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base10)]">
            Script reference
          </span>
          <button
            class="flex items-center justify-center w-[1.5rem] h-[1.5rem] bg-[var(--base2)] border border-[color:var(--base4)] text-[0.75rem] rounded-[3px] text-[color:var(--base12)] cursor-pointer [transition:background_80ms] hover:bg-[var(--base4)]"
            title="Close"
            @click=${handlers.onToggleHelp}>
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          class="overflow-y-auto px-5 py-4 text-[0.82rem] leading-[1.55] text-[color:var(--base12)] flex flex-col gap-5">
          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Keyboard shortcuts
            </h3>
            <table class="w-full font-mono text-[0.78rem]">
              <tbody>
                ${[
                  ["\u2318 / Ctrl + Enter", "Run script"],
                  ["\u2318 / Ctrl + S", "Download current script as .js"],
                  ["Tab", "Indent (2 spaces)"],
                  ["Shift + Tab", "Outdent"],
                  ["\u2318 / Ctrl + Z", "Undo"],
                  ["\u2318 / Ctrl + Shift + Z", "Redo"],
                  ["\u2318 / Ctrl + F", "Find"],
                  ["\u2318 / Ctrl + Space", "Trigger autocomplete"],
                  ["\u2318 / Ctrl + wheel", "Zoom chart or bitmap editor"],
                  ["Esc", "Close any open modal"],
                ].map(
                  ([k, v]) => html`<tr>
                    <td
                      class="py-[0.15rem] pr-4 text-[color:var(--base10)] whitespace-nowrap align-top">
                      ${k}
                    </td>
                    <td class="py-[0.15rem]">${v}</td>
                  </tr>`
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Script workspace
            </h3>
            <ul
              class="list-disc pl-5 text-[color:var(--base10)] space-y-[0.3rem]">
              <li>
                The script pane auto-saves to browser storage as you type.
                When you edit a read-only example, it forks into an
                <code class="font-mono">Untitled</code> saved script.
              </li>
              <li>
                <b>Load</b> opens saved scripts (with delete);
                <b>Load Example</b> opens the bundled examples.
              </li>
              <li>
                Click the script name in the toolbar to rename. Names must
                be unique.
              </li>
              <li>
                The <i class="fa-solid fa-bolt"></i> <b>Auto</b> toggle runs
                the script live on every edit (typing, bitmap paints,
                resizes, palette changes). Run is disabled while Auto is
                on; Ctrl/Cmd+Enter still works as a manual kick.
              </li>
              <li>
                The last-opened script is restored on page refresh.
              </li>
            </ul>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Chart pane
            </h3>
            <ul
              class="list-disc pl-5 text-[color:var(--base10)] space-y-[0.3rem]">
              <li><b>Drag</b> anywhere to pan the chart and sidebar.</li>
              <li>
                <b>Click a cell</b> to set the step scrubber to that
                stitch — the 3D preview jumps to that point.
              </li>
              <li>
                <b>Ctrl/Cmd + scroll</b> to zoom cells in and out.
              </li>
              <li>
                The Step slider scrubs through the program one op at a
                time (skipping MISS / EMPTY).
              </li>
            </ul>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Bitmap editor
            </h3>
            <p class="mb-2 text-[color:var(--base10)]">
              Inline bitmap literals
              (<code class="font-mono">new Bimp(w, h, […], […])</code>) get
              an accent-colored <b>✎</b> edit badge in the gutter. Click
              it to paint the bitmap visually.
            </p>
            <ul
              class="list-disc pl-5 text-[color:var(--base10)] space-y-[0.3rem]">
              <li>
                <b>Tools</b>: brush (paint, drag to paint continuously),
                line and rectangle (click-drag), flood fill.
              </li>
              <li>
                <b>Shift</b> arrows move the whole bitmap one cell with
                wraparound.
              </li>
              <li>
                Resize via the W × H inputs. Zoom with the +/− buttons or
                Ctrl/Cmd + scroll on the grid.
              </li>
              <li>
                Palette swatches pick the brush value; the small pencil
                badge opens the native color picker; the text field
                next to each swatch edits its label. Click
                <b>+</b> to add a new palette color.
              </li>
              <li>
                Save commits changes to source (the whole
                <code class="font-mono">new Bimp(...)</code> call is
                rewritten). Cancel or Esc discards.
              </li>
            </ul>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Operations (Op)
            </h3>
            <p class="mb-2 text-[color:var(--base10)]">
              Each cell of the <code class="font-mono">ops</code> bitmap is one
              of:
            </p>
            <table class="w-full font-mono text-[0.78rem]">
              <tbody>
                ${[
                  ["Op.MISS", "0", "Yarn floats past the needle"],
                  ["Op.FKNIT", "1", "Front bed knit"],
                  ["Op.FTUCK", "2", "Front bed tuck"],
                  ["Op.BKNIT", "3", "Back bed knit"],
                  ["Op.BTUCK", "4", "Back bed tuck"],
                  ["Op.FTB", "5", "Transfer front \u2192 back"],
                  ["Op.BTF", "6", "Transfer back \u2192 front"],
                  ["Op.FDROP", "7", "Drop loop from front bed"],
                  ["Op.BDROP", "8", "Drop loop from back bed"],
                  ["Op.EMPTY", "9", "No action (use for non-transfer cells in a transfer row)"],
                ].map(
                  ([name, val, desc]) => html`<tr>
                    <td
                      class="py-[0.15rem] pr-4 text-[color:var(--base13)] whitespace-nowrap align-top">
                      ${name}
                    </td>
                    <td
                      class="py-[0.15rem] pr-4 text-[color:var(--base7)] whitespace-nowrap align-top">
                      = ${val}
                    </td>
                    <td class="py-[0.15rem] font-sans">${desc}</td>
                  </tr>`
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Return value
            </h3>
            <p class="mb-2 text-[color:var(--base10)]">
              Your script must return an object with the following fields:
            </p>
            <table class="w-full font-mono text-[0.78rem]">
              <tbody>
                ${[
                  [
                    "ops",
                    "Bimp",
                    "Bitmap of Op values (width \u00d7 height).",
                  ],
                  [
                    "yarnFeeder",
                    "(number | null)[]",
                    "Feeder id per row. Use null for a transfer-only row (no yarn).",
                  ],
                  [
                    "direction",
                    '("left"|"right")[]?',
                    "Carriage direction per row. If omitted, each yarn starts right and flips on each subsequent row it's used; transfer rows flip from the previous row.",
                  ],
                  [
                    "palette",
                    "string[]",
                    "CSS colors, indexed by feeder id \u2212 1.",
                  ],
                  [
                    "racking",
                    "number[]?",
                    "Bed offset per row. Defaults to zeros.",
                  ],
                ].map(
                  ([name, type, desc]) => html`<tr>
                    <td
                      class="py-[0.2rem] pr-4 text-[color:var(--base13)] whitespace-nowrap align-top">
                      ${name}
                    </td>
                    <td
                      class="py-[0.2rem] pr-4 text-[color:var(--base7)] whitespace-nowrap align-top">
                      ${type}
                    </td>
                    <td class="py-[0.2rem] font-sans">${desc}</td>
                  </tr>`
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3
              class="text-[0.72rem] [font-variation-settings:'wght'_600] tracking-[0.08em] uppercase text-[color:var(--base7)] mb-2">
              Available globals
            </h3>
            <p class="text-[color:var(--base10)] mb-3">
              <code class="font-mono text-[color:var(--base13)]">Bimp</code>
              is an immutable bitmap class. Every method that transforms
              pixels returns a new <code class="font-mono">Bimp</code>.
              <code class="font-mono text-[color:var(--base13)]">Op</code>
              is the enum above.
            </p>
            <p class="mb-3 text-[color:var(--base10)]">
              The optional 4th arg to <code class="font-mono">new Bimp</code>
              is a palette (for the inline bitmap editor). Each entry is
              either a hex string
              (<code class="font-mono">"#f00"</code>) or an object
              <code class="font-mono">{ color: "#f00", label: "main" }</code>
              — the label is editable next to each swatch.
            </p>
            ${bimpMethodTable("Constructors", [
              ["new Bimp(w, h, pixels, palette?)", "Raw construction. pixels is any ArrayLike<number>."],
              ["Bimp.empty(w, h, color)", "Uniform fill."],
              ["Bimp.fromTile(w, h, tile)", "Repeat a Bimp to fill w × h. Palette flows through."],
              ["Bimp.fromJSON({width, height, pixels})", "Deserialize."],
            ])}
            ${bimpMethodTable("Read / inspect", [
              ["pixel(x, y)", "Value at (x, y); -1 if out of bounds."],
              ["pixelAt(x, y)", "Same, but negative indices wrap (x = -1 → last column)."],
              ["make2d()", "Return pixels as number[height][width]."],
              ["uniqueValues()", "Sorted array of distinct pixel values."],
              ["count(color)", "Number of cells equal to color."],
              ["equals(other)", "Same dimensions and pixels (palette ignored)."],
              ["forEach(fn)", "Call fn(value, x, y) on every pixel."],
              ["toJSON()", "{ width, height, pixels } plain object."],
            ])}
            ${bimpMethodTable("Draw", [
              ["brush(pos, color)", "Set one pixel."],
              ["draw(changes)", "Bulk: [{x, y, color}, …]."],
              ["indexedDraw(changes)", "Bulk by linear index: [{index, color}, …]."],
              ["rect(start, end, color)", "Filled rectangle. start / end are [x, y]."],
              ["line(from, to, color)", "Rasterized line."],
              ["circle(center, radius, color)", "Filled disk."],
              ["flood(pos, color)", "4-way flood fill from pos."],
              ["overlay(other, pos, skip?, avoid?)", "Paste other at pos. skip = source value to skip; avoid = dest value not to overwrite."],
            ])}
            ${bimpMethodTable("Compose / reshape", [
              ["crop(x, y, w, h)", "Extract sub-rectangle. Out-of-bounds cells fill with 0."],
              ["concat(other, axis)", `Stack side-by-side ("x") or top-to-bottom ("y"). Throws on mismatched cross-dimension.`],
              ["repeat(nx, ny)", "Tile this Bimp nx × ny times."],
              ["trim(bgColor = 0)", "Crop to the bounding box of non-background pixels."],
              ["pad(padX, padY, color)", "Add a uniform border."],
              ["resize(w, h, emptyColor = 0)", "Reshape anchored at top-left; new cells get emptyColor."],
            ])}
            ${bimpMethodTable("Orient / reflect", [
              ["hFlip()", "Mirror horizontally."],
              ["vFlip()", "Mirror vertically."],
              ["rotate90() / rotate180() / rotate270()", "Rotate (clockwise). 90° / 270° swap width and height."],
              ["transpose()", "Swap axes: out.pixel(y, x) === this.pixel(x, y)."],
              ["shift(dx, dy)", "Shift all pixels with wrap-around."],
            ])}
            ${bimpMethodTable("Value mapping / palette", [
              ["map(fn)", "Call fn(value, x, y) → newValue on every pixel."],
              ["replace(oldColor, newColor)", "Swap one value everywhere."],
              ["remap(table)", "Lookup replacement. Array: table[old] = new. Object: { [old]: new }. Missing keys pass through."],
              ["withPalette(palette?)", "Return a copy with the palette replaced (or cleared)."],
            ])}
          </section>
        </div>
      </div>
    </div>
  `;
}
