import * as THREE from 'three';
import { COLORS, COURSE, GAME } from '../config';
import type { Lang, Milestone, MilestoneKind } from '../data/history';
import { MILESTONES } from '../data/history';
import type { Market } from '../data/market';
import { FONT_MONO, hex, textTexture } from '../ui/labels';
import type { Models } from './assets';
import { cloneWithMaterials, tintEmissive } from './assets';
import type { Course } from './Course';

export const KIND_COLOR: Record<MilestoneKind, number> = {
  origin: COLORS.cyan,
  milestone: COLORS.green,
  crash: COLORS.red,
  record: COLORS.gold,
  deal: COLORS.violet,
};

export interface Gate {
  x: number;
  milestone: Milestone;
  passed: boolean;
  object: THREE.Object3D;
  banner: THREE.Mesh;
}

/** Milestone arches (Blender model) with holographic date/title banners. */
export class Gates {
  readonly group = new THREE.Group();
  readonly list: Gate[] = [];

  constructor(
    private market: Market,
    private course: Course,
    models: Models,
    lang: Lang,
  ) {
    this.group.name = 'Gates';
    const ipoWeek = market.dateToWeek('1999-01-22');
    const prologue = MILESTONES.filter((m) => market.dateToWeek(m.date) < ipoWeek - 1);
    MILESTONES.forEach((m) => {
      const w = market.dateToWeek(m.date);
      let x: number;
      if (w < ipoWeek - 1) {
        // spread pre-IPO history evenly along the runway
        const i = prologue.indexOf(m);
        x = course.xStart + 90 + (i * (COURSE.prologue - 150)) / Math.max(1, prologue.length - 1);
      } else {
        x = w * COURSE.xPerWeek;
      }
      const object = cloneWithMaterials(models.gate);
      const color = new THREE.Color(KIND_COLOR[m.kind]);
      tintEmissive(object, color, m.kind === 'crash' ? 5 : 4);
      object.scale.setScalar(1.18);
      object.position.set(x, course.height(x) - 0.2, 0);
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true }),
      );
      banner.rotation.y = -Math.PI / 2;
      object.add(banner);
      this.group.add(object);
      this.list.push({ x, milestone: m, passed: false, object, banner });
    });
    this.setLang(lang);
  }

  setLang(lang: Lang) {
    const fmt = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: lang === 'ja' ? 'long' : 'short', timeZone: 'UTC' });
    for (const g of this.list) {
      const m = g.milestone;
      const col = KIND_COLOR[m.kind];
      const { texture, aspect } = textTexture(
        [
          { text: fmt.format(new Date(m.date + 'T00:00:00Z')).toUpperCase(), size: 54, color: hex(col), font: FONT_MONO, weight: 700, letterSpacing: 6 },
          { text: m.title[lang], size: 92, color: '#ffffff', weight: 700 },
        ],
        { width: 1536, pad: 34, bg: 'rgba(4,8,6,0.62)', border: hex(col, 0.9), glow: hex(col, 0.6) },
      );
      const mat = g.banner.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = texture;
      mat.needsUpdate = true;
      const w = 19 / 1.18;
      g.banner.scale.set(w, w / aspect, 1);
      g.banner.position.set(0, 9.2, 0);
    }
  }

  /** Show only nearby gates. */
  update(playerX: number) {
    for (const g of this.list) g.object.visible = Math.abs(g.x - playerX) < GAME.propViewDistance * 1.4;
  }

  /** Returns gates newly passed when moving from x0 to x1. */
  crossings(x0: number, x1: number): Gate[] {
    const out: Gate[] = [];
    if (x1 <= x0) return out;
    for (const g of this.list) {
      if (!g.passed && g.x > x0 && g.x <= x1) {
        g.passed = true;
        out.push(g);
      }
    }
    return out;
  }

  reset() {
    for (const g of this.list) g.passed = false;
  }

  /** Last gate behind x (used as respawn checkpoint). */
  checkpointBefore(x: number): number {
    let best = this.course.xStart + 20;
    for (const g of this.list) if (g.x < x - 5 && g.x > best) best = g.x;
    // also checkpoint every year boundary
    for (const { week } of this.market.yearStarts()) {
      const yx = week * COURSE.xPerWeek;
      if (yx < x - 5 && yx > best) best = yx;
    }
    return best;
  }
}
