interface BBox3DResult {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  dimensions: number[];
  center: number[];
}

export function bbox3d(points: number[]): BBox3DResult {
  let xMin = Infinity;
  let xMax = -Infinity;

  let yMin = Infinity;
  let yMax = -Infinity;

  let zMin = Infinity;
  let zMax = -Infinity;

  for (let i = 0; i < points.length; i += 3) {
    xMin = Math.min(points[i], xMin);
    xMax = Math.max(points[i], xMax);

    yMin = Math.min(points[i + 1], yMin);
    yMax = Math.max(points[i + 1], yMax);

    zMin = Math.min(points[i + 2], zMin);
    zMax = Math.max(points[i + 2], zMax);
  }

  let width = Math.abs(xMax - xMin);
  let height = Math.abs(yMax - yMin);
  let depth = Math.abs(zMax - zMin);

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
    dimensions: [width, height, depth],
    center: [xMin + width / 2, yMin + height / 2, zMin + depth / 2],
  };
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement
): boolean {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(canvas.clientWidth * dpr);
  const displayHeight = Math.round(canvas.clientHeight * dpr);

  const needResize =
    canvas.width !== displayWidth || canvas.height !== displayHeight;

  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: Record<string, number>;
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

function loadShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function initShaderProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): ProgramInfo | null {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) return null;

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) return null;

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    return null;
  }

  const programInfo: ProgramInfo = {
    program: shaderProgram,
    attribLocations: {},
    uniformLocations: {},
  };

  const attribCount = gl.getProgramParameter(
    shaderProgram,
    gl.ACTIVE_ATTRIBUTES
  );
  for (let i = 0; i < attribCount; ++i) {
    const attrib = gl.getActiveAttrib(shaderProgram, i);
    if (attrib) {
      programInfo.attribLocations[attrib.name] = gl.getAttribLocation(
        shaderProgram,
        attrib.name
      );
    }
  }

  const uniformCount = gl.getProgramParameter(
    shaderProgram,
    gl.ACTIVE_UNIFORMS
  );
  for (let i = 0; i < uniformCount; ++i) {
    const uniform = gl.getActiveUniform(shaderProgram, i);
    if (uniform) {
      programInfo.uniformLocations[uniform.name] = gl.getUniformLocation(
        shaderProgram,
        uniform.name
      );
    }
  }

  return programInfo;
}
