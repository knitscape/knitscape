import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

const HEX_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

function normalizeHex(match: string): string {
  const h = match.slice(1);
  if (h.length === 3) return "#" + h.split("").map((c) => c + c).join("");
  if (h.length === 4)
    return "#" + h.slice(0, 3).split("").map((c) => c + c).join("");
  if (h.length === 8) return "#" + h.slice(0, 6);
  return "#" + h;
}

function pickContrast(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

class ColorSwatchWidget extends WidgetType {
  constructor(
    readonly match: string,
    readonly hex: string,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: ColorSwatchWidget): boolean {
    return (
      this.match === other.match &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const swatch = document.createElement("span");
    swatch.className = "cm-color-swatch";
    swatch.style.backgroundColor = this.match;
    swatch.title = `Pick color (${this.match})`;
    swatch.onmousedown = (e) => e.preventDefault();
    swatch.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "color";
      input.value = this.hex;
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "0";
      input.style.opacity = "0";
      document.body.appendChild(input);
      const finish = () => input.remove();
      input.addEventListener("change", () => {
        view.dispatch({
          changes: { from: this.from, to: this.to, insert: input.value },
        });
        finish();
      });
      input.addEventListener("blur", finish);
      input.click();
    };
    return swatch;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecos(view: EditorView): DecorationSet {
  type Range = { from: number; to: number; match: string; hex: string };
  const ranges: Range[] = [];
  const tree = syntaxTree(view.state);
  tree.iterate({
    enter(nodeRef) {
      if (nodeRef.name !== "String" && nodeRef.name !== "TemplateString")
        return;
      const text = view.state.doc.sliceString(nodeRef.from, nodeRef.to);
      HEX_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = HEX_RE.exec(text))) {
        ranges.push({
          from: nodeRef.from + m.index,
          to: nodeRef.from + m.index + m[0].length,
          match: m[0],
          hex: normalizeHex(m[0]),
        });
      }
    },
  });
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) {
    builder.add(
      r.from,
      r.from,
      Decoration.widget({
        widget: new ColorSwatchWidget(r.match, r.hex, r.from, r.to),
        side: -1,
      })
    );
    builder.add(
      r.from,
      r.to,
      Decoration.mark({
        class: "cm-color-mark",
        attributes: {
          style: `background-color:${r.match};--cm-color-fg:${pickContrast(
            r.hex
          )};`,
        },
      })
    );
  }
  return builder.finish();
}

export function colorWidgetExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecos(view);
      }
      update(update: ViewUpdate) {
        const treeChanged =
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (update.docChanged || update.viewportChanged || treeChanged) {
          this.decorations = buildDecos(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}
