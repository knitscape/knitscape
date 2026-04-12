import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        structure: resolve(__dirname, "structure/index.html"),
        panel: resolve(__dirname, "panel/index.html"),
        scripteditor: resolve(__dirname, "scripteditor/index.html"),
      },
    },
  },
});
