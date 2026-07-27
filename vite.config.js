import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "shared"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        structure: resolve(__dirname, "structure/index.html"),
        panel: resolve(__dirname, "panel/index.html"),
        knitbit: resolve(__dirname, "knitbit/index.html"),
      },
    },
  },
});
