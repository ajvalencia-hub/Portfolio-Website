// QA overlay (?heroPlan=structure | parking | boh | deck | all): draws the
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
