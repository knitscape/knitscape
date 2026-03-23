import { GLOBAL_STATE, dispatch } from "../state";
import { getRandomColor } from "../utilities/misc";
import jscolor from "@eastdesire/jscolor";
import { Bimp } from "../lib/Bimp";

export function deleteYarn(index) {
  const { yarnPalette, yarnChart } = GLOBAL_STATE;

  if (yarnPalette.length == 1) {
    alert("you need some color in your life");
    return;
  }
  const newPalette = yarnPalette.filter((color, i) => i != index);
  const newBitmap = yarnChart.pixels.map((bit) => {
    if (bit == index) return 0;
    if (bit > index) return bit - 1;
    return bit;
  });
  //TODO: also remove yarn from yarn blocks

  dispatch({
    yarnPalette: newPalette,
    yarnChart: new Bimp(
      GLOBAL_STATE.yarnChart.width,
      GLOBAL_STATE.yarnChart.height,
      newBitmap
    ),
  });
}

export function editYarnColor(e, index) {
  const target = e.target;
  if (target.closest(".delete-color-button")) return;
  if (!target.jscolor) {
    const picker = new jscolor(target, {
      preset: "dark large",
      format: "hex",
      value: GLOBAL_STATE.yarnPalette[index],
      onInput: () => {
        const newPalette = [...GLOBAL_STATE.yarnPalette];
        newPalette[index] = picker.toHEXString();
        dispatch({
          yarnPalette: newPalette,
        });
      },
      previewElement: null,
    });
  }
  target.jscolor.show();
}

export function addRandomYarn() {
  let newPalette = [...GLOBAL_STATE.yarnPalette];
  newPalette.push(getRandomColor());
  dispatch({ yarnPalette: newPalette });
}
