// Curvilinear masses: smooth extruded plans (podium, tower tiers, penthouses,
// the Art Deco hotel volumes) and open rings (guards, crowns, screens), with the
// shared facade shading, slab sets that follow each curved plan (balcony
// ribbons, transfer slabs, eaves, eyebrows), and a CAD wireframe that rises with
// the building — vertical ribs, floor rings revealed as the mass passes them,
// and a moving top ring. Plans come from site-plan.js in world space.
import * as THREE from 'three';
import { PHASES } from '../config.js';
import { clamp01, window01, smootherstep, lerp } from '../sequence.js';
import { injectFacade, DITHER_GLSL } from './facade-glsl.js';
import { planNormals, offsetPlan } from '../site-plan.js';

const FLOOR = 3.2;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

// Triangle builder that enforces winding toward an intended facing direction.
function makeBuilder() {
  const position = [], normal = [], across = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  function tri(p, n, u, facing) {
    a.fromArray(p[0]); b.fromArray(p[1]); c.fromArray(p[2]);
    const flip = e1.subVectors(b, a).cross(e2.subVectors(c, a)).dot(facing) < 0;
    const order = flip ? [0, 2, 1] : [0, 1, 2];
    for (const k of order) { position.push(...p[k]); normal.push(...n[k]); across.push(u[k]); }
  }
  function quad(p, n, u, facing) {
    tri([p[0], p[1], p[2]], [n[0], n[1], n[2]], [u[0], u[1], u[2]], facing);
    tri([p[0], p[2], p[3]], [n[0], n[2], n[3]], [u[0], u[2], u[3]], facing);
  }
  function geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    g.computeBoundingSphere();
    return g;
  }
  return { tri, quad, geometry };
}

// smooth vertical wall around a plan between y0 and y1; sign -1 faces inward
function wall(B, pts, y0, y1, sign = 1) {
  const n = pts.length;
  const nrm = planNormals(pts);
  const facing = new THREE.Vector3();
  let run = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, az] = pts[i], [bx, bz] = pts[j];
    const len = Math.hypot(bx - ax, bz - az);
    const na = [nrm[i][0] * sign, 0, nrm[i][1] * sign], nb = [nrm[j][0] * sign, 0, nrm[j][1] * sign];
    facing.set(na[0] + nb[0], 0, na[2] + nb[2]);
    B.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [na, nb, nb, na], [run, run + len, run + len, run], facing);
    run += len;
  }
}

function cap(B, pts, y, facingUp) {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const n = facingUp ? [0, 1, 0] : [0, -1, 0];
  for (const [i0, i1, i2] of THREE.ShapeUtils.triangulateShape(contour, [])) {
    B.tri([[pts[i0][0], y, pts[i0][1]], [pts[i1][0], y, pts[i1][1]], [pts[i2][0], y, pts[i2][1]]], [n, n, n], [0, 0, 0], facingUp ? UP : DOWN);
  }
}

// extruded prism, local y ∈ [0, h], with roof and soffit caps
function prismGeometry(pts, h) {
  const B = makeBuilder();
  wall(B, pts, 0, h);
  cap(B, pts, h, true);
  cap(B, pts, 0, false);
  return B.geometry();
}

const FLAT_UP = [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
const FLAT_DOWN = [[0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]];
const ZERO4 = [0, 0, 0, 0];

// horizontal annulus between two plans with matching vertex counts
function annulus(B, outer, inner, y, up) {
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    B.quad([[outer[i][0], y, outer[i][1]], [outer[j][0], y, outer[j][1]], [inner[j][0], y, inner[j][1]], [inner[i][0], y, inner[i][1]]],
      up ? FLAT_UP : FLAT_DOWN, ZERO4, up ? UP : DOWN);
  }
}

// open ring (guard, halo, mechanical screen): outer + inner faces, coping and soffit
function ringGeometry(outer, inner, h) {
  const B = makeBuilder();
  wall(B, outer, 0, h, 1);
  wall(B, inner, 0, h, -1);
  annulus(B, outer, inner, h, true);
  annulus(B, outer, inner, 0, false);
  return B.geometry();
}

// Slab sets that follow a curved plan: balcony ribbons, transfer slabs, eaves and
// eyebrows. Each floor gives its own outer edge and inner (buried) edge — plans
// with matching vertex counts — so ribbons can swell, ripple and rotate floor by
// floor while the glazing line stays put.
function slabGeometry(floors) {
  const B = makeBuilder();
  const outward = new THREE.Vector3();
  for (const f of floors) {
    const top = f.y;
    const bottom = f.y - f.thick;
    const n = f.outer.length;
    const nrm = planNormals(f.outer);
    annulus(B, f.outer, f.inner, top, true);
    annulus(B, f.outer, f.inner, bottom, false);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const A = f.outer[i], C = f.outer[j];
      const na = [nrm[i][0], 0, nrm[i][1]], nc = [nrm[j][0], 0, nrm[j][1]];
      outward.set(na[0] + nc[0], 0, na[2] + nc[2]);
      B.quad([[A[0], bottom, A[1]], [C[0], bottom, C[1]], [C[0], top, C[1]], [A[0], top, A[1]]], [na, nc, nc, na], ZERO4, outward);
    }
  }
  return B.geometry();
}

// Stacked floorplates: one wall band per floor with that floor's plan (the glass
// line may lean slightly floor to floor; the balcony slabs cover each small step).
function stackGeometry(plans, floorH) {
  const B = makeBuilder();
  plans.forEach((pts, k) => wall(B, pts, k * floorH, (k + 1) * floorH));
  cap(B, plans[plans.length - 1], plans.length * floorH, true);
  cap(B, plans[0], 0, false);
  return B.geometry();
}

function stackWireGeometry(plans, floorH, ribs = 16) {
  const position = [], kind = [];
  const n = plans[0].length;
  const seg = (a, b, k) => { position.push(...a, ...b); kind.push(k, k); };
  const step = Math.max(1, Math.round(n / ribs));
  plans.forEach((pts, k) => {
    const y0 = k * floorH, y1 = (k + 1) * floorH;
    for (let i = 0; i < n; i += step) seg([pts[i][0], y0, pts[i][1]], [pts[i][0], y1, pts[i][1]], 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      seg([pts[i][0], k === 0 ? 0.05 : y0, pts[i][1]], [pts[j][0], k === 0 ? 0.05 : y0, pts[j][1]], k === 0 ? 0 : 1);
    }
  });
  const top = plans[plans.length - 1], yt = plans.length * floorH - 0.02;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; seg([top[i][0], yt, top[i][1]], [top[j][0], yt, top[j][1]], 0); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return g;
}

// CAD wireframe: vertical ribs, base ring and floor rings (local y ∈ [0, h])
function wireGeometry(pts, h, ribs = 16, floorH = FLOOR) {
  const position = [], kind = [];
  const n = pts.length;
  const seg = (a, b, k) => { position.push(...a, ...b); kind.push(k, k); };
  const step = Math.max(1, Math.round(n / ribs));
  for (let i = 0; i < n; i += step) seg([pts[i][0], 0, pts[i][1]], [pts[i][0], h, pts[i][1]], 0);
  const ring = (y, k) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      seg([pts[i][0], y, pts[i][1]], [pts[j][0], y, pts[j][1]], k);
    }
  };
  ring(0.05, 0);
  for (let y = floorH; y < h - 0.5; y += floorH) ring(y, 1);
  ring(h - 0.02, 0); // top edge, revealed once the mass is fully grown (the moving ring then retires)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return g;
}

function ringLineGeometry(pts) {
  const position = [], kind = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    position.push(pts[i][0], 0, pts[i][1], pts[j][0], 0, pts[j][1]);
    kind.push(0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return g;
}

function wireMaterial(palette) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(palette.ink) },
      uEdge: { value: 0 },
      uFloor: { value: 0 },
      uClip: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute float aKind;
      varying float vKind;
      varying float vY;
      void main() {
        vKind = aKind;
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uEdge;
      uniform float uFloor;
      uniform float uClip;
      varying float vKind;
      varying float vY;
      void main() {
        if (vY > uClip + 0.01) discard;
        float a = vKind < 0.5 ? uEdge : uFloor;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

function ditherMaterial(color, uFill) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, envMapIntensity: 0.35 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = uFill;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFill;
        ${DITHER_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (bayer4(gl_FragCoord.xy) + 0.03125 > uFill) discard;`);
  };
  return material;
}

// ---------------------------------------------------------------------------

export function createCurves(plan, palette, tier) {
  const group = new THREE.Group();
  const shadows = !!tier.shadows;
  const byName = {};

  const items = plan.curved.map((spec) => {
    const parent = spec.parent ? byName[spec.parent] : null;
    const finalBase = parent ? parent.finalTop : spec.y0;
    const item = { spec, parent, finalBase, finalTop: finalBase + spec.h, top: 0 };
    byName[spec.name] = item;

    const ring = spec.type === 'ring';
    const outer = ring && !spec.inner ? offsetPlan(spec.pts, -(spec.inset || 0)) : spec.pts;
    const inner = ring ? (spec.inner || offsetPlan(spec.pts, -((spec.inset || 0) + spec.thick))) : null;
    const stack = spec.type === 'stack';
    const geometry = ring ? ringGeometry(outer, inner, spec.h)
      : stack ? stackGeometry(spec.floorPlans, spec.floorH) : prismGeometry(spec.pts, spec.h);

    // facade surface (static at its final height, shown once the massing turns solid)
    const uniforms = {
      uFill: { value: 0 },
      uGlaze: { value: spec.glaze },
      uModule: { value: new THREE.Vector2(spec.module[0], spec.module[1]) },
      uRamp: { value: new THREE.Vector4(...(spec.ramp || [0, 0, 0, 0])) },
      uBotY: { value: finalBase },
      uTopY: { value: finalBase + spec.h },
    };
    const fillMaterial = new THREE.MeshStandardMaterial({ color: palette[spec.kind] ?? palette.concrete, roughness: 0.92, metalness: 0 });
    fillMaterial.extensions = { derivatives: true };
    fillMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      injectFacade(shader, {
        vertexDecl: `
          attribute float aAcross;
          varying float vAcross;
          varying vec3 vWPos;
          varying vec3 vNrm;`,
        vertexBody: `
          vAcross = aAcross;
          vNrm = normal;
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        fragmentDecl: `
          uniform float uFill;
          uniform float uGlaze;
          uniform vec2 uModule;
          uniform vec4 uRamp;
          uniform float uBotY;
          uniform float uTopY;
          varying float vAcross;
          varying vec3 vWPos;
          varying vec3 vNrm;`,
        fill: 'uFill', glaze: 'uGlaze', base: 'diffuseColor.rgb', worldPos: 'vWPos', across: 'vAcross',
        nrm: 'vNrm', botY: 'uBotY', topY: 'uTopY', module: 'uModule', ramp: 'uRamp', screen: palette.screen,
      });
    };
    const fill = new THREE.Mesh(geometry, fillMaterial);
    fill.position.y = finalBase;
    fill.castShadow = shadows;
    fill.receiveShadow = shadows;
    group.add(fill);
    item.uniforms = uniforms;

    if (spec.slabs) {
      item.slabFill = { value: 0 };
      const slabColor = palette[spec.slabs.kind] ?? palette.slab;
      const slabs = item.slabs = new THREE.Mesh(slabGeometry(spec.slabs.floors), ditherMaterial(slabColor, item.slabFill));
      slabs.position.y = finalBase;
      slabs.castShadow = shadows;
      slabs.receiveShadow = shadows;
      group.add(slabs);
    }

    item.fill = fill;
    // rising wireframe (guards and other small rings simply materialise with the surfaces)
    if (spec.wire !== false) {
      const wireMat = wireMaterial(palette);
      const floorH = spec.floorH ?? spec.module[1];
      const wire = new THREE.LineSegments(stack ? stackWireGeometry(spec.floorPlans, floorH, spec.ribs ?? 16)
        : wireGeometry(outer, spec.h, ring ? 8 : (spec.ribs ?? 16), floorH), wireMat);
      const topRing = new THREE.LineSegments(ringLineGeometry(stack ? spec.floorPlans[spec.floorPlans.length - 1] : outer), wireMat);
      wire.renderOrder = topRing.renderOrder = 1;
      wire.frustumCulled = topRing.frustumCulled = false;
      group.add(wire, topRing);
      Object.assign(item, { wire, topRing, wireMat });
    }
    return item;
  });

  function update(S) {
    const mat = smootherstep(window01(S, PHASES.materialize));
    const solid = smootherstep(window01(S, [PHASES.materialize[0] + 0.02, PHASES.materialize[1] - 0.02]));
    // landscape surfaces (pools, fountain, paving) arrive with the context phase
    const context = smootherstep(window01(S, [PHASES.context[0] + 0.01, PHASES.context[0] + 0.09]));
    for (const item of items) {
      const { spec } = item;
      const g = smootherstep(clamp01((S - spec.start) / spec.dur));
      const base = item.parent ? item.parent.top : spec.y0;
      const height = spec.h * g;
      item.top = base + height;

      if (item.wire) {
        item.wire.position.y = base;
        item.topRing.position.y = base + height;
        item.wireMat.uniforms.uClip.value = height;
        item.wireMat.uniforms.uEdge.value = g > 0 ? lerp(0.9, 0.3, mat) : 0;
        item.wireMat.uniforms.uFloor.value = g > 0 ? lerp(0.32, 0.04, mat) : 0;
        // skip draw calls for lines that cannot show
        item.wire.visible = g > 0 && !(tier.dropSettledWire && mat >= 1);
        item.topRing.visible = g > 0 && g < 1;
      }

      const fillA = spec.phase === 'context' ? context : solid;
      item.uniforms.uFill.value = fillA;
      item.fill.visible = fillA > 0;
      if (item.slabFill) { item.slabFill.value = fillA; item.slabs.visible = fillA > 0; }
    }
  }

  return { object: group, update };
}
