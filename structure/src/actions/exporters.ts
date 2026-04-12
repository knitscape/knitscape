import { GLOBAL_STATE } from "../state";
import { download } from "../utils";

export function downloadPunchcard(): void {
  const svg = document.getElementById("punchcard")!;

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);

  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(
      /^<svg/,
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
  }

  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

  download(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source),
    "punchcard.svg"
  );
}

export function downloadSilverKnitTxt(): void {
  const text =
    "SilverKnit\n" +
    GLOBAL_STATE.repeats[0].bitmap
      .make2d()
      .map((row) =>
        row
          .map((pixel) => {
            if (pixel == 0 || pixel == 1) return 7;
            else return 8;
          })
          .join("")
      )
      .join("\n");

  download(
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    "pattern.txt"
  );
}

export function downloadKniterate(): void {
  const width = GLOBAL_STATE.chart.width;
  const chartHeight = GLOBAL_STATE.chart.height;
  const colors: string[] = [];

  for (let y = 0; y < chartHeight; y++) {
    const paletteIndex = GLOBAL_STATE.yarnSequence.pixel(
      0,
      (chartHeight - y - 1) % GLOBAL_STATE.yarnSequence.height
    );

    colors.push(new Array(width).fill(paletteIndex).join(""));
  }

  const text =
    "FILE FORMAT : DAK\nYARNS\n" +
    colors.join("\n") +
    "\nYARN PALETTE\nSTITCH SYMBOLS\n" +
    GLOBAL_STATE.chart
      .make2d()
      .map((row) =>
        row
          .map((pixel) => {
            if (pixel == 0 || pixel == 1) return ".";
            else return "-";
          })
          .join("")
      )
      .join("\n") +
    "\nEND";

  download(
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    "pattern.txt"
  );
}

export function downloadJSON(): void {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(
      JSON.stringify({
        width: GLOBAL_STATE.chart.width,
        height: GLOBAL_STATE.chart.height,
        repeats: GLOBAL_STATE.repeats.map(({ bitmap }) => {
          return { bitmap: bitmap.toJSON() };
        }),
        yarnPalette: GLOBAL_STATE.yarnPalette,
        yarnSequence: GLOBAL_STATE.yarnSequence.toJSON(),
      })
    );

  download(dataStr, "pattern.json");
}
