import * as THREE from 'three';
import { shared } from './uniforms';

/**
 * Procedural sky dome: deep-space gradient, drifting aurora bands and a star
 * field. The palette shifts from NVIDIA green to crimson in bear markets.
 */
export class Sky {
  readonly group = new THREE.Group();

  constructor() {
    const geo = new THREE.SphereGeometry(5000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { ...shared },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uBear;
        uniform vec3 uFogColor;
        varying vec3 vDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 zenith = mix(vec3(0.004, 0.008, 0.012), vec3(0.012, 0.002, 0.004), uBear);
          vec3 horizon = mix(vec3(0.014, 0.032, 0.026), vec3(0.07, 0.01, 0.018), uBear);
          vec3 col = mix(horizon, zenith, smoothstep(-0.05, 0.55, h));
          // below the horizon fade into the fog colour so the floor-less void reads as depth
          col = mix(uFogColor, col, smoothstep(-0.25, 0.02, h));

          // aurora ribbons
          float az = atan(d.z, d.x);
          vec2 q = vec2(az * 3.0, h * 6.0);
          float n = fbm(q + vec2(uTime * 0.02, 0.0));
          float band = smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.25, 0.7, h));
          float curtain = pow(fbm(vec2(az * 9.0 + n * 2.0, uTime * 0.05)), 2.5) * band;
          vec3 aur = mix(vec3(0.25, 0.95, 0.15), vec3(1.0, 0.15, 0.25), uBear);
          col += aur * curtain * 0.14;

          // grid horizon line — a nod to chart paper
          col += mix(vec3(0.2, 0.6, 0.1), vec3(0.7, 0.1, 0.15), uBear) * exp(-abs(h) * 220.0) * 0.12;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.group.add(dome);

    // stars
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.02;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 4500, y * 4500, Math.sin(th) * r * 4500], i * 3);
      size[i] = Math.pow(Math.random(), 6) * 6 + 1.2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const sm = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uTime;
        varying float vTw;
        void main() {
          vTw = 0.6 + 0.4 * sin(uTime * 2.0 + position.x * 0.01 + position.z * 0.013);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w * 0.9999;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vTw;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c));
          gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a * vTw, a);
        }
      `,
    });
    const stars = new THREE.Points(sg, sm);
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    this.group.add(stars);
  }

  follow(camera: THREE.Camera) {
    this.group.position.copy(camera.position);
  }
}
