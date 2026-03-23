import { Bimp } from "../lib/Bimp";
import { GLOBAL_STATE, dispatch } from "../state";
import { rasterizeChart } from "../charting/evalChart";
import { bBoxAllBoundaries } from "../charting/helpers";
import { fitChart } from "../interaction/chartPanZoom";

export function hydrateWorkspaceJSON(rawJSON) {
  // TODO: Make a default workspace and pull from there
  let {
    cellAspect = 7 / 11,
    yarnPalette = ["#ebe9bbff"],
    boundaries = [],
    regions = [],
    blocks = [],
    paths = [],
    annotations = true,
    simLive = true,
  } = rawJSON;

  loadWorkspace({
    annotations,
    simLive,
    cellAspect,
    yarnPalette,
    boundaries,
    regions: regions.map(
      ({ pos, joinMode = "none", shaping = 0, yarnBlock, stitchBlock }) => {
        return {
          pos,
          joinMode,
          shaping,
          yarnBlock: Bimp.fromJSON(yarnBlock),
          stitchBlock: Bimp.fromJSON(stitchBlock),
        };
      }
    ),
    paths: paths.map(
      ({ pts, offset, tileMode = "tiled", yarnBlock, stitchBlock }) => {
        return {
          pts,
          offset,
          tileMode,
          yarnBlock: Bimp.fromJSON(yarnBlock),
          stitchBlock: Bimp.fromJSON(stitchBlock),
        };
      }
    ),
    blocks: blocks.map(({ pos, yarnBlock, stitchBlock }) => {
      return {
        pos,
        yarnBlock: Bimp.fromJSON(yarnBlock),
        stitchBlock: Bimp.fromJSON(stitchBlock),
      };
    }),
  });
}

export function uploadFile(cb) {
  let fileInputElement = document.createElement("input");
  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";
  fileInputElement.onchange = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0]);
    fileReader.onload = () => cb(fileReader.result);
  };

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  document.body.removeChild(fileInputElement);
}

export function loadWorkspace(workspace) {
  const { boundaries, regions, blocks, paths } = workspace;

  // Make chart by evaluating workspace
  let { stitchChart, yarnChart, machineChart, yarnSequence, rowMap } =
    rasterizeChart(boundaries, regions, blocks, paths);

  dispatch({
    ...workspace,
    chart: stitchChart,
    yarnChart: yarnChart,
    machineChart,
    yarnSequence,
    rowMap,
    bbox: bBoxAllBoundaries(boundaries),
    selectedBoundary: null,
    selectedPath: null,
    selectedBlock: null,
    blockEditMode: null,
  });
  setTimeout(() => fitChart());
}

export function uploadWorkspace() {
  uploadFile((fileContent) => hydrateWorkspaceJSON(JSON.parse(fileContent)));
  dispatch({ showUpload: false });
}

export function loadExampleWorkspace(path) {
  dispatch({ showExampleLibrary: false });
  GLOBAL_STATE.exampleLibrary[path]().then((mod) => hydrateWorkspaceJSON(mod));
}
