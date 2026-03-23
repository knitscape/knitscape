import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { buildYarnCurve } from "./utils/yarnSpline";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Line2 } from "three/addons/lines/Line2.js";

let renderer, camera, scene, controls, effect;
let yarns = [];

function fitCameraToBbox(camera, bbox, offset) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  const fov = camera.fov * (Math.PI / 180);
  const fovh = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2));
  let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2));
  let cameraZ = Math.max(dx, dy);

  // offset the camera, if desired (to avoid filling the whole canvas)
  if (offset !== undefined && offset !== 0) cameraZ *= offset;

  camera.position.set(center.x, center.y, cameraZ);
}

function updateCameraExtents(camera, bbox, orbitControls) {
  // set the far plane of the camera so that it easily encompasses the whole object
  const minZ = bbox.min.z;
  const cameraToFarEdge =
    minZ < 0 ? -minZ + camera.position.z : camera.position.z - minZ;

  camera.far = cameraToFarEdge * 3;
  camera.updateProjectionMatrix();

  if (orbitControls !== undefined) {
    // set camera to rotate around the center
    orbitControls.target = new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      0
    );

    // prevent camera from zooming out far enough to create far plane cutoff
    orbitControls.maxDistance = cameraToFarEdge * 2;
  }
}

function toVector3(arr) {
  const v3Arr = [];
  for (let i = 0; i < arr.length; i += 3) {
    v3Arr.push(new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]));
  }
  return v3Arr;
}

function generateCNPoints(pointArray, color, pointSize = 0.1) {
  const positions = new Float32Array(pointArray);

  const pointGeom = new THREE.BufferGeometry();
  pointGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointGeom.computeBoundingBox();
  const material = new THREE.PointsMaterial({
    size: pointSize,
    color: color,
  });
  material.depthTest = false;
  console.log(material);

  return new THREE.Points(pointGeom, material);
}

function init(yarnData, canvas) {
  let width = canvas.parentNode.clientWidth;
  let height = canvas.parentNode.clientHeight;
  THREE.ColorManagement.enabled = true;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a);

  // Lights

  scene.add(new THREE.AmbientLight(0xc1c1c1, 1));
  // const pointLight = new THREE.PointLight(0xffffff, 2, 800, 0);
  // particleLight.add(pointLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
  scene.add(directionalLight);
  // directionalLight.castShadow = true;

  // Renderer
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // effect = new OutlineEffect(renderer);
  }

  yarns = [];
  //  Yarn
  yarnData.forEach((yarn) => {
    if (yarn.pts.length < 6) return;

    // const splinePts = buildYarnCurve(yarn.pts, 12);

    // const geometry = new LineGeometry();
    // geometry.setPositions(splinePts);

    let color = new THREE.Color(...yarn.color, 1.0);
    color.setRGB(...yarn.color);

    const colors = new Uint8Array(4);

    for (let c = 0; c <= colors.length; c++) {
      colors[c] = (c / colors.length) * 256;
    }

    const gradientMap = new THREE.DataTexture(
      colors,
      colors.length,
      1,
      THREE.RedFormat
    );
    gradientMap.needsUpdate = true;

    const controlPoints = toVector3(yarn.pts);

    const curve = new THREE.CatmullRomCurve3(controlPoints);
    const geometry = new THREE.TubeGeometry(
      curve,
      curve.points.length * 5,
      yarn.diameter / 2,
      8
    );
    const material = new THREE.MeshLambertMaterial({
      color: color,
    });
    const mesh = new THREE.Mesh(geometry, material);

    scene.add(mesh);

    // const CNPoints = generateCNPoints(yarn.pts, 0xffffff);
    // scene.add(CNPoints);

    yarns.push(mesh);
    // scene.add(line);
    // yarns.push(line);
  });

  const bbox = new THREE.Box3();
  bbox.setFromObject(yarns[0]);

  if (!camera) {
    camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    controls = new OrbitControls(camera, renderer.domElement);

    fitCameraToBbox(camera, bbox, 1.2, controls);
  }

  updateCameraExtents(camera, bbox, controls);
}

function updateYarnGeometry(yarnData) {
  yarnData.forEach((yarn, yarnIndex) => {
    yarns[yarnIndex].geometry.setPositions(buildYarnCurve(yarn.pts, 12));
  });
}

function draw() {
  renderer.render(scene, camera);
  // effect.render(scene, camera);
}

export const threeTubeRenderer = {
  draw,
  init,
  updateYarnGeometry,
};
