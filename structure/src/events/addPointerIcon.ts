export function addPointerIcon(
  pointerContainer: HTMLElement,
  parent: HTMLElement
): void {
  parent.addEventListener("pointermove", (e: PointerEvent) => {
    pointerContainer.style.transform = `translate(${e.pageX}px, ${e.pageY}px)`;
  });
  parent.addEventListener("pointerleave", () => {
    pointerContainer.style.display = `none`;
  });
  parent.addEventListener("pointerenter", () => {
    pointerContainer.style.display = `block`;
  });
}
