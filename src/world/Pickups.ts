import * as THREE from 'three';
import { COURSE, GAME } from '../config';
import type { Lang, Product } from '../data/history';
import { PRODUCTS } from '../data/history';
import type { Market } from '../data/market';
import { FONT_MONO, textTexture } from '../ui/labels';
import type { Models } from './assets';
import { mulberry32 } from './Backdrop';
import type { Course } from './Course';
import type { Gates } from './Gates';

export interface ProductPickup {
  product: Product;
  x: number;
  pos: THREE.Vector3;
  object: THREE.Group;
  model: THREE.Object3D;
  label: THREE.Sprite;
  collected: boolean;
  /** collect animation timer (s) */
  fade: number;
}

/**
 * Collectibles:
 *  - Products: Blender-modelled GPUs / accelerators at their launch week.
 *  - CUDA cores: small glowing tokens strung along the road and over crests.
 */
export class Pickups {
  readonly group = new THREE.Group();
  readonly products: ProductPickup[] = [];
  readonly coreCount: number;
  private corePos: Float32Array; // xyz per core, sorted by x
  private coreTaken: Uint8Array;
  private coreMesh: THREE.InstancedMesh;
  private coreCursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(
    market: Market,
    course: Course,
    models: Models,
    gates: Gates,
    lang: Lang,
  ) {
    this.group.name = 'Pickups';

    // ── products ────────────────────────────────────────────────────────
    const lanes = [-5, 4, 0, -3, 6, -6, 2];
    let prevX = -Infinity;
    const beamGeo = new THREE.CylinderGeometry(0.5, 1.6, 60, 16, 1, true);
    beamGeo.translate(0, 30, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.35, 0.9, 0.1),
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.TorusGeometry(3.4, 0.08, 8, 64);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.2, 0.25) });

    PRODUCTS.forEach((p, i) => {
      let x = market.dateToWeek(p.date) * COURSE.xPerWeek;
      for (const g of gates.list) if (Math.abs(g.x - x) < 16) x = g.x + 26;
      if (x - prevX < 30) x = prevX + 30;
      prevX = x;
      const z = lanes[i % lanes.length];
      const y = course.height(x) + 3.2;
      const object = new THREE.Group();
      object.position.set(x, y, z);
      const model = (p.model === 'card' ? models.gpu_card : models.dc_module).clone(true);
      model.scale.setScalar(p.model === 'card' ? 1.9 : 2.3);
      if (p.model === 'module') model.rotation.x = -1.0;
      const spin = new THREE.Group();
      spin.add(model);
      object.add(spin);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = -3.2;
      object.add(beam);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = -3.0;
      object.add(ring);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: true }));
      label.position.y = 4.6;
      object.add(label);
      this.group.add(object);
      this.products.push({ product: p, x, pos: object.position.clone(), object, model: spin, label, collected: false, fade: 0 });
    });
    this.setLang(lang);

    // ── CUDA cores ──────────────────────────────────────────────────────
    const rand = mulberry32(2006);
    const pts: number[] = [];
    const hw = COURSE.halfWidth - 2;
    // strings along the road
    for (let x = course.xStart + 70; x < course.xLastBar; x += 55 + rand() * 45) {
      const kind = Math.floor(rand() * 3);
      const z0 = (rand() * 2 - 1) * hw * 0.7;
      const len = 6 + Math.floor(rand() * 4);
      for (let k = 0; k < len; k++) {
        const xx = x + k * 5;
        let z = z0;
        if (kind === 1) z = Math.sin(k * 0.8) * 5 + z0 * 0.3;
        if (kind === 2) z = THREE.MathUtils.clamp(z0 + (k - len / 2) * 1.6, -hw, hw);
        pts.push(xx, course.height(xx) + 1.4, z);
      }
    }
    // arcs over strong crests — reward for catching air
    let lastArc = -Infinity;
    for (let x = course.xStart + 200; x < course.xLastBar; x += 4) {
      if (x - lastArc < 260) continue;
      if (course.curvature(x) < -0.012 && course.slope(x - 10) > 0.35) {
        lastArc = x;
        const z = (rand() * 2 - 1) * 4;
        const span = 70;
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          const xx = x - 10 + t * span;
          const lift = 4 + Math.sin(t * Math.PI) * 9;
          pts.push(xx, Math.max(course.height(xx), course.height(x)) + lift, z);
        }
      }
    }
    // sort by x for windowed updates
    const idx = [...Array(pts.length / 3).keys()].sort((a, b) => pts[a * 3] - pts[b * 3]);
    this.coreCount = idx.length;
    this.corePos = new Float32Array(this.coreCount * 3);
    idx.forEach((j, i) => this.corePos.set([pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2]], i * 3));
    this.coreTaken = new Uint8Array(this.coreCount);

    const geo = new THREE.OctahedronGeometry(0.62, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 2.6, 0.18) });
    this.coreMesh = new THREE.InstancedMesh(geo, mat, this.coreCount);
    for (let i = 0; i < this.coreCount; i++) this.writeCore(i, 0);
    this.coreMesh.frustumCulled = false;
    this.group.add(this.coreMesh);
  }

  setLang(lang: Lang) {
    for (const p of this.products) {
      const year = p.product.date.slice(0, 4);
      const { texture, aspect } = textTexture(
        [
          { text: p.product.name, size: 76, color: '#ffffff', weight: 700 },
          { text: `${year} · ${p.product.tag[lang]}`, size: 40, color: '#b8ff5a', font: FONT_MONO, weight: 500 },
        ],
        { width: 1100, pad: 22, bg: 'rgba(5,10,6,0.55)', border: 'rgba(118,185,0,0.8)', glow: 'rgba(118,185,0,0.5)' },
      );
      const mat = p.label.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.map = texture;
      mat.needsUpdate = true;
      p.label.scale.set(3.4 * aspect, 3.4, 1);
    }
  }

  private writeCore(i: number, t: number) {
    const o = i * 3;
    if (this.coreTaken[i]) {
      this.m.makeScale(0, 0, 0);
    } else {
      const bob = Math.sin(t * 3 + i * 0.7) * 0.25;
      this.q.setFromEuler(this.e.set(0.4, t * 2.2 + i, 0));
      this.m.compose(this.v.set(this.corePos[o], this.corePos[o + 1] + bob, this.corePos[o + 2]), this.q, this.s.set(1, 1.35, 1));
    }
    this.coreMesh.setMatrixAt(i, this.m);
  }

  /**
   * Animate nearby pickups and collect anything the ball touches.
   * Returns counts / collected products for this frame.
   */
  update(t: number, dt: number, ball: THREE.Vector3): { cores: number; corePositions: THREE.Vector3[]; products: ProductPickup[] } {
    const result = { cores: 0, corePositions: [] as THREE.Vector3[], products: [] as ProductPickup[] };
    const px = ball.x;
    // advance cursor to first core within the window
    while (this.coreCursor > 0 && this.corePos[(this.coreCursor - 1) * 3] > px - 60) this.coreCursor--;
    while (this.coreCursor < this.coreCount - 1 && this.corePos[this.coreCursor * 3] < px - 60) this.coreCursor++;
    const r2 = GAME.coreRadius * GAME.coreRadius;
    for (let i = this.coreCursor; i < this.coreCount; i++) {
      const o = i * 3;
      const cx = this.corePos[o];
      if (cx > px + 450) break;
      if (!this.coreTaken[i]) {
        const dx = cx - ball.x;
        const dy = this.corePos[o + 1] - ball.y;
        const dz = this.corePos[o + 2] - ball.z;
        if (dx * dx + dy * dy + dz * dz < r2) {
          this.coreTaken[i] = 1;
          result.cores++;
          result.corePositions.push(new THREE.Vector3(cx, this.corePos[o + 1], this.corePos[o + 2]));
        }
      }
      this.writeCore(i, t);
    }
    this.coreMesh.instanceMatrix.needsUpdate = true;

    const pr2 = GAME.pickupRadius * GAME.pickupRadius;
    for (const p of this.products) {
      const near = Math.abs(p.x - px) < GAME.propViewDistance;
      p.object.visible = near && (!p.collected || p.fade < 0.6);
      if (!p.object.visible) continue;
      p.model.rotation.y += dt * 1.2;
      p.model.position.y = Math.sin(t * 1.8 + p.x) * 0.35;
      if (!p.collected && p.pos.distanceToSquared(ball) < pr2) {
        p.collected = true;
        result.products.push(p);
      }
      if (p.collected) {
        p.fade += dt;
        const k = p.fade / 0.6;
        p.object.scale.setScalar(1 + k * 1.5);
        p.model.rotation.y += dt * 12;
        p.label.material.opacity = Math.max(0, 1 - k * 1.5);
      }
    }
    return result;
  }

  reset() {
    this.coreTaken.fill(0);
    for (let i = 0; i < this.coreCount; i++) this.writeCore(i, 0);
    this.coreMesh.instanceMatrix.needsUpdate = true;
    this.coreCursor = 0;
    for (const p of this.products) {
      p.collected = false;
      p.fade = 0;
      p.object.scale.setScalar(1);
      p.label.material.opacity = 1;
    }
  }
}
