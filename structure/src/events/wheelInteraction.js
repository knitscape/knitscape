import { zoomAtPoint } from "../actions/zoomFit";
import { GLOBAL_STATE } from "../state";

export function wheelInteraction(target) {
  target.addEventListener("wheel", (e) => {
    const bounds = desktop.getBoundingClientRect();
    let scale;

    if (Math.sign(e.deltaY) < 0) {
      scale = GLOBAL_STATE.reverseScroll
        ? GLOBAL_STATE.scale - 1
        : GLOBAL_STATE.scale + 1;
    } else {
      scale = GLOBAL_STATE.reverseScroll
        ? GLOBAL_STATE.scale + 1
        : GLOBAL_STATE.scale - 1;
    }
    zoomAtPoint(
      {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      },
      scale
    );
  });
}
