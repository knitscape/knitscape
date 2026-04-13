export function hexToRgb(hex: string): [number, number, number] {
  hex = hex.length > 7 ? hex.slice(0, 7) : hex;
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}
