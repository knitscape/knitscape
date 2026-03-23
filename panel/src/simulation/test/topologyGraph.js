import { Pattern } from "../Pattern";
import { cnStates, stitches } from "../../constants";

import { populateDS, followTheYarn, cnOrderAt, orderCNs } from "../topology";
import { layoutNodes, buildSegmentData } from "../yarn3d";
import * as d3 from "d3";

const STITCH_WIDTH = 75;

export function drawGraph(pattern, parentID) {
  d3.select(parentID).html("");

  const LINK_WIDTH = 4;
  const directionColors = ["#e91e63", "#03a9f4"];
  const cnColors = ["#000", "#fff", "#444", "#f00"];
  const cnTypes = Object.keys(cnStates);
  const opTypes = Object.keys(stitches);
  const opColors = d3.scaleOrdinal(d3.schemePastel1);
  const cnRadius = 7;
  const rowMap = [0, 1, 2];

  const chart = new Pattern(pattern, [0, 0, 0], rowMap);

  const DS = populateDS(chart);
  orderCNs(DS, chart);
  const yarnPaths = followTheYarn(DS, chart.yarnSequence, chart.carriagePasses);
  const nodes = layoutNodes(DS, pattern, rowMap, STITCH_WIDTH);
  // orderLoops(DS, chart);
  const links = buildSegmentData(DS, yarnPaths, nodes, chart, STITCH_WIDTH);
  console.log(links);

  nodes.forEach((node, index) => {
    const i = index % DS.width;
    const j = (index - i) / DS.width;

    let [ST, AV, MV, CNL, YPI, CNO] = DS.data[index];

    node.ST = ST;
    node.AV = AV;
    node.MV = MV;
    node.CNL = CNL;
    node.YPI = YPI;
    node.CNO = CNO;
    node.i = i;
    node.j = j;
  });

  const ops = Array.from(chart.ops).map((op, index) => {
    const x = index % chart.width;
    const y = Math.floor(index / chart.width);

    const cnIJ = [
      [2 * x, y],
      [2 * x + 1, y],
      [2 * x + 1, y + 1],
      [2 * x, y + 1],
    ];

    return {
      index,
      op,
      opType: opTypes[op],
      cnIndices: cnIJ.map(([i, j]) => j * 2 * chart.width + i),
    };
  });

  const svg = d3
    .select(parentID)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("user-select", "none");

  svg
    .append("svg:defs")
    .selectAll("marker")
    .data(["end"])
    .enter()
    .append("svg:marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 13)
    .attr("refY", 0)
    .attr("markerWidth", 2)
    .attr("markerHeight", 2)
    .attr("orient", "auto-start-reverse")
    .append("svg:path")
    .attr("d", "M0,-5L10,0L0,5");

  const container = svg.append("g").attr("class", "container");
  const operationContainer = container.append("g").attr("class", "operations");
  const yarnsBehindContainer = container
    .append("g")
    .attr("class", "yarns-behind");
  const yarnsFrontContainer = container
    .append("g")
    .attr("class", "yarns-front");
  const labelsContainer = container.append("g").attr("class", "labels");
  const cnNodeContainer = container.append("g").attr("class", "contact-nodes");

  container.attr("transform", "translate(20,20)");

  const backYarns = yarnsBehindContainer
    .attr("filter", "brightness(0.7)")
    .attr("stroke-width", LINK_WIDTH)
    .attr("stroke-linecap", "round")
    .selectAll("line")
    .data(links)
    .join("line")
    .filter(function (d) {
      return d.linkType == "LLFL" || d.linkType == "FHLH";
    })
    .attr("x1", (d) => nodes[d.sourceIndex].pos.x)
    .attr("y1", (d) => nodes[d.sourceIndex].pos.y)
    .attr("x2", (d) => nodes[d.targetIndex].pos.x)
    .attr("y2", (d) => nodes[d.targetIndex].pos.y)
    .attr("marker-end", "url(#arrow)")
    .attr("stroke", (d) => directionColors[d.row % 2]);

  const frontYarns = yarnsFrontContainer
    .attr("stroke-width", LINK_WIDTH)
    .attr("stroke-linecap", "round")
    .selectAll("line")
    .data(links)
    .join("line")
    .filter(function (d) {
      return !(d.linkType == "LLFL" || d.linkType == "FHLH");
    })
    .attr("marker-end", "url(#arrow)")
    .attr("stroke", (d) => directionColors[d.row % 2])
    .attr("x1", (d) => nodes[d.sourceIndex].pos.x)
    .attr("y1", (d) => nodes[d.sourceIndex].pos.y)
    .attr("x2", (d) => nodes[d.targetIndex].pos.x)
    .attr("y2", (d) => nodes[d.targetIndex].pos.y);

  const tooltip = d3
    .select(parentID)
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px");

  const cns = cnNodeContainer
    .selectAll()
    .data(nodes)
    .join("circle")
    .attr("r", (d) => (d.AV == 3 ? cnRadius + 3 : cnRadius))
    .attr("cx", (d) => d.pos.x)
    .attr("cy", (d) => d.pos.y)
    // .attr("cx", (d) => d.pos.x + (d.MV[0] * PARAMS.stitchWidth) / 2)
    // .attr("cy", (d) => d.pos.y - d.MV[1] * (PARAMS.stitchWidth / 2))
    .attr("fill", (d) => cnColors[d.AV])
    .attr("stroke", "black")
    // .attr("opacity", (d) => (d.AV == cnStates.ECN ? 0 : 1))
    .attr("stroke-width", "1px")
    .on("mouseover", (e, d) => {
      tooltip.style("opacity", 1);
    })
    .on("mousemove", (e, d) => {
      tooltip
        .html(
          `ij: [${d.i},${d.j}]
          <br />ST: ${opTypes[d.ST]}
          <br />AV: ${cnTypes[d.AV]}
          <br />MV: ${JSON.stringify(d.MV)}
          <br />CNL: ${JSON.stringify(d.CNL)}
          <br />YPI: ${JSON.stringify(d.YPI)}
          <br />CNO: ${JSON.stringify(cnOrderAt(d.i, d.j, chart, DS))}`
        )
        .style("left", `${e.pageX + 10}px`)
        .style("top", `${e.pageY + 10}px`);
    })
    .on("mouseleave", (e, d) => {
      tooltip.style("opacity", 0);
    });

  // const operations = operationContainer
  //   .selectAll()
  //   .data(ops)
  //   .join("polygon")
  //   .attr("fill", (d) => opColors(d.op))
  //   .attr("points", (d) =>
  //     d.cnIndices.reduce(
  //       (str, vertexID) =>
  //         `${str} ${nodes[vertexID].pos.x},${nodes[vertexID].pos.y}`,
  //       ""
  //     )
  //   );

  // const opLabels = labelsContainer
  //   .attr("text-anchor", "middle")
  //   .attr("font-size", "18")
  //   .selectAll()
  //   .data(ops)
  //   .join("text")
  //   .text((d) => d.opType)
  //   .attr(
  //     "x",
  //     (d) =>
  //       d.cnIndices.reduce((sum, vertexID) => sum + nodes[vertexID].pos.x, 0) /
  //       d.cnIndices.length
  //   )
  //   .attr(
  //     "y",
  //     (d) =>
  //       d.cnIndices.reduce((sum, vertexID) => sum + nodes[vertexID].pos.y, 0) /
  //       d.cnIndices.length
  //   )
  //   .attr("alignment-baseline", "middle");
}
