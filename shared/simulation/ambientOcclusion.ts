import { initShaderProgram } from "./webgl";
import { Mat4 } from "../mat4";

// Screen-space ambient occlusion, ported from chainstitch
// (src/rendering/AmbientOcclusion.ts), which uses three.js r166's GTAOPass: the
// yarn darkens where it tucks under other yarn, whatever the light does. The
// scene is drawn into a multisampled target with a depth texture; GTAO works
// from that depth alone, normals reconstructed from it (the yarn shaders place
// their own geometry, so there is no normal buffer to draw), at CSS-pixel
// resolution; a Poisson denoise smooths it; and it is multiplied into the
// colour, in linear light, on the way to the screen.
//
// The GTAO and denoise shaders are three's (GTAOShader, PoissonDenoiseShader),
// with the settings chainstitch gives them.

/** Ambient-occlusion settings; the noodle renderer's setAmbientOcclusion changes them. */
export const DEFAULT_AO = Object.freeze({
  enabled: true,
  /** How far occluders reach, in scene units (a stitch is 1 wide, a yarn 0.27 across). */
  radius: 0.5,
  /** The occlusion raised to this power: 1 as computed, higher darker, 0 none. */
  strength: 2.5,
});

export type AOSettings = { enabled: boolean; radius: number; strength: number };

// Samples crowded toward the middle, and occluders counted up to 1.5 units off in
// depth: three's defaults leave the knit's crevices faint.
const SAMPLES = 16;
const DISTANCE_EXPONENT = 2;
const THICKNESS = 1.5;
const DISTANCE_FALLOFF = 1;
// Poisson denoise, as GTAOPass sets it up.
const PD_SAMPLES = 16;
const PD_RINGS = 2;
const PD_RADIUS_EXPONENT = 1;
const PD_LUMA_PHI = 10;
const PD_DEPTH_PHI = 2;
const PD_NORMAL_PHI = 3;
const PD_RADIUS = 8;

// A triangle covering the screen, from gl_VertexID alone.
const fullscreenVertex = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2( ( gl_VertexID << 1 ) & 2, gl_VertexID & 2 );
  vUv = p;
  gl_Position = vec4( p * 2.0 - 1.0, 0.0, 1.0 );
}
`;

const common = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
#define PI 3.141592653589793
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tDepth;
uniform sampler2D tNoise;
uniform vec2 resolution;
uniform mat4 cameraProjectionMatrixInverse;

vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
  vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
  vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
  return viewSpacePosition.xyz / viewSpacePosition.w;
}

float getDepth( const vec2 uv ) {
  return textureLod( tDepth, uv.xy, 0.0 ).x;
}

float fetchDepth( const ivec2 uv ) {
  return texelFetch( tDepth, uv.xy, 0 ).x;
}

vec3 computeNormalFromDepth( const vec2 uv ) {
  vec2 size = vec2( textureSize( tDepth, 0 ) );
  ivec2 p = ivec2( uv * size );
  float c0 = fetchDepth( p );
  float l2 = fetchDepth( p - ivec2( 2, 0 ) );
  float l1 = fetchDepth( p - ivec2( 1, 0 ) );
  float r1 = fetchDepth( p + ivec2( 1, 0 ) );
  float r2 = fetchDepth( p + ivec2( 2, 0 ) );
  float b2 = fetchDepth( p - ivec2( 0, 2 ) );
  float b1 = fetchDepth( p - ivec2( 0, 1 ) );
  float t1 = fetchDepth( p + ivec2( 0, 1 ) );
  float t2 = fetchDepth( p + ivec2( 0, 2 ) );
  float dl = abs( ( 2.0 * l1 - l2 ) - c0 );
  float dr = abs( ( 2.0 * r1 - r2 ) - c0 );
  float db = abs( ( 2.0 * b1 - b2 ) - c0 );
  float dt = abs( ( 2.0 * t1 - t2 ) - c0 );
  vec3 ce = getViewPosition( uv, c0 ).xyz;
  vec3 dpdx = ( dl < dr ) ? ce - getViewPosition( ( uv - vec2( 1.0 / size.x, 0.0 ) ), l1 ).xyz
                          : -ce + getViewPosition( ( uv + vec2( 1.0 / size.x, 0.0 ) ), r1 ).xyz;
  vec3 dpdy = ( db < dt ) ? ce - getViewPosition( ( uv - vec2( 0.0, 1.0 / size.y ) ), b1 ).xyz
                          : -ce + getViewPosition( ( uv + vec2( 0.0, 1.0 / size.y ) ), t1 ).xyz;
  return normalize( cross( dpdx, dpdy ) );
}
`;

// three's GTAOShader, perspective camera, normals from depth, no clip box.
const gtaoFragment = /* glsl */ `${common}
uniform mat4 cameraProjectionMatrix;
uniform float radius;
uniform float distanceExponent;
uniform float thickness;
uniform float distanceFallOff;
uniform float scale;

#define DIRECTIONS ${SAMPLES < 30 ? 3 : 5}
#define STEPS ${Math.ceil(SAMPLES / (SAMPLES < 30 ? 3 : 5))}

vec3 getSceneUvAndDepth( vec3 sampleViewPos ) {
  vec4 sampleClipPos = cameraProjectionMatrix * vec4( sampleViewPos, 1. );
  vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
  float sampleSceneDepth = getDepth( sampleUv );
  return vec3( sampleUv, sampleSceneDepth );
}

void main() {
  float depth = getDepth( vUv.xy );
  if ( depth >= 1.0 ) {
    discard;
  }
  vec3 viewPos = getViewPosition( vUv, depth );
  vec3 viewNormal = computeNormalFromDepth( vUv );

  float radiusToUse = radius;

  vec2 noiseResolution = vec2( textureSize( tNoise, 0 ) );
  vec2 noiseUv = vUv * resolution / noiseResolution;
  vec4 noiseTexel = textureLod( tNoise, noiseUv, 0.0 );
  vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
  vec3 tangent = normalize( vec3( randomVec.xy, 0. ) );
  vec3 bitangent = vec3( -tangent.y, tangent.x, 0. );
  mat3 kernelMatrix = mat3( tangent, bitangent, vec3( 0., 0., 1. ) );

  float ao = 0.0;
  for ( int i = 0; i < DIRECTIONS; ++i ) {
    float angle = float( i ) / float( DIRECTIONS ) * PI;
    vec4 sampleDir = vec4( cos( angle ), sin( angle ), 0., 0.5 + 0.5 * noiseTexel.w );
    sampleDir.xyz = normalize( kernelMatrix * sampleDir.xyz );

    vec3 viewDir = normalize( -viewPos.xyz );
    vec3 sliceBitangent = normalize( cross( sampleDir.xyz, viewDir ) );
    vec3 sliceTangent = cross( sliceBitangent, viewDir );
    vec3 normalInSlice = normalize( viewNormal - sliceBitangent * dot( viewNormal, sliceBitangent ) );

    vec3 tangentToNormalInSlice = cross( normalInSlice, sliceBitangent );
    vec2 cosHorizons = vec2( dot( viewDir, tangentToNormalInSlice ), dot( viewDir, -tangentToNormalInSlice ) );

    for ( int j = 0; j < STEPS; ++j ) {
      vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow( float( j + 1 ) / float( STEPS ), distanceExponent );

      vec3 sampleSceneUvDepth = getSceneUvAndDepth( viewPos + sampleViewOffset );
      vec3 sampleSceneViewPos = getViewPosition( sampleSceneUvDepth.xy, sampleSceneUvDepth.z );
      vec3 viewDelta = sampleSceneViewPos - viewPos;
      if ( abs( viewDelta.z ) < thickness ) {
        float sampleCosHorizon = dot( viewDir, normalize( viewDelta ) );
        cosHorizons.x += max( 0., ( sampleCosHorizon - cosHorizons.x ) * mix( 1., 2. / float( j + 2 ), distanceFallOff ) );
      }

      sampleSceneUvDepth = getSceneUvAndDepth( viewPos - sampleViewOffset );
      sampleSceneViewPos = getViewPosition( sampleSceneUvDepth.xy, sampleSceneUvDepth.z );
      viewDelta = sampleSceneViewPos - viewPos;
      if ( abs( viewDelta.z ) < thickness ) {
        float sampleCosHorizon = dot( viewDir, normalize( viewDelta ) );
        cosHorizons.y += max( 0., ( sampleCosHorizon - cosHorizons.y ) * mix( 1., 2. / float( j + 2 ), distanceFallOff ) );
      }
    }

    vec2 sinHorizons = sqrt( 1. - cosHorizons * cosHorizons );
    float nx = dot( normalInSlice, sliceTangent );
    float ny = dot( normalInSlice, viewDir );
    float nxb = 1. / 2. * ( acos( cosHorizons.y ) - acos( cosHorizons.x ) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y );
    float nyb = 1. / 2. * ( 2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y );
    float occlusion = nx * nxb + ny * nyb;
    ao += occlusion;
  }

  ao = clamp( ao / float( DIRECTIONS ), 0., 1. );
  ao = pow( ao, scale );

  fragColor = vec4( vec3( ao ), 1. );
}
`;

// three's PoissonDenoiseShader, normals from depth, depth from its red channel.
function poissonDisk(samples: number, rings: number, radiusExponent: number): string {
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    const angle = (2 * Math.PI * rings * i) / samples;
    const radius = Math.pow(i / (samples - 1), radiusExponent);
    points.push(`vec3(${Math.cos(angle)}, ${Math.sin(angle)}, ${radius})`);
  }
  return `vec3[SAMPLES](${points.join(", ")})`;
}

const denoiseFragment = /* glsl */ `${common}
uniform sampler2D tDiffuse;
uniform float lumaPhi;
uniform float depthPhi;
uniform float normalPhi;
uniform float radius;

#define SAMPLES ${PD_SAMPLES}
const vec3 poissonDisk[SAMPLES] = ${poissonDisk(PD_SAMPLES, PD_RINGS, PD_RADIUS_EXPONENT)};

float getLuminance( const in vec3 a ) {
  return dot( vec3( 0.2125, 0.7154, 0.0721 ), a );
}

void denoiseSample( in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight ) {
  vec4 sampleTexel = textureLod( tDiffuse, sampleUv, 0.0 );
  float sampleDepth = getDepth( sampleUv );
  vec3 sampleNormal = computeNormalFromDepth( sampleUv );
  vec3 neighborColor = sampleTexel.rgb;
  vec3 viewPosSample = getViewPosition( sampleUv, sampleDepth );

  float normalDiff = dot( viewNormal, sampleNormal );
  float normalSimilarity = pow( max( normalDiff, 0. ), normalPhi );
  float lumaDiff = abs( getLuminance( neighborColor ) - getLuminance( center ) );
  float lumaSimilarity = max( 1.0 - lumaDiff / lumaPhi, 0.0 );
  float depthDiff = abs( dot( viewPos - viewPosSample, viewNormal ) );
  float depthSimilarity = max( 1. - depthDiff / depthPhi, 0. );
  float w = lumaSimilarity * depthSimilarity * normalSimilarity;

  denoised += w * neighborColor;
  totalWeight += w;
}

void main() {
  float depth = getDepth( vUv.xy );
  vec3 viewNormal = computeNormalFromDepth( vUv );
  if ( depth == 1. || dot( viewNormal, viewNormal ) == 0. ) {
    discard;
  }
  vec4 texel = textureLod( tDiffuse, vUv, 0.0 );
  vec3 center = texel.rgb;
  vec3 viewPos = getViewPosition( vUv, depth );

  vec2 noiseResolution = vec2( textureSize( tNoise, 0 ) );
  vec2 noiseUv = vUv * resolution / noiseResolution;
  vec4 noiseTexel = textureLod( tNoise, noiseUv, 0.0 );
  vec2 noiseVec = vec2( sin( noiseTexel.x * 2. * PI ), cos( noiseTexel.x * 2. * PI ) );
  mat2 rotationMatrix = mat2( noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y );

  float totalWeight = 1.0;
  vec3 denoised = texel.rgb;
  for ( int i = 0; i < SAMPLES; i++ ) {
    vec3 sampleDir = poissonDisk[ i ];
    vec2 offset = rotationMatrix * ( sampleDir.xy * ( 1. + sampleDir.z * ( radius - 1. ) ) / resolution );
    vec2 sampleUv = vUv + offset;
    denoiseSample( center, viewNormal, viewPos, sampleUv, denoised, totalWeight );
  }

  if ( totalWeight > 0. ) {
    denoised /= totalWeight;
  }
  fragColor = vec4( denoised, 1. );
}
`;

// The scene's colour (as the yarn shaders wrote it, sRGB) times the occlusion,
// multiplied in linear light as chainstitch's sRGB target blends it.
const compositeFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tColor;
uniform sampler2D tAO;

vec3 toLinear( vec3 c ) {
  return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) );
}

vec3 toSRGB( vec3 c ) {
  c = max( c, 0.0 );
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}

void main() {
  vec3 color = texture( tColor, vUv ).rgb;
  float ao = texture( tAO, vUv ).r;
  fragColor = vec4( toSRGB( toLinear( color ) * ao ), 1.0 );
}
`;

// three's generateMagicSquareNoise: 5 × 5 rotations, each used once per tile.
function magicSquareNoise(size = 5): Uint8Array {
  const n = size % 2 === 0 ? size + 1 : size;
  const square = new Array(n * n).fill(0);
  let i = Math.floor(n / 2);
  let j = n - 1;
  for (let num = 1; num <= n * n; ) {
    if (i === -1 && j === n) {
      j = n - 2;
      i = 0;
    } else {
      if (j === n) j = 0;
      if (i < 0) i = n - 1;
    }
    if (square[i * n + j] !== 0) {
      j -= 2;
      i++;
      continue;
    }
    square[i * n + j] = num++;
    j++;
    i--;
  }
  const data = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) {
    const angle = (2 * Math.PI * square[k]) / (n * n);
    data[k * 4] = (Math.cos(angle) * 0.5 + 0.5) * 255;
    data[k * 4 + 1] = (Math.sin(angle) * 0.5 + 0.5) * 255;
    data[k * 4 + 2] = 127;
    data[k * 4 + 3] = 255;
  }
  return data;
}

// The denoise's rotations. three fills this with simplex noise from a random
// permutation; independent random values serve the same purpose.
function randomNoise(size = 64): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < data.length; k++) data[k] = Math.floor(Math.random() * 256);
  return data;
}

export function createAmbientOcclusion(gl: WebGL2RenderingContext) {
  const settings: AOSettings = { ...DEFAULT_AO };
  const gtao = initShaderProgram(gl, fullscreenVertex, gtaoFragment) as any;
  const denoise = initShaderProgram(gl, fullscreenVertex, denoiseFragment) as any;
  const composite = initShaderProgram(gl, fullscreenVertex, compositeFragment) as any;
  const emptyVAO = gl.createVertexArray();

  function texture(width: number, height: number, internal: number, format: number, type: number, filter: number, wrap: number, data: ArrayBufferView | null = null) {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  const gtaoNoise = texture(5, 5, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, gl.REPEAT, magicSquareNoise());
  const pdNoise = texture(64, 64, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, gl.REPEAT, randomNoise());

  // Sized on first use and whenever the canvas changes.
  let width = 0, height = 0, aoWidth = 0, aoHeight = 0;
  let sceneFB: WebGLFramebuffer | null = null;
  let resolveFB: WebGLFramebuffer | null = null;
  let aoFB: WebGLFramebuffer | null = null;
  let pdFB: WebGLFramebuffer | null = null;
  let owned: { textures: WebGLTexture[]; renderbuffers: WebGLRenderbuffer[]; framebuffers: WebGLFramebuffer[] } = {
    textures: [],
    renderbuffers: [],
    framebuffers: [],
  };
  let colorTexture: WebGLTexture, depthTexture: WebGLTexture, aoTexture: WebGLTexture, pdTexture: WebGLTexture;

  function framebuffer(attach: (fb: WebGLFramebuffer) => void): WebGLFramebuffer {
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    attach(fb);
    owned.framebuffers.push(fb);
    return fb;
  }

  function resize(w: number, h: number, pixelRatio: number) {
    const aw = Math.max(1, Math.round(w / pixelRatio));
    const ah = Math.max(1, Math.round(h / pixelRatio));
    if (w === width && h === height && aw === aoWidth && ah === aoHeight) return;
    for (const t of owned.textures) gl.deleteTexture(t);
    for (const r of owned.renderbuffers) gl.deleteRenderbuffer(r);
    for (const f of owned.framebuffers) gl.deleteFramebuffer(f);
    owned = { textures: [], renderbuffers: [], framebuffers: [] };
    width = w;
    height = h;
    aoWidth = aw;
    aoHeight = ah;

    // The scene, 4x multisampled, resolved into a colour and a depth texture.
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const colorRB = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, colorRB);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    const depthRB = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRB);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    owned.renderbuffers.push(colorRB, depthRB);
    sceneFB = framebuffer(() => {
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRB);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRB);
    });

    colorTexture = texture(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, gl.CLAMP_TO_EDGE);
    depthTexture = texture(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST, gl.CLAMP_TO_EDGE);
    resolveFB = framebuffer(() => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
    });

    // The occlusion and its denoised copy, per CSS pixel, blended up when composited.
    aoTexture = texture(aw, ah, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.CLAMP_TO_EDGE);
    pdTexture = texture(aw, ah, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.CLAMP_TO_EDGE);
    aoFB = framebuffer(() => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, aoTexture, 0));
    pdFB = framebuffer(() => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pdTexture, 0));
    owned.textures.push(colorTexture, depthTexture, aoTexture, pdTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Bind the scene target for the main pass, if occlusion is on; false if it is off. */
  function begin(pixelRatio: number): boolean {
    if (!settings.enabled) return false;
    resize(gl.canvas.width, gl.canvas.height, pixelRatio);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFB);
    return true;
  }

  function bindTexture(unit: number, t: WebGLTexture, location: WebGLUniformLocation | null) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(location, unit);
  }

  /** Resolve the scene, work out the occlusion, and composite it onto the screen. */
  function finish(projMatrix: number[]) {
    const inverse = Mat4.inverse(projMatrix);
    const clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sceneFB);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFB);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindVertexArray(emptyVAO);
    gl.viewport(0, 0, aoWidth, aoHeight);
    gl.clearColor(1, 1, 1, 1);

    // Occlusion, cleared to none where the background is.
    gl.bindFramebuffer(gl.FRAMEBUFFER, aoFB);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(gtao.program);
    let u = gtao.uniformLocations;
    bindTexture(0, depthTexture, u.tDepth);
    bindTexture(1, gtaoNoise, u.tNoise);
    gl.uniform2f(u.resolution, aoWidth, aoHeight);
    gl.uniformMatrix4fv(u.cameraProjectionMatrix, false, projMatrix);
    gl.uniformMatrix4fv(u.cameraProjectionMatrixInverse, false, inverse);
    gl.uniform1f(u.radius, settings.radius);
    gl.uniform1f(u.distanceExponent, DISTANCE_EXPONENT);
    gl.uniform1f(u.thickness, THICKNESS);
    gl.uniform1f(u.distanceFallOff, DISTANCE_FALLOFF);
    gl.uniform1f(u.scale, settings.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Denoised.
    gl.bindFramebuffer(gl.FRAMEBUFFER, pdFB);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(denoise.program);
    u = denoise.uniformLocations;
    bindTexture(0, depthTexture, u.tDepth);
    bindTexture(1, pdNoise, u.tNoise);
    bindTexture(2, aoTexture, u.tDiffuse);
    gl.uniform2f(u.resolution, aoWidth, aoHeight);
    gl.uniformMatrix4fv(u.cameraProjectionMatrixInverse, false, inverse);
    gl.uniform1f(u.lumaPhi, PD_LUMA_PHI);
    gl.uniform1f(u.depthPhi, PD_DEPTH_PHI);
    gl.uniform1f(u.normalPhi, PD_NORMAL_PHI);
    gl.uniform1f(u.radius, PD_RADIUS);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Onto the screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(composite.program);
    u = composite.uniformLocations;
    bindTexture(0, colorTexture, u.tColor);
    bindTexture(1, pdTexture, u.tAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
  }

  return { settings, begin, finish };
}

export type AmbientOcclusion = ReturnType<typeof createAmbientOcclusion>;
