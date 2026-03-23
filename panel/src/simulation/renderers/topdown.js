import {
  bbox3d,
  resizeCanvasToDisplaySize,
  initShaderProgram,
} from "./utils/helpers";
import { Mat3 } from "./utils/Mat3";
import { buildYarnCurve } from "./utils/yarnSpline";

const segmentVertexShader = /* glsl */ `#version 300 es
precision highp float;

in vec3 instancePosition;
in vec3 pointA;
in vec3 pointB;

uniform mat3 u_Matrix;
uniform float u_Radius;
uniform float u_ZMin;
uniform float u_ZMax;

out float vZ;
out float across;
out float depth;

void main() {
  // basis vector between point A and point B
  vec2 xBasis = pointB.xy - pointA.xy;

  // perpendicular direction
  vec2 yBasis = u_Radius * normalize(vec2(-xBasis.y, xBasis.x));

  vec3 currentPoint = mix(pointA, pointB, instancePosition.z);

  vec2 point = currentPoint.xy + (xBasis * instancePosition.x + yBasis * instancePosition.y);

  vec3 clip = u_Matrix * vec3(point, 1.0);

  // gl_Position = vec4(clip.xy, -currentPoint.z, 1.0);
  gl_Position = vec4(clip.xy, -currentPoint.z/10.0, 1.0);

  vZ = abs(currentPoint.z-u_ZMin) / abs(u_ZMax-u_ZMin);

  depth = -currentPoint.z;
  across = instancePosition.y;
}
`;

const fragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform vec3 u_Color;

in float vZ;
in float across;
in float depth;

out vec4 outColor;


void main() {
    vec3 normal = vec3(0, 0, -1);
    vec3 shaded = u_Color - 0.4;

    vec3 highlight = normalize(vec3(0.0, across, -0.1 ));

    float light = dot(normal, highlight);
    light = smoothstep(0.0, 0.5, light);


    outColor.rgb = mix(shaded, u_Color, vZ);
    outColor.rgb *= light;

    // outColor.rgb = u_Color;
    outColor.a = 1.0;
}
`;

const joinVertexShader = /* glsl */ `#version 300 es
precision highp float;

in vec3 instancePosition;
in vec3 pointA;
in vec3 pointB;
in vec3 pointC;

uniform mat3 u_Matrix;
uniform float u_Radius;
uniform float u_ZMin;
uniform float u_ZMax;

out float vZ;
out float across;
out float depth;

void main() {
  vec3 tangent = normalize(normalize(pointC - pointB) + normalize(pointB - pointA));
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 ab = pointB.xy - pointA.xy;
  vec2 cb = pointB.xy - pointC.xy;
  vec2 abn = normalize(vec2(-ab.y, ab.x));
  vec2 cbn = -normalize(vec2(-cb.y, cb.x));

  float sigma = sign(dot(ab + cb, normal));

  vec2 p0 = 0.5 * sigma * u_Radius * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * u_Radius * (sigma < 0.0 ? cbn : abn);
  vec2 point = pointB.xy + instancePosition.x * p0 + instancePosition.y * p1;

  vec3 clip = u_Matrix * vec3(point, 1.0);

  // gl_Position =  vec4(clip.xy, -pointB.z, 1);
  gl_Position =  vec4(clip.xy,-pointB.z/5.0, 1);

  depth = -pointB.z;
  vZ = abs(pointB.z-u_ZMin) / abs(u_ZMax-u_ZMin);
  across = (instancePosition.x + instancePosition.y) * 0.5 * sigma;
}
`;

let gl, segmentProgramInfo, joinProgramInfo, camera, bbox;

let yarnProgramData = [];

const yarnInstanceGeometry = new Float32Array([
  0, -0.5, 0, 0, -0.5, 1, 0, 0.5, 0, 0, 0.5, 1,
]);

const joinInstanceGeometry = new Float32Array([0, 0, 1, 0, 0, 1]);

function mouseClip(e) {
  // get canvas relative css position
  const rect = gl.canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;

  // get normalized 0 to 1 position across and down canvas
  const normalizedX = cssX / gl.canvas.clientWidth;
  const normalizedY = cssY / gl.canvas.clientHeight;

  // convert to clip space
  const clipX = normalizedX * 2 - 1;
  const clipY = normalizedY * -2 + 1;

  return [clipX, clipY];
}

class Camera2D {
  constructor(x = 0, y = 0, zoom = 100) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  handlePan(e) {
    let startInvViewProjMat = Mat3.inverse(buildViewProjection());
    let startX = this.x;
    let startY = this.y;
    let startClipPos = mouseClip(e);
    let startPos = Mat3.transformPoint(startInvViewProjMat, startClipPos);

    const move = (e) => {
      if (e.buttons === 0) {
        end();
        return;
      }

      const pos = Mat3.transformPoint(startInvViewProjMat, mouseClip(e));

      this.x = startX + startPos[0] - pos[0];
      this.y = startY + startPos[1] - pos[1];

      e.preventDefault();
    };

    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointerleave", end);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointerleave", end);
  }

  handleZoom(e) {
    e.preventDefault();
    const [clipX, clipY] = mouseClip(e);

    const [preZoomX, preZoomY] = Mat3.transformPoint(
      Mat3.inverse(buildViewProjection()),
      [clipX, clipY]
    );

    const newZoom = this.zoom * Math.pow(1.2, e.deltaY * -0.01);
    this.zoom = Math.max(0.02, Math.min(100, newZoom));

    const [postZoomX, postZoomY] = Mat3.transformPoint(
      Mat3.inverse(buildViewProjection()),
      [clipX, clipY]
    );

    this.x += preZoomX - postZoomX;
    this.y += preZoomY - postZoomY;
  }

  fit(bbox) {
    this.x = bbox.center[0];
    this.y = bbox.center[1];
  }

  matrix() {
    let scale = 1 / this.zoom;

    let matrix = Mat3.identity();
    matrix = Mat3.translate(matrix, this.x, this.y);
    matrix = Mat3.scale(matrix, scale, scale);

    return matrix;
  }
}

function buildViewProjection() {
  let projectionMatrix = Mat3.projection(
    gl.canvas.clientWidth,
    gl.canvas.clientHeight
  );
  // put the origin in the center
  projectionMatrix = Mat3.translate(
    projectionMatrix,
    gl.canvas.width / 2,
    gl.canvas.height / 2
  );

  let cameraMat = camera.matrix();

  let viewMat = Mat3.inverse(cameraMat);

  return Mat3.multiply(projectionMatrix, viewMat);
}

function initializeYarn(yarn) {
  const splinePts = new Float32Array(buildYarnCurve(yarn.pts, 4));
  const instanceCount = splinePts.length / 3 - 1;
  const yarnInstanceBuffer = gl.createBuffer();

  // BUILD YARN VAO

  // Create and bind
  let yarnVao = gl.createVertexArray();
  gl.bindVertexArray(yarnVao);

  const segmentInstanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segmentInstanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, yarnInstanceGeometry, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(
    segmentProgramInfo.attribLocations.instancePosition
  );
  gl.vertexAttribPointer(
    segmentProgramInfo.attribLocations.instancePosition,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0 // offset
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, yarnInstanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, splinePts, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(segmentProgramInfo.attribLocations.pointA);
  gl.vertexAttribPointer(
    segmentProgramInfo.attribLocations.pointA,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    Float32Array.BYTES_PER_ELEMENT * 0 // offset
  );
  gl.vertexAttribDivisor(segmentProgramInfo.attribLocations.pointA, 1);

  gl.enableVertexAttribArray(segmentProgramInfo.attribLocations.pointB);
  gl.vertexAttribPointer(
    segmentProgramInfo.attribLocations.pointB,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    Float32Array.BYTES_PER_ELEMENT * 3 // offset
  );
  gl.vertexAttribDivisor(segmentProgramInfo.attribLocations.pointB, 1);

  // BUILD JOIN VAO
  let joinVAO = gl.createVertexArray();
  gl.bindVertexArray(joinVAO);

  const joinInstancePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, joinInstancePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, joinInstanceGeometry, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(joinProgramInfo.attribLocations.instancePosition);
  gl.vertexAttribPointer(
    joinProgramInfo.attribLocations.instancePosition,
    2, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0 // offset
  );

  // use the yarn instance buffer again
  gl.bindBuffer(gl.ARRAY_BUFFER, yarnInstanceBuffer);

  gl.enableVertexAttribArray(joinProgramInfo.attribLocations.pointA);
  gl.vertexAttribPointer(
    joinProgramInfo.attribLocations.pointA,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    Float32Array.BYTES_PER_ELEMENT * 0 // offset
  );
  gl.vertexAttribDivisor(joinProgramInfo.attribLocations.pointA, 1);

  gl.enableVertexAttribArray(joinProgramInfo.attribLocations.pointB);
  gl.vertexAttribPointer(
    joinProgramInfo.attribLocations.pointB,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    Float32Array.BYTES_PER_ELEMENT * 3 // offset
  );
  gl.vertexAttribDivisor(joinProgramInfo.attribLocations.pointB, 1);

  gl.enableVertexAttribArray(joinProgramInfo.attribLocations.pointC);
  gl.vertexAttribPointer(
    joinProgramInfo.attribLocations.pointC,
    3, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    Float32Array.BYTES_PER_ELEMENT * 6 // offset
  );
  gl.vertexAttribDivisor(joinProgramInfo.attribLocations.pointC, 1);

  const yarnUniforms = {
    u_Color: yarn.color,
    u_Radius: yarn.diameter,
  };

  return {
    joinVAO: joinVAO,
    segmentVAO: yarnVao,
    uniforms: yarnUniforms,
    instances: instanceCount,
    geometry: splinePts,
    buffer: yarnInstanceBuffer,
  };
}

export function init(yarnData, canvas) {
  gl = canvas.getContext("webgl2");

  if (gl === null) {
    alert("No WebGL :(");
    return;
  }
  resizeCanvasToDisplaySize(gl.canvas);

  gl.clearColor(0.1, 0.1, 0.1, 1.0); // Background color

  segmentProgramInfo = initShaderProgram(
    gl,
    segmentVertexShader,
    fragmentShader
  );

  joinProgramInfo = initShaderProgram(gl, joinVertexShader, fragmentShader);

  yarnProgramData = [];
  yarnData.forEach((yarn) => {
    yarnProgramData.push(initializeYarn(yarn));
  });

  console.log(yarnProgramData[0]);
  console.log(yarnProgramData[0].geometry.length / 3);

  bbox = bbox3d(yarnProgramData[0].geometry);

  console.log(bbox);

  if (!camera) {
    camera = new Camera2D();
    camera.fit(bbox);
    canvas.addEventListener("pointerdown", (e) => camera.handlePan(e));
    canvas.addEventListener("wheel", (e) => camera.handleZoom(e));
  }
}

function drawMainYarn(uniforms, instances) {
  gl.uniform3f(
    segmentProgramInfo.uniformLocations.u_Color,
    uniforms.u_Color[0],
    uniforms.u_Color[1],
    uniforms.u_Color[2]
  );
  gl.uniform1f(segmentProgramInfo.uniformLocations.u_Radius, uniforms.u_Radius);
  gl.uniform1f(segmentProgramInfo.uniformLocations.u_ZMin, bbox.zMin);
  gl.uniform1f(segmentProgramInfo.uniformLocations.u_ZMax, bbox.zMax);

  // Draw instanced triangle strip along the entire yarn
  gl.drawArraysInstanced(
    gl.TRIANGLE_STRIP,
    0,
    yarnInstanceGeometry.length / 3, // number of indices to be rendered per instance
    instances // number of instances of the range of elements to draw
  );
}

function drawJoin(uniforms, instances) {
  // Main yarn should always be in front of outline. Set polygon offset to prevent z-fighting
  // gl.polygonOffset(1, 0);
  gl.uniform3f(
    joinProgramInfo.uniformLocations.u_Color,
    uniforms.u_Color[0],
    uniforms.u_Color[1],
    uniforms.u_Color[2]
  );

  gl.uniform1f(joinProgramInfo.uniformLocations.u_Radius, uniforms.u_Radius);
  gl.uniform1f(joinProgramInfo.uniformLocations.u_ZMin, bbox.zMin);
  gl.uniform1f(joinProgramInfo.uniformLocations.u_ZMax, bbox.zMax);

  // Draw instanced triangle strip along the entire yarn
  gl.drawArraysInstanced(
    gl.TRIANGLES,
    0,
    joinInstanceGeometry.length / 2, // number of indices to be rendered per instance
    instances - 1 // number of instances of the range of elements to draw
  );
}

function draw() {
  resizeCanvasToDisplaySize(gl.canvas);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.enable(gl.DEPTH_TEST);
  // gl.disable(gl.CULL_FACE);

  let mvp = buildViewProjection();

  for (const { segmentVAO, joinVAO, uniforms, instances } of yarnProgramData) {
    gl.useProgram(segmentProgramInfo.program);

    // Bind the VAO which has contains the attribute state for the current yarn
    gl.bindVertexArray(segmentVAO);

    // Set uniforms
    gl.uniformMatrix3fv(
      segmentProgramInfo.uniformLocations.u_Matrix,
      false,
      mvp
    );

    drawMainYarn(uniforms, instances);

    // Draw yarn join
    gl.useProgram(joinProgramInfo.program);
    gl.bindVertexArray(joinVAO);

    gl.uniformMatrix3fv(joinProgramInfo.uniformLocations.u_Matrix, false, mvp);

    drawJoin(uniforms, instances);
  }
}

function updateYarnGeometry(yarnData) {}

export const topDownRenderer = {
  draw,
  init,
  updateYarnGeometry,
};
