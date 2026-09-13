// Architectural massing. Every box in the plan (hotel, office, landscape slabs,
// neighbours) is one instance of a unit cube, drawn twice:
//   • fill  — lit MeshStandardMaterial with the shared facade shading
//             (layers/facade-glsl.js): use-specific glazing, screened parking,
//             water, and ordered-dither transparency for the wireframe → solid fade
//   • edges — unlit shader that draws crisp box edges and floor-plate lines
//             from box-local coordinates (constant pixel width, one draw call)
// Extrusion, stacking and fades are per-instance CPU updates.
import * as THREE from 'three';
import { PHASES } from '../config.js';
import { clamp01, window01, smootherstep, lerp } from '../sequence.js';
import { injectFacade } from './facade-glsl.js';

// fill: steady-state opacity · floor: strength of drawn floor lines in the wireframe
const KIND = {
  concrete: { fill: 1.0, floor: 0.75 },
  stucco:   { fill: 1.0, floor: 0.75 },
  stone:    { fill: 1.0, floor: 0.6 },
  podium:   { fill: 1.0, floor: 0.6 },
  frame:    { fill: 1.0, floor: 0.4 },
  glass:    { fill: 1.0, floor: 1.25 }, // floor > 1 also draws mullions in the edge pass
  paving:   { fill: 1.0, floor: 0.0 },
  drive:    { fill: 1.0, floor: 0.0 },
  lawn:     { fill: 1.0, floor: 0.0 },
  planter:  { fill: 1.0, floor: 0.0 },
  pool:     { fill: 1.0, floor: 0.0 },
  context:  { fill: 1.0, floor: 0.3 },
};

export function createMassing(plan, palette, tier) {
  const boxes = plan.boxes;
  const count = boxes.length;
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  const color = new Float32Array(count * 3);
  const alphaArr = new Float32Array(count * 2);
  const floorArr = new Float32Array(count);
  const glazeArr = new Float32Array(count);
  const moduleArr = new Float32Array(count * 2);
  const c = new THREE.Color();
  boxes.forEach((b, i) => {
    c.set(palette[b.kind] ?? palette.concrete).toArray(color, i * 3);
    floorArr[i] = b.group === 'L' ? 0 : (KIND[b.kind] || KIND.concrete).floor;
    glazeArr[i] = b.glaze ?? 0;
    moduleArr[i * 2] = b.module ? b.module[0] : 5;
    moduleArr[i * 2 + 1] = b.module ? b.module[1] : 3.2;
  });
  const aAlpha = new THREE.InstancedBufferAttribute(alphaArr, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
  geometry.setAttribute('aAlpha', aAlpha);
  geometry.setAttribute('aFloor', new THREE.InstancedBufferAttribute(floorArr, 1));
  geometry.setAttribute('aGlaze', new THREE.InstancedBufferAttribute(glazeArr, 1));
  geometry.setAttribute('aModule', new THREE.InstancedBufferAttribute(moduleArr, 2));

  // ---- fill -----------------------------------------------------------------
  const fillMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  fillMaterial.extensions = { derivatives: true }; // fwidth() for the facades (WebGL1)
  fillMaterial.onBeforeCompile = (shader) => injectFacade(shader, {
    vertexDecl: `
      attribute vec3 aColor;
      attribute vec2 aAlpha;
      attribute float aGlaze;
      attribute vec2 aModule;
      varying vec3 vBoxColor;
      varying float vFill;
      varying float vGlaze;
      varying vec2 vModule;
      varying vec3 vWPos;
      varying vec3 vObjN;
      varying float vTopY;
      varying float vBotY;
      varying float vAcross;`,
    vertexBody: `
      vBoxColor = aColor;
      vFill = aAlpha.x;
      vGlaze = aGlaze;
      vModule = aModule;
      vObjN = normal;
      mat4 boxToWorld = modelMatrix * instanceMatrix;
      vWPos = (boxToWorld * vec4(transformed, 1.0)).xyz;
      vTopY = (boxToWorld * vec4(0.0, 0.5, 0.0, 1.0)).y;
      vBotY = (boxToWorld * vec4(0.0, -0.5, 0.0, 1.0)).y;
      // horizontal coordinate along the facade, in metres, in the box's own frame
      vAcross = abs(normal.x) > 0.5 ? transformed.z * length(instanceMatrix[2].xyz) : transformed.x * length(instanceMatrix[0].xyz);`,
    fragmentDecl: `
      varying vec3 vBoxColor;
      varying float vFill;
      varying float vGlaze;
      varying vec2 vModule;
      varying vec3 vWPos;
      varying vec3 vObjN;
      varying float vTopY;
      varying float vBotY;
      varying float vAcross;`,
    fill: 'vFill', glaze: 'vGlaze', base: 'vBoxColor', worldPos: 'vWPos', across: 'vAcross',
    nrm: 'vObjN', botY: 'vBotY', topY: 'vTopY', module: 'vModule', ramp: 'vec4(0.0)', screen: palette.screen,
  });
  const fill = new THREE.InstancedMesh(geometry, fillMaterial, count);
  fill.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fill.frustumCulled = false;
  fill.castShadow = !!tier.shadows;
  fill.receiveShadow = !!tier.shadows;

  // ---- edges + floor plates --------------------------------------------------
  const edgeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    extensions: { derivatives: true },
    uniforms: {
      uColor: { value: new THREE.Color(palette.ink) },
      uFloor: { value: 0.5 },
      uWidth: { value: 1.15 },
    },
    vertexShader: /* glsl */`
      attribute vec2 aAlpha;
      attribute float aFloor;
      attribute vec2 aModule;
      varying vec3 vLocal;
      varying vec3 vNrm;
      varying float vEdge;
      varying float vFloorK;
      varying vec2 vModule;
      varying float vWorldY;
      varying float vTopY;
      varying float vBotY;
      varying float vAcross;
      void main() {
        vLocal = position;
        vNrm = normal;
        vEdge = aAlpha.y;
        vFloorK = aFloor;
        vModule = aModule;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        vWorldY = wp.y;
        vAcross = abs(normal.x) > 0.5 ? position.z * length(instanceMatrix[2].xyz) : position.x * length(instanceMatrix[0].xyz);
        vTopY = (m * vec4(0.0, 0.5, 0.0, 1.0)).y;
        vBotY = (m * vec4(0.0, -0.5, 0.0, 1.0)).y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uFloor;
      uniform float uWidth;
      varying vec3 vLocal;
      varying vec3 vNrm;
      varying float vEdge;
      varying float vFloorK;
      varying vec2 vModule;
      varying float vWorldY;
      varying float vTopY;
      varying float vBotY;
      varying float vAcross;
      float gridLine(float coord, float spacing, float halfWidth) {
        float fw = max(fwidth(coord), 1e-4);
        float f = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
        return (1.0 - smoothstep(halfWidth, halfWidth + 0.9, f / fw)) * (1.0 - smoothstep(0.22, 0.5, fw / spacing));
      }
      void main() {
        if (vEdge < 0.003) discard;
        vec3 fw = max(fwidth(vLocal), vec3(1e-5));
        vec3 d = (0.5 - abs(vLocal)) / fw + abs(vNrm) * 1e4;
        float e = min(min(d.x, d.y), d.z);
        float edge = 1.0 - smoothstep(uWidth * 0.5, uWidth * 0.5 + 1.0, e);

        float plate = 0.0;
        if (abs(vNrm.y) < 0.5 && vFloorK > 0.0) {
          float inside = step(vBotY + 0.8, vWorldY) * step(vWorldY, vTopY - 0.8);
          plate = gridLine(vWorldY - vModule.x, vModule.y, 0.35) * step(vModule.x - 0.1, vWorldY) * inside;
          if (vFloorK > 1.0) plate = max(plate, 0.55 * gridLine(vAcross, 3.0, 0.3) * inside);
        }
        float a = max(edge * vEdge, plate * vFloorK * uFloor * min(1.0, vEdge * 1.6));
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
  const edges = new THREE.InstancedMesh(geometry, edgeMaterial, count);
  edges.instanceMatrix = fill.instanceMatrix; // shared transforms, uploaded once
  edges.frustumCulled = false;
  edges.renderOrder = 1;

  const group = new THREE.Group();
  group.add(fill, edges);

  // ---- per-frame state -------------------------------------------------------
  const top = new Float32Array(count);
  const m = new THREE.Matrix4();

  const isDev = (b) => b.group === 'A' || b.group === 'B' || b.group === 'C';

  function update(S) {
    const mat = smootherstep(window01(S, PHASES.materialize));
    // surfaces fill over a tighter window so the dithered in-between is brief
    const solid = smootherstep(window01(S, [PHASES.materialize[0] + 0.02, PHASES.materialize[1] - 0.02]));
    // once the facades are visible, the drawn floor lines step back
    edgeMaterial.uniforms.uFloor.value = lerp(0.5, 0.06, mat);

    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      const g = smootherstep(clamp01((S - b.start) / b.dur));
      const base = b.parentIndex >= 0 ? top[b.parentIndex] : b.y0;
      const h = Math.max(b.h * g, 0.001);
      top[i] = base + h;
      m.makeScale(b.w, h, b.d).setPosition(b.x, base + h / 2, b.z);
      fill.setMatrixAt(i, m);

      let fillA, edgeA;
      if (b.group === 'L') {
        fillA = g;
        edgeA = 0.1 * g;
      } else if (isDev(b)) {
        fillA = (KIND[b.kind] || KIND.concrete).fill * solid;
        edgeA = g > 0 ? lerp(0.9, 0.3, mat) : 0;
      } else {
        fillA = KIND.context.fill * g;
        edgeA = 0.18 * g;
      }
      alphaArr[i * 2] = g > 0 ? fillA : 0;
      alphaArr[i * 2 + 1] = edgeA;
    }
    fill.instanceMatrix.needsUpdate = true;
    aAlpha.needsUpdate = true;
  }

  return { object: group, update };
}
