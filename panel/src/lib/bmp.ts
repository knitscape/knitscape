/**
 * BMP Library for JavaScript
 *
 * Copyright 2008 Neil Fraser.
 * http://neil.fraser.name/software/bmp_lib/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Root object for BMP Library.
const bmp_lib = {
  render(element: string | HTMLElement, grid: any[], opt_palette?: any[]) {
    if (typeof element == "string") {
      element = document.getElementById(element) as HTMLElement;
    }
    if (!element || !(element as HTMLElement).tagName) {
      throw "bmp_lib.render: Invalid element: " + element;
    } else if ((element as HTMLElement).tagName == "IMG") {
      (element as HTMLImageElement).src = this.imageSource(grid, opt_palette);
    } else if ((element as HTMLElement).tagName == "TABLE") {
      var data = this.tableBody(grid, opt_palette);
      if ("outerHTML" in element) {
        var rowCount = (element as HTMLTableElement).rows.length;
        for (var y = rowCount - 1; y >= 0; y--) {
          (element as HTMLTableElement).deleteRow(y);
        }
        var tableTag = (element as HTMLElement).outerHTML;
        tableTag = tableTag.substring(0, tableTag.indexOf(">") + 1);
        var tempDiv = document.createElement("DIV");
        tempDiv.innerHTML = tableTag + data + "</table>";
        (element as HTMLElement).parentElement!.replaceChild(tempDiv.firstChild!, element as HTMLElement);
      } else {
        (element as HTMLElement).innerHTML = data;
      }
    } else {
      throw "bmp_lib.render: Invalid HTML tag: " + (element as HTMLElement).tagName;
    }
  },

  imageSource(grid: any[], opt_palette?: any[]): string {
    var a = this.normalize_(grid, opt_palette);
    var data = this.createBmp_(a[0], a[1]);
    return "data:image/bmp;base64," + this.encode64_(data);
  },

  tableBody(grid: any[], opt_palette?: any[]): string {
    var a = this.normalize_(grid, opt_palette);
    grid = a[0];
    var palette = a[1];
    var height = grid.length;
    var width = height && grid[0].length;
    var rgb: any;
    var table: string[] = [];
    for (var y = 0; y < height; y++) {
      var row: string[] = [];
      for (var x = 0; x < width; x++) {
        if (palette) {
          rgb = palette[grid[y].charCodeAt(x)];
        } else {
          rgb = grid[y][x];
        }
        var colour =
          this.dec2hex_(rgb[0]) + this.dec2hex_(rgb[1]) + this.dec2hex_(rgb[2]);
        row[x] = "<TD BGCOLOR=#" + colour + "><img width=1 height=1></TD>";
      }
      row.unshift("<TR>");
      row.push("</TR>");
      table[y] = row.join("");
    }
    return table.join("\n");
  },

  normalize_(grid: any[], opt_palette?: any[]): [any[], any] {
    var palette: any;
    if (grid.length == 0) {
      palette = null;
    } else if (typeof grid[0] == "string" && opt_palette) {
      palette = opt_palette;
    } else if (
      typeof grid[0] == "object" &&
      typeof grid[0][0] == "number" &&
      opt_palette
    ) {
      grid = this.arrayArrayToArrayStr_(grid);
      palette = opt_palette;
    } else if (
      typeof grid[0] == "object" &&
      typeof grid[0][0] == "object" &&
      grid[0][0].length >= 3
    ) {
      palette = null;
    } else {
      throw "Invalid argument types.";
    }
    return [grid, palette];
  },

  createBmp_(grid: any[], palette: any): string {
    var bitmapFileHeader = "BMxxxx\0\0\0\0yyyy";

    var height = grid.length;
    var width = height && grid[0].length;
    var biHeight = this.multiByteEncode_(height, 4);
    var biWidth = this.multiByteEncode_(width, 4);
    var bfOffBits = this.multiByteEncode_(40, 4);
    var bitCount: number;
    if (palette && palette.length <= 256) {
      bitCount = 8;
    } else {
      bitCount = 24;
      if (palette) {
        grid = this.depalette_(grid, palette);
      }
      palette = null;
    }
    var biBitCount = this.multiByteEncode_(bitCount, 2);
    var bitmapInfoHeader =
      bfOffBits +
      biWidth +
      biHeight +
      "\x01\0" +
      biBitCount +
      "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

    var rgbQuad: string;
    if (bitCount != 24) {
      var palette_str = String(palette);
      if (bmp_lib_cache.palette_str_cache == palette_str) {
        rgbQuad = bmp_lib_cache.rgbQuad_cache;
      } else {
        var rgbQuadArr: string[] = [];
        var r = 0;
        var g = 0;
        var b = 0;
        for (var x = 0; x < 256; x++) {
          if (x < palette.length) {
            r = palette[x][0];
            g = palette[x][1];
            b = palette[x][2];
          }
          rgbQuadArr[x] = String.fromCharCode(b, g, r, 0);
        }
        rgbQuad = rgbQuadArr.join("");
        bmp_lib_cache.palette_str_cache = palette_str;
        bmp_lib_cache.rgbQuad_cache = rgbQuad;
      }
    } else {
      rgbQuad = "";
    }

    var padding: string;
    if (width % 4 == 1) {
      padding = "\0\0\0";
    } else if (width % 4 == 2) {
      padding = "\0\0";
    } else if (width % 4 == 3) {
      padding = "\0";
    } else {
      padding = "";
    }
    if (bitCount == 24) {
      padding = padding + padding + padding;
    }

    var data: string[] = [];
    for (var y = 0; y < height; y++) {
      var row = grid[height - y - 1];
      if (bitCount == 8) {
        data[y] = row + padding;
      } else if (bitCount == 24) {
        for (var x = 0; x < width; x++) {
          data.push(String.fromCharCode(row[x][2], row[x][1], row[x][0]));
        }
        data.push(padding);
      }
    }
    var dataStr = data.join("");

    var bitmap = bitmapFileHeader + bitmapInfoHeader + rgbQuad + dataStr;
    bitmap = bitmap.replace(
      /yyyy/,
      this.multiByteEncode_(
        bitmapFileHeader.length + bitmapInfoHeader.length + rgbQuad.length,
        4
      )
    );
    bitmap = bitmap.replace(/xxxx/, this.multiByteEncode_(bitmap.length, 4));
    return bitmap;
  },

  multiByteEncode_(number: number, bytes: number): string {
    if (number < 0 || bytes < 0) {
      throw "Negative numbers not allowed.";
    }
    var string = "";
    for (var i = 0; i < bytes; i++) {
      string += String.fromCharCode(number & 255);
      number = number >> 8;
    }
    if (number != 0) {
      throw "Overflow, number too big for string length";
    }
    return string;
  },

  arrayArrayToArrayStr_(arrayArray: number[][]): string[] {
    var arrayStr = Array(arrayArray.length) as string[];
    for (var y = 0; y < arrayArray.length; y++) {
      let line: string[] = [];
      for (var x = 0; x < arrayArray[y].length; x++) {
        line[x] = String.fromCharCode(arrayArray[y][x]);
      }
      arrayStr[y] = line.join("");
    }
    return arrayStr;
  },

  depalette_(oldGrid: string[], palette: number[][]): number[][][] {
    var newGrid: number[][][] = Array(oldGrid.length);
    for (var y = 0; y < oldGrid.length; y++) {
      newGrid[y] = [];
      for (var x = 0; x < oldGrid[y].length; x++) {
        newGrid[y][x] = palette[oldGrid[y].charCodeAt(x)];
      }
    }
    return newGrid;
  },

  dec2hex_(decimal: number): string {
    var a = decimal % 16;
    var b = (decimal - a) / 16;
    return (
      bmp_lib_dec2hex_hexChars.charAt(b) + bmp_lib_dec2hex_hexChars.charAt(a)
    );
  },

  encode64_(input: string): string {
    if (
      "btoa" in window &&
      typeof window.btoa == "function" &&
      window.btoa("hello") == "aGVsbG8="
    ) {
      return window.btoa(input);
    }

    var output = "";
    var i = 0;

    do {
      var chr1 = input.charCodeAt(i++);
      var chr2 = input.charCodeAt(i++);
      var chr3 = input.charCodeAt(i++);

      var enc1 = chr1 >> 2;
      var enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      var enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      var enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output =
        output +
        bmp_lib_encode64_keyStr.charAt(enc1) +
        bmp_lib_encode64_keyStr.charAt(enc2) +
        bmp_lib_encode64_keyStr.charAt(enc3) +
        bmp_lib_encode64_keyStr.charAt(enc4);
    } while (i < input.length);

    return output;
  },
};

const bmp_lib_cache = {
  palette_str_cache: "",
  rgbQuad_cache: "",
};

const bmp_lib_dec2hex_hexChars = "0123456789ABCDEF";

const bmp_lib_encode64_keyStr =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export { bmp_lib };
