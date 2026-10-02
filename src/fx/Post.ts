import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Render → bloom → "lens" (speed-reactive chromatic aberration, radial
 * streaks, vignette, grain) → tone-mapping / sRGB output.
 */
export class Post {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly lens: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.5, 0.35, 0.92);
    this.composer.addPass(this.bloom);
    this.lens = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uSpeed: { value: 0 },
        uTime: { value: 0 },
        uDanger: { value: 0 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uSpeed;
        uniform float uTime;
        uniform float uDanger;
        uniform float uFlash;
        uniform vec3 uFlashColor;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec2 c = vUv - 0.5;
          float r = length(c);
          // chromatic aberration grows toward the edges and with speed
          float ca = (0.0015 + uSpeed * 0.006) * r;
          vec3 col;
          col.r = texture2D(tDiffuse, vUv - c * ca * 2.0).r;
          col.g = texture2D(tDiffuse, vUv).g;
          col.b = texture2D(tDiffuse, vUv + c * ca * 2.0).b;
          // radial speed streaks (cheap zoom blur on the outer ring)
          if (uSpeed > 0.05) {
            vec3 acc = vec3(0.0);
            for (int i = 1; i <= 6; i++) {
              acc += texture2D(tDiffuse, vUv - c * float(i) * 0.012 * uSpeed).rgb;
            }
            col = mix(col, acc / 6.0, smoothstep(0.18, 0.55, r) * uSpeed * 0.85);
          }
          // vignette (+ red pulse in danger)
          float vig = smoothstep(0.85, 0.25, r);
          col *= mix(0.55, 1.0, vig);
          col = mix(col, col + vec3(0.35, 0.0, 0.03) * (1.0 - vig), uDanger * (0.6 + 0.4 * sin(uTime * 6.0)));
          col += uFlashColor * uFlash * pow(1.0 - vig, 1.5);
          // grain
          col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.018;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.composer.addPass(this.lens);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
  }

  render(dt: number) {
    this.composer.render(dt);
  }
}
