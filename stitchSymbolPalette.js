import knitUrl from "./assets/stitches/knit.png";
import slipUrl from "./assets/stitches/slip.png";
import tuckUrl from "./assets/stitches/tuck.png";
import purlUrl from "./assets/stitches/purl.png";
import knitTransparentUrl from "./assets/stitches/knit_transparent.png";
import slipTransparentUrl from "./assets/stitches/slip_transparent.png";
import tuckTransparentUrl from "./assets/stitches/tuck_transparent.png";
import purlTransparentUrl from "./assets/stitches/purl_transparent.png";

export async function stitchSymbolPalette() {
  const knit = new Image();
  knit.src = knitUrl;
  await knit.decode();
  const slip = new Image();
  slip.src = slipUrl;
  await slip.decode();
  const tuck = new Image();
  tuck.src = tuckUrl;
  await tuck.decode();
  const purl = new Image();
  purl.src = purlUrl;
  await purl.decode();

  return [
    { image: knit, title: "Knit" },
    { image: purl, title: "Purl" },
    { image: slip, title: "Slip" },
    { image: tuck, title: "Tuck" },
  ];
}

export async function transparentStitchPalette() {
  const knit = new Image();
  knit.src = knitTransparentUrl;
  await knit.decode();
  const slip = new Image();
  slip.src = slipUrl;
  await slip.decode();
  const tuck = new Image();
  tuck.src = tuckUrl;
  await tuck.decode();
  const purl = new Image();
  purl.src = purlTransparentUrl;
  await purl.decode();
  return [
    { image: knit, title: "Knit" },
    { image: purl, title: "Purl" },
    { image: slip, title: "Slip" },
    { image: tuck, title: "Tuck" },
  ];
}