import * as THREE from 'three';
import { shared } from '../world/uniforms';

/**
 * GPU-friendly particle pool (single Points draw call). CPU integrates a
 * fixed ring buffer; the shader handles size attenuation and fade.
 */
export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private life: Float32Array; // remaining
  private span: Float32Array; // total
  private size: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private head = 0;
  private geo: THREE.BufferGeometry;

  constructor(max = 4000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.span = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSpan', new THREE.BufferAttribute(this.span, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uScale: { value: innerHeight / 2 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aLife;
        attribute float aSpan;
        attribute float aSize;
        uniform float uScale;
        varying vec3 vColor;
        varying float vA;
        void main() {
          float t = clamp(aLife / aSpan, 0.0, 1.0);
          vColor = aColor;
          vA = t * t;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sz = aSize * (0.4 + 0.6 * t) * uScale / -mv.z;
          // fade & clamp sprites that get too close to the lens
          vA *= smoothstep(1.5, 6.0, -mv.z);
          gl_PointSize = aLife > 0.0 ? min(sz, 42.0) : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * a * vA * 2.2, a * vA);
        }
      `,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  emit(
    p: THREE.Vector3,
    v: THREE.Vector3,
    color: THREE.Color,
    opts: { life?: number; size?: number; spread?: number; drag?: number; gravity?: number } = {},
  ) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const s = opts.spread ?? 0;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x + (Math.random() - 0.5) * s, v.y + (Math.random() - 0.5) * s, v.z + (Math.random() - 0.5) * s], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    const life = (opts.life ?? 1) * (0.7 + Math.random() * 0.6);
    this.life[i] = life;
    this.span[i] = life;
    this.size[i] = opts.size ?? 1;
    this.drag[i] = opts.drag ?? 1.5;
    this.grav[i] = opts.gravity ?? 0;
  }

  burst(p: THREE.Vector3, color: THREE.Color, count: number, speed: number, opts: { life?: number; size?: number; gravity?: number } = {}) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.emit(p, v, color, { life: opts.life ?? 0.9, size: opts.size ?? 1.2, drag: 2.2, gravity: opts.gravity ?? 6 });
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[o] *= d;
      this.vel[o + 1] = this.vel[o + 1] * d - this.grav[i] * dt;
      this.vel[o + 2] *= d;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    for (const name of ['position', 'aColor', 'aLife', 'aSpan', 'aSize']) this.geo.getAttribute(name).needsUpdate = true;
  }

  resize(h: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h / 2;
  }
}
