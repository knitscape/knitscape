import { buildYarnCurveInto } from "./spline";
import { bbox3d, initShaderProgram, resizeCanvasToDisplaySize } from "./webgl";
import { createCamera3D } from "./camera";
import { Mat4 } from "../mat4";
import { createFiberRenderer, fiberStyle, type FiberRenderer, type FiberStyle } from "./fiber";
import { createAmbientOcclusion, DEFAULT_AO, type AmbientOcclusion, type AOSettings } from "./ambientOcclusion";

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
uniform vec3 uLightDir;
uniform float uViewportHeight;

varying float across;
varying vec4 vLightNDC;
varying float vFacing;
varying float vPixelWidth;

const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

// Yarn narrower than MIN_YARN_PX on screen is drawn wider (up to
// MAX_WIDEN×) so that when zoomed out the fabric reads as solid rather than
// a fine yarn/gap pattern that aliases into moiré.
const float MIN_YARN_PX = 3.0;
const float MAX_WIDEN = 2.5;

// On-screen diameter in pixels of a yarn at view-space depth z.
float pixelWidth(float z) {
  return uWidth * projectionMatrix[1][1] * 0.5 * uViewportHeight / max(-z, 1e-4);
}

float drawnWidth(float px) {
  return uWidth * clamp(MIN_YARN_PX / max(px, 1e-4), 1.0, MAX_WIDEN);
}

void main() {
  vec4 p0 = modelViewMatrix * vec4(pointA, 1.0);
  vec4 p1 = modelViewMatrix * vec4(pointB, 1.0);

  vec2 tangent = p1.xy - p0.xy;
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));

  vec4 currentPoint = mix(p0, p1, position.x);
  vPixelWidth = pixelWidth(currentPoint.z);
  float width = drawnWidth(vPixelWidth);
  vec2 pt = currentPoint.xy + uWidth * position.x * tangent + width * position.y * normal;

  vec4 mvPosition = vec4(pt, currentPoint.z, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  across = position.y;
  vec4 worldPoint = modelMatrix * vec4(mix(pointA, pointB, position.x), 1.0);
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * worldPoint;

  vFacing = normalize((modelViewMatrix * vec4(uLightDir, 0.0)).xyz).z;
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
varying float vPixelWidth;

float unpackRGBA(vec4 v) {
    return dot(v, 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0));
}

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

    // Dark outline along the yarn's edges: the band past OUTLINE_START
    // (in units of yarn diameter from the centerline). A hard step aliases
    // into moiré once the band is under a pixel, so blend it over one
    // pixel, and fade it out entirely as the yarn shrinks on screen.
    const float OUTLINE_START = 0.458;
    float px = 1.0 / max(vPixelWidth, 1e-3);
    float outline = 1.0 - smoothstep(OUTLINE_START - 0.5 * px, OUTLINE_START + 0.5 * px, abs(across));
    outline = mix(1.0, outline, smoothstep(4.0, 16.0, vPixelWidth));

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
uniform vec3 uLightDir;
uniform float uViewportHeight;

varying float across;
varying vec4 vLightNDC;
varying float vFacing;
varying float vPixelWidth;

const mat4 depthScaleMatrix = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

// Yarn narrower than MIN_YARN_PX on screen is drawn wider (up to
// MAX_WIDEN×) so that when zoomed out the fabric reads as solid rather than
// a fine yarn/gap pattern that aliases into moiré.
const float MIN_YARN_PX = 3.0;
const float MAX_WIDEN = 2.5;

// On-screen diameter in pixels of a yarn at view-space depth z.
float pixelWidth(float z) {
  return uWidth * projectionMatrix[1][1] * 0.5 * uViewportHeight / max(-z, 1e-4);
}

float drawnWidth(float px) {
  return uWidth * clamp(MIN_YARN_PX / max(px, 1e-4), 1.0, MAX_WIDEN);
}

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

  vPixelWidth = pixelWidth(clipB.z);
  float width = drawnWidth(vPixelWidth);
  vec2 p0 = 0.5 * sigma * width * (sigma < 0.0 ? abn : cbn);
  vec2 p1 = 0.5 * sigma * width * (sigma < 0.0 ? cbn : abn);

  vec2 clip = clipB.xy + position.x * p0 + position.y * p1;
  vec4 mvPosition = vec4(clip, clipB.z, clipB.w);

  gl_Position = projectionMatrix * mvPosition;

  across = (position.x + position.y) * 0.5 * sigma;
  vec4 worldPoint = modelMatrix * vec4(pointB, 1.0);
  vLightNDC = depthScaleMatrix * shadowProjectionMatrix * shadowViewMatrix * worldPoint;

  vFacing = normalize((modelViewMatrix * vec4(uLightDir, 0.0)).xyz).z;
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
// Direction toward the light (world space). A directional light shades the
// whole fabric evenly regardless of its size; a nearby point light would
// graze across large pieces and shade one side differently from the other.
const LIGHT_DIR = normalize3([-1, 1, 4]);

// Segment instance geometry VAO (shared, non-instanced part)
let segmentGeoBuffer: any, joinGeoBuffer: any;

// Per-yarn data
let yarns: any[] = [];

// Fibre-level drawing (fiber.ts), in place of the toon strips when on. Its
// yarns are rebuilt from the toon centerlines whenever those were replaced or
// moved while it was off.
// Frames are only drawn when something in them changed: the camera, the canvas,
// the yarn or a setting. Otherwise the canvas keeps showing the last one. The
// shadow map depends only on the yarn and the light, so moving the camera
// doesn't redraw it either.
let sceneChanged = true;
let shadowStale = true;
let lastView: any = null;
let lastAspect = 0;

let fiberMode = false;
let fiber: FiberRenderer | null = null;
let fiberStale = true;
// Rebuilding the fibre frames of a whole garment takes a while, so while the
// yarn is moving they catch up at most a third of the time; the latest
// position is always drawn once it stops.
let fiberMoved = false;
let fiberUpdateMs = 0;
let fiberUpdatedAt = 0;

// Screen-space ambient occlusion over either renderer (ambientOcclusion.ts).
let ao: AmbientOcclusion | null = null;
const aoSettings: AOSettings = { ...DEFAULT_AO };

function setAmbientOcclusion(settings: Partial<AOSettings>) {
  Object.assign(aoSettings, settings);
  sceneChanged = true;
}

function setFiberMode(on: boolean) {
  if (on !== fiberMode) sceneChanged = shadowStale = true;
  fiberMode = on;
}

/** Change fibre settings; they show on the next frame. */
function setFiberStyle(style: Partial<FiberStyle>) {
  // The sample spacing is baked into each yarn's frames when it is built.
  if (style.spacing !== undefined && style.spacing !== fiberStyle.spacing) fiberStale = true;
  Object.assign(fiberStyle, style);
  // Plies, twist and spacing change what casts shadows.
  sceneChanged = shadowStale = true;
}

function fiberFrame(viewMatrix: any, projMatrix: any) {
  if (!fiber) fiber = createFiberRenderer(gl);
  if (fiberStale) {
    fiber.setYarns(
      yarns.map((yarn) => ({ dense: yarn.splinePts, radius: yarn.diameter / 2, color: yarn.color }))
    );
    fiberStale = false;
    fiberMoved = false;
    shadowStale = true;
  } else if (fiberMoved && performance.now() - fiberUpdatedAt >= 2 * fiberUpdateMs) {
    const start = performance.now();
    fiber.update(yarns.map((yarn) => yarn.splinePts));
    fiberUpdatedAt = performance.now();
    fiberUpdateMs = fiberUpdatedAt - start;
    fiberMoved = false;
    shadowStale = true;
  }
  return {
    viewMatrix,
    projMatrix,
    shadowViewMatrix,
    shadowProjectionMatrix,
    shadowSize: SHADOW_SIZE,
    lightDir: LIGHT_DIR,
  };
}

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

function normalize3(v: number[]): number[] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function computeLightMatrices(bbox: any) {
  // Shadow camera sits back along LIGHT_DIR, far enough to clear the scene.
  const lightTarget = bbox.center;
  const reach = Math.hypot(
    bbox.xMax - bbox.xMin,
    bbox.yMax - bbox.yMin,
    bbox.zMax - bbox.zMin
  );
  const lightPos = lightTarget.map((c: number, i: number) => c + LIGHT_DIR[i] * reach);
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
    fiber = null;
    ao = null;
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
  fiberStale = true;
  sceneChanged = shadowStale = true;

  yarnData.forEach((yarn: any) => {
    if (yarn.pts.length < 6) return;

    const splinePts = buildYarnCurveInto(yarn.pts, 12, 0);
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
  gl.uniform3fv(u.uLightDir, LIGHT_DIR);
  gl.uniform1f(u.uViewportHeight, gl.canvas.height);
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
  const resized = resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

  const canvas = gl.canvas as HTMLCanvasElement;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const viewMatrix = camera.viewMatrix;
  if (!sceneChanged && !resized && viewMatrix === lastView && aspect === lastAspect) return;
  sceneChanged = false;
  lastView = viewMatrix;
  lastAspect = aspect;
  const projMatrix = camera.projection(aspect);

  const frame = fiberMode ? fiberFrame(viewMatrix, projMatrix) : null;
  // Fibre frames still catching up with the yarn: come back next frame.
  if (fiberMoved) sceneChanged = true;

  if (shadowStale) {
    shadowStale = false;
    // Shadow pass — render depth into shadowFB
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(4.0, 8.0);

    if (frame) {
      fiber!.drawDepth(frame);
    } else {
      for (const yarn of yarns) {
        setDepthUniforms(segmentDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
        gl.bindVertexArray(yarn.segmentDepthVAO);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, yarn.segmentCount);

        setDepthUniforms(joinDepthProgram, shadowViewMatrix, shadowProjectionMatrix, yarn.diameter);
        gl.bindVertexArray(yarn.joinDepthVAO);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, yarn.joinCount);
      }
    }

    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  // Main pass, into the occlusion's target when it is on.
  if (!ao) ao = createAmbientOcclusion(gl);
  Object.assign(ao.settings, aoSettings);
  const occluded = ao.begin(window.devicePixelRatio || 1);
  if (!occluded) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture);

  if (frame) fiber!.draw(frame);
  else drawToon(viewMatrix, projMatrix);

  if (occluded) ao.finish(projMatrix);
}

function drawToon(viewMatrix: any, projMatrix: any) {
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
    buildYarnCurveInto(yarn.pts, 12, 0.5, yarns[i].splinePts);
    gl.bindBuffer(gl.ARRAY_BUFFER, yarns[i].yarnBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, yarns[i].splinePts);
  });
  sceneChanged = true;
  if (fiberMode && fiber && !fiberStale) fiberMoved = true;
  else {
    fiberStale = true;
    shadowStale = true;
  }
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
  setFiberMode,
  setFiberStyle,
  setAmbientOcclusion,
};
