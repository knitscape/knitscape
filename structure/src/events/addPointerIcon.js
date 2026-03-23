export function addPointerIcon(pointerContainer, parent) {
  parent.addEventListener("pointermove", (e) => {
    pointerContainer.style.transform = `translate(${e.pageX}px, ${e.pageY}px)`;
  });
  parent.addEventListener("pointerleave", (e) => {
    pointerContainer.style.display = `none`;
  });
  parent.addEventListener("pointerenter", (e) => {
    pointerContainer.style.display = `block`;
  });
}
