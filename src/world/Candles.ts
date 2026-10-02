import * as THREE from 'three';
import { COURSE } from '../config';
import type { Market } from '../data/market';
import { FOG_GLSL, shared } from './uniforms';

/**
 * A wall of real weekly candlesticks running alongside the road — the raw
 * OHLC data the smoothed course is built from. Two InstancedMeshes (bodies
 * and wicks) render all ~1,450 weeks in two draw calls.
 */
export function buildCandles(market: Market): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Candles';
  const n = market.n;
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const wickGeo = new THREE.BoxGeometry(1, 1, 1);

  const make = (glow: number) =>
    new THREE.ShaderMaterial({
      uniforms: { ...shared, uGlow: { value: glow } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aWeek;
        varying vec3 vColor;
        varying float vDist;
        varying vec3 vLocal;
        varying float vNear;
        uniform vec3 uPlayer;
        void main() {
          vColor = aColor;
          vLocal = position;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vNear = exp(-abs(wp.x - uPlayer.x) / 140.0);
          vec4 mv = viewMatrix * wp;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uGlow;
        varying vec3 vColor;
        varying float vDist;
        varying vec3 vLocal;
        varying float vNear;
        ${FOG_GLSL}
        void main() {
          // brighter rim on the box edges for a crisp glass-neon look
          vec3 a = abs(vLocal) * 2.0;
          float rim = smoothstep(0.82, 1.0, max(max(a.x * a.y, a.y * a.z), a.x * a.z));
          vec3 col = vColor * (0.3 + rim * 0.8) * (uGlow * (0.45 + vNear * 0.45));
          col = applyFog(col, vDist);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

  const bodies = new THREE.InstancedMesh(bodyGeo, make(1.15), n);
  const wicks = new THREE.InstancedMesh(wickGeo, make(0.9), n);
  const bodyCol = new Float32Array(n * 3);
  const weekAttr = new Float32Array(n);
  const m = new THREE.Matrix4();
  const up = new THREE.Color(0.36, 0.95, 0.05);
  const down = new THREE.Color(1.0, 0.12, 0.22);
  const z = COURSE.candleZ;
  for (let i = 0; i < n; i++) {
    const x = i * COURSE.xPerWeek;
    const yo = market.priceToY(market.o[i]);
    const yc = market.priceToY(market.c[i]);
    const yh = market.priceToY(market.h[i]);
    const yl = market.priceToY(market.l[i]);
    const bh = Math.max(0.35, Math.abs(yc - yo));
    m.makeScale(COURSE.xPerWeek * 0.62, bh, 1.8).setPosition(x, (yo + yc) / 2, z);
    bodies.setMatrixAt(i, m);
    m.makeScale(0.42, Math.max(0.4, yh - yl), 0.42).setPosition(x, (yh + yl) / 2, z);
    wicks.setMatrixAt(i, m);
    const col = market.c[i] >= market.o[i] ? up : down;
    bodyCol.set([col.r, col.g, col.b], i * 3);
    weekAttr[i] = i;
  }
  bodyGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(bodyCol, 3));
  bodyGeo.setAttribute('aWeek', new THREE.InstancedBufferAttribute(weekAttr, 1));
  wickGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(bodyCol.slice(), 3));
  wickGeo.setAttribute('aWeek', new THREE.InstancedBufferAttribute(weekAttr.slice(), 1));
  bodies.frustumCulled = false;
  wicks.frustumCulled = false;
  group.add(bodies, wicks);
  return group;
}
