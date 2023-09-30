import { bmp_lib } from "./lib/bmp";
import { GLOBAL_STATE, dispatch } from "./state";

export function devicePixelBoundingBox(el) {
  const bbox = el.getBoundingClientRect();

  return {
    width: bbox.width * devicePixelRatio,
    height: bbox.height * devicePixelRatio,
  };
}

export function posAtCoords(event, target) {
  const bounds = target.getBoundingClientRect();

  const x = Math.floor(
    ((event.clientX - bounds.x) / GLOBAL_STATE.scale) * devicePixelRatio
  );
  const y = Math.floor(
    ((event.clientY - bounds.y) / GLOBAL_STATE.scale) * devicePixelRatio
  );
  return { x, y };
}

export function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

export function download(dataStr, downloadName) {
  const downloadAnchorNode = document.createElement("a");

  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", downloadName);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export async function buildImagePalette(imageNames) {
  return await Promise.all(
    imageNames.map(async (imageName) => {
      const im = new Image();
      im.src = new URL(
        `../assets/symbols/${imageName}.png`,
        import.meta.url
      ).href;

      await im.decode();
      return { image: im, title: imageName };
    })
  );
}

export function isMobile() {
  let check = false;
  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
        a
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        a.substr(0, 4)
      )
    )
      check = true;
  })(navigator.userAgent || navigator.vendor || window.opera);

  return check;
}

export function hexPalette(paletteEntry, ctx, scale) {
  // paletteEntry will be a hex code
  ctx.fillStyle = paletteEntry;
  ctx.fillRect(0, 0, scale, scale);
}

export function imagePalette(paletteEntry, ctx, scale) {
  // paletteEntry will be an object with an image field
  ctx.imageSmoothingQuality = "high";

  ctx.clearRect(0, 0, scale, scale);
  ctx.drawImage(paletteEntry.image, 0, 0, scale, scale);
}

function leastCommonMultiple(first, second) {
  let min = first > second ? first : second;
  while (true) {
    if (min % first == 0 && min % second == 0) {
      return min;
    }
    min++;
  }
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

export function shuffle(arr) {
  return arr.sort(() => (Math.random() > 0.5 ? 1 : -1));
}

export function makeBMP(repeatBimp, colorRepeat, palette) {
  const height = leastCommonMultiple(repeatBimp.height, colorRepeat.length);
  const bmp2d = repeatBimp.make2d();
  const bits = [];

  for (let rowIndex = 0; rowIndex < height; rowIndex++) {
    bits.push(
      bmp2d[rowIndex % repeatBimp.height].map((bit) => {
        if (bit == 0 || bit == 1) {
          return colorRepeat[rowIndex % colorRepeat.length];
        } else {
          return palette.length;
        }
      })
    );
  }

  const rgbPalette = palette.map((hex) => hexToRgb(hex));
  rgbPalette.push([255, 255, 255]);

  const im = document.createElement("img");
  bmp_lib.render(im, bits, rgbPalette);
  return im;
}