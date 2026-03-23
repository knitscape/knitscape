import { ProcessModel } from "./ProcessModel";
import { Pattern } from "./Pattern";
import { YarnModel } from "./YarnModel";
import { yarnLinkForce } from "./YarnForce";
import * as d3 from "d3";

// Number of stitches to add to the left and right of the pattern
// (need to do this because tuck / slip stitches can't be on the
// end of the row)
const X_PADDING = 1;

// Number of rows to add to the top and bottom of the pattern
// (will be drawn in a different transparent color)
const Y_PADDING = 0;

const STITCH_RATIO = 5 / 3; // Row height / stitch width
const YARN_RATIO = 0.24;

const SPREAD = 0.88;

// Sim constants
const ALPHA_DECAY = 0.05;
const ALPHA_MIN = 0.2;
const ITERATIONS = 1;
const LINK_STRENGTH = 0.2;

// The target link distance when the simulation is run
const HEIGHT_SHRINK = 0.7;

const dpi = devicePixelRatio;

export function simulate(pattern, yarnSequence, palette, scale) {
  let relaxed = false;
  let yarnWidth, stitchHeight, sim;
  let yarnSet = new Set(yarnSequence);
  let yarnPalette = { ...palette, border: "#00000033" };
  performance.clearMeasures();
  performance.mark("start");

  ///////////////////////
  // INITIALIZE NODES
  ///////////////////////

  function layoutNodes(yarnGraph) {
    // calculates the x,y values for the i,j

    const stitchWidth = Math.min(
      (canvasWidth * 0.9) / stitchPattern.width,
      ((canvasHeight * 0.9) / stitchPattern.height) * STITCH_RATIO
    );

    const halfStitch = stitchWidth / 2;
    stitchHeight = stitchWidth / STITCH_RATIO;

    yarnWidth = stitchWidth * YARN_RATIO;

    const offsetX =
      yarnWidth + (canvasWidth - stitchPattern.width * stitchWidth) / 2;
    const offsetY =
      -yarnWidth + (canvasHeight - stitchPattern.height * stitchHeight) / 2;

    yarnGraph.contactNodes.forEach((node, index) => {
      const i = index % yarnGraph.width;
      const j = (index - i) / yarnGraph.width;
      node.i = i;
      node.j = j;
      node.x = offsetX + i * halfStitch;
      node.y = offsetY + (yarnGraph.height - j) * stitchHeight;
    });

    return yarnGraph.contactNodes;
  }

  function unitNormal(prev, next, flip) {
    if (prev.index === next.index) return [0, 0];
    const x = prev.x - next.x;
    const y = prev.y - next.y;

    const mag = SPREAD * Math.sqrt(x ** 2 + y ** 2);

    if (flip) {
      return [-y / mag, x / mag];
    } else {
      return [y / mag, -x / mag];
    }
  }

  function updateNormals() {
    yarnPath[0].normal = unitNormal(
      nodes[yarnPath[0].cnIndex],
      nodes[yarnPath[1].cnIndex],
      true
    );

    for (let index = 1; index < yarnPath.length - 1; index++) {
      let flip;
      if (yarnPath[index].cnType == "FH" || yarnPath[index].cnType == "LH") {
        // headnode
        if (yarnPath[index].row % 2 == 0) {
          // moving right
          flip = true;
        } else {
          // moving left
          flip = false;
        }
      } else {
        // legnode
        if (yarnPath[index].row % 2 == 0) {
          // moving right
          flip = false;
        } else {
          // moving left
          flip = true;
        }
      }

      yarnPath[index].normal = unitNormal(
        nodes[yarnPath[index - 1].cnIndex],
        nodes[yarnPath[index + 1].cnIndex],
        flip
      );
    }

    yarnPath.at(-1).normal = unitNormal(
      nodes[yarnPath.at(-2).cnIndex],
      nodes[yarnPath.at(-1).cnIndex],
      true
    );
  }

  const openYarnCurve = d3
    .line()
    .x((d) => nodes[d.cnIndex].x + (yarnWidth / 2) * d.normal[0])
    .y((d) => nodes[d.cnIndex].y + (yarnWidth / 2) * d.normal[1])
    .curve(d3.curveCatmullRomOpen);

  function yarnCurve(yarnLink) {
    const index = yarnLink.index;

    if (index == 0 || index > yarnPathLinks.length - 3) {
      // if is the first or last link, just draw a line
      return `M ${yarnLink.source.x} ${yarnLink.source.y} ${yarnLink.target.x} ${yarnLink.target.y}`;
    }

    const linkData = [
      yarnPath[index - 1],
      yarnPath[index],
      yarnPath[index + 1],
      yarnPath[index + 2],
    ];

    return openYarnCurve(linkData);
  }

  function sortSegments() {
    const sortedSegments = {
      front: { border: [] },
      back: { border: [] },
      mid: { border: [] },
    };

    for (const color of yarnSet) {
      sortedSegments.front[color] = [];
      sortedSegments.back[color] = [];
      sortedSegments.mid[color] = [];
    }

    return sortedSegments;
  }

  ///////////////////////
  // YARN COLOR
  ///////////////////////

  function yarnColor(rowNum) {
    if (rowNum < Y_PADDING || rowNum >= stitchPattern.height - Y_PADDING)
      return "border"; // show border rows as transparent black
    return yarnSequence[(rowNum - Y_PADDING) % yarnSequence.length];
  }

  ///////////////////////
  // DRAW
  ///////////////////////
  function drawSegmentsToLayer(context, layer) {
    context.lineWidth = yarnWidth;

    Object.entries(layer).forEach(([colorIndex, paths]) => {
      context.strokeStyle = yarnPalette[colorIndex];
      context.stroke(new Path2D(paths.join(" ")));
    });
  }

  function draw() {
    frontCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    midCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    backCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    updateNormals();

    const layers = sortSegments();

    yarnPathLinks.forEach((link, index) => {
      if (index == 0 || index > yarnPathLinks.length - 3) return;
      const colorIndex = yarnColor(link.row);

      layers[link.layer][colorIndex].push(yarnCurve(link));
    });

    drawSegmentsToLayer(backCtx, layers.back);
    drawSegmentsToLayer(frontCtx, layers.front);
    drawSegmentsToLayer(midCtx, layers.mid);
  }

  function relax() {
    if (relaxed) return;
    sim = d3
      .forceSimulation(nodes)
      .alphaMin(ALPHA_MIN)
      .alphaDecay(ALPHA_DECAY)
      .force(
        "link",
        yarnLinkForce(yarnPathLinks)
          .strength(LINK_STRENGTH)
          .iterations(ITERATIONS)
          .distance((l) => {
            if (l.linkType == "FLFH" || l.linkType == "LHLL")
              return stitchHeight * HEIGHT_SHRINK;
            return Math.abs(l.source.x - l.target.x);
          })
      )

      .on("tick", draw);
    relaxed = true;
  }

  function stopSim() {
    if (sim) sim.stop();
  }

  ///////////////////////
  // INIT PATTERN
  ///////////////////////

  const stitchPattern = new Pattern(pattern.pad(X_PADDING, Y_PADDING, 0));

  ///////////////////////
  // INIT CANVASES
  ///////////////////////

  const bbox = document.getElementById("sim-container").getBoundingClientRect();

  const width = bbox.width * scale;
  const height = bbox.height * scale;
  const canvasWidth = dpi * width;
  const canvasHeight = dpi * height;

  function getCanvases(canvasIDs) {
    return canvasIDs.map((canvasID) => {
      let canvas = document.getElementById(canvasID);
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.cssText = `width: ${width}px; height: ${height}px;`;
      return canvas;
    });
  }

  let [backCanvas, midCanvas, frontCanvas] = getCanvases([
    "back",
    "mid",
    "front",
  ]);

  const backCtx = backCanvas.getContext("2d");
  const midCtx = midCanvas.getContext("2d");
  const frontCtx = frontCanvas.getContext("2d");

  ///////////////////////
  // BUILD SIMULATION DATA
  ///////////////////////

  const testModel = new ProcessModel(stitchPattern);

  const yarnGraph = new YarnModel(testModel.cn);

  const nodes = layoutNodes(yarnGraph);

  const yarnPath = yarnGraph.makeNice();

  const yarnPathLinks = yarnGraph.yarnPathToLinks();
  draw();

  return { relax, stopSim };
}
