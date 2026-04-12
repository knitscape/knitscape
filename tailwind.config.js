/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./panel/**/*.{html,js,ts}",
    "./structure/**/*.{html,js,ts}",
    "./scripteditor/**/*.{html,js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          0: "#0e0e0e",
          1: "#1a1a1a",
          2: "#2b2b2b",
          3: "#3c3c3c",
          4: "#4d4d4d",
          5: "#5e5e5e",
          6: "#6f6f6f",
          7: "#8a8a8a",
          8: "#9b9b9b",
          9: "#a1a1a1",
          10: "#b2b2b2",
          11: "#c3c3c3",
          12: "#d4d4d4",
          13: "#e5e5e5",
        },
        accent: "hsla(316, 29%, 64%)",
      },
      fontFamily: {
        "national-park": ['"National Park"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
