import { bmp_lib } from "../lib/bmp";
import { hexToRgb } from "./misc";
import { SYMBOL_DATA } from "../constants";
import { scheduleChart } from "../charting/planner";

function downloadFile(dataStr, fileName) {
  const downloadAnchorNode = document.createElement("a");

  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", fileName);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

// TODO: Actually check these inputs
export function downloadWorkspace({
  cellAspect = 7 / 11,
  yarnPalette = ["#ebe9bbff"],
  boundaries = [],
  regions = [],
  blocks = [],
  paths = [],
  annotations = true,
  simLive = true,
}) {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(
      JSON.stringify({
        annotations,
        simLive,
        cellAspect,
        yarnPalette,
        boundaries,
        regions: regions.map(
          ({ pos, joinMode, shaping, yarnBlock, stitchBlock }) => {
            return {
              pos,
              joinMode,
              shaping,
              yarnBlock: yarnBlock.toJSON(),
              stitchBlock: stitchBlock.toJSON(),
            };
          }
        ),
        paths: paths.map(
          ({ pts, offset, tileMode, yarnBlock, stitchBlock }) => {
            return {
              pts,
              offset,
              tileMode,
              yarnBlock: yarnBlock.toJSON(),
              stitchBlock: stitchBlock.toJSON(),
            };
          }
        ),
        blocks: blocks.map(({ pos, yarnBlock, stitchBlock }) => {
          return {
            pos,
            yarnBlock: yarnBlock.toJSON(),
            stitchBlock: stitchBlock.toJSON(),
          };
        }),
      })
    );

  downloadFile(dataStr, "workspace.json");
}

const stitches = ".-,!#$%^&*()_+{}[]qwertyuiopasdfghjkl";

export function downloadKniterate({ machineChart, yarnSequence }) {
  const { passes, yarns } = scheduleChart(machineChart, yarnSequence);

  const colors = yarns.map((yarnIndex) =>
    new Array(machineChart.width).fill(yarnIndex).join("")
  );

  console.log(passes);
  const text =
    "FILE FORMAT : DAK\nYARNS\n" +
    colors.toReversed().join("\n") +
    "\nYARN PALETTE\nSTITCH SYMBOLS\n" +
    passes
      .toReversed()
      .map((row) => row.map((stitch) => stitches[stitch]).join(""))
      .join("\n") +
    "\nEND";

  downloadFile(
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    "pattern.txt"
  );
}

export function downloadTimeNeedleBMP(passSchedule) {
  const bmp2d = passSchedule.toReversed();
  const rgbPalette = Object.values(SYMBOL_DATA).map(({ color }) =>
    hexToRgb(color)
  );

  const im = document.createElement("img");
  bmp_lib.render(im, bmp2d, rgbPalette);

  downloadFile(im.src, "pattern.bmp");
}
