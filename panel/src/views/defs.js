import { svg } from "lit-html";

export const gridPattern = (cellWidth, cellHeight) => svg`
<pattern
  id="grid"
  width="${cellWidth}"
  height="${cellHeight}"
  patternUnits="userSpaceOnUse">
  <line stroke="black" x1="0" y1="0" x2="${cellWidth}" y2="0"></line>
  <line stroke="black" x1="0" y1="0" x2="0" y2="${cellHeight}"></line>
</pattern>`;

export const cellShadow = () => svg`
<filter id="path-shadow">
  <feOffset in="SourceAlpha" dx="0" dy="0" />
  <feGaussianBlur stdDeviation="3" />
  <feBlend in="SourceGraphic" in2="blurOut" />
</filter>`;

export const maskOutside = (boundary, chart, cellWidth, cellHeight) => {
  if (!boundary) return;
  return svg`

<mask id="mask">
  <rect x="0" y="0" width="100%" height="100%" fill="#ffffffff" />
  <path d="M ${boundary.reduce(
    (acc, [x, y]) => `${acc} ${x * cellWidth} ${y * cellHeight}`,
    ""
  )} Z" />
</mask>
<filter id="g">
  <!-- <feGaussianBlur in="url(#chart-canvas)" stdDeviation="5" /> -->
      <!-- <feImage href="url(#chart-canvas)" /> -->
      <feImage href="url(#chart-canvas)" x="0" y="0" result="chart"/>
      <feComposite operator="in" in="SourceGraphic" in2="chart" result="overlap" />
      <feGaussianBlur stdDeviation="10" in="overlap" result="blurred-overlap"/>
      <feComposite operator="over" in="blurred-overlap" in2="SourceGraphic"/>

          <!-- <feComposite operator="in" in="SourceGraphic"/>
        <feGaussianBlur stdDeviation="10"/>
        <feComposite operator="over" in2="SourceGraphic"/> -->
</filter>
<rect fill="#09ff0079"
      height="${cellHeight * chart.height}"
      width="${cellWidth * chart.width}"
      filter="url(#g)"
      mask="url(#mask)"
/>`;
};

// export const activeBoundaryMask = (
//   boundary,
//   chartPan,
//   cellWidth,
//   cellHeight
// ) => {
//   if (!boundary) return;
//   return svg`
// <mask id="boundarymask">
//   <rect x="0" y="0" width="100%" height="100%" fill="#ffffffff" />
//   <g transform="scale (1, -1)" transform-origin="center">
//     <g transform="translate(${chartPan.x} ${chartPan.y})">
//       <path d="M ${boundary.reduce(
//         (acc, [x, y]) => `${acc} ${x * cellWidth} ${y * cellHeight}`,
//         ""
//       )} Z"
//           fill="black" />
//     </g>
//   </g>
// </mask>
// <filter id="blur" x="0" y="0">
//   <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
// </filter>
// <!-- <filter id="grayscale">
//   <feColorMatrix type="matrix" values="0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0"/>
// </filter>
// <filter id="blur" x="0" y="0">
//   <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
// </filter> -->
// <rect width="100%" height="100%" filter="url(#blur)" mask="url(#boundarymask)"/>
//  `;
// };
