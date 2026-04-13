import { Mat4 } from "@shared/mat4";

export function createPerspectiveCamera(
  fov = 1,
  aspect = 1.0,
  zNear = 0.1,
  zFar = 100.0,
  radius = 400.0, // Distance to target
  position = [0.0, 0.0, 0.0],
  target = [0.0, 0.0, 0.0],
  phi = 0.0, // Left/right angle
  theta = 0.0 // Angle with the horizontal plane
) {
  let projectionMatrix: number[] | undefined;
  let cameraMatrix: number[] | undefined;
  let viewMatrix: number[] | undefined;

  let up = [0, 1, 0];

  function update(): void {
    projectionMatrix = Mat4.perspective(fov, aspect, zNear, zFar);
    cameraMatrix = Mat4.lookAt(position, target, up);
    viewMatrix = Mat4.inverse(cameraMatrix);
  }

  update();
  return {
    fov,
    aspect,
    zNear,
    zFar,
    radius,
    projectionMatrix,
    update,
  };
}
