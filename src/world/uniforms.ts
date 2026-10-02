import * as THREE from 'three';

/**
 * Uniforms shared by every custom shader so atmosphere (fog, market regime,
 * player glow) stays consistent across road, cliffs, sky and props.
 */
export const shared = {
  uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(0x05080b) },
  uFogDensity: { value: 0.0016 },
  /** player centre in world space (for contact glow / blob shadow) */
  uPlayer: { value: new THREE.Vector3() },
  /** 0 = bull market, 1 = deep bear (drives red tint) */
  uBear: { value: 0 },
  /** 0..1 speed factor for pulse animation */
  uSpeed: { value: 0 },
};

/** red ← neutral → green, avoiding the muddy yellow of a straight red/green mix */
export const TREND_GLSL = /* glsl */ `
  vec3 trendColor(float t) {
    vec3 neutral = vec3(0.45, 0.62, 0.55);
    vec3 green = vec3(0.30, 0.85, 0.02);
    vec3 red = vec3(1.0, 0.10, 0.20);
    return t >= 0.0 ? mix(neutral, green, smoothstep(0.0, 0.3, t)) : mix(neutral, red, smoothstep(0.0, 0.3, -t));
  }
`;

export const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 col, float dist) {
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    return mix(col, uFogColor, clamp(f, 0.0, 1.0));
  }
`;
