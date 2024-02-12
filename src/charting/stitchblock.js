import { GLOBAL_STATE, dispatch } from "../state";
import { Bimp } from "../lib/Bimp";

export function addStitchBlock() {
  const { stitchSelect, blocks } = GLOBAL_STATE;

  let uuid = self.crypto.randomUUID();
  let [bl, tr] = stitchSelect;
  let [width, height] = [tr[0] - bl[0], tr[1] - bl[1]];

  dispatch(
    {
      stitchSelect: null,
      blocks: {
        ...blocks,
        [uuid]: { pos: bl, bitmap: Bimp.empty(width, height, 1) },
      },
    },
    true
  );
}

export function removeStitchBlock(blockID) {
  const { blocks } = GLOBAL_STATE;
  const updated = { ...blocks };
  delete updated[blockID];

  dispatch(
    {
      blocks: updated,
    },
    true
  );
}