import { initShaderProgram } from "./webgl";

// Fibre-level yarn, ported from chainstitch (src/rendering/FiberMaterial.ts and
// FiberYarnGeometry.ts) from three.js to raw WebGL2 so it draws with the noodle
// renderer's camera, light and shadow map.
//
// The plied structure is Zhao et al.'s procedural yarn (Fitting Procedural Yarn
// Models for Realistic Cloth Rendering, SIGGRAPH 2016): plies twisted about the
// yarn's centre, fibres twisted about each ply's, and flyaways, as hairs with one
// free end and loops with both ends in the yarn. As in Wu and Yuksel's real-time
// version (I3D 2017), it is generated on the GPU from the yarn's centerline: the
// centerline is resampled about every `spacing` yarn radii, given a
// rotation-minimizing frame and arc length, and stored in float textures. Each
// ply is instanced tube patches placed by the vertex shader and shaded with its
// dense fibres rather than drawing them; the flyaways are instanced ribbons.
// An update uploads the frames and nothing else.

/** Fibre settings, shared by every yarn. Read each frame, so changes show at once. */
export const DEFAULT_FIBER_STYLE = Object.freeze({
  /** Plies per yarn; 1 is a singles yarn. */
  plies: 3,
  /** Length of one full turn of the plies about the yarn, in yarn diameters. */
  plyPitch: 3.5,
  /** Fibres across each ply's surface. */
  fiberCount: 24,
  /** Angle of the fibres to the ply's axis at its surface, in degrees; opposite in sign to
   *  the ply twist leaves them near parallel to the yarn's axis, as in a balanced yarn. */
  fiberAngle: -30,
  /** How round each fibre looks: how far its normal tips across it. */
  fiberBump: 0.6,
  /** Length of a fibre before it migrates into the ply, in yarn diameters. */
  fiberLength: 4,
  /** Flyaways per yarn diameter of length. */
  fuzz: 24,
  /** Longest flyaway, in yarn diameters. */
  hairLength: 1.2,
  /** Share of flyaways that are loops. */
  loopShare: 0.3,
  /** How much a hair winds about its own line: its crimp. */
  hairCurl: 0.5,
  /** Fibre width, in yarn radii. */
  hairWidth: 0.025,
  /** Kajiya-Kay highlight along the fibres. */
  sheen: 0.2,
  /** The key light's strength; light from everywhere and from over the viewer's shoulder
   *  besides it. Only the key light is shadowed, so it has to lead for shadows to show. */
  key: 1,
  ambient: 0.25,
  fill: 0.1,
  /** Centerline sample spacing, in yarn radii. Read when a yarn is built. */
  spacing: 0.8,
});

export type FiberStyle = { -readonly [K in keyof typeof DEFAULT_FIBER_STYLE]: number };

/** The settings in use; the noodle renderer's setFiberStyle changes them. */
export const fiberStyle: FiberStyle = { ...DEFAULT_FIBER_STYLE };

/** Texels per row of the frame textures; the shaders index them as j & 1023, j >> 10. */
const TEXTURE_WIDTH = 1024;
/** Centerline intervals drawn by one ply instance. */
const PLY_CHUNK = 16;
/** Sides around each ply's cross-section. */
const PLY_SIDES = 10;
/** Segments along each flyaway fibre. */
const HAIR_SEGMENTS = 8;
/**
 * Flyaways thin out from full density where the yarn is HAIR_FULL pixels across to none
 * where it is HAIR_NONE: further off they are finer than a pixel and show only as speckle.
 */
const HAIR_NONE = 2;
const HAIR_FULL = 30;
/**
 * Most flyaways drawn per yarn. A whole garment has millions at full density; past
 * this they thin evenly so a close view of a big piece stays drawable.
 */
const MAX_HAIRS = 2_000_000;
/**
 * Ply detail by the yarn's diameter on screen (or in the shadow map), in pixels:
 * sides around each ply and centerline samples per row of the patch. Further off
 * the plies are a few pixels across and a coarse tube shades the same.
 */
const PLY_LODS = [
  { minPixels: 16, sides: PLY_SIDES, step: 1 },
  { minPixels: 5, sides: 6, step: 2 },
  { minPixels: 0, sides: 4, step: 4 },
];
/**
 * Flyaway densities chunks are grouped by, as shares of full density: each group
 * draws its top share and the shader drops the rest, so halving steps waste at
 * most half the instances.
 */
const HAIR_BUCKETS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];
/** Texture units: the shadow map is on 0. */
const FRAME_UNITS = [1, 2, 3];

function hairShare(pixels: number): number {
  return Math.min(1, Math.max(0, (pixels - HAIR_NONE) / (HAIR_FULL - HAIR_NONE)));
}

// ─── Shaders ──────────────────────────────────────────────────────────────────

const header = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
#define PI 3.141592653589793
#define PI2 6.283185307179586
`;

// The centerline frames FiberYarn stores, and how the plies sit about it.
const frames = /* glsl */ `
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D centerTexture;
uniform sampler2D tangentTexture;
uniform sampler2D normalTexture;
uniform int sampleCount;
uniform float sampleSpacing;
uniform float radius;
uniform int plies;
uniform float plyPitch;

layout(location = 0) in vec3 position;
// Which PLY_CHUNK-sample stretch of the centerline this instance draws.
layout(location = 1) in float chunkIndex;

struct Frame { vec3 p; float s; vec3 t; vec3 n; vec3 b; };

ivec2 texel( int j ) { return ivec2( j & 1023, j >> 10 ); }

Frame frameAt( int j ) {
  j = clamp( j, 0, sampleCount - 1 );
  vec4 c = texelFetch( centerTexture, texel( j ), 0 );
  Frame f;
  f.p = c.xyz;
  f.s = c.w;
  f.t = texelFetch( tangentTexture, texel( j ), 0 ).xyz;
  f.n = texelFetch( normalTexture, texel( j ), 0 ).xyz;
  f.b = cross( f.t, f.n );
  return f;
}

// Between samples, for the flyaways.
Frame frameAt( float x ) {
  x = clamp( x, 0.0, float( sampleCount - 1 ) );
  int j = int( floor( x ) );
  Frame a = frameAt( j ), b = frameAt( j + 1 );
  float w = x - float( j );
  Frame f;
  f.p = mix( a.p, b.p, w );
  f.s = mix( a.s, b.s, w );
  f.t = normalize( mix( a.t, b.t, w ) );
  f.n = normalize( mix( a.n, b.n, w ) );
  f.b = normalize( cross( f.t, f.n ) );
  return f;
}

// Round plies packed in a yarn of radius 1: each ply's radius and its centre's
// distance from the yarn's.
void plyLayout( out float rPly, out float rCenter ) {
  if ( plies <= 1 ) { rPly = 1.0; rCenter = 0.0; return; }
  float s = sin( PI / float( plies ) );
  rPly = s / ( 1.0 + s );
  rCenter = 1.0 - rPly;
}

// How far the plies have turned at arc length s (in whole turns wrapped off, for
// sin and cos's sake), and how fast they turn.
float plyTwist( float s ) { return PI2 * fract( s / ( plyPitch * 2.0 * radius ) ); }
float plyTwistRate() { return PI2 / ( plyPitch * 2.0 * radius ); }
`;

// The key light's shadow and the extra lights, shared by plies and flyaways.
// Colours are lit in linear space and written out as sRGB.
const lighting = /* glsl */ `
uniform sampler2D tShadow;
uniform mat4 shadowViewMatrix;
uniform mat4 shadowProjectionMatrix;
// The key light's direction in view space, toward it.
uniform vec3 keyDirection;
uniform float key;
uniform float ambient;
uniform float fill;
uniform float sheen;
uniform vec3 color;

out vec4 fragColor;

float unpackRGBA( vec4 v ) {
  return dot( v, 1.0 / vec4( 1.0, 255.0, 65025.0, 16581375.0 ) );
}

// The noodle renderer's shadow map, looked up as its own shader does.
float keyShadow( vec3 world ) {
  vec4 clip = shadowProjectionMatrix * shadowViewMatrix * vec4( world, 1.0 );
  vec3 lp = clip.xyz / clip.w * 0.5 + 0.5;
  if ( lp.x < 0.0 || lp.x > 1.0 || lp.y < 0.0 || lp.y > 1.0 || lp.z > 1.0 ) return 1.0;
  float depth = lp.z - 0.002;
  float texelSize = 1.0 / 2048.0;
  float lit = 0.0;
  for ( int x = -1; x <= 1; x++ ) {
    for ( int y = -1; y <= 1; y++ ) {
      lit += step( depth, unpackRGBA( texture( tShadow, lp.xy + vec2( x, y ) * texelSize ) ) );
    }
  }
  return lit / 9.0;
}

vec3 toSRGB( vec3 c ) {
  c = max( c, 0.0 );
  return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}

// Over the viewer's shoulder, in view space.
const vec3 FILL_DIRECTION = vec3( -0.32, 0.45, 0.83 );
`;

const plyVertexShader = /* glsl */ `${header}
#define PLY_CHUNK ${PLY_CHUNK}
${frames}
uniform float fiberCount;
uniform float fiberAngle;

out vec3 vView;
out vec3 vNormal;
out vec3 vFiber;
out vec3 vWorld;
// Across the fibres (whole numbers between them), and along the yarn in diameters.
out float vStripe;
out float vAlong;
out float vPly;
// How far the surface faces out from the yarn's centre, -1 to 1: where plies meet, it faces in.
out float vOutward;

void main() {
  int chunk = int( chunkIndex );
  int ply = gl_InstanceID - ( gl_InstanceID / plies ) * plies;
  Frame f = frameAt( chunk * PLY_CHUNK + int( position.y ) );
  float rPly, rCenter;
  plyLayout( rPly, rCenter );

  // The ply's centre turns about the yarn's; its cross-section turns with it.
  float theta = PI2 * float( ply ) / float( plies ) + plyTwist( f.s );
  vec3 out1 = cos( theta ) * f.n + sin( theta ) * f.b;
  vec3 side = -sin( theta ) * f.n + cos( theta ) * f.b;
  // Plies pressed together widen toward each other.
  float a = rPly * radius, b = a * ( plies > 1 ? 1.12 : 1.0 );
  float phi = PI2 * position.x;
  vec3 offset = ( rCenter * radius + a * cos( phi ) ) * out1 + b * sin( phi ) * side;
  vec3 p = f.p + offset;
  vec3 normal = normalize( cos( phi ) / a * out1 + sin( phi ) / b * side );
  vec3 around = normalize( -a * sin( phi ) * out1 + b * cos( phi ) * side );
  // Along the ply's surface, as the cross-section turns; the fibres lie at fiberAngle to that.
  vec3 along = f.t + plyTwistRate() * cross( f.t, offset );
  float speed = length( along );
  vec3 fiber = along + tan( fiberAngle ) * speed * around;

  // Arc length runs to thousands along a piece, too big to interpolate to a fraction of
  // a fibre, so the patterns are wrapped at the chunk's start, on whole fibres and whole
  // diameters so each fibre keeps its place across chunks (the chunk's start is the
  // last chunk's end). They jump where the wrap comes round, every 1024 fibres' twist.
  float s0 = frameAt( chunk * PLY_CHUNK ).s;
  float circumference = PI2 * 0.5 * ( a + b );
  // Speed along the ply's own centre, not this vertex's, so it is the same all round the ply.
  float plySpeed = length( vec2( 1.0, plyTwistRate() * rCenter * radius ) );
  float perLength = fiberCount * plySpeed * tan( fiberAngle ) / circumference;
  vStripe = fiberCount * position.x - ( f.s - s0 ) * perLength - mod( s0 * perLength, 1024.0 );
  vAlong = ( f.s - s0 ) / ( 2.0 * radius ) + mod( s0 / ( 2.0 * radius ), 256.0 );
  vPly = float( ply );
  vOutward = plies > 1 ? dot( normal, normalize( offset ) ) : 1.0;

  vec4 view = viewMatrix * vec4( p, 1.0 );
  vView = view.xyz;
  vNormal = normalize( mat3( viewMatrix ) * normal );
  vFiber = normalize( mat3( viewMatrix ) * fiber );
  // Looked up a little off the surface, so a yarn does not shadow itself where it faces the light.
  vWorld = p + normal * radius * 0.25;
  gl_Position = projectionMatrix * view;
}
`;

const plyFragmentShader = /* glsl */ `${header}
${lighting}
uniform float fiberBump;
uniform float fiberLength;

in vec3 vView;
in vec3 vNormal;
in vec3 vFiber;
in vec3 vWorld;
in float vStripe;
in float vAlong;
in float vPly;
in float vOutward;

float hash13( vec3 p3 ) {
  p3 = fract( p3 * 0.1031 );
  p3 += dot( p3, p3.zyx + 31.32 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

void main() {
  vec3 N = normalize( vNormal );
  vec3 T = normalize( vFiber );
  vec3 V = normalize( -vView );
  vec3 across = normalize( cross( N, T ) );

  // Which fibre, and which stretch of it: each runs fiberLength (varied) before it
  // migrates into the ply and another takes its place. The pattern fades to its
  // average once fibres are finer than a pixel.
  float fw = fwidth( vStripe );
  float detail = 1.0 - smoothstep( 0.3, 0.8, fw );
  float id = floor( vStripe );
  float start = hash13( vec3( id, vPly, 7.0 ) );
  float run = vAlong / ( fiberLength * mix( 0.6, 1.4, hash13( vec3( id, vPly, 3.0 ) ) ) ) + start;
  float stretch = floor( run );
  float h1 = hash13( vec3( id, stretch, vPly ) );
  float h2 = hash13( vec3( stretch, id, vPly + 11.0 ) );
  // Tapered at both ends of the stretch.
  float end = fract( run );
  float width = mix( 0.5, 0.95, h2 ) * smoothstep( 0.0, 0.08, end ) * smoothstep( 1.0, 0.92, end );
  // Not quite evenly spaced.
  float x = fract( vStripe ) - 0.5 + 0.25 * ( h1 - 0.5 ) * ( 1.0 - width );
  float half_ = 0.5 * width;
  float inside = 1.0 - smoothstep( half_ - fw, half_ + fw, abs( x ) );
  float xn = clamp( x / max( half_, 1e-3 ), -1.0, 1.0 );
  vec3 Nf = normalize( N + across * xn * fiberBump * inside * detail );
  float tone = mix( 1.0, mix( 0.82, 1.12, h1 ), detail );
  // Between fibres, and between plies, less light gets in.
  float gaps = mix( 1.0, mix( 0.6, 1.0, inside ), detail );
  float crevice = mix( 0.35, 1.0, smoothstep( -0.7, 0.55, vOutward ) );
  float occlusion = gaps * crevice;

  vec3 L = keyDirection;
  float shadow = keyShadow( vWorld );
  float wrap = 0.3;
  float keyLight = max( ( dot( Nf, L ) + wrap ) / ( 1.0 + wrap ), 0.0 ) * shadow;
  float fillLight = max( ( dot( Nf, FILL_DIRECTION ) + wrap ) / ( 1.0 + wrap ), 0.0 );
  // Kajiya-Kay: a highlight across the fibres, shifted toward their roots.
  vec3 H = normalize( L + V );
  vec3 Ts = normalize( T - 0.15 * Nf );
  float th = dot( Ts, H );
  float highlight = pow( sqrt( max( 1.0 - th * th, 0.0 ) ), 48.0 ) * smoothstep( -0.1, 0.25, dot( N, L ) ) * shadow;

  vec3 base = color * tone;
  vec3 light = base * ( ambient * occlusion + ( key * keyLight + fill * fillLight ) * mix( 1.0, occlusion, 0.6 ) );
  fragColor = vec4( toSRGB( light + sheen * highlight * occlusion * mix( base, vec3( 1.0 ), 0.5 ) ), 1.0 );
}
`;

const plyDepthVertexShader = /* glsl */ `${header}
#define PLY_CHUNK ${PLY_CHUNK}
${frames}

void main() {
  int chunk = int( chunkIndex );
  int ply = gl_InstanceID - ( gl_InstanceID / plies ) * plies;
  Frame f = frameAt( chunk * PLY_CHUNK + int( position.y ) );
  float rPly, rCenter;
  plyLayout( rPly, rCenter );
  float theta = PI2 * float( ply ) / float( plies ) + plyTwist( f.s );
  vec3 out1 = cos( theta ) * f.n + sin( theta ) * f.b;
  vec3 side = -sin( theta ) * f.n + cos( theta ) * f.b;
  float a = rPly * radius, b = a * ( plies > 1 ? 1.12 : 1.0 );
  float phi = PI2 * position.x;
  vec3 p = f.p + ( rCenter * radius + a * cos( phi ) ) * out1 + b * sin( phi ) * side;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}
`;

// The shadow map, packed as the noodle renderer's depth pass packs it.
const depthFragmentShader = /* glsl */ `${header}
out vec4 fragColor;

vec4 packRGBA( float v ) {
  vec4 pack = fract( vec4( 1.0, 255.0, 65025.0, 16581375.0 ) * v );
  pack -= pack.yzww * vec2( 1.0 / 255.0, 0.0 ).xxxy;
  return pack;
}

void main() {
  fragColor = packRGBA( gl_FragCoord.z );
}
`;

// A flyaway: hairs leave the yarn at their root and stand out from it, crimped, to a
// free end; loops leave it and come back. Most are short, a halo of fuzz close to the
// yarn, and a few are long strays. Each is laid out from its root in the yarn's frame
// (along the yarn, out from it, around it) and follows the yarn where it bends. Each is a
// ribbon at least a pixel wide, as wide as the fibre is, with the rest of the pixel
// left to alpha-to-coverage, so fine fuzz reads as a haze.
const hairVertexShader = /* glsl */ `${header}
${frames}
uniform float hairLength;
uniform float loopShare;
uniform float hairWidth;
uniform float hairCurl;
uniform vec2 resolution;
// The share of the flyaways drawn: the most any part of this chunk needs.
uniform float hairDrawn;
// Flyaways per chunk at full density, and how many of them this draw takes.
uniform int hairsPerChunk;
uniform int hairsDrawnPerChunk;

out vec3 vView;
out vec3 vTangent;
out vec3 vWorld;
out float vCoverage;
out float vRoot;

// Each flyaway's own stream of random numbers, from its instance id. An integer hash
// (PCG): a float hash of ids in the hundreds of thousands has only a few bits left
// after fract, and gives thousands of flyaways the same numbers.
uint state;
float random() {
  state = state * 747796405u + 2891336453u;
  uint word = ( ( state >> ( ( state >> 28u ) + 4u ) ) ^ state ) * 277803737u;
  return float( ( word >> 22u ) ^ word ) / 4294967296.0;
}

void main() {
  // Seeded by the flyaway's place in its chunk, so it is the same one whichever
  // chunks are drawn.
  int chunk = int( chunkIndex );
  int slot = gl_InstanceID - ( gl_InstanceID / hairsDrawnPerChunk ) * hairsDrawnPerChunk;
  state = uint( chunk * hairsPerChunk + slot );
  float anchor = min( float( chunk * ${PLY_CHUNK} ) + random() * ${PLY_CHUNK}.0, float( sampleCount - 1 ) );
  float diameter = 2.0 * radius;
  // Thinned by the yarn's size on screen where the flyaway is rooted, found before
  // anything else is fetched, to hairShare's share of all of them.
  vec4 root = viewMatrix * vec4( texelFetch( centerTexture, texel( int( anchor ) ), 0 ).xyz, 1.0 );
  float pixel = -root.z * 2.0 / ( projectionMatrix[ 1 ][ 1 ] * resolution.y );
  float share = clamp( ( diameter / pixel - ${HAIR_NONE.toFixed(1)} ) / ${(HAIR_FULL - HAIR_NONE).toFixed(1)}, 0.0, 1.0 );
  if ( random() * hairDrawn > share ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }
  bool isLoop = random() < loopShare;
  // Mostly short: lengths crowd toward the shortest, and a few reach hairLength.
  float len = hairLength * diameter * mix( 0.12, 1.0, pow( random(), 2.5 ) );
  float way = random() < 0.5 ? -1.0 : 1.0;
  // About a segment per 4 pixels of length on screen: the rest collapse onto their
  // neighbours, and their triangles, with no area, are dropped before shading.
  float segments = clamp( ceil( len / pixel / 4.0 ), 1.0, ${HAIR_SEGMENTS}.0 );
  float t = floor( position.x * segments + 0.5 ) / segments;

  // Offset from the root, and its rate along the fibre: (along the yarn, out, around).
  vec3 local, rate;
  if ( isLoop ) {
    float span = way * len * mix( 0.4, 1.0, random() );
    float height = diameter * mix( 0.08, 0.4, random() );
    float sideways = span * 0.3 * ( random() - 0.5 );
    local = vec3( span * t, height * sin( PI * t ), sideways * sin( PI * t ) );
    rate = vec3( span, PI * height * cos( PI * t ), PI * sideways * cos( PI * t ) );
  } else {
    // Out at 15 to 75 degrees from the surface, leaning along the yarn either way.
    float rise = mix( 0.25, 1.3, random() );
    float turn = mix( -0.7, 0.7, random() );
    vec3 d = vec3( way * cos( rise ) * cos( turn ), sin( rise ), cos( rise ) * sin( turn ) );
    vec3 u = normalize( cross( d, vec3( 0.0, 0.0, 1.0 ) ) );
    vec3 v = cross( d, u );
    // Crimp: the fibre winds about its own line as it goes.
    float w = PI2 * mix( 0.5, 2.5, random() );
    float c = hairCurl * mix( 0.3, 1.0, random() );
    local = len * ( t * d + c * ( sin( w * t ) * u + ( 1.0 - cos( w * t ) ) * v ) / w );
    rate = len * ( d + c * ( cos( w * t ) * u + sin( w * t ) * v ) );
  }
  // Along the yarn in samples, at their mean spacing: where the drawn points bunch up,
  // local spacing would send it far along the yarn.
  Frame f = frameAt( anchor + local.x / sampleSpacing );
  float psi = PI2 * random();
  vec3 outward = cos( psi ) * f.n + sin( psi ) * f.b;
  vec3 around = -sin( psi ) * f.n + cos( psi ) * f.b;
  // Rooted just under the yarn's surface.
  vec3 p = f.p + ( 0.9 * radius + local.y ) * outward + local.z * around;
  vec3 dir = rate.x * f.t + rate.y * outward + rate.z * around;

  vec4 view = viewMatrix * vec4( p, 1.0 );
  vec3 viewDir = mat3( viewMatrix ) * dir;
  vec2 screen = viewDir.xy;
  float l = length( screen );
  vec2 across = l > 1e-9 ? vec2( -screen.y, screen.x ) / l : vec2( 0.0, 1.0 );
  float width = hairWidth * radius * ( isLoop ? 1.0 : mix( 1.0, 0.35, t ) );
  pixel = -view.z * 2.0 / ( projectionMatrix[ 1 ][ 1 ] * resolution.y );
  float drawn = max( width, pixel );
  vCoverage = width / drawn;
  view.xy += 0.5 * drawn * position.y * across;

  vView = view.xyz;
  vTangent = normalize( viewDir );
  vWorld = p;
  vRoot = isLoop ? sin( PI * t ) : t;
  gl_Position = projectionMatrix * view;
}
`;

const hairFragmentShader = /* glsl */ `${header}
${lighting}
in vec3 vView;
in vec3 vTangent;
in vec3 vWorld;
in float vCoverage;
in float vRoot;

void main() {
  vec3 T = normalize( vTangent );
  vec3 V = normalize( -vView );
  vec3 L = keyDirection;
  float shadow = keyShadow( vWorld );
  // Kajiya-Kay diffuse and highlight, and light through the fibre when it is between
  // the viewer and the light: fuzz glows when backlit.
  float tl = dot( T, L );
  float keyLight = sqrt( max( 1.0 - tl * tl, 0.0 ) ) * shadow;
  float tf = dot( T, FILL_DIRECTION );
  float fillLight = sqrt( max( 1.0 - tf * tf, 0.0 ) );
  vec3 H = normalize( L + V );
  float th = dot( T, H );
  float highlight = pow( sqrt( max( 1.0 - th * th, 0.0 ) ), 32.0 ) * shadow;
  float through = pow( max( dot( -V, L ), 0.0 ), 2.0 ) * shadow;
  // Darker near the yarn, where the fibre is among the others.
  float occlusion = mix( 0.55, 1.0, smoothstep( 0.0, 0.6, vRoot ) );
  vec3 base = color;
  vec3 light = base * ( ( ambient + key * keyLight + fill * fillLight ) * occlusion + 0.5 * through );
  fragColor = vec4( toSRGB( light + sheen * highlight * mix( base, vec3( 1.0 ), 0.5 ) ), vCoverage );
}
`;

// ─── Instance patches ─────────────────────────────────────────────────────────

// One ply over PLY_CHUNK intervals: x is the way around the ply (0 to 1, the seam
// doubled so the fibre pattern does not wrap), y the centerline sample within the
// chunk, every `step`-th of them.
function plyPatch(sides: number, step: number): { position: Float32Array; index: Uint16Array } {
  const ring = sides + 1;
  const rows = PLY_CHUNK / step;
  const position = new Float32Array(ring * (rows + 1) * 3);
  for (let i = 0; i <= rows; i++) {
    for (let k = 0; k < ring; k++) position.set([k / sides, i * step, 0], (i * ring + k) * 3);
  }
  const index: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * ring + k, b = a + 1, c = a + ring, d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  return { position, index: new Uint16Array(index) };
}

// A ribbon along one flyaway: x from root to tip, y which side.
function hairRibbon(): { position: Float32Array; index: Uint16Array } {
  const position = new Float32Array((HAIR_SEGMENTS + 1) * 2 * 3);
  for (let i = 0; i <= HAIR_SEGMENTS; i++) {
    position.set([i / HAIR_SEGMENTS, -1, 0, i / HAIR_SEGMENTS, 1, 0], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < HAIR_SEGMENTS; i++) {
    index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  return { position, index: new Uint16Array(index) };
}

interface Patch {
  vao: WebGLVertexArrayObject;
  count: number;
}

function makePatch(gl: WebGL2RenderingContext, data: { position: Float32Array; index: Uint16Array }): Patch {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const position = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, data.position, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const index = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.index, gl.STATIC_DRAW);
  // The chunk index, per instance; its buffer and divisor are set per draw.
  gl.enableVertexAttribArray(1);
  gl.bindVertexArray(null);
  return { vao, count: data.index.length };
}

// ─── One yarn ─────────────────────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * A yarn at fibre level: its centerline resampled about every `spacing` radii, with
 * arc length and a rotation-minimizing frame per sample, in three float textures.
 */
class FiberYarn {
  /** Take every `step`-th point of the dense centerline the renderer samples. */
  readonly step: number;
  readonly count: number;
  /** PLY_CHUNK-sample stretches of the centerline, and each one's bounding sphere (xyz, r). */
  readonly chunkCount: number;
  readonly chunkBounds: Float32Array;
  /** Every chunk's index, for drawing the whole yarn (the shadow map). */
  readonly allChunks: WebGLBuffer;
  length = 0;
  readonly min = [0, 0, 0];
  readonly max = [0, 0, 0];
  sampleSpacing = 1;
  readonly color: number[];
  private readonly textures: WebGLTexture[];
  private readonly rows: number;
  private readonly centers: Float32Array;
  private readonly tangents: Float32Array;
  private readonly normals: Float32Array;
  /** The first sample's normal last time, so the twist does not flip between updates. */
  private readonly firstNormal = [0, 0, 0];
  private hasFirstNormal = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    dense: ArrayLike<number>,
    readonly radius: number,
    color: number[]
  ) {
    this.color = color.map(srgbToLinear);
    const denseCount = dense.length / 3;
    let total = 0;
    for (let i = 1; i < denseCount; i++) {
      const dx = dense[i * 3] - dense[i * 3 - 3];
      const dy = dense[i * 3 + 1] - dense[i * 3 - 2];
      const dz = dense[i * 3 + 2] - dense[i * 3 - 1];
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const denseSpacing = total / Math.max(denseCount - 1, 1);
    this.step = Math.max(1, Math.floor((radius * fiberStyle.spacing) / Math.max(denseSpacing, 1e-9)));
    this.count = Math.floor((denseCount - 1) / this.step) + 1;
    this.rows = Math.ceil(this.count / TEXTURE_WIDTH);
    this.chunkCount = Math.max(1, Math.ceil((this.count - 1) / PLY_CHUNK));
    this.chunkBounds = new Float32Array(this.chunkCount * 4);
    this.allChunks = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.allChunks);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from({ length: this.chunkCount }, (_, i) => i), gl.STATIC_DRAW);
    const size = TEXTURE_WIDTH * this.rows * 4;
    this.centers = new Float32Array(size);
    this.tangents = new Float32Array(size);
    this.normals = new Float32Array(size);
    this.textures = [0, 1, 2].map(() => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, TEXTURE_WIDTH, this.rows);
      return texture;
    });
    this.update(dense);
  }

  /** `dense` must have the length the yarn was built with. */
  update(dense: ArrayLike<number>): void {
    const n = this.count;
    const step = this.step;
    const c = this.centers, t = this.tangents, r = this.normals;
    // Positions, arc length and bounds.
    let s = 0;
    const min = this.min, max = this.max;
    min[0] = min[1] = min[2] = Infinity;
    max[0] = max[1] = max[2] = -Infinity;
    for (let i = 0; i < n; i++) {
      const d = i * step * 3;
      const x = dense[d], y = dense[d + 1], z = dense[d + 2];
      if (i > 0) {
        const dx = x - c[i * 4 - 4], dy = y - c[i * 4 - 3], dz = z - c[i * 4 - 2];
        s += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      c[i * 4] = x;
      c[i * 4 + 1] = y;
      c[i * 4 + 2] = z;
      c[i * 4 + 3] = s;
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }
    this.length = s;
    this.sampleSpacing = Math.max(s / Math.max(n - 1, 1), 1e-6);
    // Tangents by central differences; a sample with no length either side keeps the one before.
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0) * 4, b = Math.min(i + 1, n - 1) * 4;
      let x = c[b] - c[a], y = c[b + 1] - c[a + 1], z = c[b + 2] - c[a + 2];
      const l = Math.sqrt(x * x + y * y + z * z);
      if (l > 1e-9) {
        x /= l;
        y /= l;
        z /= l;
      } else if (i > 0) {
        x = t[i * 4 - 4];
        y = t[i * 4 - 3];
        z = t[i * 4 - 2];
      } else {
        x = 1;
        y = 0;
        z = 0;
      }
      t[i * 4] = x;
      t[i * 4 + 1] = y;
      t[i * 4 + 2] = z;
    }
    // The first normal: last update's, turned onto the new tangent.
    let nx = 0, ny = 0, nz = 0;
    if (this.hasFirstNormal) [nx, ny, nz] = this.firstNormal;
    const dot0 = nx * t[0] + ny * t[1] + nz * t[2];
    nx -= dot0 * t[0];
    ny -= dot0 * t[1];
    nz -= dot0 * t[2];
    if (nx * nx + ny * ny + nz * nz < 1e-6) {
      // Square to the tangent, from whichever axis it is furthest from.
      const [ax, ay, az] = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      nx = t[1] * az - t[2] * ay;
      ny = t[2] * ax - t[0] * az;
      nz = t[0] * ay - t[1] * ax;
    }
    const nl = Math.hypot(nx, ny, nz);
    r[0] = this.firstNormal[0] = nx / nl;
    r[1] = this.firstNormal[1] = ny / nl;
    r[2] = this.firstNormal[2] = nz / nl;
    this.hasFirstNormal = true;
    // Rotation-minimizing frames by double reflection (Wang et al. 2008).
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4, b = a + 4;
      const v1x = c[b] - c[a], v1y = c[b + 1] - c[a + 1], v1z = c[b + 2] - c[a + 2];
      const c1 = v1x * v1x + v1y * v1y + v1z * v1z;
      let rx = r[a], ry = r[a + 1], rz = r[a + 2];
      if (c1 > 1e-18) {
        const kr = (2 / c1) * (v1x * rx + v1y * ry + v1z * rz);
        rx -= kr * v1x;
        ry -= kr * v1y;
        rz -= kr * v1z;
        const kt = (2 / c1) * (v1x * t[a] + v1y * t[a + 1] + v1z * t[a + 2]);
        const v2x = t[b] - (t[a] - kt * v1x);
        const v2y = t[b + 1] - (t[a + 1] - kt * v1y);
        const v2z = t[b + 2] - (t[a + 2] - kt * v1z);
        const c2 = v2x * v2x + v2y * v2y + v2z * v2z;
        if (c2 > 1e-18) {
          const k2 = (2 / c2) * (v2x * rx + v2y * ry + v2z * rz);
          rx -= k2 * v2x;
          ry -= k2 * v2y;
          rz -= k2 * v2z;
        }
      }
      // Kept square to the tangent against drift.
      const d = rx * t[b] + ry * t[b + 1] + rz * t[b + 2];
      rx -= d * t[b];
      ry -= d * t[b + 1];
      rz -= d * t[b + 2];
      const l = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
      r[b] = rx / l;
      r[b + 1] = ry / l;
      r[b + 2] = rz / l;
    }

    // Each chunk's bounding sphere, from the box round its samples.
    const bounds = this.chunkBounds;
    for (let k = 0; k < this.chunkCount; k++) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      const end = Math.min((k + 1) * PLY_CHUNK, n - 1);
      for (let i = k * PLY_CHUNK; i <= end; i++) {
        const x = c[i * 4], y = c[i * 4 + 1], z = c[i * 4 + 2];
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (z < z0) z0 = z;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
        if (z > z1) z1 = z;
      }
      bounds[k * 4] = (x0 + x1) / 2;
      bounds[k * 4 + 1] = (y0 + y1) / 2;
      bounds[k * 4 + 2] = (z0 + z1) / 2;
      bounds[k * 4 + 3] = 0.5 * Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2 + (z1 - z0) ** 2) + this.radius;
    }

    const gl = this.gl;
    [c, t, r].forEach((data, k) => {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[k]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEXTURE_WIDTH, this.rows, gl.RGBA, gl.FLOAT, data);
    });
  }

  /** Bind the frame textures and their uniforms for `program`. */
  bind(program: any): void {
    const gl = this.gl;
    const u = program.uniformLocations;
    ["centerTexture", "tangentTexture", "normalTexture"].forEach((name, k) => {
      gl.activeTexture(gl.TEXTURE0 + FRAME_UNITS[k]);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[k]);
      gl.uniform1i(u[name], FRAME_UNITS[k]);
    });
    gl.uniform1i(u.sampleCount, this.count);
    gl.uniform1f(u.sampleSpacing, this.sampleSpacing);
    gl.uniform1f(u.radius, this.radius);
    gl.uniform1i(u.plies, fiberStyle.plies);
    gl.uniform1f(u.plyPitch, fiberStyle.plyPitch);
  }

  /** Flyaways per chunk at full density. */
  hairsPerChunk(): number {
    return Math.round((fiberStyle.fuzz * PLY_CHUNK * this.sampleSpacing) / (2 * this.radius));
  }

  dispose(): void {
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.gl.deleteBuffer(this.allChunks);
  }
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export interface FiberFrame {
  viewMatrix: number[];
  projMatrix: number[];
  shadowViewMatrix: number[];
  shadowProjectionMatrix: number[];
  /** Shadow map size, in texels. */
  shadowSize: number;
  /** World-space direction toward the key light. */
  lightDir: number[];
}

function plyLod(pixels: number): number {
  return PLY_LODS.findIndex((lod) => pixels >= lod.minPixels);
}

// The view frustum's six planes (xyz normal, w offset, inside positive), from the
// combined projection and view matrices (Gribb and Hartmann).
function frustumPlanes(proj: number[], view: number[]): Float64Array {
  const m = new Float64Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += proj[k * 4 + row] * view[col * 4 + k];
      m[col * 4 + row] = sum;
    }
  }
  const planes = new Float64Array(24);
  const rows = (i: number) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r3 = rows(3);
  [0, 0, 1, 1, 2, 2].forEach((axis, p) => {
    const r = rows(axis);
    const sign = p % 2 === 0 ? 1 : -1;
    const a = r3[0] + sign * r[0], b = r3[1] + sign * r[1], c = r3[2] + sign * r[2], d = r3[3] + sign * r[3];
    const l = Math.hypot(a, b, c) || 1;
    planes.set([a / l, b / l, c / l, d / l], p * 4);
  });
  return planes;
}

/** Draws yarns at fibre level, given each one's dense centerline (xyz flat). */
export function createFiberRenderer(gl: WebGL2RenderingContext) {
  const ply = initShaderProgram(gl, plyVertexShader, plyFragmentShader) as any;
  const plyDepth = initShaderProgram(gl, plyDepthVertexShader, depthFragmentShader) as any;
  const hair = initShaderProgram(gl, hairVertexShader, hairFragmentShader) as any;
  const plyPatches = PLY_LODS.map((lod) => makePatch(gl, plyPatch(lod.sides, lod.step)));
  const hairVAO = makePatch(gl, hairRibbon());
  // Chunk indices for this frame's draws, one list after another.
  const instanceBuffer = gl.createBuffer()!;
  let instances = new Float32Array(0);
  let yarns: FiberYarn[] = [];

  /** Rebuild for a new set of yarns. */
  function setYarns(list: { dense: ArrayLike<number>; radius: number; color: number[] }[]): void {
    for (const yarn of yarns) yarn.dispose();
    yarns = list.map((y) => new FiberYarn(gl, y.dense, y.radius, y.color));
  }

  /** Same yarns, moved. */
  function update(dense: ArrayLike<number>[]): void {
    dense.forEach((d, i) => yarns[i]?.update(d));
  }

  // Draw `count` chunks from `buffer` (starting at chunk `first`) with `patch`,
  // `perChunk` instances each.
  function drawChunks(patch: Patch, buffer: WebGLBuffer, first: number, count: number, perChunk: number): void {
    if (count === 0 || perChunk === 0) return;
    gl.bindVertexArray(patch.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, first * 4);
    gl.vertexAttribDivisor(1, perChunk);
    gl.drawElementsInstanced(gl.TRIANGLES, patch.count, gl.UNSIGNED_SHORT, 0, count * perChunk);
  }

  /** Into the shadow map, every chunk, at the detail the map's texels need; the caller has it bound. */
  function drawDepth(frame: FiberFrame): void {
    const u = plyDepth.uniformLocations;
    gl.useProgram(plyDepth.program);
    gl.uniformMatrix4fv(u.viewMatrix, false, frame.shadowViewMatrix);
    gl.uniformMatrix4fv(u.projectionMatrix, false, frame.shadowProjectionMatrix);
    // An orthographic map: texels per unit are the same everywhere.
    const texelsPerUnit = (frame.shadowProjectionMatrix[0] * frame.shadowSize) / 2;
    for (const yarn of yarns) {
      yarn.bind(plyDepth);
      const patch = plyPatches[plyLod(2 * yarn.radius * texelsPerUnit)];
      drawChunks(patch, yarn.allChunks, 0, yarn.chunkCount, fiberStyle.plies);
    }
    gl.bindVertexArray(null);
  }

  function setLighting(program: any, frame: FiberFrame, yarn: FiberYarn): void {
    const u = program.uniformLocations;
    gl.uniformMatrix4fv(u.viewMatrix, false, frame.viewMatrix);
    gl.uniformMatrix4fv(u.projectionMatrix, false, frame.projMatrix);
    gl.uniformMatrix4fv(u.shadowViewMatrix, false, frame.shadowViewMatrix);
    gl.uniformMatrix4fv(u.shadowProjectionMatrix, false, frame.shadowProjectionMatrix);
    gl.uniform1i(u.tShadow, 0);
    // Toward the light, in view space.
    const v = frame.viewMatrix, l = frame.lightDir;
    const kx = v[0] * l[0] + v[4] * l[1] + v[8] * l[2];
    const ky = v[1] * l[0] + v[5] * l[1] + v[9] * l[2];
    const kz = v[2] * l[0] + v[6] * l[1] + v[10] * l[2];
    const kl = Math.hypot(kx, ky, kz) || 1;
    gl.uniform3f(u.keyDirection, kx / kl, ky / kl, kz / kl);
    gl.uniform1f(u.key, fiberStyle.key);
    gl.uniform1f(u.ambient, fiberStyle.ambient);
    gl.uniform1f(u.fill, fiberStyle.fill);
    gl.uniform1f(u.sheen, fiberStyle.sheen);
    gl.uniform3fv(u.color, yarn.color);
    yarn.bind(program);
  }

  // Per yarn, where each list of chunk indices starts and how long it is: a list
  // per ply detail level, then one per flyaway density.
  interface Lists {
    plyStart: number[];
    plyCount: number[];
    hairStart: number[];
    hairCount: number[];
  }

  // Per chunk, this frame: its ply detail level and flyaway group, -1 for none.
  let plyClass = new Int8Array(0);
  let hairClass = new Int8Array(0);

  // Sort each yarn's chunks for this view: out of view, none; in view, the ply
  // detail and flyaway density its nearest point needs. Written to `instances`
  // and uploaded once. Runs every drawn frame over every chunk, so it is kept to
  // plain arithmetic.
  function sortChunks(frame: FiberFrame, height: number): Lists[] {
    const f = frustumPlanes(frame.projMatrix, frame.viewMatrix);
    const v = frame.viewMatrix;
    const v2 = v[2], v6 = v[6], v10 = v[10], v14 = v[14];
    const pixelsAtUnitDepth = (frame.projMatrix[5] * height) / 2;
    let total = 0, most = 0;
    for (const yarn of yarns) {
      total += yarn.chunkCount;
      most = Math.max(most, yarn.chunkCount);
    }
    if (instances.length < 2 * total) instances = new Float32Array(2 * total);
    if (plyClass.length < most) {
      plyClass = new Int8Array(most);
      hairClass = new Int8Array(most);
    }
    const lodPixels0 = PLY_LODS[0].minPixels, lodPixels1 = PLY_LODS[1].minPixels;
    const buckets = HAIR_BUCKETS.length;
    const lists: Lists[] = [];
    let offset = 0;
    for (const yarn of yarns) {
      const b = yarn.chunkBounds;
      const diameter = 2 * yarn.radius;
      const hairMargin = fiberStyle.hairLength * diameter;
      const hairsOn = fiberStyle.fuzz > 0;
      const plyCount = PLY_LODS.map(() => 0);
      const hairCount = HAIR_BUCKETS.map(() => 0);
      for (let k = 0; k < yarn.chunkCount; k++) {
        const x = b[k * 4], y = b[k * 4 + 1], z = b[k * 4 + 2], r = b[k * 4 + 3];
        plyClass[k] = hairClass[k] = -1;
        // Distance inside each plane; the chunk is out of view if it is further
        // outside one than its bounds (and any flyaways) reach.
        let inside = Infinity;
        for (let p = 0; p < 24; p += 4) {
          const d = f[p] * x + f[p + 1] * y + f[p + 2] * z + f[p + 3];
          if (d < inside) inside = d;
        }
        if (inside < -r - hairMargin) continue;
        const depth = Math.max(-(v2 * x + v6 * y + v10 * z + v14) - r, 0.1);
        const pixels = (diameter * pixelsAtUnitDepth) / depth;
        if (inside >= -r) {
          const lod = pixels >= lodPixels0 ? 0 : pixels >= lodPixels1 ? 1 : 2;
          plyClass[k] = lod;
          plyCount[lod]++;
        }
        if (hairsOn && pixels > HAIR_NONE) {
          const share = hairShare(pixels);
          let bucket = 0;
          while (bucket < buckets - 1 && share > HAIR_BUCKETS[bucket]) bucket++;
          hairClass[k] = bucket;
          hairCount[bucket]++;
        }
      }
      const plyStart: number[] = [];
      for (const count of plyCount) {
        plyStart.push(offset);
        offset += count;
      }
      const hairStart: number[] = [];
      for (const count of hairCount) {
        hairStart.push(offset);
        offset += count;
      }
      const plyAt = [...plyStart];
      const hairAt = [...hairStart];
      for (let k = 0; k < yarn.chunkCount; k++) {
        const lod = plyClass[k], bucket = hairClass[k];
        if (lod >= 0) instances[plyAt[lod]++] = k;
        if (bucket >= 0) instances[hairAt[bucket]++] = k;
      }
      lists.push({ plyStart, plyCount, hairStart, hairCount });
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances.subarray(0, offset), gl.DYNAMIC_DRAW);
    return lists;
  }

  /** The plies and their flyaways; the caller has the shadow map on unit 0. */
  function draw(frame: FiberFrame): void {
    const width = gl.canvas.width, height = gl.canvas.height;
    const lists = sortChunks(frame, height);

    gl.useProgram(ply.program);
    const pu = ply.uniformLocations;
    gl.uniform1f(pu.fiberCount, fiberStyle.fiberCount);
    gl.uniform1f(pu.fiberAngle, (fiberStyle.fiberAngle * Math.PI) / 180);
    gl.uniform1f(pu.fiberBump, fiberStyle.fiberBump);
    gl.uniform1f(pu.fiberLength, fiberStyle.fiberLength);
    yarns.forEach((yarn, i) => {
      setLighting(ply, frame, yarn);
      PLY_LODS.forEach((_, lod) =>
        drawChunks(plyPatches[lod], instanceBuffer, lists[i].plyStart[lod], lists[i].plyCount[lod], fiberStyle.plies)
      );
    });

    gl.useProgram(hair.program);
    const hu = hair.uniformLocations;
    gl.uniform1f(hu.hairLength, fiberStyle.hairLength);
    gl.uniform1f(hu.loopShare, fiberStyle.loopShare);
    gl.uniform1f(hu.hairWidth, fiberStyle.hairWidth);
    gl.uniform1f(hu.hairCurl, fiberStyle.hairCurl);
    gl.uniform2f(hu.resolution, width, height);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    // Drawn after the yarn and not into the depth: a pixel-wide flyaway there only
    // adds noise to the ambient occlusion, which reads it.
    gl.depthMask(false);
    yarns.forEach((yarn, i) => {
      const perChunk = yarn.hairsPerChunk();
      if (perChunk === 0) return;
      // Each density group draws its share of every chunk's flyaways (the shader
      // thins them further by where each is rooted), all thinned evenly past MAX_HAIRS.
      const { hairStart, hairCount } = lists[i];
      const wanted = HAIR_BUCKETS.reduce((sum, share, b) => sum + hairCount[b] * Math.ceil(perChunk * share), 0);
      const thin = Math.min(1, MAX_HAIRS / Math.max(wanted, 1));
      setLighting(hair, frame, yarn);
      gl.uniform1i(hu.hairsPerChunk, perChunk);
      HAIR_BUCKETS.forEach((share, b) => {
        const drawn = Math.max(1, Math.ceil(perChunk * share * thin));
        gl.uniform1f(hu.hairDrawn, share);
        gl.uniform1i(hu.hairsDrawnPerChunk, drawn);
        drawChunks(hairVAO, instanceBuffer, hairStart[b], hairCount[b], drawn);
      });
    });
    gl.depthMask(true);
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  return { setYarns, update, drawDepth, draw };
}

export type FiberRenderer = ReturnType<typeof createFiberRenderer>;
