import { html, render } from "lit-html";
import { buildYarnCurve } from "./utils/yarnSpline";
import { initShaderProgram, resizeCanvasToDisplaySize } from "./utils/helpers";
import { createCamera3D } from "./utils/Camera3D";

const vertexShader = /* glsl */ `
precision highp float;
attribute vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = 50.0 / length(mvPos.xyz);
}
`;

const pointShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;

void main() {
  vec2 uv = gl_PointCoord.xy;
  float circle = step(0.5, 1.0 - length(uv - 0.5));
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
        @change=${(e: any) => (STATE.spline = e.target.checked)} />
      centerline spline
    </label>
    <label class="form-control toggle">
      <input
        type="checkbox"
        ?checked=${STATE.splinePoints}
        @change=${(e: any) => (STATE.splinePoints = e.target.checked)} />
      spline points
    </label>
    <label class="form-control toggle">
      <input
        type="checkbox"
        ?checked=${STATE.controlPolyline}
        @change=${(e: any) => (STATE.controlPolyline = e.target.checked)} />
      control polyline
    </label>
  </div>`;
}

let gl: WebGL2RenderingContext;
let camera: any;
// Each entry: { controlVAO, controlCount, splineVAO, splineCount, buffer }
let yarns: any[] = [];
let pointProgram: any, lineProgram: any;

function createVAO(data: Float32Array) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posLoc = gl.getAttribLocation(pointProgram.program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  return { vao, count: data.length / 3, buf };
}

function init(yarnData: any, canvas: HTMLCanvasElement) {
  if (!gl || gl.canvas !== canvas) {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    if (!gl) {
      console.error("Unable to create WebGL2 context");
      return;
    }
    gl.clearColor(0.1, 0.1, 0.1, 1);

    pointProgram = initShaderProgram(gl, vertexShader, pointShader);
    lineProgram = initShaderProgram(gl, vertexShader, lineShader);

    camera = createCamera3D();
    camera.attach(canvas);
  }

  yarns = [];

  yarnData.forEach((yarn: any) => {
    if (yarn.pts.length < 6) return;

    const controlData = new Float32Array(yarn.pts);
    const splineData = new Float32Array(buildYarnCurve(yarn.pts, 5));

    const control = createVAO(controlData);
    const spline = createVAO(splineData);

    yarns.push({ control, spline });
  });

  const center = computeCenter(yarnData[0].pts);
  camera.fit({ center, dimensions: [30, 30, 30] });
}

function computeCenter(pts: number[]) {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < pts.length - 2; i += 3) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
    minZ = Math.min(minZ, pts[i + 2]);
    maxZ = Math.max(maxZ, pts[i + 2]);
  }
  return [0.5 * (minX + maxX), 0.5 * (minY + maxY), 0.5 * (minZ + maxZ)];
}

function setUniforms(program: any, viewMatrix: any, projMatrix: any, color: any) {
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(
    program.uniformLocations.modelViewMatrix,
    false,
    viewMatrix,
  );
  gl.uniformMatrix4fv(
    program.uniformLocations.projectionMatrix,
    false,
    projMatrix,
  );
  if (program.uniformLocations.uColor != null) {
    gl.uniform3fv(program.uniformLocations.uColor, color);
  }
}

function draw() {
  const domCanvas = gl.canvas as HTMLCanvasElement;
  resizeCanvasToDisplaySize(domCanvas);
  gl.viewport(0, 0, domCanvas.width, domCanvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const aspect = domCanvas.clientWidth / domCanvas.clientHeight;
  const projMatrix = camera.projection(aspect);
  const viewMatrix = camera.viewMatrix;

  for (const yarn of yarns) {
    if (STATE.controlPolyline) {
      setUniforms(lineProgram, viewMatrix, projMatrix, [1.0, 1.0, 0.3]);
      gl.bindVertexArray(yarn.control.vao);
      gl.drawArrays(gl.LINE_STRIP, 0, yarn.control.count);
    }

    if (STATE.spline) {
      setUniforms(lineProgram, viewMatrix, projMatrix, [0.0, 0.3, 0.3]);
      gl.bindVertexArray(yarn.spline.vao);
      gl.drawArrays(gl.LINE_STRIP, 0, yarn.spline.count);
    }

    if (STATE.splinePoints) {
      setUniforms(pointProgram, viewMatrix, projMatrix, [0.0, 0.3, 0.3]);
      gl.bindVertexArray(yarn.spline.vao);
      gl.drawArrays(gl.POINTS, 0, yarn.spline.count);
    }
  }

  gl.bindVertexArray(null);
  render(monitorView(), (gl.canvas as HTMLCanvasElement).parentNode as HTMLElement);
}

function updateYarnGeometry(yarnData: any) {
  yarnData.forEach((yarn: any, i: any) => {
    if (!yarns[i]) return;
    const splineData = new Float32Array(buildYarnCurve(yarn.pts, 5));
    gl.bindBuffer(gl.ARRAY_BUFFER, yarns[i].spline.buf);
    gl.bufferData(gl.ARRAY_BUFFER, splineData, gl.STATIC_DRAW);
    yarns[i].spline.count = splineData.length / 3;
  });
}

export const centerlineRenderer = {
  draw,
  init,
  updateYarnGeometry,
};
