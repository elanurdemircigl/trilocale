import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

// Keep tweens on wall-clock time even when a slow GPU drops frames.
gsap.ticker.lagSmoothing(0);

// Fly the camera to a pose. Both the position and the look-at point are tweened so the
// camera keeps looking somewhere sensible during the flight.
export function flyTo(app, { pos, look, fov }, duration = 1.3) {
  const { camera, lookTarget } = app;
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve, defaults: { duration, ease: 'power3.inOut' } });
    tl.to(camera.position, { x: pos.x, y: pos.y, z: pos.z }, 0);
    tl.to(lookTarget, { x: look.x, y: look.y, z: look.z }, 0);
    if (fov) tl.to(camera, { fov, onUpdate: () => camera.updateProjectionMatrix() }, 0);
  });
}

export function createFocus(app, { getReturnPose, onEnter, onExit }) {
  const { camera, renderer, lookTarget } = app;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = lookTarget; // share the vector the render loop looks at
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.zoomSpeed = 0.8;
  app.onTick(() => controls.enabled && controls.update());

  const panel = document.querySelector('#focus-panel');
  const title = panel.querySelector('h3');
  const body = panel.querySelector('p');
  panel.querySelector('button').addEventListener('click', () => exit());
  window.addEventListener('keydown', (e) => e.key === 'Escape' && exit());

  let current = null;
  let busy = false;

  async function enter(item) {
    if (busy || current === item) return;
    busy = true;
    current = item;
    controls.enabled = false;
    onEnter(item);
    title.textContent = item.name;
    body.textContent = item.text;
    document.body.classList.add('focusing');
    const center = item.box.getCenter(new THREE.Vector3());
    const size = item.box.getSize(new THREE.Vector3()).length();
    await flyTo(app, { pos: item.fromWorld, look: center, fov: 50 });
    const dist = camera.position.distanceTo(center);
    controls.minDistance = Math.max(0.25, size * 0.35);
    controls.maxDistance = Math.max(dist * 1.8, size * 2);
    controls.enabled = true;
    busy = false;
  }

  async function exit() {
    if (busy || !current) return;
    busy = true;
    controls.enabled = false;
    document.body.classList.remove('focusing');
    await flyTo(app, getReturnPose(), 1.1);
    current = null;
    busy = false;
    onExit();
  }

  return {
    enter,
    exit,
    get active() {
      return current !== null || busy;
    },
  };
}
