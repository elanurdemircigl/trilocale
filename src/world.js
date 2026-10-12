import * as THREE from 'three';

// The source model is in centimetres, Z-up (Sketchfab's root node rotates it to Y-up) and sits
// ~84 m away from the origin. We recentre it on the apartment and convert to metres.
// All coordinates in scene-config.js are written in the model's raw (x, y, z) cm space — the
// same numbers src/data/meshes.json reports — and converted with toWorld().
export const RAW_CENTER = { x: -8390, y: 173 };
export const MODEL_SCALE = 0.01;

export function toWorld([x, y, z], target = new THREE.Vector3()) {
  return target.set((x - RAW_CENTER.x) * MODEL_SCALE, z * MODEL_SCALE, -(y - RAW_CENTER.y) * MODEL_SCALE);
}

export function rawBoxToWorld(min, max) {
  return new THREE.Box3().setFromPoints([toWorld(min), toWorld(max)]);
}

export function placeModel(root) {
  const holder = new THREE.Group();
  holder.name = 'apartment';
  holder.scale.setScalar(MODEL_SCALE);
  holder.position.set(-RAW_CENTER.x * MODEL_SCALE, 0, RAW_CENTER.y * MODEL_SCALE);
  holder.add(root);
  return holder;
}
