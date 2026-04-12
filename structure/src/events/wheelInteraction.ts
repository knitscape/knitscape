import { zoomAtPoint } from "../actions/zoomFit";
import { GLOBAL_STATE } from "../state";

export function wheelInteraction(target: HTMLElement): void {
  target.addEventListener("wheel", (e: WheelEvent) => {
    const bounds = target.getBoundingClientRect();
    let scale: number;

    if (Math.sign(e.deltaY) < 0) {
      scale = GLOBAL_STATE.reverseScroll
        ? Math.round(GLOBAL_STATE.scale / 1.1)
        : Math.round(GLOBAL_STATE.scale * 1.1);
    } else {
      scale = GLOBAL_STATE.reverseScroll
        ? Math.round(GLOBAL_STATE.scale * 1.1)
        : Math.round(GLOBAL_STATE.scale / 1.1);
    }
    zoomAtPoint(
      [e.clientX - bounds.left, e.clientY - bounds.top],
      scale
    );
  });
}
