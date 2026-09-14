// CAD-style linework that draws itself: every path reveals along its own length
// inside its own S window, with a small orange "pen" at the drawing front for
// footprints. All site lines share one LineSegments draw call.
import * as THREE from 'three';
import { LAYER, LAYER_COUNT } from '../site-plan.js';
import { PHASES, BUILT } from '../config.js';
import { window01, lerp } from '../sequence.js';

function emitPath(path, out) {
  const pts = path.closed ? [...path.pts, path.pts[0]] : path.pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  if (total <= 0) return;

  const pointAt = (d) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
  };
  const segment = (d0, d1) => {
    const a = pointAt(d0), b = pointAt(d1);
    out.position.push(a[0], path.y, a[1], b[0], path.y, b[1]);
    out.path.push(d0, total, path.layer, d1, total, path.layer);
    out.time.push(path.start, path.dur, path.start, path.dur);
  };

  if (path.dash) {
    const [on, off] = path.dash;
    for (let d = 0; d < total; d += on + off) segment(d, Math.min(total, d + on));
  } else {
    // split at vertices so dash-free paths still bend correctly
    for (let i = 1; i < cum.length; i++) segment(cum[i - 1], cum[i]);
  }
}

export function createLinework(paths, palette) {
  const out = { position: [], path: [], time: [] };
  paths.forEach((p) => emitPath(p, out));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  geometry.setAttribute('aPath', new THREE.Float32BufferAttribute(out.path, 3));
  geometry.setAttribute('aTime', new THREE.Float32BufferAttribute(out.time, 2));

  const ink = new THREE.Color(palette.ink);
  const colors = Array.from({ length: LAYER_COUNT }, () => ink.clone());
  colors[LAYER.landscape] = new THREE.Color(palette.green).lerp(new THREE.Color(palette.ink), 0.25);
  const tips = new Float32Array(LAYER_COUNT);
  tips[LAYER.footprint] = 1;
  tips[LAYER.property] = 1;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uS: { value: 0 },
      uLayerAlpha: { value: new Float32Array(LAYER_COUNT) },
      uLayerColor: { value: colors },
      uLayerTip: { value: tips },
      uTip: { value: new THREE.Color(palette.orange) },
      uOutside: { value: 1 },
    },
    vertexShader: /* glsl */`
      #define LAYERS ${LAYER_COUNT}
      attribute vec3 aPath;   // distance along path, path length, layer
      attribute vec2 aTime;   // start, duration (S)
      uniform float uS;
      uniform float uLayerAlpha[LAYERS];
      uniform vec3 uLayerColor[LAYERS];
      uniform float uLayerTip[LAYERS];
      uniform float uOutside;   // lines beyond the model's street ring (context drawing)
      varying float vDist;
      varying float vReveal;
      varying float vAlpha;
      varying float vTip;
      varying vec3 vColor;
      void main() {
        float t = clamp((uS - aTime.x) / aTime.y, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        vReveal = t >= 1.0 ? aPath.y + 1.0 : e * aPath.y;
        vDist = aPath.x;
        int li = int(aPath.z + 0.5);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float fade = 1.0 - smoothstep(190.0, 440.0, length(wp.xz));
        float inside = step(abs(wp.x), 97.6) * step(abs(wp.z), 72.9);
        vAlpha = uLayerAlpha[li] * fade * mix(uOutside, 1.0, inside);
        vColor = uLayerColor[li];
        vTip = (t > 0.0 && t < 1.0) ? uLayerTip[li] * fade : 0.0;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTip;
      varying float vDist;
      varying float vReveal;
      varying float vAlpha;
      varying float vTip;
      varying vec3 vColor;
      void main() {
        if (vDist > vReveal) discard;
        float tip = vTip * (1.0 - smoothstep(0.0, 3.0, vReveal - vDist));
        float a = max(vAlpha, tip * 0.95);
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(vColor, uTip, tip), a);
        #include <colorspace_fragment>
      }`,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = -1;

  const alpha = material.uniforms.uLayerAlpha.value;
  const w = (s, win) => window01(s, win);

  return {
    object: lines,
    update(S) {
      material.uniforms.uS.value = S;
      const mat = w(S, PHASES.materialize);
      const out = w(S, PHASES.handoff);
      // once built, the construction drawing clears: only road paint on the model's own
      // streets remains (the lane lines and crosswalks are part of the finished model)
      const clear = 1 - w(S, BUILT);
      alpha[LAYER.guides] = 0.24 * w(S, [0.0, 0.05]) * (1 - w(S, [0.26, 0.36]));
      alpha[LAYER.streets] = lerp(0.3, 0.2, mat) * clear;
      alpha[LAYER.property] = lerp(0.62, 0.34, mat) * clear;
      alpha[LAYER.parcel] = lerp(0.4, 0.1, w(S, [0.44, 0.6])) * clear;
      alpha[LAYER.footprint] = lerp(0.85, 0.22, w(S, [0.44, 0.58])) * clear;
      alpha[LAYER.tower] = 0.42 * (1 - w(S, [0.38, 0.48]));
      alpha[LAYER.landscape] = 0.5 * clear;
      alpha[LAYER.markings] = 0.3 * (1 - 0.5 * out);
      alpha[LAYER.paths] = 0.36 * clear;
      material.uniforms.uOutside.value = clear;
      alpha[LAYER.dimension] = 0.5 * (1 - w(S, [0.4, 0.48]));
    },
  };
}
