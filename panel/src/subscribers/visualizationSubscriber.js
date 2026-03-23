import { visualizations } from "../simulation/visualizationManager";

function switchVisualization(newViz) {
  const vizContainer = document.getElementById("viz-container");

  // Remove all child nodes
  while (vizContainer.firstChild) {
    vizContainer.removeChild(vizContainer.lastChild);
  }

  visualizations[newViz].init(vizContainer);
}

export function visualizationSubscriber() {
  return ({ state }) => {
    let currentViz = state.viz;

    return {
      syncState(state, changes) {
        if (!changes.includes("viz")) return;

        if (state.viz != currentViz) {
          if (!(state.viz in visualizations)) {
            console.warn(
              state.viz,
              "does not match an existing visualization!"
            );
            return;
          }
          switchVisualization(state.viz);
          currentViz = state.viz;
        }
      },
    };
  };
}
