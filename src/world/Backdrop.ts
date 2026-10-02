import * as THREE from 'three';
import { COURSE } from '../config';
import type { Market } from '../data/market';
import { FONT_MONO, labelSprite } from '../ui/labels';
import type { Models } from './assets';
import { instanceModel } from './assets';
import type { Course } from './Course';

/**
 * Scenery that turns the void around the road into a 3D price chart:
 *  - log-scale price gridlines ($0.10, $1, $10, $100 …) on a distant plane
 *  - giant year numerals floating beside the road
 *  - floating "era islands" carrying Blender-modelled hardware from that era
 */
export function buildBackdrop(market: Market, course: Course, models: Models): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Backdrop';
  const x0 = course.xStart - 400;
  const x1 = course.xEnd + 600;
  const len = x1 - x0;

  // ── price gridlines ─────────────────────────────────────────────────────
  const gridZ = -120;
  const lineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.35, 0.75, 0.2),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: true,
  });
  const minorMat = lineMat.clone();
  minorMat.opacity = 0.14;
  const priceLevels: number[] = [];
  for (let d = -2; d <= 3; d++) priceLevels.push(Math.pow(10, d));
  for (const p of priceLevels) {
    const y = market.priceToY(p);
    if (y < COURSE.floorY - 50 || y > market.priceToY(market.maxHigh) + 250) continue;
    const line = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 0.6), lineMat);
    line.position.set(x0 + len / 2, y, gridZ);
    group.add(line);
    // minor 2×, 5× lines
    for (const mult of [2, 5]) {
      const ym = market.priceToY(p * mult);
      const ml = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.3), minorMat);
      ml.position.set(x0 + len / 2, ym, gridZ);
      group.add(ml);
    }
    const label = p >= 1 ? `$${p.toLocaleString('en-US')}` : `$${p.toFixed(p < 0.1 ? 2 : 1)}`;
    for (let x = x0 + 200; x < x1; x += 700) {
      const s = labelSprite([{ text: label, size: 120, color: '#9cff3a', font: FONT_MONO, weight: 700 }], 26, {
        width: 640,
        glow: 'rgba(118,185,0,0.9)',
      });
      s.position.set(x, y + 16, gridZ);
      group.add(s);
    }
  }

  // ── year numerals ───────────────────────────────────────────────────────
  for (const { week, year } of market.yearStarts()) {
    const x = week * COURSE.xPerWeek;
    const s = labelSprite([{ text: String(year), size: 220, color: 'rgba(220,255,200,0.85)', weight: 700, letterSpacing: 8 }], 22, {
      width: 900,
      glow: 'rgba(118,185,0,0.8)',
    });
    s.position.set(x + 6, course.height(x) + 24, -COURSE.halfWidth - 34);
    group.add(s);
  }

  // ── era islands ─────────────────────────────────────────────────────────
  const islandGeo = new THREE.CylinderGeometry(16, 11, 4, 6, 1);
  const underGeo = new THREE.ConeGeometry(11, 26, 6, 1);
  underGeo.translate(0, -15, 0);
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x0c0f13, metalness: 0.85, roughness: 0.35 });
  const ringGeo = new THREE.TorusGeometry(16.3, 0.22, 6, 6);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 0.15) });

  const islandPlacements: THREE.Matrix4[] = [];
  const cards: THREE.Matrix4[] = [];
  const modules: THREE.Matrix4[] = [];
  const racks: THREE.Matrix4[] = [];
  const rand = mulberry32(1999);
  const yearOf = (x: number) => market.dateOf(x / COURSE.xPerWeek).getUTCFullYear();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  for (let x = course.xStart + 120, k = 0; x < course.xEnd; x += 170 + rand() * 120, k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const z = side * (70 + rand() * 90);
    const y = course.height(x) - 30 + rand() * 70;
    const yaw = rand() * Math.PI;
    const isl = new THREE.Matrix4().compose(v.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.set(1, 1, 1));
    islandPlacements.push(isl);
    const year = yearOf(x);
    if (year >= 2016) {
      // a little data hall: 2 rows of racks
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 4; c++) {
          const local = new THREE.Matrix4().compose(
            v.set(-6 + c * 3.4, 2, -4 + r * 8),
            q.setFromEuler(e.set(0, r === 0 ? 0 : Math.PI, 0)),
            s.set(1.4, 1.4, 1.4),
          );
          racks.push(new THREE.Matrix4().multiplyMatrices(isl, local));
        }
    } else if (year >= 2007 && k % 2 === 0) {
      const local = new THREE.Matrix4().compose(v.set(0, 5, 0), q.setFromEuler(e.set(-0.9, 0.3, 0)), s.setScalar(6));
      modules.push(new THREE.Matrix4().multiplyMatrices(isl, local));
    } else {
      // a monolith-sized graphics card standing on its bracket edge
      const local = new THREE.Matrix4().compose(v.set(0, 9, 0), q.setFromEuler(e.set(0, rand() * 0.8 - 0.4, 0.15)), s.setScalar(5.5));
      cards.push(new THREE.Matrix4().multiplyMatrices(isl, local));
    }
  }
  const islands = new THREE.InstancedMesh(islandGeo, islandMat, islandPlacements.length);
  const unders = new THREE.InstancedMesh(underGeo, islandMat, islandPlacements.length);
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, islandPlacements.length);
  const ringOffset = new THREE.Matrix4().makeTranslation(0, 2.05, 0);
  islandPlacements.forEach((m, i) => {
    islands.setMatrixAt(i, m);
    unders.setMatrixAt(i, m);
    rings.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, ringOffset));
  });
  for (const im of [islands, unders, rings]) {
    im.computeBoundingSphere();
    group.add(im);
  }
  group.add(instanceModel(models.gpu_card, cards));
  group.add(instanceModel(models.dc_module, modules));
  group.add(instanceModel(models.server_rack, racks));
  return group;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
