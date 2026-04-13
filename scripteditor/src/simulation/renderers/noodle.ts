import { buildYarnCurve } from "./utils/yarnSpline";
import { bbox3d, initShaderProgram, resizeCanvasToDisplaySize } from "./utils/helpers";
import { createCamera3D } from "./utils/Camera3D";
import { Mat4 } from "@shared/mat4";

const segmentVertexShader = /* glsl */ `
precision highp float;
attribute vec2 position;
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

const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

void main() {
  vec4 p0 = modelViewMatrix * vec4(pointA, 1.0);
  vec4 p1 = modelViewMatrix * vec4(pointB, 1.0);

  vec2 tangent = p1.xy - p0.xy;
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));

  vec4 currentPoint = mix(p0, p1, position.x);
  vec2 pt = currentPoint.xy + uWidth * (position.x * tangent + position.y * normal);

  vec4 mvPosition = vec4(pt, currentPoint.z, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vec4 undo = uInverseModelViewMatrix * mvPosition;
  across = position.y;
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

float unpackRGBA(vec4 v) {
    return dot(v, 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0));
}

vec3 normal = vec3(0.0, 0.0, 1.0);

void main() {
    vec3 lightPos = vLightNDC.xyz / vLightNDC.w;
    float bias = 0.0001;
    float depth = lightPos.z - bias;
    float occluder = unpackRGBA(texture2D(tShadow, lightPos.xy));
    float shadow = mix(0.6, 1.0, step(depth, occluder));

    vec3 highlight = normalize(vec3(0.0, across * 2., 0.4));
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

const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

void main() {
  vec4 clipA = modelViewMatrix * vec4(pointA, 1.0);
  vec4 clipB = modelViewMatrix * vec4(pointB, 1.0);
  vec4 clipC = modelViewMatrix * vec4(pointC, 1.0);

  vec2 tangent = normalize(normalize(clipC.xy - clipB.xy) + normalize(clipB.xy - clipA.xy));
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 ab = clipB.xy - clipA.xy;
  vec2 cb = clipB.xy - clipC.xy;
  vec2 abn = normalize(vec2(-ab.y, ab.x));
  vec2 cbn = -normalize(vec2(-cb.y, cb.x));

  float sigma = sign(dot(ab + cb, normal));

  vec2 p0 = 0.5 * sigma * uWidth * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * uWidth * (sigma < 0.0 ? cbn : abn);

  vec2 clip = clipB.xy + position.x * p0 + position.y * p1;
  vec4 mvPosition = vec4(clip, clipB.z, clipB.w);

  gl_Position = projectionMatrix * mvPosition;

  vec4 undo = uInverseModelViewMatrix * mvPosition;
  across = (position.x + position.y) * 0.5 * sigma;
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * modelMatrix * undo;
}
`;

const segmentDepthVertex = /* glsl */ `
precision highp float;
attribute vec2 position;
attribute vec3 pointA;
attribute vec3 pointB;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uWidth;

void main() {
  vec4 p0 = modelViewMatrix * vec4(pointA, 1.0);
  vec4 p1 = modelViewMatrix * vec4(pointB, 1.0);

  vec2 tangent = p1.xy - p0.xy;
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));

  vec4 currentPoint = mix(p0, p1, position.x);
  vec2 pt = currentPoint.xy + uWidth * (position.x * tangent + position.y * normal);

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
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  vec4 clipA = modelViewMatrix * vec4(pointA, 1.0);
  vec4 clipB = modelViewMatrix * vec4(pointB, 1.0);
  vec4 clipC = modelViewMatrix * vec4(pointC, 1.0);

  vec2 tangent = normalize(normalize(clipC.xy - clipB.xy) + normalize(clipB.xy - clipA.xy));
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 ab = clipB.xy - clipA.xy;
  vec2 cb = clipB.xy - clipC.xy;
  vec2 abn = normalize(vec2(-ab.y, ab.x));
  vec2 cbn = -normalize(vec2(-cb.y, cb.x));

  float sigma = sign(dot(ab + cb, normal));
  vec2 p0 = 0.5 * sigma * uWidth * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * uWidth * (sigma < 0.0 ? cbn : abn);

  vec2 clip = clipB.xy + position.x * p0 + position.y * p1;
  gl_Position = projectionMatrix * vec4(clip, clipB.z, clipB.w);
}
`;

const depthFragment = /* glsl */ `
precision highp float;

vec4 packRGBA(float v) {
    vec4 pack = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);
    pack -= pack.yzww * vec2(1.0 / 255.0, 0.0).xxxy;
    return pack;
}

void main() {
    gl_FragColor = packRGBA(gl_FragCoord.z);
}
`;

// Instance geometry for segment (quad as TRIANGLE_STRIP)
const SEGMENT_INSTANCE_GEO = new Float32Array([0, -0.5, 1, -0.5, 0, 0.5, 1, 0.5]);

// Instance geometry for join (bevel triangle)
const JOIN_INSTANCE_GEO = new Float32Array([0, 0, 1, 0, 0, 1]);

const SHADOW_SIZE = 2048;
const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

let gl: WebGL2RenderingContext;
let camera: any;
let segmentProgram: any, joinProgram: any, segmentDepthProgram: any, joinDepthProgram: any;
let shadowFB: any, shadowTexture: any;
let shadowViewMatrix: any, shadowProjectionMatrix: any;

// Segment instance geometry VAO (shared, non-instanced part)
let segmentGeoBuffer: any, joinGeoBuffer: any;

// Per-yarn data
let yarns: any[] = [];

function setupShadowFramebuffer() {
  shadowTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const depthRB = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRB);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_SIZE, SHADOW_SIZE);

  shadowFB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRB);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function buildSegmentVAO(splinePts: any, yarnBuffer: any) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Non-instanced: quad geometry (position, vec2)
  gl.bindBuffer(gl.ARRAY_BUFFER, segmentGeoBuffer);
  const posLoc = gl.getAttribLocation(segmentProgram.program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Instanced: pointA and pointB from yarn buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, yarnBuffer);
  const stride = 3 * Float32Array.BYTES_PER_ELEMENT;

  const pointALoc = gl.getAttribLocation(segmentProgram.program, "pointA");
  gl.enableVertexAttribArray(pointALoc);
  gl.vertexAttribPointer(pointALoc, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(pointALoc, 1);

  const pointBLoc = gl.getAttribLocation(segmentProgram.program, "pointB");
  gl.enableVertexAttribArray(pointBLoc);
  gl.vertexAttribPointer(pointBLoc, 3, gl.FLOAT, false, stride, stride);
  gl.vertexAttribDivisor(pointBLoc, 1);

  gl.bindVertexArray(null);
  return vao;
}

function buildSegmentDepthVAO(yarnBuffer: any) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, segmentGeoBuffer);
  const posLoc = gl.getAttribLocation(segmentDepthProgram.program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, yarnBuffer);
  const stride = 3 * Float32Array.BYTES_PER_ELEMENT;

  const pointALoc = gl.getAttribLocation(segmentDepthProgram.program, "pointA");
  gl.enableVertexAttribArray(pointALoc);
  gl.vertexAttribPointer(pointALoc, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(pointALoc, 1);

  const pointBLoc = gl.getAttribLocation(segmentDepthProgram.program, "pointB");
  gl.enableVertexAttribArray(pointBLoc);
  gl.vertexAttribPointer(pointBLoc, 3, gl.FLOAT, false, stride, stride);
  gl.vertexAttribDivisor(pointBLoc, 1);

  gl.bindVertexArray(null);
  return vao;
}

function buildJoinVAO(yarnBuffer: any) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, joinGeoBuffer);
  const posLoc = gl.getAttribLocation(joinProgram.program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, yarnBuffer);
  const stride = 3 * Float32Array.BYTES_PER_ELEMENT;

  const pointALoc = gl.getAttribLocation(joinProgram.program, "pointA");
  gl.enableVertexAttribArray(pointALoc);
  gl.vertexAttribPointer(pointALoc, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(pointALoc, 1);

  const pointBLoc = gl.getAttribLocation(joinProgram.program, "pointB");
  gl.enableVertexAttribArray(pointBLoc);
  gl.vertexAttribPointer(pointBLoc, 3, gl.FLOAT, false, stride, stride);
  gl.vertexAttribDivisor(pointBLoc, 1);

  const pointCLoc = gl.getAttribLocation(joinProgram.program, "pointC");
  gl.enableVertexAttribArray(pointCLoc);
  gl.vertexAttribPointer(pointCLoc, 3, gl.FLOAT, false, stride, 2 * stride);
  gl.vertexAttribDivisor(pointCLoc, 1);

  gl.bindVertexArray(null);
  return vao;
}

function buildJoinDepthVAO(yarnBuffer: any) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, joinGeoBuffer);
  const posLoc = gl.getAttribLocation(joinDepthProgram.program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, yarnBuffer);
  const stride = 3 * Float32Array.BYTES_PER_ELEMENT;

  const pointALoc = gl.getAttribLocation(joinDepthProgram.program, "pointA");
  gl.enableVertexAttribArray(pointALoc);
  gl.vertexAttribPointer(pointALoc, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(pointALoc, 1);

  const pointBLoc = gl.getAttribLocation(joinDepthProgram.program, "pointB");
  gl.enableVertexAttribArray(pointBLoc);
  gl.vertexAttribPointer(pointBLoc, 3, gl.FLOAT, false, stride, stride);
  gl.vertexAttribDivisor(pointBLoc, 1);

  const pointCLoc = gl.getAttribLocation(joinDepthProgram.program, "pointC");
  gl.enableVertexAttribArray(pointCLoc);
  gl.vertexAttribPointer(pointCLoc, 3, gl.FLOAT, false, stride, 2 * stride);
  gl.vertexAttribDivisor(pointCLoc, 1);

  gl.bindVertexArray(null);
  return vao;
}

function computeLightMatrices(bbox: any) {
  const lightPos = [bbox.xMin, bbox.yMax, 25];
  const lightTarget = bbox.center;
  const lightCameraMatrix = Mat4.lookAt(lightPos, lightTarget, [0, 1, 0]);
  shadowViewMatrix = Mat4.inverse(lightCameraMatrix);
  shadowProjectionMatrix = Mat4.orthographic(
    -bbox.dimensions[0],
    bbox.dimensions[0],
    -bbox.dimensions[1],
    bbox.dimensions[1],
    0.1,
    100
  );
}

function init(yarnData: any, canvas: HTMLCanvasElement) {
  if (!gl || gl.canvas !== canvas) {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    if (!gl) {
      console.error("Unable to create WebGL2 context");
      return;
    }
    gl.clearColor(0.1, 0.1, 0.1, 1);

    segmentProgram = initShaderProgram(gl, segmentVertexShader, fragmentShader);
    joinProgram = initShaderProgram(gl, joinVertexShader, fragmentShader);
    segmentDepthProgram = initShaderProgram(gl, segmentDepthVertex, depthFragment);
    joinDepthProgram = initShaderProgram(gl, joinDepthVertex, depthFragment);

    // Shared instance geometry buffers
    segmentGeoBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, segmentGeoBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, SEGMENT_INSTANCE_GEO, gl.STATIC_DRAW);

    joinGeoBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, joinGeoBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, JOIN_INSTANCE_GEO, gl.STATIC_DRAW);

    setupShadowFramebuffer();

    camera = createCamera3D();
    camera.attach(canvas);
  }

  const bbox = bbox3d(yarnData[0].pts);
  camera.fit(bbox);
  computeLightMatrices(bbox);

  yarns = [];

  yarnData.forEach((yarn: any) => {
    if (yarn.pts.length < 6) return;

    const splinePts = new Float32Array(buildYarnCurve(yarn.pts, 12, 0));
    const segmentCount = splinePts.length / 3 - 1;
    const joinCount = splinePts.length / 3 - 2;

    const yarnBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, yarnBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, splinePts, gl.DYNAMIC_DRAW);

    yarns.push({
      segmentVAO: buildSegmentVAO(splinePts, yarnBuffer),
      joinVAO: buildJoinVAO(yarnBuffer),
      segmentDepthVAO: buildSegmentDepthVAO(yarnBuffer),
      joinDepthVAO: buildJoinDepthVAO(yarnBuffer),
      segmentCount,
      joinCount,
      yarnBuffer,
      splinePts,
      color: yarn.color,
      diameter: yarn.diameter,
    });
  });
}

function setMainUniforms(program: any, viewMatrix: any, projMatrix: any, inverseViewMatrix: any, color: any, diameter: any) {
  const u = program.uniformLocations;
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(u.modelMatrix, false, IDENTITY);
  gl.uniformMatrix4fv(u.modelViewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(u.projectionMatrix, false, projMatrix);
  gl.uniformMatrix4fv(u.uInverseModelViewMatrix, false, inverseViewMatrix);
  gl.uniformMatrix4fv(u.shadowViewMatrix, false, shadowViewMatrix);
  gl.uniformMatrix4fv(u.shadowProjectionMatrix, false, shadowProjectionMatrix);
  gl.uniform1f(u.uWidth, diameter);
  gl.uniform3fv(u.uColor, color);
}

function setDepthUniforms(program: any, viewMatrix: any, projMatrix: any, diameter: any) {
  const u = program.uniformLocations;
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(u.modelViewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(u.projectionMatrix, false, projMatrix);
  gl.uniform1f(u.uWidth, diameter);
}

function draw() {
  if (!gl) return;
  resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

  const canvas = gl.canvas as HTMLCanvasElement;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const projMatrix = camera.projection(aspect);
  const viewMatrix = camera.viewMatrix;
  const inverseViewMatrix = Mat4.inverse(viewMatrix);

  // Shadow pass — render depth into shadowFB
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  for (const yarn of yarns) {
    setDepthUniforms(segmentDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
    gl.bindVertexArray(yarn.segmentDepthVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, yarn.segmentCount);

    setDepthUniforms(joinDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
    gl.bindVertexArray(yarn.joinDepthVAO);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, yarn.joinCount);
  }

  // Main pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);

  for (const yarn of yarns) {
    setMainUniforms(segmentProgram, viewMatrix, projMatrix, inverseViewMatrix, yarn.color, yarn.diameter);
    gl.uniform1i(segmentProgram.uniformLocations.tShadow, 0);
    gl.bindVertexArray(yarn.segmentVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, yarn.segmentCount);

    setMainUniforms(joinProgram, viewMatrix, projMatrix, inverseViewMatrix, yarn.color, yarn.diameter);
    gl.uniform1i(joinProgram.uniformLocations.tShadow, 0);
    gl.bindVertexArray(yarn.joinVAO);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, yarn.joinCount);
  }

  gl.bindVertexArray(null);
}

function updateYarnGeometry(yarnData: any) {
  yarnData.forEach((yarn: any, i: any) => {
    if (!yarns[i]) return;
    const splinePts = new Float32Array(buildYarnCurve(yarn.pts, 12));
    splinePts.forEach((v, j) => (yarns[i].splinePts[j] = v));
    gl.bindBuffer(gl.ARRAY_BUFFER, yarns[i].yarnBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, yarns[i].splinePts);
  });
}

export const noodleRenderer = {
  draw,
  init,
  updateYarnGeometry,
};
