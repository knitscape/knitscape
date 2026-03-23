import { html } from "lit-html";
import { GLOBAL_STATE, dispatch } from "../state";
import { LAYERS } from "../constants";
import { getRandomColor, shuffle } from "../utils";
import jscolor from "@eastdesire/jscolor";
import { Bimp } from "../lib/Bimp";

function symbolPicker() {
  return html` <div id="symbol-picker">
    <h3>Symbols</h3>
    ${GLOBAL_STATE.symbolMap.map(
      (symbolName, index) => html`<button
        class="btn solid img ${GLOBAL_STATE.activeSymbol == index
          ? "current"
          : ""}"
        @click=${() => dispatch({ activeSymbol: index })}>
        <div>${symbolName}</div>
        <canvas class="symbol-preview" data-symbol=${symbolName}></canvas>
      </button>`
    )}
  </div>`;
}

function motifLibrary() {
  return html`<div id="repeat-library">
    <h2>Motifs</h2>
    <div id="repeat-library-content" class="scroller">
      ${GLOBAL_STATE.repeatLibrary.map(
        (repeat, index) => html`
          <div class="repeat-library-canvas">
            <canvas
              data-repeattitle=${repeat.title}
              draggable="true"
              data-repeatlibraryindex=${index}></canvas>
          </div>
          <div class="repeat-size">
            ${repeat.bitmap.width}x${repeat.bitmap.height}
          </div>
          <div class="repeat-title">${repeat.title}</div>
        `
      )}
    </div>
  </div>`;
}

function deleteColor(index) {
  if (GLOBAL_STATE.yarnPalette.length == 1) {
    alert("you need some color in your life");
    return;
  }
  const newPalette = GLOBAL_STATE.yarnPalette.filter((color, i) => i != index);
  const newBitmap = GLOBAL_STATE.yarnSequence.pixels.map((bit) => {
    if (bit == index) return 0;
    if (bit > index) return bit - 1;
    return bit;
  });

  dispatch({
    yarnPalette: newPalette,
    yarnSequence: new Bimp(
      GLOBAL_STATE.yarnSequence.width,
      GLOBAL_STATE.yarnSequence.height,
      newBitmap
    ),
  });
}

function editColor(index) {
  const target = document.getElementById(`color-${index}`);
  if (!target.jscolor) {
    const picker = new jscolor(target, {
      preset: "dark large",
      format: "hexa",
      value: GLOBAL_STATE.yarnPalette[index],
      onInput: () => {
        const newPalette = [...GLOBAL_STATE.yarnPalette];
        newPalette[index] = picker.toRGBAString();
        dispatch({
          yarnPalette: newPalette,
          yarnSequence: GLOBAL_STATE.yarnSequence,
        });
      },
      previewElement: null,
    });
  }
  target.jscolor.show();
}

function yarnPicker() {
  return html`<div id="yarn-picker">
    <h3>Yarns</h3>
    <div>
      <button
        class="btn icon ${GLOBAL_STATE.editingPalette ? "selected" : ""}"
        @click=${() =>
          dispatch({ editingPalette: !GLOBAL_STATE.editingPalette })}>
        <i class="fa-solid fa-pen"></i>
      </button>
      <button
        class="btn icon"
        @click=${() => {
          let newPalette = [...GLOBAL_STATE.yarnPalette];
          newPalette.push(getRandomColor());
          dispatch({ yarnPalette: newPalette });
        }}>
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
    ${GLOBAL_STATE.yarnPalette.map(
      (hexa, index) =>
        html`<button
          class="btn solid color-select ${index == GLOBAL_STATE.activeYarn
            ? "selected"
            : ""}"
          @click=${() => dispatch({ activeYarn: index })}>
          <div class="color-label">${index + 1}</div>
          <div class="color-preview" style="--current: ${hexa};">
            ${GLOBAL_STATE.editingPalette
              ? html`
                  <button
                    class="delete-color-button"
                    @click=${() => deleteColor(index)}>
                    <i class="fa-solid fa-circle-xmark"></i>
                  </button>
                  <button
                    id="color-${index}"
                    class="edit-color-btn"
                    @click=${(e) => editColor(index)}></button>
                  <div
                    class="edit-color-icon"
                    @click=${(e) => editColor(index)}>
                    <i class="fa-solid fa-pen"></i>
                  </div>
                `
              : ""}
          </div>
        </button>`
    )}

    <div>
      <button
        class="btn icon"
        @click=${() => {
          dispatch({
            yarnPalette: [...shuffle(GLOBAL_STATE.yarnPalette)],
          });
        }}>
        <i class="fa-solid fa-arrows-rotate"></i>
      </button>
      <button
        class="btn icon"
        @click=${() => {
          dispatch({
            yarnPalette: Array.from(
              Array(GLOBAL_STATE.yarnPalette.length),
              () => getRandomColor()
            ),
          });
        }}>
        <i class="fa-solid fa-dice"></i>
      </button>
    </div>
  </div>`;
}

function addRepeat() {
  const newBitmap = Bimp.empty(2, 2, [0, 0, 0, 0]);

  dispatch({
    repeats: [
      ...GLOBAL_STATE.repeats,
      {
        bitmap: newBitmap,
        area: [newBitmap.width, newBitmap.height],
        pos: [0, 0],
      },
    ],
    editingRepeat: GLOBAL_STATE.repeats.length,
  });
}

export function leftBar() {
  return html`<div id="left-bar" class="scroller">
    <button class="btn solid add-repeat" @click=${() => addRepeat()}>
      <i class="fa-solid fa-plus"></i>
    </button>
    ${symbolPicker()} ${yarnPicker()}
  </div>`;
}
