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

const SHAPES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: () => new THREE.ConeGeometry(0.5, 1, 10),
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
    const mesh = new THREE.InstancedMesh(SHAPES[shape](), material, parts.length);
    parts.forEach((p, i) => {
      m.compose(pos.set(p.x, p.y, p.z), q.setFromAxisAngle(up, p.rot || 0), scl.set(p.sx, p.sy, p.sz));
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
