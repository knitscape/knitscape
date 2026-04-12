import { visualizations } from "../simulation/visualizationManager";
import type { GlobalState, StateObserver } from "../types";

function switchVisualization(newViz: string) {
  const vizContainer = document.getElementById("viz-container");
  if (!vizContainer) return;

  // Remove all child nodes
  while (vizContainer.firstChild) {
    vizContainer.removeChild(vizContainer.lastChild!);
  }

  visualizations[newViz].init(vizContainer);
}

export function visualizationSubscriber() {
  return ({ state }: { state: GlobalState }): StateObserver => {
    const stateAny = state as any;
    let currentViz = stateAny.viz;

    return {
      syncState(state: GlobalState, changes?: string[]) {
        const s = state as any;
        if (!changes?.includes("viz")) return;

        if (s.viz != currentViz) {
          if (!(s.viz in visualizations)) {
            console.warn(
              s.viz,
              "does not match an existing visualization!"
            );
            return;
          }
          switchVisualization(s.viz);
          currentViz = s.viz;
        }
      },
    };
  };
}
