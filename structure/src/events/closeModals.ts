import { dispatch } from "../state";

export function closeModals(): void {
  document.getElementById("site")!.addEventListener("pointerdown", () => {
    dispatch({
      showLibrary: false,
      showSettings: false,
      showDownload: false,
    });
  });
}
