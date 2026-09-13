// Program and geometry analysis for the site plan: structure alignment, parking
// stalls counted from modelled positions, pool clearances, walkable routes and the
// hotel back-of-house graph. Used by tools/hero3d/audit.mjs (validation register)
// and by the ?heroPlan QA overlay. Geometric checks only — none of this is a code,
// egress, structural or zoning compliance check.
import {
  FLOOR, GROUND, OFFICE_FLOOR, PODIUM_TOP, DECK_Y, clamp, offsetPlan, insidePlan, arcSamples,
  polygonArea, rayRadius, inRect, rectOverlap,
} from './core.js';
import { PODIUM_PLAN, PODIUM_PARKING, POOL, SPA } from './residential.js';
import { OFFICE_GRID, OFFICE_BLOCKS, OFFICE_CORE, OFFICE_PARKING, OFFICE_BASE_RECT, OFFICE_BASE_TOP, OFFICE_PLANTERS, OFFICE_TERRACES, PLANTER } from './office.js';
import { HOTEL, HOTEL_GROUND, HOTEL_DOORS, HOTEL_FRONT_TOP, HOTEL_CENTRE_TOP, HOTEL_WING_TOP } from './hotel.js';
import { FOUNTAIN, PARK_PATHS, CAFE_ZONES } from './park.js';

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const rectArea = (r) => (r[1] - r[0]) * (r[3] - r[2]);
const sq = (x, z, s) => [x - s / 2, x + s / 2, z - s / 2, z + s / 2];
const shrink = (r, d) => [r[0] + d, r[1] - d, r[2] + d, r[3] - d];
const touchLength = (a, b, tol = 0.05) => {
  const ox = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  const oz = Math.min(a[3], b[3]) - Math.max(a[2], b[2]);
  if (ox > tol && oz > tol) return Math.max(ox, oz);             // overlapping
  if (Math.abs(ox) <= tol && oz > 0) return oz;                  // share a vertical edge
  if (Math.abs(oz) <= tol && ox > 0) return ox;                  // share a horizontal edge
  return 0;
};
const bfs = (nodes, edges, start) => {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    for (const [a, b] of edges) {
      const m = a === n ? b : b === n ? a : null;
      if (m && !seen.has(m)) { seen.add(m); queue.push(m); }
    }
  }
  return seen;
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
function towerStructure(plan) {
  return plan.meta.towers.map((t) => {
    const body = plan.curved.find((c) => c.name === t.body);
    const ph1 = plan.curved.find((c) => c.name === `${t.id}.ph1`);
    const ph2 = plan.curved.find((c) => c.name === `${t.id}.ph2`);
    const cols = t.columns;
    const issues = [];
    const spans = cols.map((c, k) => { const d = cols[(k + 1) % cols.length]; return Math.hypot(c[0] - d[0], c[1] - d[1]); });
    // columns inside every occupied floorplate, clear of the core
    body.floorPlans.forEach((fp, g) => {
      const inset = offsetPlan(fp, -0.3);
      cols.forEach(([x, z]) => { if (!insidePlan(x, z, inset)) issues.push(`column (${round(x, 1)}, ${round(z, 1)}) not 0.3 m inside floor ${g + 1}`); });
      t.core.forEach(([x, z]) => { if (!insidePlan(x, z, offsetPlan(fp, -0.5))) issues.push(`core outside floor ${g + 1}`); });
    });
    cols.forEach(([x, z]) => { if (insidePlan(x, z, offsetPlan(t.core, 1.0))) issues.push(`column (${round(x, 1)}, ${round(z, 1)}) within 1 m of core`); });
    // floor-to-floor lean of the glass line
    let maxStep = 0;
    for (let g = 1; g < body.floorPlans.length; g++) {
      body.floorPlans[g].forEach(([x, z], i) => {
        const [px, pz] = body.floorPlans[g - 1][i];
        maxStep = Math.max(maxStep, Math.hypot(x - px, z - pz));
      });
    }
    // slab cantilever beyond the column polygon, measured radially from the core centre
    let maxCant = 0, minDepth = Infinity;
    body.slabs.floors.forEach((f, g) => {
      const encl = body.floorPlans[g];
      f.outer.forEach(([x, z], i) => {
        const a = Math.atan2(z - t.cz, x - t.cx);
        const r = Math.hypot(x - t.cx, z - t.cz);
        maxCant = Math.max(maxCant, r - rayRadius(t.cx, t.cz, cols, a));
        if (g < body.slabs.floors.length - 1) minDepth = Math.min(minDepth, r - Math.hypot(encl[i][0] - t.cx, encl[i][1] - t.cz));
      });
    });
    // core-to-column flat-plate span
    let maxCoreSpan = 0;
    cols.forEach(([x, z]) => {
      const a = Math.atan2(z - t.cz, x - t.cx);
      maxCoreSpan = Math.max(maxCoreSpan, Math.hypot(x - t.cx, z - t.cz) - rayRadius(t.cx, t.cz, t.core, a));
    });
    // penthouses: lower glass inside the column ring with a walkable terrace, eave covers
    // the columns, core continues through the upper penthouse
    cols.forEach(([x, z]) => {
      if (insidePlan(x, z, offsetPlan(ph1.pts, 1.2))) issues.push(`terrace column (${round(x, 1)}, ${round(z, 1)}) within 1.2 m of penthouse glass`);
      if (!insidePlan(x, z, offsetPlan(ph1.slabs.floors[0].outer, -0.3))) issues.push(`terrace column (${round(x, 1)}, ${round(z, 1)}) not under the eave`);
    });
    t.core.forEach(([x, z]) => { if (!insidePlan(x, z, offsetPlan(ph2.pts, -0.3))) issues.push('core does not fit inside the upper penthouse'); });
    // columns and cores clear of drive aisles, ramp and ground aisles
    const drive = [...PODIUM_PARKING.aisles, ...PODIUM_PARKING.ground.aisles].map((a) => ({ name: a.name, rect: a.rect }));
    drive.push({ name: 'ramp lanes', rect: PODIUM_PARKING.ramp.rect });
    cols.forEach(([x, z]) => drive.forEach((a) => { if (rectOverlap(sq(x, z, t.columnSize), a.rect)) issues.push(`column (${round(x, 1)}, ${round(z, 1)}) in ${a.name}`); }));
    drive.forEach((a) => { if (t.core.some(([x, z]) => inRect(x, z, a.rect))) issues.push(`core in ${a.name}`); });
    const longSpans = spans.map((d, k) => ({ d, k })).filter((s) => s.d > 9.0).map((s) => {
      const a = cols[s.k], b = cols[(s.k + 1) % cols.length];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const over = drive.find((d) => inRect(mid[0], mid[1], d.rect, 2.5));
      return { span: round(s.d, 1), from: a.map((v) => round(v, 1)), to: b.map((v) => round(v, 1)), reason: over ? `ring crosses ${over.name}` : 'ring geometry' };
    });
    return {
      id: t.id, floors: t.floors, columns: cols.length, columnSize: t.columnSize,
      maxColumnSpacing: round(Math.max(...spans), 1), longSpans,
      maxCantilever: round(maxCant, 2), limit: t.maxCantilever, minBalconyDepth: round(minDepth, 2),
      maxCoreToColumnSpan: round(maxCoreSpan, 1), maxLeanStep: round(maxStep, 3),
      core: t.core, coreArea: round(polygonArea(t.core), 0),
      columnBaseY: 0, columnTopY: round(t.columnTopY, 2),
      transfers: t.transfers.map((tr) => ({ ...tr, outer: undefined, inner: undefined, area: round(polygonArea(tr.outer) - polygonArea(tr.inner), 0) })),
      issues,
    };
  });
}

function officeStructure() {
  const issues = [];
  const lines = (b) => ({ x: OFFICE_GRID.x.filter((v) => v >= b.cols.x[0] - 1e-6 && v <= b.cols.x[1] + 1e-6), z: OFFICE_GRID.z.filter((v) => v >= b.cols.z[0] - 1e-6 && v <= b.cols.z[1] + 1e-6) });
  const baseLines = { x: OFFICE_GRID.x, z: OFFICE_GRID.z };
  const rows = [];
  OFFICE_BLOCKS.forEach((b, k) => {
    const below = k ? OFFICE_BLOCKS[k - 1] : null;
    const L = lines(b), B = below ? lines(below) : baseLines;
    const continuous = L.x.every((v) => B.x.includes(v)) && L.z.every((v) => B.z.includes(v));
    if (!continuous) issues.push(`${b.name} has column lines not present in the block below (transfer needed)`);
    if (!OFFICE_GRID.x.includes(b.cols.x[0]) || !OFFICE_GRID.x.includes(b.cols.x[1]) || !OFFICE_GRID.z.includes(b.cols.z[0]) || !OFFICE_GRID.z.includes(b.cols.z[1])) issues.push(`${b.name} column extents off the grid`);
    const edges = Object.values(b.edges);
    if (Math.max(...edges) > 3.0) issues.push(`${b.name} slab edge cantilever ${Math.max(...edges)} m exceeds 3.0 m`);
    let projection = null;
    if (below) {
      const p = [below.rect[0] - b.rect[0], b.rect[1] - below.rect[1], below.rect[2] - b.rect[2], b.rect[3] - below.rect[3]];
      projection = Math.max(...p);
      if (projection > 2.41) issues.push(`${b.name} projects ${projection} m past ${below.name}`);
      if (!p.some((v) => v >= 1.0)) issues.push(`${b.name} does not project past ${below.name}`);
    }
    const [c0, c1, c2, c3] = OFFICE_CORE;
    if (!(c0 >= b.rect[0] && c1 <= b.rect[1] && c2 >= b.rect[2] && c3 <= b.rect[3])) issues.push(`office core not inside ${b.name}`);
    rows.push({ name: b.name, rect: b.rect, edges: b.edges, maxCantilever: Math.max(...edges), projection: projection == null ? null : round(projection, 2), columnLines: `${L.x.length} × ${L.z.length}`, continuous });
  });
  // office columns vs parking aisles and car lifts
  const cols = [];
  for (const x of OFFICE_GRID.x) for (const z of OFFICE_GRID.z) if (inRect(x, z, OFFICE_BASE_RECT)) cols.push([x, z]);
  const drive = [...OFFICE_PARKING.aisles.map((a) => a.rect), OFFICE_PARKING.lifts.rect];
  cols.forEach(([x, z]) => { if (drive.some((r) => rectOverlap(sq(x, z, 0.6), r))) issues.push(`office column (${x}, ${z}) in a drive aisle or lift`); });
  if (drive.some((r) => rectOverlap(OFFICE_CORE, r))) issues.push('office core in a drive aisle');
  return { blocks: rows, columns: cols, transfersRequired: rows.some((r) => !r.continuous), issues };
}

// ---------------------------------------------------------------------------
// Parking: stalls generated along modelled aisles and rejected by obstacles
// ---------------------------------------------------------------------------
const STALL = { w: 2.6, d: 5.4 };

function aisleGraph(aisles, extras = []) {
  const nodes = [...aisles.map((a) => a.name), ...extras.map((e) => e.name)];
  const all = [...aisles, ...extras];
  const edges = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (touchLength(all[i].rect, all[j].rect) >= 3.0) edges.push([all[i].name, all[j].name]);
  }
  return { nodes, edges };
}

function podiumParking(plan) {
  const P = PODIUM_PARKING;
  const towers = plan.meta.towers;
  const levelPoly = offsetPlan(PODIUM_PLAN, -0.6);
  const linerPoly = offsetPlan(PODIUM_PLAN, -(0.6 + P.linerDepth));
  const boundary = arcSamples(PODIUM_PLAN, 1.0);
  const inLiner = (x, z) => {
    if (insidePlan(x, z, linerPoly)) return false;
    let best = null, bd = Infinity;
    for (const s of boundary) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best.nz > 0.35 || best.nx > 0.55;
  };
  // podium interior columns on the module lines, outside tower rings, aisles and the ramp
  const inner = offsetPlan(PODIUM_PLAN, -1.0);
  const podiumCols = [];
  for (const x of P.columnLines) {
    for (let z = P.columnOrigin - P.columnStep * 6; z <= 50; z += P.columnStep) {
      if (!insidePlan(x, z, inner)) continue;
      if (P.aisles.some((a) => inRect(x, z, a.rect, 0.4))) continue;
      if (inRect(x, z, P.ramp.rect, 0.4) && Math.abs(x + 42.1) > 0.01) continue;
      if (towers.some((t) => insidePlan(x, z, offsetPlan(t.columns, 1.5)) || t.columns.some((c) => Math.hypot(c[0] - x, c[1] - z) < 3))) continue;
      podiumCols.push([x, z]);
    }
  }
  const allCols = [...podiumCols, ...towers.flatMap((t) => t.columns)];
  const cores = [...towers.map((t) => ({ name: `${t.id} core`, poly: t.core })), ...P.cores.map((c) => ({ name: c.name, rect: c.rect }))];
  const graph = aisleGraph(P.aisles, [{ name: 'ramp', rect: P.ramp.rect }]);
  const reachable = bfs(graph.nodes, graph.edges, 'ramp');
  const aisleIssues = [];
  for (const a of P.aisles) {
    const corners = [[a.rect[0], a.rect[2]], [a.rect[1], a.rect[2]], [a.rect[1], a.rect[3]], [a.rect[0], a.rect[3]]];
    if (!corners.every(([x, z]) => insidePlan(x, z, levelPoly))) aisleIssues.push(`${a.name} extends outside the parking level`);
    if (allCols.some(([x, z]) => rectOverlap(sq(x, z, 0.6), a.rect))) aisleIssues.push(`${a.name} obstructed by a column`);
    if (cores.some((c) => (c.rect ? rectOverlap(c.rect, a.rect) : c.poly.some(([x, z]) => inRect(x, z, a.rect))))) aisleIssues.push(`${a.name} obstructed by a core`);
    if (!reachable.has(a.name)) aisleIssues.push(`${a.name} not connected to the ramp`);
  }
  // pool basin over L3
  const basin = offsetPlan(plan.meta.pool.outline, 0.35);
  const poolClear = POOL.basinSoffitY - P.levels[1].floor - POOL.mepAllowance;

  const levels = P.levels.map((lv, li) => {
    const stalls = [];
    const rejected = {};
    const reject = (why) => { rejected[why] = (rejected[why] || 0) + 1; };
    for (const row of P.stallRows) {
      for (const an of [].concat(row.aisle)) {
        const a = P.aisles.find((q) => q.name === an);
        const zStart = P.columnOrigin + Math.floor((a.rect[2] - P.columnOrigin) / P.columnStep) * P.columnStep;
        for (let zc = zStart; zc < a.rect[3]; zc += P.columnStep) {
          for (let k = 0; k < 3; k++) {
            const z0 = zc + 0.3 + k * STALL.w, z1 = z0 + STALL.w;
            if (z0 < a.rect[2] - 1e-6 || z1 > a.rect[3] + 1e-6) continue;       // outside the aisle's reach
            const r = [row.x[0], row.x[1], z0, z1];
            const cs = [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]];
            const t = shrink(r, 0.05);
            if (!cs.every(([x, z]) => insidePlan(x, z, levelPoly))) { reject('outside level edge'); continue; }
            if (cs.some(([x, z]) => inLiner(x, z))) { reject('occupied liner'); continue; }
            if (P.aisles.some((q) => rectOverlap(t, q.rect))) { reject('cross aisle'); continue; }
            if (rectOverlap(t, P.ramp.rect)) { reject('ramp'); continue; }
            if (allCols.some(([x, z]) => rectOverlap(t, sq(x, z, 0.6)))) { reject('column'); continue; }
            if (cores.some((c) => (c.rect ? rectOverlap(t, c.rect) : c.poly.some(([x, z]) => inRect(x, z, t)) || cs.some(([x, z]) => insidePlan(x, z, c.poly))))) { reject('core'); continue; }
            if (!reachable.has(a.name)) { reject('aisle not connected'); continue; }
            if (li === 1 && poolClear < POOL.carClearance && cs.some(([x, z]) => insidePlan(x, z, basin))) { reject('pool basin clearance'); continue; }
            stalls.push(r);
          }
        }
      }
    }
    return { name: lv.name, floor: lv.floor, stalls, count: stalls.length, rejected };
  });

  // stacked switchback ramp: slopes and headroom between runs above one another
  const R = P.ramp;
  const ramps = R.rises.map((rise, k) => ({ from: k === 0 ? 'ground' : P.levels[k - 1].name, to: P.levels[k].name, rise, runLength: 2 * R.run, slope: round((rise / (2 * R.run)) * 100, 1) }));
  const headroom = round(FLOOR - P.slab, 2);  // runs stacked one level apart (see site plan notes)
  const poolOverDrive = P.aisles.filter((a) => basin.some(([x, z]) => inRect(x, z, a.rect)) || [[a.rect[0], a.rect[2]], [a.rect[1], a.rect[3]]].some(([x, z]) => insidePlan(x, z, basin))).map((a) => a.name);
  const basinConflicts = [
    ...plan.meta.towers.flatMap((t) => t.columns.filter(([x, z]) => insidePlan(x, z, offsetPlan(basin, 0.5))).map(() => `${t.id} column`)),
    ...plan.meta.towers.filter((t) => t.core.some(([x, z]) => insidePlan(x, z, basin))).map((t) => `${t.id} core`),
    ...(basin.some(([x, z]) => inRect(x, z, R.rect)) ? ['ramp'] : []),
    ...P.cores.filter((c) => basin.some(([x, z]) => inRect(x, z, c.rect))).map((c) => c.name),
  ];
  const groundGraph = aisleGraph(P.ground.aisles, [{ name: 'ramp', rect: R.rect }, { name: 'portal', rect: [P.entry.portal[0], P.entry.portal[1], P.entry.z - 1.2, P.entry.z] }]);
  const groundReach = bfs(groundGraph.nodes, groundGraph.edges, 'portal');
  const groundIssues = [];
  if (!groundReach.has('ramp')) groundIssues.push('ground approach does not connect the portal to the ramp');
  for (const room of P.ground.rooms) for (const a of P.ground.aisles) if (rectOverlap(shrink(room.rect, 0.05), a.rect)) groundIssues.push(`${room.name} overlaps ${a.name}`);
  if (!(P.entry.portal[0] >= P.ground.aisles[0].rect[0] - 1e-6 && P.entry.portal[1] <= P.ground.aisles[0].rect[1] + 1e-6)) groundIssues.push('garage portal wider than the entry aisle');

  return {
    levels, total: levels.reduce((a, l) => a + l.count, 0), podiumColumns: podiumCols, ramps, rampHeadroom: headroom,
    aisleIssues, groundIssues, graph,
    pool: {
      basinSoffitY: round(POOL.basinSoffitY, 2), levelBelow: P.levels[1].name, clearHeight: round(poolClear, 2), required: POOL.carClearance,
      clearOk: poolClear >= POOL.carClearance, overDrive: poolOverDrive, conflicts: basinConflicts,
      supportingColumns: podiumCols.filter(([x, z]) => insidePlan(x, z, offsetPlan(basin, 1.0))).length,
    },
  };
}

function officeParking() {
  const P = OFFICE_PARKING;
  const cols = [];
  for (const x of OFFICE_GRID.x) for (const z of OFFICE_GRID.z) if (inRect(x, z, OFFICE_BASE_RECT)) cols.push([x, z]);
  const graph = aisleGraph(P.aisles, [{ name: 'lifts', rect: P.lifts.rect }]);
  const reachable = bfs(graph.nodes, graph.edges, 'lifts');
  const aisleIssues = [];
  for (const a of P.aisles) {
    if (!reachable.has(a.name)) aisleIssues.push(`${a.name} not connected to the car lifts`);
    if (cols.some(([x, z]) => rectOverlap(sq(x, z, 0.6), a.rect))) aisleIssues.push(`${a.name} obstructed by a column`);
    if (rectOverlap(OFFICE_CORE, a.rect)) aisleIssues.push(`${a.name} obstructed by the core`);
  }
  const levels = P.levels.map((lv) => {
    const stalls = [];
    const rejected = {};
    const reject = (why) => { rejected[why] = (rejected[why] || 0) + 1; };
    for (const row of P.stallRows) {
      const a = P.aisles.find((q) => q.name === row.aisle);
      for (let k = 0; k < OFFICE_GRID.z.length - 1; k++) {
        const zA = OFFICE_GRID.z[k], zB = OFFICE_GRID.z[k + 1];
        const n = Math.floor((zB - zA - 0.6) / STALL.w);
        for (let j = 0; j < n; j++) {
          const z0 = zA + 0.3 + j * STALL.w, z1 = z0 + STALL.w;
          if (z0 < a.rect[2] - 1e-6 || z1 > a.rect[3] + 1e-6) continue;
          const r = [row.x[0], row.x[1], z0, z1];
          const t = shrink(r, 0.05);
          if (!(r[0] >= P.zone[0] - 1e-6 && r[1] <= P.zone[1] + 1e-6 && r[2] >= P.zone[2] - 1e-6 && r[3] <= P.zone[3] + 1e-6)) { reject('outside parking zone / liner'); continue; }
          if (P.aisles.some((q) => rectOverlap(t, q.rect))) { reject('cross aisle'); continue; }
          if (rectOverlap(t, P.lifts.rect)) { reject('car lifts'); continue; }
          if (cols.some(([x, z]) => rectOverlap(t, sq(x, z, 0.6)))) { reject('column'); continue; }
          if (rectOverlap(t, OFFICE_CORE)) { reject('core'); continue; }
          if (!reachable.has(a.name)) { reject('aisle not connected'); continue; }
          stalls.push(r);
        }
      }
    }
    return { name: lv.name, floor: lv.floor, stalls, count: stalls.length, rejected };
  });
  return { levels, total: levels.reduce((a, l) => a + l.count, 0), aisleIssues, lifts: 2 };
}

// ---------------------------------------------------------------------------
// Walkable routes on a 0.5 m grid (obstacles dilated for a clear width)
// ---------------------------------------------------------------------------
function footprint(q) {
  const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0);
  if (q.shape === 'cyl') return { circle: [q.x, q.z, q.sx / 2] };
  return { poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [q.x + (u * q.sx / 2) * c + (v * q.sz / 2) * s, q.z - (u * q.sx / 2) * s + (v * q.sz / 2) * c]) };
}
function distToPoly(x, z, poly) {
  if (insidePlan(x, z, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ez = bz - az;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return best;
}

function gridRoutes({ bounds, walkable, obstacles, clear, nodes, start, step = 0.5, transitionOk }) {
  const [x0, x1, z0, z1] = bounds;
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const free = new Uint8Array(nx * nz);
  const level = new Int8Array(nx * nz);
  const cx = (i) => x0 + (i + 0.5) * step, cz = (j) => z0 + (j + 0.5) * step;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), z = cz(j);
    const w = walkable(x, z);
    if (w === false) continue;
    level[j * nx + i] = w === true ? 0 : w;
    let ok = true;
    for (const o of obstacles) {
      const r = clear / 2;
      if (o.bbox && (x < o.bbox[0] - r || x > o.bbox[1] + r || z < o.bbox[2] - r || z > o.bbox[3] + r)) continue;
      const d = o.circle ? Math.hypot(x - o.circle[0], z - o.circle[1]) - o.circle[2] : distToPoly(x, z, o.poly);
      if (d < r) { ok = false; break; }
    }
    free[j * nx + i] = ok ? 1 : 0;
  }
  const cell = ([x, z]) => {
    const i = Math.floor((x - x0) / step), j = Math.floor((z - z0) / step);
    // nearest free cell within 1.5 m
    let best = -1, bd = Infinity;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || !free[jj * nx + ii]) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = jj * nx + ii; }
    }
    return best;
  };
  const seen = new Uint8Array(nx * nz);
  const s0 = cell(start.at);
  const queue = s0 >= 0 ? [s0] : [];
  if (s0 >= 0) seen[s0] = 1;
  while (queue.length) {
    const c = queue.shift();
    const i = c % nx, j = (c - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const n = jj * nx + ii;
      if (seen[n] || !free[n]) continue;
      if (level[n] !== level[c] && !(transitionOk && transitionOk(cx(i), cz(j), cx(ii), cz(jj)))) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return nodes.map((nd) => { const c = cell(nd.at); return { name: nd.name, reachable: c >= 0 && !!seen[c], placed: c >= 0 }; });
}

function obstaclesFrom(parts, yMin, yMax, filter = () => true) {
  return parts.filter((q) => {
    const base = q.y - q.sy / 2, top = q.y + q.sy / 2;
    return base >= yMin - 0.05 && base <= yMax && top - base > 0.2 && filter(q);
  }).map((q) => {
    const f = footprint(q);
    const pts = f.poly || [[f.circle[0] - f.circle[2], f.circle[1] - f.circle[2]], [f.circle[0] + f.circle[2], f.circle[1] + f.circle[2]]];
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    return { ...f, bbox: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], part: q };
  });
}

function deckRoutes(plan) {
  const deckIn = offsetPlan(PODIUM_PLAN, -0.5);
  const terrace = POOL.terrace;
  const walk = plan.boxes.find((b) => b.name === 'L.walk');
  const body = (id) => plan.curved.find((c) => c.name === `${id}.body`).floorPlans[0];
  const [t1, t2] = [body('A.t1'), body('A.t2')];
  const deckParts = plan.parts.filter((q) => q.color !== 'deck' && !(q.shape === 'cone' && q.y - q.sy / 2 > DECK_Y + 1.8));
  const obstacles = [
    ...obstaclesFrom(deckParts, DECK_Y - 0.5, POOL.terraceY + 0.1, (q) => insidePlan(q.x, q.z, PODIUM_PLAN)),
    { poly: offsetPlan(plan.meta.pool.outline, 0.5), bbox: [-73, -47, -7.5, 7.5] },
    { circle: [SPA.x, SPA.z, SPA.r + SPA.coping], bbox: [SPA.x - 2, SPA.x + 2, SPA.z - 2, SPA.z + 2] },
    { poly: t1, bbox: [-68, -36, -45, -13] }, { poly: t2, bbox: [-68, -34, 12, 44] },
  ];
  const steps = [-46.2, -45.2, -10.1, 10.1];
  const rampRect = [-60.6, -54.8, 12.3, 14.2];
  const transitionOk = (ax, az, bx, bz) => inRect((ax + bx) / 2, (az + bz) / 2, steps) || inRect((ax + bx) / 2, (az + bz) / 2, rampRect);
  const walkable = (x, z) => (insidePlan(x, z, deckIn) ? (insidePlan(x, z, terrace) ? 1 : true) : false);
  const doorOn = (pl, zFrom, dir) => { let z = zFrom; while (insidePlan(walk.x, z, pl)) z += dir * 0.2; return [walk.x, z + dir * 0.6]; };
  const nodes = [
    { name: 'Tower 1 deck lobby', at: doorOn(t1, walk.z - walk.d / 2, 1) },
    { name: 'Tower 2 deck lobby', at: doorOn(t2, walk.z + walk.d / 2, -1) },
    { name: 'Podium stair + lift (east)', at: [-34.4, 0.1] },
    { name: 'Podium stair (north-west)', at: [-70.4, -18.5] },
    { name: 'Pool terrace (east end, beside the sun shelf)', at: [-47.0, 0] },
    { name: 'Pool terrace (west end, entry steps)', at: [-73.0, 0] },
    { name: 'North lounging row', at: [-59.5, -7.4] },
    { name: 'South lounging row', at: [-59.5, 7.4] },
    { name: 'Outdoor dining + barbecue', at: [-40.0, -8.2] },
    { name: 'Shaded lounge', at: [-40.0, 9.5] },
    { name: 'Wellness terrace + spa', at: [-57.5, 39.2] },
    { name: 'Quiet garden', at: [-52.0, -46.2] },
  ];
  const routes = gridRoutes({ bounds: [-77, -25, -52, 50], walkable, obstacles, clear: 1.5, nodes, start: nodes[0], transitionOk });
  // planter maintenance access: a 0.9 m clear strip beside at least one long side
  const planters = deckParts.filter((q) => q.shape === 'box' && q.color === 'frame' && q.phase === 'context' && q.sy >= 0.5 && q.sy <= 1.0 && insidePlan(q.x, q.z, PODIUM_PLAN));
  const others = obstacles.filter((o) => o.part);
  let noAccess = 0;
  const missing = [];
  for (const p of planters) {
    const f = footprint(p).poly;
    const sides = [0, 1, 2, 3].map((k) => {
      const [ax, az] = f[k], [bx, bz] = f[(k + 1) % 4];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ox = mx - p.x, oz = mz - p.z, ol = Math.hypot(ox, oz) || 1;
      const probe = [mx + (ox / ol) * 0.6, mz + (oz / ol) * 0.6];
      const ok = walkable(...probe) !== false && !others.some((o) => o.part !== p && (o.circle ? Math.hypot(probe[0] - o.circle[0], probe[1] - o.circle[1]) < o.circle[2] + 0.45 : distToPoly(probe[0], probe[1], o.poly) < 0.45));
      return ok;
    });
    if (!sides.some(Boolean)) { noAccess++; missing.push([round(p.x, 1), round(p.z, 1)]); }
  }
  return { routes, clearWidth: 1.5, planters: planters.length, plantersWithoutAccess: noAccess, plantersWithoutAccessAt: missing };
}

function parkRoutes(plan) {
  const parts = plan.parts.filter((q) => q.y - q.sy / 2 < 0.2 && q.x > -27 && q.x < 23 && q.z > 0 && q.z < 56 && q.color !== 'terrazzo');
  const obstacles = [
    ...obstaclesFrom(parts, -0.1, 0.2),
    { circle: [FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.basin + FOUNTAIN.coping], bbox: [-9, 9, 19, 37] },
    ...plan.palms.filter((p) => p.y === 0 && p.x > -27 && p.x < 23 && p.z > 0 && p.z < 56).map((p) => ({ circle: [p.x, p.z, 0.35], bbox: [p.x - 1, p.x + 1, p.z - 1, p.z + 1] })),
  ];
  const podium = offsetPlan(PODIUM_PLAN, -3.5);   // storefront line; the arcade is walkable
  const walkable = (x, z) => !insidePlan(x, z, podium) && !(x > 22 && z > 14) && z > -2;
  const nodes = [
    { name: 'Podium retail arcade', at: [-27.5, 20] },
    { name: 'Hotel entrance canopy', at: [28, 2.8] },
    { name: 'Office lobby', at: [22.8, 46.0] },
    { name: 'South street', at: [0, 55] },
    { name: 'Fountain benches', at: [0, 39.6] },
    { name: 'Paseo (north)', at: [-24, 1] },
  ];
  const routes = gridRoutes({ bounds: [-30, 40, -3, 57], walkable, obstacles, clear: 1.5, nodes, start: nodes[0] });
  // café seating kept off the through routes
  const pathRects = PARK_PATHS.map((p) => ({ name: p.name, p }));
  const cafeParts = plan.parts.filter((q) => q.y < 1.2 && CAFE_ZONES.some((c) => inRect(q.x, q.z, c.rect, 0.01)));
  let onPath = 0;
  for (const q of cafeParts) {
    for (const { p } of pathRects) {
      const dx = q.x - p.from[0], dz = q.z - p.from[1];
      const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
      const u = (dx * (p.to[0] - p.from[0]) + dz * (p.to[1] - p.from[1])) / len;
      const v = Math.abs(-dx * (p.to[1] - p.from[1]) + dz * (p.to[0] - p.from[0])) / len;
      if (u > 0 && u < len && v < p.width / 2 + 0.3) onPath++;
    }
    if (q.x > -26 && q.x < -22) onPath++;   // paseo
  }
  return { routes, cafeZones: CAFE_ZONES.length, cafePartsOnRoutes: onPath };
}

// ---------------------------------------------------------------------------
// Hotel back of house
// ---------------------------------------------------------------------------
function hotelGraph() {
  const rooms = HOTEL_GROUND;
  const edges = [];
  const interfaces = [];
  const overlaps = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j];
    if (a.within === b.name || b.within === a.name) { edges.push([a.name, b.name]); continue; }
    const ox = Math.min(a.rect[1], b.rect[1]) - Math.max(a.rect[0], b.rect[0]);
    const oz = Math.min(a.rect[3], b.rect[3]) - Math.max(a.rect[2], b.rect[2]);
    if (ox > 0.05 && oz > 0.05) overlaps.push(`${a.name} ↔ ${b.name}`);
    const crossZone = (a.zone === 'service') !== (b.zone === 'service');
    if (touchLength(a.rect, b.rect) >= 1.0 && !crossZone) edges.push([a.name, b.name]);
  }
  for (const [a, b] of HOTEL_DOORS) {
    const ra = rooms.find((r) => r.name === a), rb = rooms.find((r) => r.name === b);
    if (!ra || !rb || touchLength(ra.rect, rb.rect) < 1.0) { overlaps.push(`declared door ${a} ↔ ${b} has no shared wall`); continue; }
    edges.push([a, b]);
    interfaces.push(`${a} ↔ ${b}`);
  }
  const serviceEdges = edges.filter(([a, b]) => rooms.find((r) => r.name === a).zone === 'service' && rooms.find((r) => r.name === b).zone === 'service');
  const guestEdges = edges.filter(([a, b]) => rooms.find((r) => r.name === a).zone !== 'service' && rooms.find((r) => r.name === b).zone !== 'service');
  const svc = bfs(null, serviceEdges, 'Receiving + loading dock');
  const guest = bfs(null, guestEdges, 'Porte-cochère');
  // service must not be able to reach guest rooms except through declared doors
  const leak = [...bfs(null, edges.filter(([a, b]) => !HOTEL_DOORS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))), 'Receiving + loading dock')]
    .filter((n) => rooms.find((r) => r.name === n).zone !== 'service');
  const required = ['Refuse + recycling (compactor)', 'Kitchen stores (dry + cold)', 'Staff entrance + security', 'Service elevators (2) + service stair', 'Housekeeping + linen', 'Staff lockers, break room, HR', 'Main electrical / water / fire pump', 'Main kitchen', 'Pool-bar pantry'];
  const guestRequired = ['Arrival lobby + bell desk', 'Lobby + reception', 'Guest elevators (centre)', 'Guest elevators (link)', 'Pool court', 'Restaurant (plaza)', 'Lobby bar + café', 'Fitness + spa changing'];
  const inside = (r, plans) => plans.some((pl) => [[r[0] + 0.2, r[2] + 0.2], [r[1] - 0.2, r[3] - 0.2]].every(([x, z]) => insidePlan(x, z, offsetPlan(pl, 0.3))));
  const outsideBuilding = rooms.filter((r) => !r.outdoor && !r.corridor && !inside(r.rect, [HOTEL.front, HOTEL.centre, HOTEL.rear, HOTEL.link])).map((r) => r.name);
  return {
    rooms: rooms.map((r) => ({ name: r.name, zone: r.zone, area: round(rectArea(r.rect), 0) })),
    serviceReach: required.map((n) => ({ name: n, reachable: svc.has(n) })),
    guestReach: guestRequired.map((n) => ({ name: n, reachable: guest.has(n) })),
    interfaces, overlaps, outsideBuilding, serviceToGuestWithoutDoor: leak,
    serviceDoorsOnStreet: rooms.filter((r) => r.door === 'north').map((r) => r.name),
  };
}

// ---------------------------------------------------------------------------
// Program areas, units and cores (planning estimates)
// ---------------------------------------------------------------------------
export const ASSUMPTIONS = {
  residentialEfficiency: 0.80, unitNSA: { 'A.t1': 120, 'A.t2': 135 }, penthouseUnitsPerTower: 2,
  hotelRoomBay: 3.8, officeEfficiency: 0.85, retailLinerDepth: 8,
  demand: {
    residentialPerUnit: [1.0, 1.5], hotelPerKey: [0.3, 0.6], officePer100m2: [1.0, 2.7], retailPer100m2: [1.5, 3.2],
  },
};

function programMetrics(plan) {
  const towers = plan.meta.towers.map((t) => {
    const body = plan.curved.find((c) => c.name === t.body);
    const ph1 = plan.curved.find((c) => c.name === `${t.id}.ph1`);
    const ph2 = plan.curved.find((c) => c.name === `${t.id}.ph2`);
    const floorAreas = body.floorPlans.map(polygonArea);
    const typ = floorAreas.reduce((a, b) => a + b, 0) / floorAreas.length;
    const gfa = floorAreas.reduce((a, b) => a + b, 0) + polygonArea(ph1.pts) + polygonArea(ph2.pts);
    const coreA = polygonArea(t.core);
    const units = Math.floor(((typ - coreA) * ASSUMPTIONS.residentialEfficiency) / ASSUMPTIONS.unitNSA[t.id]) * t.floors + ASSUMPTIONS.penthouseUnitsPerTower;
    return { id: t.id, floors: t.floors, penthouseLevels: 2, typicalFloorplate: round(typ, 0), gfa: round(gfa, 0), units };
  });
  const bay = ASSUMPTIONS.hotelRoomBay;
  const keys = {
    front: 6 * 2 * Math.floor((60 - 16 - 8) / bay),   // minus centrepiece width and a core
    centre: 9 * 4,
    rear: 5 * Math.floor((68 - 8) / bay),             // single-loaded rooms facing the court
    link: 5 * 2 * Math.floor((21.5 - 8) / bay),
  };
  const hotelGfa = polygonArea(HOTEL.front) * 7 + polygonArea(HOTEL.centre) * 3 + polygonArea(HOTEL.rear) * 6 + polygonArea(HOTEL.link) * 6;
  const officeBlocks = OFFICE_BLOCKS.reduce((a, b) => a + rectArea(b.rect) * 3, 0);
  const officeLiner = (52 * 9 + 36 * 9 - 81) * 2 + 52 * 9 + 36 * 9 - 81 - 9.5 * 9.5;   // S/W liner on ground + two upper floors
  const officeGfa = officeBlocks + officeLiner;
  const retailPodium = (polygonArea(offsetPlan(PODIUM_PLAN, -ARCADE_)) - polygonArea(offsetPlan(PODIUM_PLAN, -(ARCADE_ + ASSUMPTIONS.retailLinerDepth)))) * 0.62;  // S/E/W frontage share
  const hotelFnb = HOTEL_GROUND.filter((r) => r.zone === 'public').reduce((a, r) => a + rectArea(r.rect), 0);
  const officeRetail = 16 * 9;
  return {
    towers,
    residentialUnits: towers.reduce((a, t) => a + t.units, 0),
    hotel: { keys, totalKeys: Object.values(keys).reduce((a, b) => a + b, 0), gfa: round(hotelGfa, 0), floors: { front: 7, centre: 10, rear: 6, link: 6 } },
    office: { gfa: round(officeGfa, 0), nra: round(officeGfa * ASSUMPTIONS.officeEfficiency, 0), blocks: OFFICE_BLOCKS.map((b) => ({ name: b.name, floors: 3, plate: round(rectArea(b.rect), 0) })) },
    retail: { podium: round(retailPodium, 0), hotelFnb: round(hotelFnb, 0), office: officeRetail, total: round(retailPodium + hotelFnb + officeRetail, 0) },
  };
}
const ARCADE_ = 3.5;

function cores(plan) {
  const list = [];
  for (const t of plan.meta.towers) list.push({ building: t.id === 'A.t1' ? 'Tower 1' : 'Tower 2', name: 'central core', stairs: 2, passenger: 3, service: 1, area: round(polygonArea(t.core), 0), continuous: 'ground → upper penthouse roof (checked inside every floorplate)' });
  list.push({ building: 'Residential podium', name: 'east stair + lift', stairs: 1, passenger: 1, service: 0, area: round(rectArea(PODIUM_PARKING.cores[0].rect), 0), continuous: 'ground → amenity deck' });
  list.push({ building: 'Residential podium', name: 'north-west stair', stairs: 1, passenger: 0, service: 0, area: round(rectArea(PODIUM_PARKING.cores[1].rect), 0), continuous: 'ground → amenity deck' });
  list.push({ building: 'Hotel', name: 'centrepiece guest core', stairs: 1, passenger: 3, service: 0, area: 48, continuous: `ground → level 10 (${HOTEL_CENTRE_TOP} m)` });
  list.push({ building: 'Hotel', name: 'link guest core', stairs: 1, passenger: 2, service: 0, area: 21, continuous: `ground → level 6 (${HOTEL_WING_TOP} m)` });
  list.push({ building: 'Hotel', name: 'service core (rear wing)', stairs: 1, passenger: 0, service: 2, area: 36, continuous: `ground → roof overrun (${HOTEL_WING_TOP} m)` });
  list.push({ building: 'Hotel', name: 'west service stair', stairs: 1, passenger: 0, service: 0, area: 12, continuous: 'ground → level 7' });
  list.push({ building: 'Office', name: 'core', stairs: 2, passenger: 3, service: 1, area: round(rectArea(OFFICE_CORE), 0), continuous: 'ground → roof (inside every block and the base)' });
  return list;
}

export function analyseSite(plan) {
  return {
    structure: { towers: towerStructure(plan), office: officeStructure() },
    parking: { residential: podiumParking(plan), office: officeParking() },
    deck: deckRoutes(plan),
    park: parkRoutes(plan),
    hotel: hotelGraph(),
    program: programMetrics(plan),
    cores: cores(plan),
    officePlanters: officePlanterChecks(plan),
  };
}

function officePlanterChecks(plan) {
  const issues = [];
  const furniture = plan.parts.filter((q) => q.phase === 'context' && q.x > 20 && q.z > 12 && q.color !== 'frame' && q.color !== 'planter' && !String(q.color).startsWith('vine') && !String(q.color).startsWith('shrub'));
  for (const p of OFFICE_PLANTERS) {
    const terrace = OFFICE_TERRACES.find((t) => Math.abs(t.y - p.y) < 0.01 && rectOverlap(p.rect, t.rect, 0.2));
    if (!terrace) issues.push(`planter at (${p.rect[0]}, ${p.rect[2]}) is not on a terrace`);
    const near = furniture.filter((q) => Math.abs(q.y - q.sy / 2 - (p.y + 0.3)) < 0.5 && rectOverlap([q.x - q.sx / 2, q.x + q.sx / 2, q.z - q.sz / 2, q.z + q.sz / 2], p.rect, PLANTER.access - 0.01));
    if (near.length) issues.push(`planter at (${p.rect[0]}, ${p.rect[2]}) has furniture within ${PLANTER.access} m`);
  }
  const strands = plan.parts.filter((q) => String(q.color).startsWith('vine'));
  const entrances = [[74, 74, 15, 28, 4.6], [74, 74, 41.5, 48.5, 4.6], [22, 34, 47.5, 53, 5.0]];
  let lowOverEntrance = 0, longOverGlass = 0;
  for (const s of strands) {
    const bottom = s.y - s.sy / 2;
    if (entrances.some(([x0, x1, z0, z1, head]) => s.x > x0 - 1.5 && s.x < x1 + 1.5 && s.z > z0 - 1 && s.z < z1 + 1 && bottom < head + 2.5)) lowOverEntrance++;
    const planter = OFFICE_PLANTERS.find((p) => p.hang && Math.abs(s.y + s.sy / 2 - (p.y + (p.hang.over === 'screen' ? 0.6 : 0.2))) < 0.01 && (p.hang.face === 'e' || p.hang.face === 'w' ? Math.abs(s.x - p.hang.at) < 0.1 : Math.abs(s.z - p.hang.at) < 0.1));
    if (planter && planter.hang.over === 'band' && s.sy > 0.8) longOverGlass++;
  }
  return { planters: OFFICE_PLANTERS.length, strands: strands.length, soil: PLANTER.soil, drainage: PLANTER.drainage, access: PLANTER.access, lowOverEntrance, longOverGlass, issues };
}
