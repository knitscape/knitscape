import { Bimp } from "../lib/Bimp";
import { GLOBAL_STATE, dispatch } from "../state";
import { fitChart } from "./zoomFit";
import { getRandomColor } from "../utils";

function loadJSON(patternJSON) {
  let { yarnSequence, yarnPalette, repeats, width, height } = patternJSON;

  dispatch({
    yarnPalette,
    width,
    height,
    yarnSequence: Bimp.fromJSON(yarnSequence),
    chart: Bimp.empty(width, height, 0),
    repeats: repeats.map(({ bitmap, pos, area }) => {
      return {
        bitmap: Bimp.fromJSON(bitmap),
        pos,
        area,
      };
    }),
  });

  fitChart();
}

export function newPattern() {
  dispatch({
    repeats: [],
    yarnSequence: new Bimp(1, 4, [0, 0, 1, 1]),
    yarnPalette: [getRandomColor(), getRandomColor()],
    chart: Bimp.empty(30, 40, 0),
    repeats: [
      {
        bitmap: new Bimp(
          4,
          4,
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ),
        area: [30, 40],
        pos: [0, 0],
      },
    ],
  });
  fitChart();
}

export function loadLibraryPattern(path) {
  dispatch({ showLibrary: false });
  GLOBAL_STATE.patternLibrary[path]().then((mod) => loadJSON(mod));
}

export function uploadFile() {
  let fileInputElement = document.createElement("input");

  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  fileInputElement.onchange = (e) => {
    let file = e.target.files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = () => {
      loadJSON(JSON.parse(fileReader.result));
    };
  };
  document.body.removeChild(fileInputElement);
}
