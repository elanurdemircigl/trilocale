// Reads the GLB's JSON chunk and writes one entry per mesh node (material + raw-cm bounding box)
// to src/data/meshes.json. The model's meshes are merged per material, not per object, so this
// file is what scene-config.js uses to map furniture back to the meshes that render it.
import { readFileSync, writeFileSync } from 'node:fs';

const glbPath = process.argv[2] ?? 'public/models/apartment.glb';
const buf = readFileSync(glbPath);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

const entries = [];
gltf.nodes.forEach((node) => {
  if (node.mesh === undefined) return;
  const mesh = gltf.meshes[node.mesh];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const materials = new Set();
  let vertices = 0;
  for (const prim of mesh.primitives) {
    const acc = gltf.accessors[prim.attributes.POSITION];
    vertices += acc.count;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], acc.min[k]);
      max[k] = Math.max(max[k], acc.max[k]);
    }
    if (prim.material !== undefined) materials.add(gltf.materials[prim.material].name);
  }
  entries.push({
    node: node.name,
    material: [...materials].join(','),
    vertices,
    min: min.map((v) => +v.toFixed(1)),
    max: max.map((v) => +v.toFixed(1)),
  });
});

writeFileSync('src/data/meshes.json', JSON.stringify(entries, null, 1));
console.log(`${entries.length} meshes -> src/data/meshes.json`);
