import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import {
  defaultKeymap,
  indentWithTab,
  history,
  historyKeymap,
} from "@codemirror/commands";
import {
  bracketMatching,
  syntaxHighlighting,
  codeFolding,
  foldGutter,
  foldKeymap,
  ensureSyntaxTree,
} from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  searchKeymap,
  highlightSelectionMatches,
} from "@codemirror/search";

import { knitbitTheme, knitbitHighlightStyle } from "./theme";
import { knitbitCompletions } from "./completions";
import {
  bimpEditExtension,
  bimpFoldService,
  foldAllBimpPixels,
  type OnEditBimp,
} from "./bimpWidget";
import { colorWidgetExtension } from "./colorWidget";

export type { BimpEditTarget, OnEditBimp, PaletteEntry } from "./bimpWidget";
import type { PaletteEntry } from "./bimpWidget";

let editorView: EditorView | null = null;

export function createEditor(
  parent: HTMLElement,
  initialCode: string,
  onRunScript: () => void,
  onEditBimp: OnEditBimp,
  onDocChange?: () => void
): EditorView {
  if (editorView) {
    editorView.destroy();
  }

  editorView = new EditorView({
    state: EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        javascript(),
        autocompletion({ override: [knitbitCompletions] }),
        syntaxHighlighting(knitbitHighlightStyle),
        knitbitTheme,
        codeFolding(),
        foldGutter(),
        bimpFoldService,
        bimpEditExtension(onEditBimp),
        colorWidgetExtension(),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || !onDocChange) return;
          const hasUserEdit = update.transactions.some(
            (tr) => tr.annotation(Transaction.userEvent) !== undefined
          );
          if (hasUserEdit) onDocChange();
        }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRunScript();
              return true;
            },
          },
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
        ]),
        EditorState.tabSize.of(2),
      ],
    }),
    parent,
  });

  new ResizeObserver(() => {
    editorView?.requestMeasure();
  }).observe(parent);

  if (ensureSyntaxTree(editorView.state, editorView.state.doc.length, 100)) {
    foldAllBimpPixels(editorView);
  }

  return editorView;
}

export function getEditorCode(): string {
  return editorView?.state.doc.toString() ?? "";
}

export function setEditorCode(code: string): void {
  if (!editorView) return;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: code,
    },
  });
  if (ensureSyntaxTree(editorView.state, editorView.state.doc.length, 100)) {
    foldAllBimpPixels(editorView);
  }
}

function formatPaletteEntry(entry: PaletteEntry): string {
  // If no label, keep the compact legacy form so round-tripping a
  // palette without labels doesn't bloat the source.
  if (!entry.label) return JSON.stringify(entry.color);
  return `{ color: ${JSON.stringify(entry.color)}, label: ${JSON.stringify(entry.label)} }`;
}

export function formatBimpExpression(
  width: number,
  height: number,
  pixels: number[],
  palette?: PaletteEntry[]
): string {
  const parts = [
    String(width),
    String(height),
    `[${pixels.join(", ")}]`,
  ];
  if (palette && palette.length > 0) {
    parts.push(`[${palette.map(formatPaletteEntry).join(", ")}]`);
  }
  return `new Bimp(${parts.join(", ")})`;
}

export function replaceBimpExpression(
  exprFrom: number,
  exprTo: number,
  width: number,
  height: number,
  pixels: number[],
  palette?: PaletteEntry[]
): void {
  if (!editorView) return;
  editorView.dispatch({
    changes: {
      from: exprFrom,
      to: exprTo,
      insert: formatBimpExpression(width, height, pixels, palette),
    },
  });
  if (ensureSyntaxTree(editorView.state, editorView.state.doc.length, 100)) {
    foldAllBimpPixels(editorView);
  }
}
