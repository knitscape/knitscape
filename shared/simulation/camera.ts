import { Mat4 } from "../mat4";

const FOV = Math.PI / 3; // 60 degrees
const NEAR = 0.1;
const FAR = 1000;

interface BBox3D {
  center: number[];
  dimensions: number[];
}

export function createCamera3D() {
  let azimuth = 0.5;
  let polar = Math.PI / 4;
  let radius = 15;
  let target = [0, 0, 0];
  let viewMatrix: number[] | undefined;
  let projMatrix: number[] | undefined;

  function cameraPosition(): number[] {
    return [
      target[0] + radius * Math.sin(polar) * Math.sin(azimuth),
      target[1] + radius * Math.cos(polar),
      target[2] + radius * Math.sin(polar) * Math.cos(azimuth),
    ];
  }

  function update(): void {
    const pos = cameraPosition();
    viewMatrix = Mat4.inverse(Mat4.lookAt(pos, target, [0, 1, 0]));
  }

  update();

  function projection(aspect: number): number[] {
    projMatrix = Mat4.perspective(FOV, aspect, NEAR, FAR);
    return projMatrix;
  }

  function fit(bbox: BBox3D, aspect: number = 1): void {
    target = [...bbox.center];
    azimuth = 0;
    polar = Math.PI / 2;
    const [w, h, d] = bbox.dimensions;
    const vTan = Math.tan(FOV / 2);
    const hTan = vTan * aspect;
    const radiusV = h / 2 / vTan;
    const radiusH = w / 2 / hTan;
    radius = Math.max(radiusV, radiusH) * 1.1 + d / 2;
    update();
  }

  function handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const startAzimuth = azimuth;
    const startPolar = polar;
    const startTarget = [...target];
    const startX = e.clientX;
    const startY = e.clientY;
    const panning = e.shiftKey;

    function move(e: PointerEvent): void {
      if (panning) {
        const dx = (e.clientX - startX) * radius * 0.0008;
        const dy = (e.clientY - startY) * radius * 0.0008;
        const sa = Math.sin(startAzimuth);
        const ca = Math.cos(startAzimuth);
        const sp = Math.sin(startPolar);
        const cp = Math.cos(startPolar);
        const rightX = ca;
        const rightZ = -sa;
        const upX = -sa * cp;
        const upY = sp;
        const upZ = -ca * cp;
        target = [
          startTarget[0] - rightX * dx + upX * dy,
          startTarget[1] + upY * dy,
          startTarget[2] - rightZ * dx + upZ * dy,
        ];
      } else {
        azimuth = startAzimuth - (e.clientX - startX) * 0.005;
        polar = Math.max(
          0.05,
          Math.min(Math.PI - 0.05, startPolar - (e.clientY - startY) * 0.005)
        );
      }
      update();
    }

    function end(): void {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    radius *= Math.pow(1.1, e.deltaY * 0.01);
    radius = Math.max(0.5, Math.min(1000, radius));
    update();
  }

  function attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
  }

  function detach(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("wheel", handleWheel);
  }

  return {
    get viewMatrix() {
      return viewMatrix;
    },
    get projMatrix() {
      return projMatrix;
    },
    projection,
    fit,
    attach,
    detach,
  };
}
