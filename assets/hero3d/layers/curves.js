// Curvilinear masses: smooth extruded plans (podium, tower tiers, penthouses,
// the Art Deco hotel volumes) and open rings (guards, crowns, screens), with the
// shared facade shading, slab sets that follow each curved plan (balcony
// ribbons, transfer slabs, eaves, eyebrows), and a CAD wireframe that rises with
// the building — vertical ribs, floor rings revealed as the mass passes them,
// and a moving top ring. Plans come from site-plan.js in world space.
import * as THREE from 'three';
import { PHASES, BUILT } from '../config.js';
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

function cap(B, pts, y, facingUp, holes = []) {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  const holeContours = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
  const all = [...pts, ...holes.flat()];
  const n = facingUp ? [0, 1, 0] : [0, -1, 0];
  for (const [i0, i1, i2] of THREE.ShapeUtils.triangulateShape(contour, holeContours)) {
    B.tri([[all[i0][0], y, all[i0][1]], [all[i1][0], y, all[i1][1]], [all[i2][0], y, all[i2][1]]], [n, n, n], [0, 0, 0], facingUp ? UP : DOWN);
  }
}

// extruded prism, local y ∈ [0, h], with roof and soffit caps; optional holes (pool
// openings in a deck) get inward-facing walls
function prismGeometry(pts, h, holes = []) {
  const B = makeBuilder();
  wall(B, pts, 0, h);
  for (const hole of holes) wall(B, hole, 0, h, -1);
  cap(B, pts, h, true, holes);
  cap(B, pts, 0, false, holes);
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

// Wave screen: horizontal fins that follow a closed plan path, each rising and falling in
// a smooth wave and swelling in depth, wrapping every corner. Breaks (openings) cut the
// fins into runs with end caps. Light strips are thin warm ribbons tucked under selected
// fins, set back from the fin edge. Returns { fins, lights } geometries (world space).
function waveSamples(path, spacing) {
  // resample the closed path by arc length, with outward normals
  const nrm = planNormals(path);
  const out = [];
  let s = 0, carry = 0;
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length;
    const [ax, az] = path[i], [bx, bz] = path[j];
    const len = Math.hypot(bx - ax, bz - az);
    let t = carry;
    while (t < len) {
      const f = t / len;
      const nx = nrm[i][0] + (nrm[j][0] - nrm[i][0]) * f, nz = nrm[i][1] + (nrm[j][1] - nrm[i][1]) * f;
      const nl = Math.hypot(nx, nz) || 1;
      out.push({ x: ax + (bx - ax) * f, z: az + (bz - az) * f, nx: nx / nl, nz: nz / nl, s: s + t });
      t += spacing;
    }
    carry = t - len;
    s += len;
  }
  return { samples: out, perimeter: s };
}

function waveGeometry(spec) {
  const W = spec.waves;
  const { samples, perimeter } = waveSamples(spec.pts, W.spacing);
  const n = samples.length;
  const cycles = Math.max(1, Math.round(perimeter / W.wavelength));
  const cyclesD = Math.max(1, Math.round(perimeter / W.depthWavelength));
  const open = samples.map((p) => !W.breaks.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < b.width / 2));
  const F = makeBuilder();
  const L = makeBuilder();
  const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0), out = new THREE.Vector3();
  W.fins.forEach((fin, k) => {
    const pt = (i) => {
      const p = samples[i % n];
      const u = (2 * Math.PI * p.s) / perimeter;
      const y = fin.y + W.amplitude * Math.sin(u * cycles + fin.phase);
      const d = W.depth[0] + (W.depth[1] - W.depth[0]) * (0.5 + 0.5 * Math.sin(u * cyclesD + fin.phase * 0.7 + 1.3));
      return { p, y, d };
    };
    const t = W.thick / 2;
    for (let i = 0; i < n; i++) {
      const j = i + 1;
      if (!open[i] || !open[j % n]) {
        // end cap where a run stops at a break
        if (open[i] && !open[j % n]) {
          const a = pt(i), ix = a.p.x - a.p.nx * 0.05, iz = a.p.z - a.p.nz * 0.05, ox = a.p.x + a.p.nx * a.d, oz = a.p.z + a.p.nz * a.d;
          out.set(a.p.nz, 0, -a.p.nx);
          F.quad([[ix, a.y - t, iz], [ox, a.y - t, oz], [ox, a.y + t, oz], [ix, a.y + t, iz]], [[out.x, 0, out.z], [out.x, 0, out.z], [out.x, 0, out.z], [out.x, 0, out.z]], [0, 0, 0, 0], out);
        }
        if (!open[i] && open[j % n]) {
          const a = pt(j), ix = a.p.x - a.p.nx * 0.05, iz = a.p.z - a.p.nz * 0.05, ox = a.p.x + a.p.nx * a.d, oz = a.p.z + a.p.nz * a.d;
          out.set(-a.p.nz, 0, a.p.nx);
          F.quad([[ix, a.y - t, iz], [ox, a.y - t, oz], [ox, a.y + t, oz], [ix, a.y + t, iz]], [[out.x, 0, out.z], [out.x, 0, out.z], [out.x, 0, out.z], [out.x, 0, out.z]], [0, 0, 0, 0], out);
        }
        continue;
      }
      const a = pt(i), b = pt(j);
      const ai = [a.p.x - a.p.nx * 0.05, a.p.z - a.p.nz * 0.05], bi = [b.p.x - b.p.nx * 0.05, b.p.z - b.p.nz * 0.05];
      const ao = [a.p.x + a.p.nx * a.d, a.p.z + a.p.nz * a.d], bo = [b.p.x + b.p.nx * b.d, b.p.z + b.p.nz * b.d];
      const sa = a.p.s, sb = a.p.s + W.spacing;
      F.quad([[ai[0], a.y + t, ai[1]], [bi[0], b.y + t, bi[1]], [bo[0], b.y + t, bo[1]], [ao[0], a.y + t, ao[1]]], FLAT_UP, [sa, sb, sb, sa], up);
      F.quad([[ai[0], a.y - t, ai[1]], [bi[0], b.y - t, bi[1]], [bo[0], b.y - t, bo[1]], [ao[0], a.y - t, ao[1]]], FLAT_DOWN, [sa, sb, sb, sa], down);
      const na = [a.p.nx, 0, a.p.nz], nb = [b.p.nx, 0, b.p.nz];
      out.set(a.p.nx + b.p.nx, 0, a.p.nz + b.p.nz);
      F.quad([[ao[0], a.y - t, ao[1]], [bo[0], b.y - t, bo[1]], [bo[0], b.y + t, bo[1]], [ao[0], a.y + t, ao[1]]], [na, nb, nb, na], [sa, sb, sb, sa], out);
      if (W.lights.includes(k)) {
        // warm strip hanging 2 cm under the fin, 0.3 m back from its edge
        const la = [a.p.x + a.p.nx * (a.d - 0.3), a.p.z + a.p.nz * (a.d - 0.3)], lb = [b.p.x + b.p.nx * (b.d - 0.3), b.p.z + b.p.nz * (b.d - 0.3)];
        L.quad([[la[0], a.y - t - 0.09, la[1]], [lb[0], b.y - t - 0.09, lb[1]], [lb[0], b.y - t - 0.02, lb[1]], [la[0], a.y - t - 0.02, la[1]]], [na, nb, nb, na], [0, 0, 0, 0], out);
      }
    }
  });
  return { fins: F.geometry(), lights: L.geometry() };
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
    const waves = spec.type === 'waves' ? waveGeometry(spec) : null;
    const geometry = waves ? waves.fins : ring ? ringGeometry(outer, inner, spec.h)
      : stack ? stackGeometry(spec.floorPlans, spec.floorH) : prismGeometry(spec.pts, spec.h, spec.holes);

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
    // The CAD ribs and floor rings (LineSegments, which polygon offset cannot move) lie
    // exactly on these surfaces. Pushing the fill back slightly lets the lines win
    // deterministically instead of flickering through depth-precision ties.
    fillMaterial.polygonOffset = true;
    fillMaterial.polygonOffsetFactor = 1;
    fillMaterial.polygonOffsetUnits = 1;
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
    fill.position.y = waves ? 0 : finalBase;   // wave screens are built in world space
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
    if (waves && waves.lights.getAttribute('position').count) {
      // recessed light strips: unlit warm white, fading in with the surfaces (no animation)
      item.lightFill = { value: 0 };
      const lampMat = new THREE.MeshBasicMaterial({ color: palette.lamp });
      lampMat.onBeforeCompile = (shader) => {
        shader.uniforms.uFill = item.lightFill;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            uniform float uFill;
            ${DITHER_GLSL}`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            if (bayer4(gl_FragCoord.xy) + 0.03125 > uFill) discard;`);
      };
      item.lights = new THREE.Mesh(waves.lights, lampMat);
      group.add(item.lights);
    }
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
    // the construction wireframe (ribs, floor rings, outlines) clears once the model is built
    const clear = 1 - smootherstep(window01(S, BUILT));
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
        item.wireMat.uniforms.uEdge.value = g > 0 ? lerp(0.9, 0.3, mat) * clear : 0;
        item.wireMat.uniforms.uFloor.value = g > 0 ? lerp(0.32, 0.04, mat) * clear : 0;
        // skip draw calls for lines that cannot show
        item.wire.visible = g > 0 && clear > 0 && !(tier.dropSettledWire && mat >= 1);
        item.topRing.visible = g > 0 && g < 1;
      }

      const fillA = spec.phase === 'context' ? context : solid;
      item.uniforms.uFill.value = fillA;
      item.fill.visible = fillA > 0;
      if (item.slabFill) { item.slabFill.value = fillA; item.slabs.visible = fillA > 0; }
      if (item.lightFill) { item.lightFill.value = fillA; item.lights.visible = fillA > 0; }
    }
  }

  return { object: group, update };
}
