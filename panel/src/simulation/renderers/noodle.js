import {
  Renderer,
  Transform,
  Program,
  Camera,
  Orbit,
  Vec3,
  Geometry,
  Mesh,
  Shadow,
  Mat4,
} from "ogl";

import { buildYarnCurve } from "./utils/yarnSpline";
import { bbox3d } from "./utils/helpers";

let gl, controls, renderer, camera, scene, light, shadow;
let yarnPoints = [];
let yarnGeometry = [];
let yarnColors = [];

const segmentVertexShader = /* glsl */ `
precision highp float;
// position in the instance geometry
attribute vec2 position;

// two endpoints of a yarn segment
attribute vec3 pointA;
attribute vec3 pointB;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 uInverseModelViewMatrix;

uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;


uniform float uWidth;

varying float across;
varying vec4 vLightNDC;


// Matrix to shift range from -1->1 to 0->1
const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

void main() {
  // The segment endpoint positions in model view space
  vec4 p0 = modelViewMatrix * vec4(pointA, 1.0);
  vec4 p1 = modelViewMatrix * vec4(pointB, 1.0);

  // This is our position in the instance geometry. the x component is along the line segment
  vec2 tangent = p1.xy - p0.xy;
  vec2 normal =   normalize(vec2(-tangent.y, tangent.x)); // perp

  vec4 currentPoint = mix(p0, p1, position.x);
  vec2 pt = currentPoint.xy + uWidth *(position.x * tangent +  position.y * normal);

  vec4 mvPosition = vec4(pt, currentPoint.z, 1.0);

  gl_Position = projectionMatrix * mvPosition;

  vec4 undo = uInverseModelViewMatrix * mvPosition;

  across = position.y;

  // Calculate the NDC (normalized device coords) for the light to compare against shadowmap
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * modelMatrix * undo;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uWidth;
uniform vec3 uColor;
uniform sampler2D tShadow;

varying float across;
varying vec4 vLightNDC;

float unpackRGBA (vec4 v) {
    return dot(v, 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0));
}

vec3 normal = vec3(0.0, 0.0, 1.0);


void main() {
    vec3 lightPos = vLightNDC.xyz / vLightNDC.w;
    float bias = 0.0001;
    float depth = lightPos.z - bias;
    float occluder = unpackRGBA(texture2D(tShadow, lightPos.xy));
    // float shadow = mix(0.6, 1.0, smoothstep(depth-0.0005, depth+0.0005, occluder));
    float shadow = mix(0.6, 1.0, step(depth, occluder));

    vec3 highlight = normalize(vec3(0.0, across*2., 0.4));
    float outline = dot(normal, highlight);
    outline = step(0.4, outline);

    gl_FragColor.rgb = uColor * outline * shadow;
    gl_FragColor.a = 1.0;
}
`;

const joinVertexShader = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 pointA;
attribute vec3 pointB;
attribute vec3 pointC;

uniform float uWidth;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 uInverseModelViewMatrix;

uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;


varying float across;
varying vec4 vLightNDC;


// Matrix to shift range from -1->1 to 0->1
const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;

  vec4 clipA = modelViewMatrix * vec4(pointA, 1.0);
  vec4 clipB = modelViewMatrix * vec4(pointB, 1.0);
  vec4 clipC = modelViewMatrix * vec4(pointC, 1.0);

  // Calculate the normal to the join tangent
  vec2 tangent = normalize(normalize(clipC.xy - clipB.xy) + normalize(clipB.xy - clipA.xy));
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 ab = clipB.xy - clipA.xy;
  vec2 cb = clipB.xy - clipC.xy;

  vec2 abn = normalize(vec2(-ab.y, ab.x));
  vec2 cbn = -normalize(vec2(-cb.y, cb.x));

  float sigma = sign(dot(ab + cb, normal)); // Direction of the bend

  // Basis vectors for the bevel geometry
  vec2 p0 = 0.5 * sigma * uWidth * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * uWidth * (sigma < 0.0 ? cbn : abn);


  // Final vertex position coefficients ([0,0], [0,1], [1,0])
  vec2 clip = clipB.xy + position.x * p0 + position.y * p1;


  vec4 mvPosition = vec4(clip, clipB.z, clipB.w);

  gl_Position = projectionMatrix * mvPosition;

  vec4 undo = uInverseModelViewMatrix * mvPosition;

  across = (position.x + position.y) * 0.5 * sigma;
    // Calculate the NDC (normalized device coords) for the light to compare against shadowmap
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * modelMatrix * undo;
}
`;

const segmentDepthVertex = /* glsl */ `
precision highp float;
// position in the instance geometry
attribute vec2 position;

// two endpoints of a yarn segment
attribute vec3 pointA;
attribute vec3 pointB;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uWidth;

void main() {
  // The segment endpoint positions in model view space
  vec4 p0 = modelViewMatrix * vec4(pointA, 1.0);
  vec4 p1 = modelViewMatrix * vec4(pointB, 1.0);

  // This is our position in the instance geometry. the x component is along the line segment
  vec2 tangent = p1.xy - p0.xy;
  vec2 normal =   normalize(vec2(-tangent.y, tangent.x)); // perp

  vec4 currentPoint = mix(p0, p1, position.x);
  vec2 pt = currentPoint.xy + uWidth *(position.x * tangent +  position.y * normal);

  gl_Position = projectionMatrix * vec4(pt, currentPoint.z, 1.0);
}
`;

const joinDepthVertex = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 pointA;
attribute vec3 pointB;
attribute vec3 pointC;

uniform float uWidth;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;

  vec4 clipA = modelViewMatrix * vec4(pointA, 1.0);
  vec4 clipB = modelViewMatrix * vec4(pointB, 1.0);
  vec4 clipC = modelViewMatrix * vec4(pointC, 1.0);

  // Calculate the normal to the join tangent
  vec2 tangent = normalize(normalize(clipC.xy - clipB.xy) + normalize(clipB.xy - clipA.xy));
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 ab = clipB.xy - clipA.xy;
  vec2 cb = clipB.xy - clipC.xy;

  vec2 abn = normalize(vec2(-ab.y, ab.x));
  vec2 cbn = -normalize(vec2(-cb.y, cb.x));

  float sigma = sign(dot(ab + cb, normal)); // Direction of the bend

  // Basis vectors for the bevel geometry
  vec2 p0 = 0.5 * sigma * uWidth * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * uWidth * (sigma < 0.0 ? cbn : abn);


  // Final vertex position coefficients ([0,0], [0,1], [1,0])
  vec2 clip = clipB.xy + position.x * p0 + position.y * p1;


  vec4 mvPosition = vec4(clip, clipB.z, clipB.w);

  gl_Position = projectionMatrix * mvPosition;

}
`;

const depthFragment = /* glsl */ `
    precision highp float;

    vec4 packRGBA (float v) {
        vec4 pack = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);
        pack -= pack.yzww * vec2(1.0 / 255.0, 0.0).xxxy;
        return pack;
    }

    void main() {
        gl_FragColor = packRGBA(gl_FragCoord.z);
    }
`;

function buildYarnSegmentGeometry(splinePts, pointBuffer) {
  const instanceCount = splinePts.length / 3 - 1;

  const instanceGeometry = [
    [0, -0.5],
    [1, -0.5],
    [0, 0.5],
    [1, 0.5],
  ];

  const geometry = new Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array(instanceGeometry.flat()),
      instanced: 0,
    },
    pointA: {
      data: splinePts,
      buffer: pointBuffer,
      instanced: 1,
      count: instanceCount,
      size: 3,
      offset: Float32Array.BYTES_PER_ELEMENT * 0,
    },
    pointB: {
      data: splinePts,
      buffer: pointBuffer,
      instanced: 1,
      count: instanceCount,
      size: 3,
      offset: Float32Array.BYTES_PER_ELEMENT * 3,
    },
  });

  geometry.setDrawRange(0, instanceGeometry.length);
  geometry.setInstancedCount(instanceCount);

  return geometry;
}

function buildJoinGeometry(splinePts, pointBuffer) {
  const instanceCount = splinePts.length / 3 - 2;

  const instanceGeometry = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];

  const geometry = new Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array(instanceGeometry.flat()),
      instanced: 0,
    },
    pointA: {
      data: splinePts,
      buffer: pointBuffer,
      instanced: 1,
      count: instanceCount,
      size: 3,
      offset: Float32Array.BYTES_PER_ELEMENT * 0,
    },
    pointB: {
      data: splinePts,
      buffer: pointBuffer,
      instanced: 1,
      count: instanceCount,
      size: 3,
      offset: Float32Array.BYTES_PER_ELEMENT * 3,
    },
    pointC: {
      data: splinePts,
      buffer: pointBuffer,
      instanced: 1,
      count: instanceCount,
      size: 3,
      offset: Float32Array.BYTES_PER_ELEMENT * 6,
    },
  });

  geometry.setDrawRange(0, instanceGeometry.length);
  geometry.setInstancedCount(instanceCount);

  return geometry;
}

function init(yarnData, canvas) {
  renderer = new Renderer({
    dpr: 2,
    canvas: canvas,
    width: canvas.parentNode.clientWidth,
    height: canvas.parentNode.clientHeight,
  });
  gl = renderer.gl;
  gl.clearColor(0.1, 0.1, 0.1, 1);

  let bbox = bbox3d(yarnData[0].pts);

  if (!camera) {
    camera = new Camera(gl, { fov: 60, far: 100, near: 0.1 });
    camera.position.set(bbox.center[0], bbox.center[1], 15);

    controls = new Orbit(camera, {
      target: new Vec3(bbox.center[0], bbox.center[1], 0),
      element: canvas,
    });
    camera.lookAt(controls.target);
  }

  scene = new Transform();

  light = new Camera(gl, {
    left: -bbox.dimensions[0],
    right: bbox.dimensions[0],
    bottom: -bbox.dimensions[1],
    top: bbox.dimensions[1],
    far: 100,
    near: 0.1,
  });

  light.position.set(bbox.xMin, bbox.yMax, 25);
  light.lookAt(bbox.center);
  shadow = new Shadow(gl, { light });
  shadow.setSize({ width: 2048 });

  yarnPoints = [];
  yarnGeometry = [];

  yarnData.forEach((yarn) => {
    if (yarn.pts.length < 6) return;

    const splinePts = new Float32Array(buildYarnCurve(yarn.pts, 12, 0));

    yarnPoints.push(splinePts);

    const pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, splinePts, gl.STATIC_DRAW);

    const segmentGeometry = buildYarnSegmentGeometry(splinePts, pointBuffer);
    const joinGeometry = buildJoinGeometry(splinePts, pointBuffer);

    yarnGeometry.push(segmentGeometry);
    yarnColors.push(yarn.color);

    const segmentProgram = new Program(gl, {
      vertex: segmentVertexShader,
      fragment: fragmentShader,
      cullFace: false,
      uniforms: {
        uWidth: { value: yarn.diameter },
        uColor: { value: yarn.color },
        uInverseModelViewMatrix: { value: null },
      },
    });

    const joinProgram = new Program(gl, {
      vertex: joinVertexShader,
      fragment: fragmentShader,
      cullFace: false,
      uniforms: {
        uColor: { value: yarn.color },
        uWidth: { value: yarn.diameter },
        uInverseModelViewMatrix: { value: null },
      },
    });

    const segmentDepthProgram = new Program(gl, {
      vertex: segmentDepthVertex,
      fragment: depthFragment,
      cullFace: false,
      uniforms: {
        uWidth: { value: yarn.diameter },
        uInverseModelViewMatrix: { value: null },
      },
    });

    const joinDepthProgram = new Program(gl, {
      vertex: joinDepthVertex,
      fragment: depthFragment,
      cullFace: false,
      uniforms: {
        uWidth: { value: yarn.diameter },
        uInverseModelViewMatrix: { value: null },
      },
    });

    const mesh = new Mesh(gl, {
      mode: gl.TRIANGLE_STRIP,
      geometry: segmentGeometry,
      program: segmentProgram,
    });

    const joinMesh = new Mesh(gl, {
      geometry: joinGeometry,
      program: joinProgram,
    });

    function computeInverseModelViewUniform({ mesh }) {
      let inverse = new Mat4();
      inverse.inverse(mesh.modelViewMatrix);
      mesh.program.uniforms.uInverseModelViewMatrix.value = inverse;
    }

    mesh.onBeforeRender(computeInverseModelViewUniform);
    joinMesh.onBeforeRender(computeInverseModelViewUniform);

    mesh.depthProgram = segmentDepthProgram;
    joinMesh.depthProgram = joinDepthProgram;

    shadow.add({ mesh: mesh });
    shadow.add({ mesh: joinMesh });

    mesh.setParent(scene);
    joinMesh.setParent(scene);
  });
}

function updateYarnGeometry(yarnData) {
  yarnData.forEach((yarn, yarnIndex) => {
    const splinePts = buildYarnCurve(yarn.pts, 12);

    // Update the points in the yarn's point array
    splinePts.forEach((p, i) => (yarnPoints[yarnIndex][i] = p));

    // Flag for update
    yarnGeometry[yarnIndex].attributes.pointA.needsUpdate = true;
    yarnGeometry[yarnIndex].attributes.pointB.needsUpdate = true;
  });
}

function draw() {
  renderer.setSize(
    gl.canvas.parentNode.clientWidth,
    gl.canvas.parentNode.clientHeight
  );
  camera.perspective({
    aspect: gl.canvas.clientWidth / gl.canvas.clientHeight,
  });

  controls.update();

  shadow.render({ scene });
  renderer.render({ scene, camera });
}

export const noodleRenderer = {
  draw,
  init,
  updateYarnGeometry,
};

// function monitorView() {
//   return html`<div
//     style="position: absolute; top:0; color: #fff;display:grid; grid-template-columns: 100px 300px;">
//     <div>controls</div>
//     <div style="display: flex; flex-direction: column;">
//       <div>x: ${controls.target[0].toFixed(2)}</div>
//       <div>y: ${controls.target[1].toFixed(2)}</div>
//       <div>z: ${controls.target[2].toFixed(2)}</div>
//     </div>
//     <div>camera</div>
//     <div style="display: flex; flex-direction: column;">
//       <div style="display: flex; flex-direction: column;">
//         <div>x: ${camera.position[0].toFixed(2)}</div>
//         <div>y: ${camera.position[1].toFixed(2)}</div>
//         <div>z: ${camera.position[2].toFixed(2)}</div>
//       </div>
//     </div>
//   </div>`;
// }
