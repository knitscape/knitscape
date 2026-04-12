import { Bimp } from "../../../shared/Bimp";
import { GLOBAL_STATE, dispatch } from "../state";
import { fitChart, fitSimulation } from "./zoomFit";
import { getRandomColor } from "../utils";
import type { PatternJSON } from "../types";

function loadJSON(patternJSON: PatternJSON): void {
  const { yarnSequence, yarnPalette, repeats, width, height } = patternJSON;

  dispatch({
    yarnPalette,
    yarnSequence: Bimp.fromJSON(yarnSequence),
    chart: Bimp.empty(width, height, 0),
    repeats: repeats.map(({ bitmap }) => ({
      bitmap: Bimp.fromJSON(bitmap),
    })),
  });

  fitChart();
  fitSimulation();
}

export function newPattern(): void {
  dispatch({
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
      },
    ],
  });
  fitChart();
  fitSimulation();
}

export function loadLibraryPattern(path: string): void {
  dispatch({ showLibrary: false });
  GLOBAL_STATE.patternLibrary[path]().then((mod: any) => loadJSON(mod));
}

export function uploadFile(): void {
  const fileInputElement = document.createElement("input");

  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  fileInputElement.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files![0];
    const fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = () => {
      loadJSON(JSON.parse(fileReader.result as string));
    };
  };
  document.body.removeChild(fileInputElement);
}
