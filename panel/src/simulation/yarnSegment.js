function computeOffset(iSource, jSource, iTarget, jTarget) {
  let offX = 0;
  let offY = 0;
  let offZ = 0;

  return [];
}

export function buildSegmentData(
  DS,
  yarnPath,
  nodes,
  { STITCH_WIDTH = 1, ASPECT = 0.75, BED_OFFSET = 0.2 }
) {
  const yarnData = {};

  for (let ypIndex = 0; ypIndex < yarnPath.length - 1; ypIndex++) {
    // for each source/target pair in the yarn path
    let [iSource, jSource, rowSource] = yarnPath[ypIndex];
    let [iTarget, jTarget, rowTarget] = yarnPath[ypIndex];

    let yarnSource = stitchPattern.yarnSequence[rowSource];
    let yarnTarget = stitchPattern.yarnSequence[rowTarget];

    if (yarnSource != yarnTarget) {
      // don't compute the segment until we find the next time the yarn is used.
    }
    if (!(currentYarn in yarnSplines)) {
      yarnSplines[currentYarn] = [];
    }

    // using the other's original cn position (and the layer) to compute an offset
    // add the offset

    links[yarnIndex].push({
      source: [iSource, jSource],
      target: [iTarget, jTarget],
      sourceIndex,
      targetIndex,
      rL: 0.5,
    });
  }

  return links;
}
