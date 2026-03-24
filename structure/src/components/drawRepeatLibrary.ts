import { SYMBOL_BITS } from "../constants";
import type {
  GlobalState,
  ComponentFactory,
  SymbolName,
  RepeatLibraryItem,
} from "../types";

export function drawRepeatLibrary(): ComponentFactory {
  return ({ state }) => {
    let { repeatLibrary, symbolMap } = state;

    function draw(): void {
      for (const repeat of repeatLibrary) {
        const bitmap = repeat.bitmap;
        const canvas = document.querySelector(
          `[data-repeattitle=${repeat.title}]`
        ) as HTMLCanvasElement;

        canvas.height = bitmap.height;
        canvas.width = bitmap.width;

        const ctx = canvas.getContext("2d")!;

        for (let y = 0; y < bitmap.height; y++) {
          for (let x = 0; x < bitmap.width; x++) {
            const paletteIndex = bitmap.pixel(x, y);
            const symbol = symbolMap[paletteIndex];

            ctx.fillStyle = SYMBOL_BITS[symbol] ? "#fff" : "#000";
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    draw();

    return {
      syncState(state: GlobalState) {
        if (repeatLibrary != state.repeatLibrary) {
          repeatLibrary = state.repeatLibrary;

          draw();
        }
      },
    };
  };
}
