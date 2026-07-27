import { buildYarnCurve } from "./spline";
import { bbox3d, initShaderProgram, resizeCanvasToDisplaySize } from "./webgl";
import { createCamera3D } from "./camera";
import { Mat4 } from "../mat4";

const segmentVertexShader = /* glsl */ `
precision highp float;
attribute vec2 position;
attribute vec3 pointA;
attribute vec3 pointB;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;
uniform float uWidth;
uniform vec3 uLightPos;

varying float across;
varying vec4 vLightNDC;
varying float vFacing;

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

  across = position.y;
  vec4 worldPoint = modelMatrix * vec4(mix(pointA, pointB, position.x), 1.0);
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * worldPoint;

  vec3 lightDirView = normalize((modelViewMatrix * vec4(uLightPos, 1.0)).xyz - mvPosition.xyz);
  vFacing = lightDirView.z;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uWidth;
uniform vec3 uColor;
uniform sampler2D tShadow;

varying float across;
varying vec4 vLightNDC;
varying float vFacing;

float unpackRGBA(vec4 v) {
    return dot(v, 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0));
}

vec3 normal = vec3(0.0, 0.0, 1.0);

void main() {
    vec3 lightPos = vLightNDC.xyz / vLightNDC.w;
    float bias = 0.002;
    float depth = lightPos.z - bias;
    float texelSize = 1.0 / 2048.0;
    float lit = 0.0;
    bool inFrustum = lightPos.x >= 0.0 && lightPos.x <= 1.0
                  && lightPos.y >= 0.0 && lightPos.y <= 1.0
                  && lightPos.z <= 1.0;
    if (!inFrustum) {
        lit = 9.0;
    } else {
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                float d = unpackRGBA(texture2D(tShadow, lightPos.xy + vec2(x, y) * texelSize));
                lit += step(depth, d);
            }
        }
    }
    float facing = smoothstep(-0.1, 0.3, vFacing);
    float shadow = mix(0.6, 1.0, min(lit / 9.0, facing));

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
uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;
uniform vec3 uLightPos;

varying float across;
varying vec4 vLightNDC;
varying float vFacing;

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

  across = (position.x + position.y) * 0.5 * sigma;
  vec4 worldPoint = modelMatrix * vec4(pointB, 1.0);
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * worldPoint;

  vec3 lightDirView = normalize((modelViewMatrix * vec4(uLightPos, 1.0)).xyz - mvPosition.xyz);
  vFacing = lightDirView.z;
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
let lastBbox: any;
let segmentProgram: any, joinProgram: any, segmentDepthProgram: any, joinDepthProgram: any;
let shadowFB: any, shadowTexture: any;
let shadowViewMatrix: any, shadowProjectionMatrix: any;
let lightWorldPos: number[] = [0, 0, 25];

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
  lightWorldPos = lightPos;
  const lightTarget = bbox.center;
  const lightCameraMatrix = Mat4.lookAt(lightPos, lightTarget, [0, 1, 0]);
  shadowViewMatrix = Mat4.inverse(lightCameraMatrix);

  // Fit the ortho frustum tightly around the scene bbox in light space, so
  // the shadow map's 2048² texels are spent entirely on visible geometry.
  const corners = [
    [bbox.xMin, bbox.yMin, bbox.zMin, 1],
    [bbox.xMax, bbox.yMin, bbox.zMin, 1],
    [bbox.xMin, bbox.yMax, bbox.zMin, 1],
    [bbox.xMax, bbox.yMax, bbox.zMin, 1],
    [bbox.xMin, bbox.yMin, bbox.zMax, 1],
    [bbox.xMax, bbox.yMin, bbox.zMax, 1],
    [bbox.xMin, bbox.yMax, bbox.zMax, 1],
    [bbox.xMax, bbox.yMax, bbox.zMax, 1],
  ];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const c of corners) {
    const v = Mat4.transformVector(shadowViewMatrix, c);
    if (v[0] < minX) minX = v[0];
    if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1];
    if (v[1] > maxY) maxY = v[1];
    if (v[2] < minZ) minZ = v[2];
    if (v[2] > maxZ) maxZ = v[2];
  }

  const padX = (maxX - minX) * 0.05;
  const padY = (maxY - minY) * 0.05;
  const padZ = (maxZ - minZ) * 0.05;

  shadowProjectionMatrix = Mat4.orthographic(
    minX - padX,
    maxX + padX,
    minY - padY,
    maxY + padY,
    -maxZ - padZ,
    -minZ + padZ
  );
}

function init(yarnData: any, canvas: HTMLCanvasElement, resetCamera = true) {
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

  lastBbox = bbox3d(yarnData[0].pts);
  if (resetCamera)
    camera.fit(lastBbox, canvas.clientWidth / canvas.clientHeight);
  computeLightMatrices(lastBbox);

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

function setMainUniforms(program: any, viewMatrix: any, projMatrix: any, color: any, diameter: any) {
  const u = program.uniformLocations;
  gl.useProgram(program.program);
  gl.uniformMatrix4fv(u.modelMatrix, false, IDENTITY);
  gl.uniformMatrix4fv(u.modelViewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(u.projectionMatrix, false, projMatrix);
  gl.uniformMatrix4fv(u.shadowViewMatrix, false, shadowViewMatrix);
  gl.uniformMatrix4fv(u.shadowProjectionMatrix, false, shadowProjectionMatrix);
  gl.uniform1f(u.uWidth, diameter);
  gl.uniform3fv(u.uColor, color);
  gl.uniform3fv(u.uLightPos, lightWorldPos);
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

  // Shadow pass — render depth into shadowFB
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(4.0, 8.0);

  for (const yarn of yarns) {
    setDepthUniforms(segmentDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
    gl.bindVertexArray(yarn.segmentDepthVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, yarn.segmentCount);

    setDepthUniforms(joinDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
    gl.bindVertexArray(yarn.joinDepthVAO);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, yarn.joinCount);
  }

  gl.disable(gl.POLYGON_OFFSET_FILL);

  // Main pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);

  for (const yarn of yarns) {
    setMainUniforms(segmentProgram, viewMatrix, projMatrix, yarn.color, yarn.diameter);
    gl.uniform1i(segmentProgram.uniformLocations.tShadow, 0);
    gl.bindVertexArray(yarn.segmentVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, yarn.segmentCount);

    setMainUniforms(joinProgram, viewMatrix, projMatrix, yarn.color, yarn.diameter);
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

function fitCamera() {
  if (camera && lastBbox) {
    const canvas = gl.canvas as HTMLCanvasElement;
    camera.fit(lastBbox, canvas.clientWidth / canvas.clientHeight);
  }
}

export const noodleRenderer = {
  draw,
  init,
  updateYarnGeometry,
  fitCamera,
};
