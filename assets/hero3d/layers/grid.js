// Fine survey grid: 5 m minor / 25 m major lines, revealed radially from the
// site centre and dissolving into the page with distance. One draw call.
import * as THREE from 'three';
import { PHASES } from '../config.js';
import { window01, easeOutCubic } from '../sequence.js';

export function createGrid(palette) {
  const geometry = new THREE.PlaneGeometry(1800, 1800, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    extensions: { derivatives: true },
    uniforms: {
      uColor: { value: new THREE.Color(palette.ink) },
      uReveal: { value: 0 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uReveal;
      uniform float uAlpha;
      varying vec2 vW;
      float lineMask(vec2 p, float cell) {
        vec2 c = p / cell;
        vec2 w = fwidth(c);
        vec2 g = abs(fract(c - 0.5) - 0.5) / max(w, vec2(1e-5));
        float l = 1.0 - min(min(g.x, g.y), 1.0);
        // fade lines out before cells get so small they moiré
        return l * (1.0 - smoothstep(0.18, 0.55, max(w.x, w.y)));
      }
      void main() {
        float r = length(vW);
        float reveal = 1.0 - smoothstep(uReveal - 90.0, uReveal, r);
        float fade = 1.0 - smoothstep(170.0, 520.0, r);
        float a = max(lineMask(vW, 5.0) * 0.07, lineMask(vW, 25.0) * 0.15) * reveal * fade * uAlpha;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -0.05;
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;

  return {
    object: mesh,
    update(S) {
      material.uniforms.uReveal.value = 20 + 640 * easeOutCubic(window01(S, [0, PHASES.grid[1] + 0.06]));
      // quieter once the architecture carries the image
      material.uniforms.uAlpha.value = 1 - 0.45 * window01(S, PHASES.materialize) - 0.25 * window01(S, PHASES.handoff);
    },
  };
}
