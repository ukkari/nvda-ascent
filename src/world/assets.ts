import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MODEL_NAMES = ['player_core', 'gpu_card', 'dc_module', 'gate', 'server_rack', 'summit_spire'] as const;
export type ModelName = (typeof MODEL_NAMES)[number];
export type Models = Record<ModelName, THREE.Object3D>;

/** Load every Blender-exported GLB, reporting progress (0..1). */
export async function loadModels(base: string, onProgress: (p: number) => void): Promise<Models> {
  const loader = new GLTFLoader();
  const out = {} as Models;
  let done = 0;
  await Promise.all(
    MODEL_NAMES.map(async (name) => {
      const gltf = await loader.loadAsync(`${base}models/${name}.glb`);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = false;
          m.receiveShadow = false;
          tuneMaterial(m.material as THREE.MeshStandardMaterial);
        }
      });
      if (name === 'player_core') {
        root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m?.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = m.name.includes('Energy') ? 1.6 : 2.2;
        });
      }
      out[name] = root;
      onProgress(++done / MODEL_NAMES.length);
    }),
  );
  return out;
}

/** Push Blender emissive strengths into a range that blooms nicely in three. */
function tuneMaterial(mat: THREE.MeshStandardMaterial) {
  if (!mat || !('emissive' in mat)) return;
  if (mat.emissive && mat.emissive.getHex() !== 0) {
    mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 3.2);
    mat.toneMapped = true;
  }
  mat.envMapIntensity = 1.0;
}

/** Every mesh inside a model with its transform relative to the model root. */
export function meshesOf(root: THREE.Object3D): { mesh: THREE.Mesh; local: THREE.Matrix4 }[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out: { mesh: THREE.Mesh; local: THREE.Matrix4 }[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) out.push({ mesh: m, local: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld) });
  });
  return out;
}

/**
 * Turn a multi-material model into one InstancedMesh per material so
 * hundreds of copies cost only a handful of draw calls.
 */
export function instanceModel(root: THREE.Object3D, placements: THREE.Matrix4[], materialOverride?: (m: THREE.Material) => THREE.Material): THREE.Group {
  const group = new THREE.Group();
  if (placements.length === 0) return group;
  const tmp = new THREE.Matrix4();
  for (const { mesh, local } of meshesOf(root)) {
    const material = materialOverride ? materialOverride(mesh.material as THREE.Material) : (mesh.material as THREE.Material);
    const inst = new THREE.InstancedMesh(mesh.geometry, material, placements.length);
    placements.forEach((p, i) => inst.setMatrixAt(i, tmp.multiplyMatrices(p, local)));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  return group;
}

/** Deep clone with unique materials so per-instance tinting doesn't leak. */
export function cloneWithMaterials(root: THREE.Object3D): THREE.Object3D {
  const c = root.clone(true);
  c.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = (m.material as THREE.Material).clone();
  });
  return c;
}

/** Recolour every emissive material in a model (used for gate kinds). */
export function tintEmissive(root: THREE.Object3D, color: THREE.Color, intensity?: number) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.emissive && mat.emissive.getHex() !== 0) {
      mat.emissive.copy(color);
      mat.color.copy(color);
      if (intensity !== undefined) mat.emissiveIntensity = intensity;
    }
  });
}
