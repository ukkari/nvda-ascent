import * as THREE from 'three';
import { COURSE } from '../config';
import type { Market } from '../data/market';
import { FOG_GLSL, TREND_GLSL, shared } from './uniforms';

/**
 * The price chart turned into a rideable height field.
 *
 *   x  = time   (COURSE.xPerWeek metres per weekly bar)
 *   y  = log10(price) * COURSE.yPerDecade
 *   z  = lateral position across the road
 *
 * Heights are sampled on a fine grid so the physics can query height, slope
 * and curvature in O(1). The same samples drive the road and cliff meshes.
 */
export class Course {
  readonly xStart: number;
  readonly xEnd: number;
  /** x of the last weekly bar */
  readonly xLastBar: number;
  readonly dx: number;
  readonly count: number;
  private readonly hs: Float32Array;
  private readonly ds: Float32Array; // dh/dx
  private readonly ks: Float32Array; // signed curvature
  /** smoothed weekly heights */
  readonly weekly: Float32Array;
  /** per-sample market trend (-1 bearish … +1 bullish) */
  private readonly trend: Float32Array;

  readonly group = new THREE.Group();

  constructor(readonly market: Market) {
    const n = market.n;
    this.dx = COURSE.xPerWeek / COURSE.samplesPerWeek;
    this.xStart = -COURSE.prologue;
    this.xLastBar = (n - 1) * COURSE.xPerWeek;
    this.xEnd = this.xLastBar + COURSE.epilogue;
    this.count = Math.ceil((this.xEnd - this.xStart) / this.dx) + 1;

    // 1. Smoothed weekly log-heights
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = market.priceToY(market.c[i]);
    this.weekly = gaussian(raw, COURSE.smoothSigma);

    // 2. Resample with Catmull-Rom onto the fine grid (flat runway / plateau at the ends)
    this.hs = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const x = this.xStart + i * this.dx;
      const w = x / COURSE.xPerWeek;
      this.hs[i] = catmull(this.weekly, w);
    }
    // ease into the plateau so the finish isn't a ramp
    const hs2 = gaussian(this.hs, 2);
    this.hs.set(hs2);

    // 3. Derivatives (central differences, lightly smoothed curvature)
    this.ds = new Float32Array(this.count);
    const k = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const a = this.hs[Math.max(0, i - 1)];
      const b = this.hs[Math.min(this.count - 1, i + 1)];
      this.ds[i] = (b - a) / (2 * this.dx);
    }
    for (let i = 0; i < this.count; i++) {
      const a = this.ds[Math.max(0, i - 1)];
      const b = this.ds[Math.min(this.count - 1, i + 1)];
      const d2 = (b - a) / (2 * this.dx);
      const s = this.ds[i];
      k[i] = d2 / Math.pow(1 + s * s, 1.5);
    }
    this.ks = gaussian(k, 1.5);

    // 4. Trend per sample: 6-week change of the smoothed curve
    this.trend = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const x = this.xStart + i * this.dx;
      const w = x / COURSE.xPerWeek;
      const now = catmull(this.weekly, w);
      const past = catmull(this.weekly, w - 6);
      // the plateau after the last bar is the all-time high: keep it bullish
      this.trend[i] = x > this.xLastBar ? 1 : Math.tanh((now - past) / 10);
    }

    this.group.add(this.buildRoad());
    this.group.add(this.buildCliffs());
    this.group.add(this.buildYearStrips());
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  private sample(arr: Float32Array, x: number): number {
    const f = (x - this.xStart) / this.dx;
    if (f <= 0) return arr[0];
    if (f >= this.count - 1) return arr[this.count - 1];
    const i = Math.floor(f);
    const t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }

  height(x: number): number {
    return this.sample(this.hs, x);
  }

  slope(x: number): number {
    return this.sample(this.ds, x);
  }

  curvature(x: number): number {
    return this.sample(this.ks, x);
  }

  trendAt(x: number): number {
    return this.sample(this.trend, x);
  }

  /** Surface normal in the x/y plane. */
  normal(x: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.slope(x);
    return out.set(-s, 1, 0).normalize();
  }

  // ── Meshes ────────────────────────────────────────────────────────────────

  private buildRoad(): THREE.Mesh {
    const across = 9; // vertices across the road
    const hw = COURSE.halfWidth;
    const pos = new Float32Array(this.count * across * 3);
    const nor = new Float32Array(this.count * across * 3);
    const uv = new Float32Array(this.count * across * 2);
    const trend = new Float32Array(this.count * across);
    const n = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const x = this.xStart + i * this.dx;
      const y = this.hs[i];
      this.normal(x, n);
      const week = x / COURSE.xPerWeek;
      for (let j = 0; j < across; j++) {
        const u = j / (across - 1);
        const k = i * across + j;
        pos[k * 3] = x;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = -hw + u * 2 * hw;
        nor[k * 3] = n.x;
        nor[k * 3 + 1] = n.y;
        nor[k * 3 + 2] = 0;
        uv[k * 2] = u;
        uv[k * 2 + 1] = week;
        trend[k] = this.trend[i];
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < this.count - 1; i++) {
      for (let j = 0; j < across - 1; j++) {
        const a = i * across + j;
        const b = a + across;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aTrend', new THREE.BufferAttribute(trend, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uLight: { value: new THREE.Vector3(-0.35, 0.85, 0.4).normalize() },
      },
      vertexShader: /* glsl */ `
        attribute float aTrend;
        varying vec2 vUv;
        varying float vTrend;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vDist;
        void main() {
          vUv = uv;
          vTrend = aTrend;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vNormal = normal;
          vec4 mv = viewMatrix * wp;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uPlayer;
        uniform float uBear;
        uniform float uSpeed;
        uniform vec3 uLight;
        varying vec2 vUv;
        varying float vTrend;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vDist;
        ${FOG_GLSL}
        ${TREND_GLSL}

        float line(float x, float w) {
          float d = abs(fract(x - 0.5) - 0.5);
          float fw = fwidth(x) * 1.2;
          return 1.0 - smoothstep(w - fw, w + fw, d);
        }

        void main() {
          vec3 trendCol = trendColor(vTrend);

          // base: dark anodised metal with subtle diagonal brushing
          float u = vUv.x;
          float week = vUv.y;
          vec3 base = vec3(0.020, 0.024, 0.030);
          float brushed = sin((vWorld.x * 0.7 + vWorld.z * 3.1)) * 0.004;
          base += brushed;

          // chip-like tile pattern: weekly rows × 8 lanes, inset panels
          vec2 cell = vec2(u * 8.0, week);
          vec2 f = abs(fract(cell) - 0.5);
          float panel = smoothstep(0.47, 0.44, max(f.x, f.y));
          base = mix(base * 0.55, base, panel);

          // lane guides + weekly ticks
          float lanes = line(u * 4.0, 0.006) * 0.35;
          float ticks = line(week, 0.012) * 0.25;
          // 13-week (quarter) markers are brighter — earnings seasons!
          float quarters = line(week / 13.0, 0.0035) * 0.9;
          vec3 col = base + vec3(0.25, 0.45, 0.30) * (lanes + ticks) * 0.25;
          col += trendCol * quarters * 0.35;

          // neon road edges, coloured by market trend
          float edge = smoothstep(0.03, 0.0, u) + smoothstep(0.97, 1.0, u);
          float inner = line(u * 1.0 + 0.04, 0.003) + line(u * 1.0 - 0.04, 0.003);
          col += trendCol * (edge * 1.35 + inner * 0.4);

          // centre-line data pulse that streams forward faster with speed
          float pulse = pow(fract(week * 0.25 - uTime * (0.6 + uSpeed * 2.5)), 12.0);
          col += trendCol * pulse * smoothstep(0.02, 0.0, abs(u - 0.5)) * 2.0;

          // lighting
          vec3 N = normalize(vNormal);
          float diff = clamp(dot(N, uLight), 0.0, 1.0);
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
          vec3 sky = mix(vec3(0.05, 0.08, 0.075), vec3(0.12, 0.03, 0.045), uBear);
          col *= 0.65 + diff * 0.6;
          col += sky * fres * 0.45;

          // player: contact glow + soft blob shadow
          vec2 dp = vWorld.xz - uPlayer.xz;
          float d2 = dot(dp, dp);
          float hAbove = max(uPlayer.y - vWorld.y - 1.2, 0.0);
          float shadow = exp(-d2 / (2.0 + hAbove * 0.6)) * (1.0 - smoothstep(0.0, 30.0, hAbove));
          col *= 1.0 - shadow * 0.75;
          float glow = exp(-d2 / (24.0 + hAbove * 6.0)) / (1.0 + hAbove * 0.25);
          col += vec3(0.35, 0.9, 0.05) * glow * 0.3;

          col = applyFog(col, vDist);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.name = 'Road';
    return mesh;
  }

  /** Vertical "area chart" walls dropping from each road edge to the floor. */
  private buildCliffs(): THREE.Mesh {
    const hw = COURSE.halfWidth;
    const floor = COURSE.floorY;
    const step = 2; // every other sample is plenty
    const cols = Math.ceil(this.count / step);
    const sides = [-hw, hw];
    const pos: number[] = [];
    const depth: number[] = [];
    const trend: number[] = [];
    const week: number[] = [];
    const idx: number[] = [];
    let base = 0;
    for (const z of sides) {
      for (let c = 0; c < cols; c++) {
        const i = Math.min(c * step, this.count - 1);
        const x = this.xStart + i * this.dx;
        const y = this.hs[i];
        // lip slightly above the road so the neon edge reads as a rim
        pos.push(x, y, z, x, floor, z);
        depth.push(0, y - floor);
        trend.push(this.trend[i], this.trend[i]);
        week.push(x / COURSE.xPerWeek, x / COURSE.xPerWeek);
      }
      for (let c = 0; c < cols - 1; c++) {
        const a = base + c * 2;
        const b = a + 2;
        if (z < 0) idx.push(a, b, a + 1, a + 1, b, b + 1);
        else idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
      base += cols * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setAttribute('aTrend', new THREE.Float32BufferAttribute(trend, 1));
    g.setAttribute('aWeek', new THREE.Float32BufferAttribute(week, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aDepth;
        attribute float aTrend;
        attribute float aWeek;
        varying float vDepth;
        varying float vTrend;
        varying float vWeek;
        varying float vDist;
        varying vec3 vWorld;
        void main() {
          vDepth = aDepth;
          vTrend = aTrend;
          vWeek = aWeek;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying float vDepth;
        varying float vTrend;
        varying float vWeek;
        varying float vDist;
        varying vec3 vWorld;
        ${FOG_GLSL}
        ${TREND_GLSL}
        void main() {
          vec3 tc = trendColor(vTrend) * mix(0.35, 1.0, smoothstep(0.0, 0.3, abs(vTrend)));
          // area-chart gradient: bright at the price line, fading into the void
          float g = exp(-vDepth / 26.0);
          vec3 col = vec3(0.012, 0.016, 0.02) + tc * (g * 0.55 + exp(-vDepth / 3.0) * 0.9);
          // horizontal scan lines + yearly verticals give it a "chart paper" feel
          float scan = smoothstep(0.92, 1.0, fract(vWorld.y / 6.0)) * 0.05 * g;
          float vlines = smoothstep(0.96, 1.0, fract(vWeek / 4.0)) * 0.08 * exp(-vDepth / 60.0);
          col += tc * (scan + vlines);
          col = applyFog(col, vDist);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.name = 'Cliffs';
    return mesh;
  }

  /** Glowing strips across the road at the first trading week of each year. */
  private buildYearStrips(): THREE.Object3D {
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1.2, COURSE.halfWidth * 2 + 0.6);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 1.0, 0.35),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const { week } of this.market.yearStarts()) {
      const x = week * COURSE.xPerWeek;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, this.height(x) + 0.05, 0);
      m.rotation.z = Math.atan(this.slope(x));
      group.add(m);
    }
    group.name = 'YearStrips';
    return group;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

export function gaussian(src: ArrayLike<number>, sigma: number): Float32Array {
  const n = src.length;
  const r = Math.ceil(sigma * 3);
  const w: number[] = [];
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let ws = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      s += src[j] * w[k + r];
      ws += w[k + r];
    }
    out[i] = s / ws;
  }
  return out;
}

/** Catmull-Rom interpolation on a uniformly spaced array, clamped at the ends. */
export function catmull(arr: ArrayLike<number>, f: number): number {
  const n = arr.length;
  if (f <= 0) return arr[0];
  if (f >= n - 1) return arr[n - 1];
  const i = Math.floor(f);
  const t = f - i;
  const p0 = arr[Math.max(0, i - 1)];
  const p1 = arr[i];
  const p2 = arr[Math.min(n - 1, i + 1)];
  const p3 = arr[Math.min(n - 1, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
