// Planting and scale: lush canopy trees in varied greens, royal palms, modelled
// sedans and SUVs, soft contact shadows under the principal masses and (desktop) a
// shadow-catcher ground. Instanced throughout — draw calls do not grow with counts.
import * as THREE from 'three';
import { PHASES } from '../config.js';
import { TREE_FORMS, treeKind } from '../plan/planting.js';
import { clamp01, window01, smootherstep } from '../sequence.js';

function radialTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// deterministic hash for vertex displacement (same position → same offset, so
// the duplicated vertices of non-indexed faces stay welded)
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function mergeGeometries(parts) {
  const pos = [];
  for (const g of parts) {
    const a = (g.index ? g.toNonIndexed() : g).getAttribute('position').array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// A tree at unit canopy radius: tapered trunk with two limbs, and a canopy built from
// overlapping, noise-displaced lobes. 'spread' is a broad Miami shade tree (live oak /
// gumbo limbo); 'upright' is a rounded street tree. Trunk base at y = 0.
const TREE_TRUNK_H = Object.fromEntries(Object.entries(TREE_FORMS).map(([k, f]) => [k, f.trunk]));
// canopy lobes [x, y, z, radius] above the trunk and a vertical squash per form
const LOBES = {
  spread: { y: 0.78, lobes: [[0, 0.30, 0, 0.62], [0.52, 0.12, 0.18, 0.5], [-0.48, 0.1, 0.28, 0.5], [0.12, 0.08, -0.55, 0.5], [-0.3, 0.42, -0.25, 0.44], [0.3, 0.45, 0.32, 0.42], [-0.18, 0.05, 0.58, 0.4]] },
  upright: { y: 0.95, lobes: [[0, 0.45, 0, 0.62], [0.3, 0.2, 0.15, 0.45], [-0.28, 0.25, -0.2, 0.45], [0.05, 0.78, 0.05, 0.42], [-0.12, 0.12, 0.34, 0.4]] },
  broad: { y: 0.5, lobes: [[0, 0.3, 0, 0.72], [0.72, 0.18, 0.15, 0.56], [-0.66, 0.16, 0.3, 0.56], [0.18, 0.12, -0.72, 0.52], [-0.4, 0.22, -0.55, 0.5], [0.42, 0.26, 0.62, 0.5], [-0.2, 0.4, 0.2, 0.46]] },
  round: { y: 1.0, lobes: [[0, 0.35, 0, 0.66], [0.34, 0.18, 0.12, 0.44], [-0.3, 0.22, -0.2, 0.44], [0.02, 0.72, 0.04, 0.4], [-0.1, 0.1, 0.36, 0.38]] },
};
function trunkGeometry(kind) {
  const h = TREE_TRUNK_H[kind];
  const trunk = new THREE.CylinderGeometry(0.06, 0.11, h, 7).translate(0, h / 2, 0);
  const limb = (len, tilt, turn) => new THREE.CylinderGeometry(0.03, 0.055, len, 5)
    .translate(0, len / 2, 0)
    .rotateZ(tilt).rotateY(turn)
    .translate(0, h * 0.72, 0);
  return mergeGeometries([trunk, limb(0.55, 0.75, 0.4), limb(0.5, -0.7, 2.3), limb(0.45, 0.6, 4.1)]);
}

function canopyGeometry(kind) {
  const h = TREE_TRUNK_H[kind];
  const { lobes, y: squash } = LOBES[kind];
  const parts = lobes.map(([x, y, z, r], k) => {
    const g = new THREE.IcosahedronGeometry(r, 1);   // already non-indexed
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const len = Math.hypot(vx, vy, vz) || 1;
      const n = 0.78 + 0.34 * hash3(Math.round(vx * 100) + k * 13, Math.round(vy * 100), Math.round(vz * 100));
      p.setXYZ(i, (vx / len) * r * n, (vy / len) * r * n * squash, (vz / len) * r * n);
    }
    return g.translate(x, h + y, z);
  });
  const geo = mergeGeometries(parts);
  return geo;
}

// Merge [geometry, hex] pairs into one non-indexed geometry with baked vertex colours
// (the per-instance colour multiplies them, so paint takes the instance colour while
// glass, tyres and lights stay dark or bright).
function mergeColored(parts) {
  const pos = [], col = [];
  const c = new THREE.Color();
  for (const [g, hex] of parts) {
    const a = (g.index ? g.toNonIndexed() : g).getAttribute('position').array;
    c.set(hex);
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(c.r, c.g, c.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// A car, front toward +x, wheels on y = 0: a bevelled lower body, a glazed cabin with
// tumblehome, a painted roof and pillars, four wheels, head- and tail-lights and a
// dark lower grille. Profiles are side elevations (x along the car, y up).
const CAR_TYPES = {
  sedan: {
    width: 1.7, cabinWidth: 1.5, wheel: [0.33, 1.42, 0.8],
    hull: [[-2.25, 0.3], [2.2, 0.3], ['q', 2.3, 0.32, 2.28, 0.55], ['q', 2.25, 0.7, 2.0, 0.74], [0.9, 0.84], [-1.6, 0.86], [-2.1, 0.84], ['q', -2.3, 0.8, -2.28, 0.55]],
    glass: [[0.95, 0.8], [0.08, 1.32], [-0.92, 1.34], [-1.68, 0.84]],
    roof: [[0.12, 1.3], [-0.92, 1.32], [-0.88, 1.39], [0.08, 1.37]],
    pillars: [-0.42],
    head: [2.31, 0.62, 0.58], tail: [-2.31, 0.72, 0.56],
  },
  suv: {
    width: 1.8, cabinWidth: 1.64, wheel: [0.37, 1.5, 0.84],
    hull: [[-2.35, 0.38], [2.3, 0.38], ['q', 2.42, 0.4, 2.4, 0.66], ['q', 2.36, 0.86, 2.1, 0.9], [1.05, 1.0], [-2.2, 1.04], ['q', -2.4, 1.0, -2.38, 0.66]],
    glass: [[1.1, 0.97], [0.3, 1.58], [-2.0, 1.6], [-2.3, 1.0]],
    roof: [[0.34, 1.55], [-2.02, 1.57], [-1.98, 1.66], [0.3, 1.64]],
    pillars: [-0.55, -1.5],
    head: [2.43, 0.74, 0.62], tail: [-2.41, 0.88, 0.62],
  },
};

function carGeometry(type) {
  const T = CAR_TYPES[type];
  const shape = (pts) => {
    const s = new THREE.Shape();
    pts.forEach((p, k) => {
      if (p[0] === 'q') s.quadraticCurveTo(p[1], p[2], p[3], p[4]);
      else if (k === 0) s.moveTo(p[0], p[1]);
      else s.lineTo(p[0], p[1]);
    });
    s.closePath();
    return s;
  };
  const extrude = (pts, depth, bevel) => new THREE.ExtrudeGeometry(shape(pts), {
    depth, curveSegments: 4, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  }).translate(0, 0, -depth / 2);
  const parts = [
    [extrude(T.hull, T.width, 0.05), '#ffffff'],
    [extrude(T.glass, T.cabinWidth, 0), '#20262b'],
    [extrude(T.roof, T.cabinWidth - 0.06, 0.03), '#ffffff'],
  ];
  const glassTop = Math.max(...T.glass.map((p) => p[1]));
  const belt = Math.min(...T.glass.map((p) => p[1]));
  for (const x of T.pillars) parts.push([new THREE.BoxGeometry(0.1, glassTop - belt, T.cabinWidth + 0.03).translate(x, (glassTop + belt) / 2, 0), '#ffffff']);
  const [r, wx, wz] = T.wheel;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push([new THREE.CylinderGeometry(r, r, 0.22, 14).rotateX(Math.PI / 2).translate(sx * wx, r, sz * wz), '#1d1f21']);
  }
  const [hx, hy, hz] = T.head, [tx, ty, tz] = T.tail;
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.06, 0.1, 0.36).translate(hx, hy, s * hz), '#fff4d6']);
    parts.push([new THREE.BoxGeometry(0.06, 0.1, 0.4).translate(tx, ty, s * tz), '#8e2a22']);
  }
  parts.push([new THREE.BoxGeometry(0.05, 0.12, T.width - 0.4).translate(hx + 0.005, T.hull[0][1] + 0.12, 0), '#3a3d40']);
  return mergeColored(parts);
}

// A palm crown: drooping, tapered fronds radiating from the top of the trunk.
function palmCrownGeometry(fronds = 9) {
  const pos = [];
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * Math.PI * 2 + (k % 2) * 0.12;
    const dir = (r, ang) => [Math.cos(ang) * r, Math.sin(ang) * r];
    const [mx1, mz1] = dir(0.5, a - 0.2);
    const [mx2, mz2] = dir(0.5, a + 0.2);
    const [tx, tz] = dir(1, a);
    // centre → left mid → tip, centre → tip → right mid (tip droops below the crown)
    pos.push(0, 0.08, 0, mx1, 0.12, mz1, tx, -0.42, tz);
    pos.push(0, 0.08, 0, tx, -0.42, tz, mx2, 0.12, mz2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createLandscape(plan, palette, tier) {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();
  const shadows = !!tier.shadows;

  // canopy trees — trunk + clustered canopy; shade trees spread, street trees stay upright
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true, envMapIntensity: 0.3 });
  const barkMat = new THREE.MeshStandardMaterial({ color: palette.bark, roughness: 0.95, envMapIntensity: 0.3 });
  const kinds = Object.keys(TREE_FORMS);
  const byKind = Object.fromEntries(kinds.map((k) => [k, plan.trees.filter((t) => treeKind(t) === k)]));
  const treeMeshes = kinds.map((kind) => {
    const list = byKind[kind];
    const n = Math.max(1, list.length);
    if (!list.length) return null;
    const canopy = new THREE.InstancedMesh(canopyGeometry(kind), leafMat, n);
    const trunk = new THREE.InstancedMesh(trunkGeometry(kind), barkMat, n);
    canopy.count = trunk.count = list.length;
    trunk.instanceMatrix = canopy.instanceMatrix;   // shared transforms
    list.forEach((t, i) => {
      const set = t.flower ? palette.treeFlower : kind === 'round' ? palette.treeRound : t.lush ? palette.treeLush : palette.treeStreet;
      canopy.setColorAt(i, color.set(set[Math.floor(t.tone * set.length) % set.length]));
    });
    return { kind, list, canopy, trunk };
  }).filter(Boolean);

  // royal palms — slim trunk + frond crown
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.32, 1, 6).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 0.9, envMapIntensity: 0.3 }),
    Math.max(1, plan.palms.length),
  );
  const crowns = new THREE.InstancedMesh(
    palmCrownGeometry(),
    new THREE.MeshStandardMaterial({ color: palette.palm, roughness: 0.9, side: THREE.DoubleSide, flatShading: true, envMapIntensity: 0.3 }),
    Math.max(1, plan.palms.length),
  );
  trunks.count = crowns.count = plan.palms.length;

  // cars — modelled sedans and SUVs; paint colour per instance
  const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.45, metalness: 0.15, flatShading: true, envMapIntensity: 0.6 });
  const carMeshes = Object.keys(CAR_TYPES).map((type) => {
    const list = plan.cars.filter((c) => (c.type || 'sedan') === type);
    const mesh = new THREE.InstancedMesh(carGeometry(type), carMat, Math.max(1, list.length));
    mesh.count = list.length;
    list.forEach((c, i) => mesh.setColorAt(i, color.set(palette.carPaint[c.paint % palette.carPaint.length])));
    return { list, mesh };
  });
  const cars = carMeshes.map((c) => c.mesh);

  for (const mesh of [...treeMeshes.flatMap((t) => [t.canopy, t.trunk]), trunks, crowns, ...cars]) {
    mesh.castShadow = shadows;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  // contact shadows under the principal masses
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  shadowGeo.rotateX(-Math.PI / 2);
  const contactMat = new THREE.MeshBasicMaterial({
    color: palette.ink, map: radialTexture(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false,
  });
  const contact = new THREE.InstancedMesh(shadowGeo, contactMat, plan.shadows.length);
  contact.renderOrder = -1.5;
  contact.frustumCulled = false;
  contact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  group.add(...treeMeshes.flatMap((t) => [t.canopy, t.trunk]), trunks, crowns, ...cars, contact);

  let ground = null;
  if (shadows) {
    const groundGeo = new THREE.PlaneGeometry(900, 900);
    groundGeo.rotateX(-Math.PI / 2);
    ground = new THREE.Mesh(groundGeo, new THREE.ShadowMaterial({ color: palette.ink, opacity: 0 }));
    ground.receiveShadow = true;
    ground.position.y = 0.01;
    group.add(ground);
  }

  const growth = (item, S) => smootherstep(clamp01((S - item.start) / item.dur));

  function update(S) {
    for (const tm of treeMeshes) {
      tm.list.forEach((t, i) => {
        const g = growth(t, S);
        const r = Math.max(t.r * g, 0.001);
        // trunk base on the ground or planter soil; the tree grows up from it
        m.compose(pos.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.tone * Math.PI * 2), scl.set(r, r * (0.95 + t.tone * 0.2), r));
        tm.canopy.setMatrixAt(i, m);
      });
      tm.canopy.instanceMatrix.needsUpdate = true;
    }

    plan.palms.forEach((p, i) => {
      const g = growth(p, S);
      const h = Math.max(p.h * g, 0.001);
      m.compose(pos.set(p.x, p.y, p.z), q.identity(), scl.set(Math.max(g, 0.001), h, Math.max(g, 0.001)));
      trunks.setMatrixAt(i, m);
      const r = Math.max(p.r * g, 0.001);
      m.compose(pos.set(p.x, p.y + h, p.z), q.setFromAxisAngle(up, p.spin), scl.set(r, r, r));
      crowns.setMatrixAt(i, m);
    });

    for (const { list, mesh } of carMeshes) {
      list.forEach((car, i) => {
        const g = Math.max(growth(car, S), 0.001);
        m.compose(pos.set(car.x, car.y ?? 0.02, car.z), q.setFromAxisAngle(up, car.rot), scl.set(g, g, g));
        mesh.setMatrixAt(i, m);
      });
    }

    for (const mesh of [trunks, crowns, ...cars]) mesh.instanceMatrix.needsUpdate = true;

    // contact shadows arrive with the solid surfaces, not under wireframes
    const rise = smootherstep(window01(S, [PHASES.extrude[1] - 0.04, PHASES.materialize[1]]));
    plan.shadows.forEach((b, i) => {
      const k = 0.55 + 0.45 * rise;
      m.makeScale((b.w + 16) * k, 1, (b.d + 16) * k).setPosition(b.x, 0.03, b.z);
      contact.setMatrixAt(i, m);
    });
    contact.instanceMatrix.needsUpdate = true;
    contactMat.opacity = 0.2 * rise;

    if (ground) ground.material.opacity = 0.2 * smootherstep(window01(S, PHASES.materialize));
  }

  return { object: group, update };
}
