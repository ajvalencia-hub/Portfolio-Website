// QA overlay (?heroPlan=structure | parking | boh | deck | circulation | all): draws the
// conceptual plan data behind the architecture — tower cores and continuous
// columns, the declared penthouse transfer, office columns, parking stalls,
// aisles, ramp and car lifts, the pool basin, deck routes and the hotel
// back-of-house rooms. Loaded only when the switch is present; never shipped to
// normal visitors' render path.
import * as THREE from 'three';
import { analyseSite } from '../plan/program.js';
import { PODIUM_PARKING, POOL } from '../plan/residential.js';
import { OFFICE_PARKING, OFFICE_BLOCKS, OFFICE_CORE, OFFICE_BASE_TOP } from '../plan/office.js';
import { HOTEL_GROUND } from '../plan/hotel.js';
import { ROUTES, NODES, ENTRANCES, CROSSINGS, PLAZA_R, FOUNTAIN_CENTRE, routeCentreline, sightZones } from '../plan/pedestrian.js';

export function createQaOverlay(plan, mode = 'all') {
  const a = analyseSite(plan);
  const group = new THREE.Group();
  group.renderOrder = 10;
  const show = (m) => mode === 'all' || mode === m;
  const boxes = [];   // [x0, x1, y0, y1, z0, z1, color]
  const lines = [];   // [[x, y, z], ...], color
  const rect = (r, y0, y1, color) => boxes.push([r[0], r[1], y0, y1, r[2], r[3], color]);

  if (show('structure')) {
    for (const t of plan.meta.towers) {
      for (const [x, z] of t.columns) boxes.push([x - 0.3, x + 0.3, 0, t.columnTopY, z - 0.3, z + 0.3, '#d23b2a']);
      const xs = t.core.map((p) => p[0]), zs = t.core.map((p) => p[1]);
      boxes.push([Math.min(...xs), Math.max(...xs), 0, t.coreTopY, Math.min(...zs), Math.max(...zs), '#555b61']);
      for (const tr of t.transfers) { lines.push([tr.outer.map(([x, z]) => [x, tr.y, z]), '#ff8a00']); lines.push([tr.inner.map(([x, z]) => [x, tr.y, z]), '#ff8a00']); }
    }
    for (const [x, z] of a.structure.office.columns) {
      const top = OFFICE_BLOCKS.filter((b) => x >= b.cols.x[0] - 1e-6 && x <= b.cols.x[1] + 1e-6 && z >= b.cols.z[0] - 1e-6 && z <= b.cols.z[1] + 1e-6).reduce((m, b) => Math.max(m, b.y1), OFFICE_BASE_TOP);
      boxes.push([x - 0.3, x + 0.3, 0, top, z - 0.3, z + 0.3, '#8a5a38']);
    }
    rect(OFFICE_CORE, 0, OFFICE_BLOCKS.at(-1).y1 + 3.2, '#555b61');
  }
  if (show('parking')) {
    for (const lv of a.parking.residential.levels) {
      for (const s of lv.stalls) rect(s, lv.floor + 0.05, lv.floor + 0.15, '#3ea356');
      for (const ai of PODIUM_PARKING.aisles) rect(ai.rect, lv.floor + 0.02, lv.floor + 0.06, '#5b8bd6');
    }
    rect(PODIUM_PARKING.ramp.rect, 0, PODIUM_PARKING.levels[1].ceiling - 0.3, '#8a63d2');
    for (const [x, z] of a.parking.residential.podiumColumns) boxes.push([x - 0.3, x + 0.3, 0, 11.1, z - 0.3, z + 0.3, '#444']);
    for (const lv of a.parking.office.levels) {
      for (const s of lv.stalls) rect(s, lv.floor + 0.05, lv.floor + 0.15, '#3ea356');
      for (const ai of OFFICE_PARKING.aisles) rect(ai.rect, lv.floor + 0.02, lv.floor + 0.06, '#5b8bd6');
    }
    rect(OFFICE_PARKING.lifts.rect, 0, OFFICE_BASE_TOP, '#8a63d2');
    // pool basin: outline at the soffit and at the water line
    const basin = plan.meta.pool.outline;
    lines.push([basin.map(([x, z]) => [x, POOL.basinSoffitY, z]), '#1aa3b8']);
    lines.push([basin.map(([x, z]) => [x, POOL.waterY, z]), '#1aa3b8']);
  }
  if (show('boh')) {
    const tone = { service: '#e07b39', guest: '#3d7fd1', public: '#4caf50' };
    for (const r of HOTEL_GROUND) rect(r.rect, 0.1, r.outdoor ? 0.2 : 3.0, tone[r.zone]);
  }

  if (mode === 'circulation') {
    // circulation review: route ribbons by hierarchy, entrance zones, vehicle crossings and
    // their sight triangles, with labels — drawn over everything, above the paving
    const Y = 1.2;
    const ribbons = [];   // [pts, width, color]
    const colour = { P1: '#f47321', S1: '#c0392b', S2: '#c0392b', ARC: '#8e5bd6' };
    for (const r of ROUTES) ribbons.push([routeCentreline(r), r.type === 'primary' ? 1.6 : 0.9, colour[r.id] || '#6b4bd6']);
    const ring = Array.from({ length: 73 }, (_, k) => [FOUNTAIN_CENTRE[0] + (PLAZA_R - 3.2) * Math.cos((k / 72) * Math.PI * 2), FOUNTAIN_CENTRE[1] + (PLAZA_R - 3.2) * Math.sin((k / 72) * Math.PI * 2)]);
    ribbons.push([ring, 1.2, '#1f8fd6']);
    for (const [pts, w, color] of ribbons) {
      const pos = [];
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        const l = Math.hypot(bx - ax, bz - az) || 1, nx = (-(bz - az) / l) * (w / 2), nz = ((bx - ax) / l) * (w / 2);
        pos.push(ax + nx, Y, az + nz, bx + nx, Y, bz + nz, bx - nx, Y, bz - nz, ax + nx, Y, az + nz, bx - nx, Y, bz - nz, ax - nx, Y, az - nz);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85, toneMapped: false }));
      m.renderOrder = 12;
      group.add(m);
    }
    for (const e of ENTRANCES) lines.push([e.poly.map(([x, z]) => [x, Y, z]), '#12a36b']);
    for (const c of CROSSINGS) {
      const [a0, a1] = c.span;
      const r = c.side === 'n' ? [a0, a1, -59.5, -55.25] : c.side === 's' ? [a0, a1, 55.25, 59.5] : c.side === 'e' ? [80, 84.2, a0, a1] : [-84.2, -80, a0, a1];
      rect(r, 0.4, 1.4, '#f2c200');
    }
    for (const sz of sightZones()) lines.push([[[sz.rect[0], Y, sz.rect[2]], [sz.rect[1], Y, sz.rect[2]], [sz.rect[1], Y, sz.rect[3]], [sz.rect[0], Y, sz.rect[3]]], '#c89a00']);
    for (const n of Object.values(NODES).filter((q) => q.kind === 'door')) rect([n.at[0] - 0.7, n.at[0] + 0.7, n.at[1] - 0.7, n.at[1] + 0.7], 0.5, 1.5, '#12a36b');
    const label = (text, x, z, color = '#1f1d18', size = 4.2) => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const font = '600 44px system-ui, sans-serif';
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + 28;
      c.width = w; c.height = 64;
      ctx.font = font;
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, 0, w, 64);
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, w - 5, 59);
      ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, 34);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, toneMapped: false }));
      sp.scale.set((size * w) / 64, size, 1);
      sp.position.set(x, 3, z);
      sp.renderOrder = 14;
      group.add(sp);
    };
    label('CENTRAL PROMENADE', 40, 5.5, '#f47321');
    label('GALLERIA', -51, 15.15, '#f47321', 3.6);
    label('N–S SPINE', -11.25, -30, '#c0392b');
    label('SPINE (park gate)', 0, 48, '#c0392b', 3.4);
    label('FOUNTAIN LOOP', 0, 20.5, '#1f8fd6', 3.6);
    label('PODIUM ARCADE', -28, 38, '#8e5bd6', 3.2);
    label('RETAIL LINK', -20, 25.4, '#6b4bd6', 3.0);
    label('OFFICE LINK', 14.5, 41.5, '#6b4bd6', 3.0);
    label('HOTEL LINK', 14.5, 12.4, '#6b4bd6', 3.0);
    label('OFFICE WALK', 20.5, 27, '#6b4bd6', 3.0);
    label('HOTEL FRONTAGE', 28, -6.5, '#6b4bd6', 3.0);
    label('GARDEN WALK', 71.3, -9, '#6b4bd6', 3.0);
    label('PASEO CROSS WALKS', -18, -41, '#6b4bd6', 3.0);
    for (const c of CROSSINGS) {
      const m = (c.span[0] + c.span[1]) / 2;
      const [x, z] = c.side === 'n' ? [m, -63.5] : c.side === 's' ? [m, 63.5] : c.side === 'e' ? [89, m] : [-89, m];
      label(`${c.id} ${c.name}`, x, z, '#9a7400', 2.6);
    }
  }

  if (boxes.length) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    boxes.forEach(([x0, x1, y0, y1, z0, z1, color], i) => {
      m.makeScale(Math.max(0.05, x1 - x0), Math.max(0.05, y1 - y0), Math.max(0.05, z1 - z0)).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(color));
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    group.add(mesh);
  }
  for (const [pts, color] of lines) {
    const g = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
    l.renderOrder = 11;
    group.add(l);
  }
  return group;
}
