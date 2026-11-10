/// <reference types="vite/client" />
// Loads the detailed models built in Blender (see blender/build_models.py).
// Each file only carries geometry: materials are matched by name to the
// scene's shared materials so the models light and glow like everything else.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type MatTable = Record<string, THREE.Material>;

/** One mesh's worth of a model: geometry plus the scene material it uses. */
export interface Part {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

const isGlow = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial;
  return !!s.emissive && s.emissive.getHex() !== 0 && s.emissiveIntensity >= 0.7;
};

/** Copy of a geometry with plain float attributes (meshopt files are quantized). */
function toFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const base = import.meta.env.BASE_URL + 'models/';

async function parts(file: string, table: MatTable): Promise<Map<string, Part>> {
  const gltf = await loader.loadAsync(base + file);
  const out = new Map<string, Part>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name;
    const geo = toFloat(m.geometry).applyMatrix4(m.matrixWorld);
    // Meshopt-quantized attributes are fine for rendering; just make sure
    // normals exist for the smooth (non flat-shaded) materials.
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    geo.computeBoundingSphere();
    out.set(o.name, { geo, mat: table[name] ?? table.white });
  });
  return out;
}

/** A whole building: every part as a shadow-casting mesh in one group. */
export async function loadBuilding(file: string, table: MatTable): Promise<THREE.Group> {
  const g = new THREE.Group();
  for (const p of (await parts(file, table)).values()) {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.castShadow = !isGlow(p.mat);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/** Small repeated pieces (trees, lamps, benches) keyed by piece name. */
export async function loadPieces(file: string, table: MatTable): Promise<Map<string, Part[]>> {
  const out = new Map<string, Part[]>();
  for (const [name, p] of await parts(file, table)) {
    const piece = name.split('_')[0];
    if (!out.has(piece)) out.set(piece, []);
    out.get(piece)!.push(p);
  }
  return out;
}

/** Instance a piece at the given transforms: one InstancedMesh per material. */
export function instance(piece: Part[], matrices: THREE.Matrix4[], shadows = true): THREE.Group {
  const g = new THREE.Group();
  for (const p of piece) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = shadows && !isGlow(p.mat);
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}
