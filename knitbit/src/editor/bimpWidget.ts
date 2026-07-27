import {
  Extension,
  RangeSetBuilder,
  StateEffect,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree, foldService, foldEffect } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

export interface PaletteEntry {
  color: string;
  label: string;
}

export interface BimpEditTarget {
  exprFrom: number;
  exprTo: number;
  arrayFrom: number;
  arrayTo: number;
  width: number;
  height: number;
  pixels: number[];
  palette?: PaletteEntry[];
}

export type OnEditBimp = (target: BimpEditTarget) => void;

const MAX_PIXELS = 4096;

function expressionChildren(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) {
    const n = c.name;
    if (n === "(" || n === ")" || n === "[" || n === "]" || n === ",") continue;
    out.push(c);
  }
  return out;
}

function parseNumberLiteral(node: SyntaxNode, state: EditorState): number | null {
  if (node.name !== "Number") return null;
  const v = Number(state.doc.sliceString(node.from, node.to));
  return Number.isFinite(v) ? v : null;
}

function parseStringLiteral(node: SyntaxNode, state: EditorState): string | null {
  if (node.name !== "String") return null;
  const raw = state.doc.sliceString(node.from, node.to);
  if (raw.length < 2) return null;
  const quote = raw[0];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  if (raw[raw.length - 1] !== quote) return null;
  return raw.slice(1, -1);
}

// Accept either a bare string (legacy "#rgb" hex) or an object literal
// like { color: "#rgb", label: "main" }. We pull the two fields out with
// a lightweight regex on the source text so we don't have to mirror the
// full object-literal AST here.
function parsePaletteEntry(
  node: SyntaxNode,
  state: EditorState
): PaletteEntry | null {
  if (node.name === "String") {
    const color = parseStringLiteral(node, state);
    return color === null ? null : { color, label: "" };
  }
  if (node.name !== "ObjectExpression") return null;
  const text = state.doc.sliceString(node.from, node.to);
  const colorMatch = text.match(
    /\bcolor\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/
  );
  const labelMatch = text.match(
    /\blabel\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/
  );
  if (!colorMatch) return null;
  return {
    color: colorMatch[1] ?? colorMatch[2] ?? "",
    label: labelMatch ? (labelMatch[1] ?? labelMatch[2] ?? "") : "",
  };
}

function parseBimpNew(node: SyntaxNode, state: EditorState): BimpEditTarget | null {
  const nameNode = node.getChild("VariableName");
  if (!nameNode) return null;
  if (state.doc.sliceString(nameNode.from, nameNode.to) !== "Bimp") return null;

  const argList = node.getChild("ArgList");
  if (!argList) return null;
  const args = expressionChildren(argList);
  if (args.length < 3 || args.length > 4) return null;

  const width = parseNumberLiteral(args[0], state);
  const height = parseNumberLiteral(args[1], state);
  if (width === null || height === null) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (width * height > MAX_PIXELS) return null;

  if (args[2].name !== "ArrayExpression") return null;
  const pixelNodes = expressionChildren(args[2]);
  const pixels: number[] = [];
  for (const pn of pixelNodes) {
    const v = parseNumberLiteral(pn, state);
    if (v === null || !Number.isInteger(v) || v < 0 || v > 255) return null;
    pixels.push(v);
  }
  if (pixels.length !== width * height) return null;

  let palette: PaletteEntry[] | undefined;
  if (args.length === 4) {
    if (args[3].name !== "ArrayExpression") return null;
    const entryNodes = expressionChildren(args[3]);
    const entries: PaletteEntry[] = [];
    for (const en of entryNodes) {
      const entry = parsePaletteEntry(en, state);
      if (entry === null) return null;
      entries.push(entry);
    }
    palette = entries;
  }

  return {
    exprFrom: node.from,
    exprTo: node.to,
    arrayFrom: args[2].from,
    arrayTo: args[2].to,
    width,
    height,
    pixels,
    palette,
  };
}

class BimpEditButton extends WidgetType {
  constructor(
    private target: BimpEditTarget,
    private onClick: OnEditBimp
  ) {
    super();
  }

  eq(other: BimpEditButton): boolean {
    const a = this.target;
    const b = other.target;
    if (a.arrayFrom !== b.arrayFrom || a.arrayTo !== b.arrayTo) return false;
    if (a.width !== b.width || a.height !== b.height) return false;
    if (a.pixels.length !== b.pixels.length) return false;
    for (let i = 0; i < a.pixels.length; i++) {
      if (a.pixels[i] !== b.pixels[i]) return false;
    }
    const pa = a.palette ?? [];
    const pb = b.palette ?? [];
    if (pa.length !== pb.length) return false;
    for (let i = 0; i < pa.length; i++) {
      if (pa[i] !== pb[i]) return false;
    }
    return true;
  }

  toDOM(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "cm-bimp-edit-btn";
    btn.title = `Edit bitmap (${this.target.width}\u00D7${this.target.height})`;
    btn.innerHTML = `\u270E <span class="cm-bimp-edit-btn-label">${this.target.width}\u00D7${this.target.height}</span>`;
    btn.onmousedown = (e) => e.preventDefault();
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick(this.target);
    };
    return btn;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecos(view: EditorView, onClick: OnEditBimp): DecorationSet {
  const found: { pos: number; target: BimpEditTarget }[] = [];
  const tree = syntaxTree(view.state);
  tree.iterate({
    enter(nodeRef) {
      if (nodeRef.name !== "NewExpression") return;
      const target = parseBimpNew(nodeRef.node, view.state);
      if (target) {
        const line = view.state.doc.lineAt(nodeRef.from);
        found.push({ pos: line.from, target });
      }
    },
  });
  found.sort((a, b) => a.pos - b.pos);

  const builder = new RangeSetBuilder<Decoration>();
  for (const { pos, target } of found) {
    builder.add(
      pos,
      pos,
      Decoration.widget({
        widget: new BimpEditButton(target, onClick),
        side: -1,
      })
    );
  }
  return builder.finish();
}

const MIN_PIXELS_TO_AUTOFOLD = 32;

function foldRangeFor(target: BimpEditTarget): { from: number; to: number } | null {
  const from = target.arrayFrom + 1;
  const to = target.arrayTo - 1;
  if (to <= from) return null;
  return { from, to };
}

export const bimpFoldService = foldService.of(
  (state, lineStart, lineEnd) => {
    const tree = syntaxTree(state);
    let result: { from: number; to: number } | null = null;
    tree.iterate({
      from: lineStart,
      to: lineEnd,
      enter(nodeRef) {
        if (result) return false;
        if (nodeRef.name !== "NewExpression") return;
        const target = parseBimpNew(nodeRef.node, state);
        if (!target) return;
        if (target.arrayFrom < lineStart || target.arrayFrom > lineEnd) return;
        result = foldRangeFor(target);
        if (result) return false;
      },
    });
    return result;
  }
);

export function foldAllBimpPixels(view: EditorView): void {
  const effects: StateEffect<unknown>[] = [];
  const tree = syntaxTree(view.state);
  tree.iterate({
    enter(nodeRef) {
      if (nodeRef.name !== "NewExpression") return;
      const target = parseBimpNew(nodeRef.node, view.state);
      if (!target) return;
      if (target.pixels.length < MIN_PIXELS_TO_AUTOFOLD) return;
      const range = foldRangeFor(target);
      if (range) effects.push(foldEffect.of(range));
    },
  });
  if (effects.length > 0) view.dispatch({ effects });
}

export function bimpEditExtension(onEditBimp: OnEditBimp): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecos(view, onEditBimp);
      }
      update(update: ViewUpdate) {
        const treeChanged =
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (update.docChanged || update.viewportChanged || treeChanged) {
          this.decorations = buildDecos(update.view, onEditBimp);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
