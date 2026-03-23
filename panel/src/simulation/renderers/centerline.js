import {
  Renderer,
  Transform,
  Program,
  Camera,
  Orbit,
  Vec3,
  Geometry,
  Mesh,
} from "ogl";

import { buildYarnCurve } from "./utils/yarnSpline";
import { html, render } from "lit-html";
const vertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;


void main() {
  vec4 mvPos = modelViewMatrix *  vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = 50.0 / length(mvPos.xyz);
}
`;

const pointShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;

void main() {
  vec2 uv = gl_PointCoord.xy;
  float circle = step(0.5, 1.0-length(uv - 0.5));

  gl_FragColor.rgb = uColor;
  gl_FragColor.a = circle;
}
`;

const lineShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;

void main() {
  gl_FragColor.rgb = uColor;
  gl_FragColor.a = 1.0;
}
`;

let STATE = {
  spline: true,
  splinePoints: true,
  controlPolyline: true,
};

function monitorView() {
  return html`<div style="position: absolute; top: 0; z-index:10;">
    <label class="form-control toggle">
      <input
        type="checkbox"
        ?checked=${STATE.spline}
        @change=${(e) => (STATE.spline = e.target.checked)} />
      centerline spline
    </label>
    <label class="form-control toggle">
      <input
        type="checkbox"
        ?checked=${STATE.splinePoints}
        @change=${(e) => (STATE.splinePoints = e.target.checked)} />
      spline points
    </label>
    <label class="form-control toggle">
      <input
        type="checkbox"
        ?checked=${STATE.controlPolyline}
        @change=${(e) => (STATE.controlPolyline = e.target.checked)} />
      control polyline
    </label>
  </div>`;
}

let gl, controls, renderer, camera, scene;

function minMax(pts) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (let i = 0; i + 2 < pts.length; i += 3) {
    min.x = Math.min(min.x, pts[i + 0]);
    min.y = Math.min(min.y, pts[i + 1]);
    min.z = Math.min(min.z, pts[i + 2]);
    max.x = Math.max(max.x, pts[i + 0]);
    max.y = Math.max(max.y, pts[i + 1]);
    max.z = Math.max(max.z, pts[i + 2]);
  }

  return { min, max };
}

function computeCenter(pts) {
  const { min, max } = minMax(pts);

  return [0.5 * (min.x + max.x), 0.5 * (min.y + max.y), 0.5 * (min.z + max.z)];
}

function buildControlPointLineStrip(controlPointData) {
  const controlPointGeometry = new Geometry(gl, {
    position: {
      size: 3,
      data: controlPointData,
    },
  });

  const controlProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: lineShader,
    uniforms: {
      uColor: { value: [1.0, 1.0, 0.3] },
    },
    transparent: true,
    depthTest: false,
  });

  const controlPointProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: pointShader,
    uniforms: {
      uColor: { value: [1.0, 1.0, 0.3] },
    },
    transparent: true,
    depthTest: false,
  });

  const controlPoints = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: controlPointGeometry,
    program: controlPointProgram,
  });

  const controlLineStrip = new Mesh(gl, {
    mode: gl.LINE_STRIP,
    geometry: controlPointGeometry,
    program: controlProgram,
  });

  controlPoints.setParent(scene);
  controlLineStrip.setParent(scene);

  return controlPointGeometry;
}

function buildSplineLineStrip(controlPointData) {
  const splinePointData = new Float32Array(buildYarnCurve(controlPointData, 5));

  const splinePointGeometry = new Geometry(gl, {
    position: {
      size: 3,
      data: splinePointData,
    },
  });

  const splinePointProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: pointShader,
    uniforms: {
      uColor: { value: [0.0, 0.3, 0.3] },
    },
    transparent: true,
    depthTest: false,
  });

  const splineLineProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: lineShader,
    uniforms: {
      uColor: { value: [0.0, 0.3, 0.3] },
    },
    transparent: true,
    depthTest: false,
  });

  const splinePoints = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: splinePointGeometry,
    program: splinePointProgram,
  });

  const splineLineStrip = new Mesh(gl, {
    mode: gl.LINE_STRIP,
    geometry: splinePointGeometry,
    program: splineLineProgram,
  });

  splinePoints.setParent(scene);
  splineLineStrip.setParent(scene);
}

function buildNormals() {
  const normalData = new Float32Array(yarn.normals);

  const normalGeometry = new Geometry(gl, {
    position: {
      size: 3,
      data: normalData,
    },
  });

  const normalProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: lineShader,
    uniforms: {
      uColor: { value: [1.0, 0.3, 0.3] },
    },
    depthTest: false,
  });

  const normals = new Mesh(gl, {
    mode: gl.LINES,
    geometry: normalGeometry,
    program: normalProgram,
  });

  normals.setParent(scene);
}

function cnPoints() {
  const cnData = new Float32Array(yarn.cnPoints);

  const cnGeometry = new Geometry(gl, {
    position: {
      size: 3,
      data: cnData,
    },
  });

  const cnProgram = new Program(gl, {
    vertex: vertexShader,
    fragment: pointShader,
    uniforms: {
      uColor: { value: [1.0, 1.0, 1.0] },
    },
    depthTest: false,
    transparent: true,
  });

  const cns = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: cnGeometry,
    program: cnProgram,
  });

  cns.setParent(scene);
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

  let center = computeCenter(yarnData[0].pts);

  if (!camera) {
    camera = new Camera(gl, { fov: 60, far: 100, near: 0.1 });
    camera.position.set(center[0], center[1], 15);

    controls = new Orbit(camera, {
      target: new Vec3(center[0], center[1], 0),
      element: canvas,
    });
    camera.lookAt(controls.target);
  }

  scene = new Transform();

  yarnData.forEach((yarn) => {
    if (yarn.pts.length < 6) return;

    const controlPointData = new Float32Array(yarn.pts);

    buildControlPointLineStrip(controlPointData);
    // buildSplineLineStrip(controlPointData);
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

  renderer.render({ scene, camera });
  render(monitorView(), gl.canvas.parentNode);
}

export const centerlineRenderer = {
  draw,
  init,
  updateYarnGeometry,
};
