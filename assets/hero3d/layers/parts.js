// Architectural parts from the site plan: arcade columns, lobby canopies, the
// porte-cochère, office and tower fins, stucco blades and core spine, service
// portals, screen walls, pergolas, planters and café umbrellas. All pieces are
// static at their final positions and fade in with their phase ("solid" with
// the buildings, "context" with the landscape), so nothing can detach during
// the build. One instanced draw call per (shape, phase).
import * as THREE from 'three';
import { PHASES } from '../config.js';
import { window01, smootherstep } from '../sequence.js';
import { DITHER_GLSL } from './facade-glsl.js';

// deterministic hash: the same position always gives the same offset, so the duplicated
// vertices of a non-indexed face stay welded and every bush keeps its own shape
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// A bush in the same language as the tree canopies: overlapping icosahedral lobes pushed
// about by noise, so it reads as a clipped clump of foliage rather than a cone. Built to fill
// a unit box, so a part's sx / sy / sz still set its spread and height, and turned per
// instance (see below) so a hedge is not a row of identical shapes.
function bushGeometry(full) {
  const lobes = full
    ? [[0, 0.05, 0, 0.34], [0.16, -0.07, 0.13, 0.26]]     // 40 faces: a clump, not a ball
    : [[0, 0, 0, 0.44]];                                   // 20 faces on mobile
  const pos = [];
  lobes.forEach(([lx, ly, lz, r], k) => {
    const g = new THREE.IcosahedronGeometry(r, 0);      // 20 faces, already non-indexed
    const a = g.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      const vx = a.getX(i), vy = a.getY(i), vz = a.getZ(i);
      const len = Math.hypot(vx, vy, vz) || 1;
      const n = 0.72 + 0.42 * hash3(Math.round(vx * 100) + k * 17, Math.round(vy * 100), Math.round(vz * 100));
      pos.push(lx + (vx / len) * r * n, ly + (vy / len) * r * n, lz + (vz / len) * r * n);
    }
  });
  // fit the unit box the instance transform expects
  let mx = 0, my = 0;
  for (let i = 0; i < pos.length; i += 3) {
    mx = Math.max(mx, Math.abs(pos[i]), Math.abs(pos[i + 2]));
    my = Math.max(my, Math.abs(pos[i + 1]));
  }
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] / mx) * 0.5;
    pos[i + 1] = (pos[i + 1] / my) * 0.5;
    pos[i + 2] = (pos[i + 2] / mx) * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

const SHAPES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: () => new THREE.ConeGeometry(0.5, 1, 10),
  bush: (full) => bushGeometry(full),
  // ramp wedge: full height at +x, zero at −x (unit box footprint)
  wedge: () => {
    const g = new THREE.BufferGeometry();
    const v = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5]];
    const f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap((t) => t.flatMap((i) => v[i])), 3));
    g.computeVertexNormals();
    return g;
  },
};

export function createParts(plan, palette, tier) {
  const group = new THREE.Group();
  const fills = { solid: { value: 0 }, context: { value: 0 } };
  const buckets = new Map();
  for (const part of plan.parts) {
    const key = `${part.shape}|${part.phase}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(part);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();

  for (const [key, parts] of buckets) {
    const [shape, phase] = key.split('|');
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, envMapIntensity: 0.35 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFill = fills[phase];
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uFill;
          ${DITHER_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (bayer4(gl_FragCoord.xy) + 0.03125 > uFill) discard;`);
    };
    const mesh = new THREE.InstancedMesh(SHAPES[shape](tier.name !== 'mobile'), material, parts.length);
    parts.forEach((p, i) => {
      // bushes turn with their position, so no two neighbours read as the same shape
      const spin = shape === 'bush' ? hash3(p.x, 0, p.z) * Math.PI * 2 : 0;
      m.compose(pos.set(p.x, p.y, p.z), q.setFromAxisAngle(up, (p.rot || 0) + spin), scl.set(p.sx, p.sy, p.sz));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(palette[p.color] ?? palette.frame));
    });
    mesh.castShadow = !!tier.shadows && phase === 'solid';
    mesh.receiveShadow = !!tier.shadows;
    group.add(mesh);
  }

  return {
    object: group,
    update(S) {
      fills.solid.value = smootherstep(window01(S, [PHASES.materialize[0] + 0.02, PHASES.materialize[1] - 0.02]));
      fills.context.value = smootherstep(window01(S, [PHASES.context[0] + 0.01, PHASES.context[0] + 0.09]));
    },
  };
}
