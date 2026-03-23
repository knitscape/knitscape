import { Mat4 } from "./mat4";
import { Vec3 } from "./vec3";

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
  let projectionMatrix, cameraMatrix, viewMatrix;

  let up = [0, 1, 0];

  function update() {
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
//   up() {
//     return {
//       x: Math.sin(this.phi) * -Math.sin(this.theta),
//       y: Math.cos(this.theta),
//       z: Math.cos(this.phi) * -Math.sin(this.theta),
//     };
//   },
//   right() {
//     return Vec3.cross(this.up(), this.out());
//   },
//   out() {
//     return {
//       x: Math.sin(this.phi) * Math.cos(this.theta),
//       y: Math.sin(this.theta),
//       z: Math.cos(this.phi) * Math.cos(this.theta),
//     };
//   },
//   eye() {
//     // returns the eye position in world coordinates
//     return Vec3.add(this.target, Vec3.mul(this.out(), this.radius));
//   },
//   perspective() {
//     const f = 1 / Math.tan(((this.fov / 2) * Math.PI) / 180.0);
//     return new Float32Array([
//       f / this.aspect,
//       0.0,
//       0.0,
//       0.0,
//       0.0,
//       f,
//       0.0,
//       0.0,
//       0.0,
//       0.0,
//       -1,
//       -1.0,
//       0.0,
//       0.0,
//       -2.0 * this.zNear,
//       0.0,
//     ]);
//   },
//   lookAt() {
//     const eye = this.eye();
//     const out = this.out();
//     const up = this.up();
//     const right = Vec3.cross(up, out);

//     const offset = {
//       x: -Vec3.dot(eye, right),
//       y: -Vec3.dot(eye, up),
//       z: -Vec3.dot(eye, out),
//     };

//     return new Float32Array([
//       right.x,
//       up.x,
//       out.x,
//       0.0,
//       right.y,
//       up.y,
//       out.y,
//       0.0,
//       right.z,
//       up.z,
//       out.z,
//       0.0,
//       offset.x,
//       offset.y,
//       offset.z,
//       1.0,
//     ]);
//   },
//   center(pts) {
//     const min = { x: Infinity, y: Infinity, z: Infinity };
//     const max = { x: -Infinity, y: -Infinity, z: -Infinity };

//     for (let i = 0; i + 2 < pts.length; i += 3) {
//       min.x = Math.min(min.x, pts[i + 0]);
//       min.y = Math.min(min.y, pts[i + 1]);
//       min.z = Math.min(min.z, pts[i + 2]);
//       max.x = Math.max(max.x, pts[i + 0]);
//       max.y = Math.max(max.y, pts[i + 1]);
//       max.z = Math.max(max.z, pts[i + 2]);
//     }

//     this.target.x = 0.5 * (min.x + max.x);
//     this.target.y = 0.5 * (min.y + max.y);
//     this.target.z = 0.5 * (min.z + max.z);

//     this.radius =
//       (0.5 * (max.y - min.y)) / Math.tan((0.5 * this.fov * Math.PI) / 180.0);

//     this.phi = 0.0;
//     this.theta = 0.0;
//   },
//   viewProjectionMatrix() {
//     const P = this.perspective();
//     const MV = this.lookAt();
//     return Mat4.multiply(P, MV);
//   },
// };
