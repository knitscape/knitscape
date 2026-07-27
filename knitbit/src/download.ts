import { SYMBOL_DATA } from "@shared/opData";
import type { Bimp } from "@shared/Bimp";
import type { KnittingProgram } from "./simulation/types";

function parseHex(hex: string): [number, number, number] {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return [r, g, b];
  }
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return [r, g, b];
}

// Encode an Op bitmap as an 8-bit indexed BMP. The palette maps Op indices to
// their canonical symbol colors, so the file opens with the familiar look.
export function encodeOpsBmp(ops: Bimp): Uint8Array {
  const { width, height } = ops;
  const rowStride = (width + 3) & ~3; // BMP rows are padded to 4 bytes
  const pixelBytes = rowStride * height;
  const paletteBytes = 256 * 4;
  const headerBytes = 14 + 40;
  const fileSize = headerBytes + paletteBytes + pixelBytes;
  const pixelOffset = headerBytes + paletteBytes;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // BITMAPFILEHEADER
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, pixelOffset, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 8, true); // bits per pixel
  view.setUint32(30, 0, true); // compression: BI_RGB
  view.setUint32(34, pixelBytes, true);
  view.setUint32(38, 2835, true); // 72 DPI in pixels/meter
  view.setUint32(42, 2835, true);
  view.setUint32(46, 256, true); // colors used
  view.setUint32(50, 0, true); // important colors

  // Color table (BGRA per entry). Fill Op indices with their symbol colors.
  for (const key of Object.keys(SYMBOL_DATA)) {
    const i = Number(key);
    const [r, g, b] = parseHex(SYMBOL_DATA[i].color);
    const off = 54 + i * 4;
    bytes[off] = b;
    bytes[off + 1] = g;
    bytes[off + 2] = r;
    bytes[off + 3] = 0;
  }

  // Pixel data: rows bottom-to-top. Op uses (x, y) with y=0 at the bottom,
  // which matches BMP's bottom-up storage, so row order is natural.
  for (let y = 0; y < height; y++) {
    const rowStart = pixelOffset + y * rowStride;
    for (let x = 0; x < width; x++) {
      bytes[rowStart + x] = ops.pixel(x, y) & 0xff;
    }
    // trailing bytes of padding remain zero
  }

  return bytes;
}

export function encodeControlJson(program: KnittingProgram): string {
  return JSON.stringify(
    {
      width: program.width,
      height: program.height,
      yarnFeeder: program.yarnFeeder,
      direction: program.direction,
      racking: program.racking,
      palette: program.palette,
    },
    null,
    2
  );
}

export function triggerDownload(
  data: Uint8Array | string,
  filename: string,
  mime: string
) {
  // Uint8Array is a valid BlobPart at runtime; the cast is only needed because
  // BlobPart requires ArrayBufferView<ArrayBuffer> and Uint8Array is generic
  // over ArrayBufferLike.
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
