import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { placeModel, toWorld } from './world.js';
import './style.css';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// Cut-away plane: lowering it slices the ceiling off so the plan can be seen from above.
export const ceilingCut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);
renderer.clippingPlanes = [ceilingCut];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e6e1);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, 16, 10);
const lookTarget = new THREE.Vector3();

scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8a7f72, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(6, 12, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const loader = new GLTFLoader();
const progressEl = document.querySelector('#loader-progress');

function loadModel() {
  return new Promise((resolve, reject) => {
    loader.load(
      '/models/apartment.glb',
      (gltf) => resolve(gltf),
      (e) => {
        if (e.total) progressEl.style.width = `${(e.loaded / e.total) * 100}%`;
      },
      reject,
    );
  });
}

function prepareMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m.transparent) {
        m.depthWrite = false;
        obj.castShadow = false;
      }
      // Single-sided SketchUp faces leave holes when seen from inside rooms.
      m.side = THREE.DoubleSide;
    }
  });
}

function debugView() {
  // ?cam=x,y,z&look=x,y,z (raw model cm) &cut=metres — used for calibrating scene-config.js
  const p = new URLSearchParams(location.search);
  if (!p.has('cam')) return false;
  window.__setView = (cam, look, cut = 10, fov = 50) => {
    toWorld(cam, camera.position);
    toWorld(look, lookTarget);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    ceilingCut.constant = cut;
  };
  const num = (k) => p.get(k).split(',').map(Number);
  window.__setView(num('cam'), num('look'), p.has('cut') ? +p.get('cut') : 10, p.has('fov') ? +p.get('fov') : 50);
  return true;
}

export const app = { renderer, scene, camera, lookTarget, ceilingCut, model: null, onTick };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // On wide screens push the subject right so the text cards on the left don't cover it.
  if (w > 900) camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

const tickers = [];
export function onTick(fn) {
  tickers.push(fn);
}

renderer.setAnimationLoop(() => {
  for (const fn of tickers) fn();
  camera.lookAt(lookTarget);
  renderer.render(scene, camera);
});

loadModel()
  .then(async (gltf) => {
    prepareMaterials(gltf.scene);
    app.model = placeModel(gltf.scene);
    scene.add(app.model);
    document.body.classList.add('loaded');
    if (debugView()) {
      document.body.classList.add('debug');
      window.__ready = true;
      return;
    }
    const { startTour } = await import('./tour.js');
    startTour(app);
    window.__ready = true;
  })
  .catch((err) => {
    console.error(err);
    document.querySelector('#loader-text').textContent = 'Model yüklenemedi: ' + err.message;
  });
