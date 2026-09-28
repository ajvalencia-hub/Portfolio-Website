// Pedestrian circulation analysis for the audit and the QA overlay. It checks the conceptual
// model's own geometry (plan/pedestrian.js and the built plan) — it does not establish ADA,
// Florida Building Code, fire / egress or zoning compliance.
import { HX, HZ, insidePlan, offsetPlan, inRect } from './core.js';
import { NODES, ROUTES, ENTRANCES, CROSSINGS, FURNISHING, SURFACE, PLAZA_R, LOOP_CLEAR, FOUNTAIN_CENTRE, pedestrianGeometry, pavedAt, sightZones, distToPoly } from './pedestrian.js';
import { PODIUM_PLAN } from './residential.js';
import { FOUNTAIN } from './park.js';
import { HOTEL } from './hotel.js';
import { canopyOf } from './planting.js';

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// Paved surfaces of different materials must never overlap: two of them shimmer against each
// other where they meet. Same-material overlaps are invisible — the pattern comes from the
// world position, so both shade identically — and are allowed.
function pavingOverlaps() {
  const { groups } = pedestrianGeometry();
  const polys = [];
  for (const [key, list] of Object.entries(groups)) {
    const material = key.endsWith('Band') ? SURFACE.band.kind : SURFACE[key].kind;
    for (const q of list) {
      const xs = q.pts.map((r) => r[0]), zs = q.pts.map((r) => r[1]);
      polys.push({ id: `${q.owner}[${key}]`, material, pts: q.pts, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
    }
  }
  const out = [];
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
    const a = polys[i], b = polys[j];
    if (a.material === b.material) continue;
    const x0 = Math.max(a.bb[0], b.bb[0]), x1 = Math.min(a.bb[1], b.bb[1]);
    const z0 = Math.max(a.bb[2], b.bb[2]), z1 = Math.min(a.bb[3], b.bb[3]);
    if (x1 <= x0 || z1 <= z0) continue;
    const n = 26, cell = ((x1 - x0) / n) * ((z1 - z0) / n);
    let hit = 0;
    for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
      const x = x0 + ((u + 0.5) * (x1 - x0)) / n, z = z0 + ((v + 0.5) * (z1 - z0)) / n;
      if (insidePlan(x, z, a.pts) && insidePlan(x, z, b.pts)) hit++;
    }
    if (hit * cell > 0.05) out.push(`${a.id} × ${b.id} ${round(hit * cell, 1)} m²`);
  }
  return out;
}

// Grass has to meet the paving. The walks sit above the lawns and hide what runs beneath, so
// a lawn edge either tucks under the path or stops well clear of it; what must not happen is
// stopping a few centimetres short, which leaves a sliver of bare ground reading as a ragged
// edge. This walks the outside of every path and counts the places grass sits just beyond a
// gap of bare ground.
function grassGaps(plan) {
  const bb = (pts) => { const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; };
  const grass = [];
  for (const c of plan.curved.filter((q) => q.type === 'prisms' && (q.kind === 'lawn' || q.kind === 'bed'))) for (const part of c.parts) grass.push({ pts: part.pts, bb: bb(part.pts) });
  for (const b of plan.boxes.filter((q) => q.kind === 'lawn' || q.kind === 'bed')) {
    const pts = [[b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z + b.d / 2], [b.x - b.w / 2, b.z + b.d / 2]];
    grass.push({ pts, bb: bb(pts) });
  }
  const onGrass = (x, z) => grass.some((g) => x >= g.bb[0] && x <= g.bb[1] && z >= g.bb[2] && z <= g.bb[3] && insidePlan(x, z, g.pts));
  const gaps = [];
  for (const c of plan.curved.filter((q) => q.name.startsWith('W.'))) for (const part of c.parts) {
    const pts = part.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez);
      if (L < 0.4) continue;
      const nx = ez / L, nz = -ex / L;
      for (const t of [0.3, 0.7]) {
        const px = a[0] + ex * t, pz = a[1] + ez * t;
        for (const sgn of [1, -1]) {
          if (pavedAt(px + nx * 0.16 * sgn, pz + nz * 0.16 * sgn) || onGrass(px + nx * 0.16 * sgn, pz + nz * 0.16 * sgn)) continue;
          for (let d = 0.2; d <= 0.9; d += 0.1) if (onGrass(px + nx * d * sgn, pz + nz * d * sgn)) { gaps.push(`(${round(px, 1)}, ${round(pz, 1)})`); break; }
        }
      }
    }
  }
  return gaps;
}

export function analyseCirculation(plan) {
  const { clear } = pedestrianGeometry();
  const paving = { overlaps: pavingOverlaps(), grassGaps: grassGaps(plan), levels: [...new Set(Object.values(SURFACE).map((q) => q.top).filter((q) => q != null))] };
  const byId = Object.fromEntries(clear.map((c) => [c.id, c]));
  const zones = [
    ...clear.map((c) => ({ id: c.id, poly: c.poly })),
    ...ENTRANCES.map((e) => ({ id: e.id, poly: e.poly })),
    { id: 'PLAZA', circle: [FOUNTAIN_CENTRE[0], FOUNTAIN_CENTRE[1], PLAZA_R] },
  ];
  const inZone = (z, x, y, pad = 0) => (z.circle ? Math.hypot(x - z.circle[0], y - z.circle[1]) <= z.circle[2] + pad : insidePlan(x, y, z.poly) || (pad > 0 && distToPoly(x, y, z.poly) <= pad));
  const zonesAt = (x, y, pad = 0.05) => zones.filter((z) => inZone(z, x, y, pad)).map((z) => z.id);
  const onSidewalkLine = (x, y) => Math.abs(Math.abs(x) - HX) < 0.35 || Math.abs(Math.abs(y) - HZ) < 0.35;

  // --- graph: routes join their nodes in order; entrances join their door and neighbours; every
  //     sidewalk node joins the continuous perimeter sidewalk
  const edges = [];
  for (const r of ROUTES) for (let i = 1; i < r.nodes.length; i++) edges.push([r.nodes[i - 1], r.nodes[i], r.id]);
  for (const e of ENTRANCES) for (const j of e.joins) edges.push([e.node, j, e.id]);
  for (const [k, n] of Object.entries(NODES)) if (n.kind === 'sidewalk') edges.push(['SIDEWALK', k, 'perimeter sidewalk']);
  // destinations served on a route's own length
  const serves = { cafePodium: ['retailEast'], cafeHotel: ['hotelCafe'], cafeRestaurant: ['hotelRestaurant'], cafeOffice: ['officeLobbyW'] };
  for (const [d, via] of Object.entries(serves)) for (const v of via) edges.push([d, v, 'furnishing zone beside the route']);
  const seen = new Set(['SIDEWALK']);
  const queue = ['SIDEWALK'];
  while (queue.length) {
    const n = queue.shift();
    for (const [a, b] of edges) { const m = a === n ? b : b === n ? a : null; if (m && !seen.has(m)) { seen.add(m); queue.push(m); } }
  }
  const reach = Object.entries(NODES).filter(([, n]) => n.kind !== 'junction').map(([k, n]) => ({ id: k, name: n.name, kind: n.kind, reachable: seen.has(k) }));

  // --- geometric continuity: every node on a route really lies on that route's surface (or its
  //     entrance zone), and every door is within 1.7 m of a clear zone
  const nodeIssues = [];
  for (const r of ROUTES) {
    for (const k of r.nodes) {
      const n = NODES[k];
      const [x, y] = n.at;
      const ok = n.kind === 'door' ? zonesAt(x, y, 1.7).length > 0 : inZone({ poly: byId[r.id].poly }, x, y, 0.6) || zonesAt(x, y, 0.6).length > 1;
      if (!ok) nodeIssues.push(`${n.name} is not on ${r.name}`);
    }
  }

  // --- dead ends: each end of each route finishes on the property line (sidewalk), inside
  //     another clear zone, or at a door
  const doors = Object.values(NODES).filter((n) => n.kind === 'door');
  const deadEnds = [];
  const ends = [];
  for (const c of clear) {
    for (const [x, y] of [c.centre[0], c.centre.at(-1)]) {
      const others = zones.filter((z) => z.id !== c.id && inZone(z, x, y, 0.2)).map((z) => z.id);
      const door = doors.find((d) => Math.hypot(d.at[0] - x, d.at[1] - y) < 2.2);
      const kind = onSidewalkLine(x, y) ? 'sidewalk' : others.length ? `joins ${others.join(', ')}` : door ? `door: ${door.name}` : null;
      ends.push({ route: c.id, at: [round(x, 1), round(y, 1)], kind });
      if (!kind) deadEnds.push(`${c.name} at (${round(x, 1)}, ${round(y, 1)})`);
    }
  }

  // --- what must stay out of the clear zones
  const partsLow = plan.parts.filter((q) => q.y - q.sy / 2 < 1.2 && q.y + q.sy / 2 > 0.25);
  const footprint = (q) => {
    if (q.shape !== 'box') return [[q.x, q.z]];
    const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([u, v]) => [q.x + (u * q.sx / 2) * c + (v * q.sz / 2) * s, q.z - (u * q.sx / 2) * s + (v * q.sz / 2) * c]);
  };
  const arcadeBand = { outer: offsetPlan(PODIUM_PLAN, -1.45), inner: offsetPlan(PODIUM_PLAN, -3.45) };
  // The promenade and the spine run through the fountain plaza, so their ribbons pass over the
  // reflecting pool. The pool is not walked on — people cross the plaza on the ring around it —
  // so the basin and its coping are subtracted from every clear zone.
  const inBasin = (x, y) => Math.hypot(x - FOUNTAIN.x, y - FOUNTAIN.z) < FOUNTAIN.basin + FOUNTAIN.coping + 0.15;
  const inClear = (x, y) => !inBasin(x, y) && (clear.some((c) => {
    if (c.id === 'ARC') return insidePlan(x, y, arcadeBand.outer) && !insidePlan(x, y, arcadeBand.inner) && y > -44 && !(y < -31.5 && x < -60);
    return insidePlan(x, y, offsetPlan(c.poly, 0)) && distToPoly(x, y, c.poly) > 0.05;
  }) || ENTRANCES.some((e) => insidePlan(x, y, e.poly) && distToPoly(x, y, e.poly) > 0.05)
    || Math.hypot(x - FOUNTAIN_CENTRE[0], y - FOUNTAIN_CENTRE[1]) < LOOP_CLEAR[1] && Math.hypot(x - FOUNTAIN_CENTRE[0], y - FOUNTAIN_CENTRE[1]) > LOOP_CLEAR[0]);
  const ground = (q) => q.y - q.sy / 2 < 0.5 && Math.abs(q.x) < HX + 0.1 && Math.abs(q.z) < HZ + 0.1;
  // doors and portal frames on the storefront line belong to the buildings the routes enter
  const podiumEdge = offsetPlan(PODIUM_PLAN, -1.3);
  // an entrance door's lining, leaves, rails and threshold belong to the building it opens,
  // the same way the podium's storefront doors do; only slim pieces close to a door node
  // qualify, so this cannot excuse anything actually left standing on the walk
  // portal nodes sit on the podium edge while their doors stand on the storefront line one
  // arcade depth behind, so they reach further than a door set straight into a facade
  const doorNodes = Object.values(NODES).filter((n) => n.kind === 'door' || (n.kind === 'junction' && /portal/i.test(n.name)))
    .map((n) => ({ at: n.at, r: n.kind === 'door' ? 2.8 : 5.2 }));
  const inDoor = (q) => Math.min(q.sx, q.sz) <= 0.25 && ['frame', 'guardGlass', 'metal', 'charcoal', 'stone', 'lamp'].includes(q.color)
    && doorNodes.some((n) => Math.hypot(q.x - n.at[0], q.z - n.at[1]) < n.r);
  const inStore = (q) => inDoor(q) || (insidePlan(q.x, q.z, offsetPlan(PODIUM_PLAN, -3.3)) && q.color !== 'metal')
    || (q.shape === 'cyl' && q.sx > 0.7 && q.sy > 4 && !insidePlan(q.x, q.z, podiumEdge) && insidePlan(q.x, q.z, PODIUM_PLAN));   // the arcade's own columns (2.1 m clear kept)
  const blockers = partsLow.filter((q) => ground(q) && !inStore(q) && footprint(q).some(([x, y]) => inClear(x, y)));
  const blockerList = blockers.map((q) => `${q.color} ${q.shape} (${round(q.x, 1)}, ${round(q.z, 1)})`);
  const trunks = [...plan.trees, ...plan.palms].filter((t) => t.y < 1.2);
  const trunkIssues = trunks.filter((t) => zones.some((z) => inZone(z, t.x, t.z, 0.6))).map((t) => `(${round(t.x, 1)}, ${round(t.z, 1)})`);
  const lowCanopies = plan.trees.filter((t) => t.y < 1.2).map((t) => ({ t, k: canopyOf(t) })).filter(({ k }) => k.y0 < 2.4)
    .filter(({ k }) => Array.from({ length: 8 }, (_, i) => [k.x + Math.cos((i * Math.PI) / 4) * k.r * 0.9, k.z + Math.sin((i * Math.PI) / 4) * k.r * 0.9]).some(([x, y]) => inClear(x, y)))
    .map(({ t }) => `(${round(t.x, 1)}, ${round(t.z, 1)})`);

  // --- entrances: no planting inside, and a 1.5 m turning space
  const plantColors = new Set(['shrub', 'shrubDark', 'shrubLight', 'shrubFlower', 'planter', 'bed']);
  const blockedEntrances = ENTRANCES.filter((e) => plan.parts.some((q) => plantColors.has(q.color) && q.y < 1.5 && insidePlan(q.x, q.z, e.poly)) || trunks.some((t) => insidePlan(t.x, t.z, offsetPlan(e.poly, 0.5)))).map((e) => e.name);
  const minDim = (poly) => { const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); };
  const tightEntrances = ENTRANCES.filter((e) => minDim(e.poly) < 1.5).map((e) => e.name);

  // --- vehicles: clear zones never overlap drive areas; every driveway crossing is continuous
  //     sidewalk paving on a raised table
  const vehicleAreas = [
    { name: 'hotel arrival drive', rect: [73.0, 79.5, -42.0, -10.0] },
    { name: 'residential garage approach', rect: [-65.0, -57.8, -51.6, -47.3] },
    { name: 'residential loading approach', rect: [-40.2, -35.0, -51.6, -47.3] },
    { name: 'office car-lift apron', rect: [74.2, 78.4, 15.5, 27.5] },
    { name: 'office loading apron', rect: [74.2, 78.4, 42.0, 48.0] },
    { name: 'hotel dock apron', rect: [49.4, 64.0, -55.25, -51.2] },
  ];
  const conflicts = [];
  for (const c of clear) for (const v of vehicleAreas) if (c.poly.some(([x, y]) => inRect(x, y, v.rect, -0.05)) || corners(v.rect).some(([x, y]) => insidePlan(x, y, c.poly))) conflicts.push(`${c.name} × ${v.name}`);
  const crossings = CROSSINGS.map((c) => {
    const apron = plan.boxes.find((b) => b.name.startsWith('S.apron') && b.kind === 'sidewalk' && Math.abs((c.side === 'n' || c.side === 's' ? b.x : b.z) - (c.span[0] + c.span[1]) / 2) < 0.2);
    const edges = plan.boxes.filter((b) => b.name.startsWith('S.apron') && b.kind === 'band' && Math.abs((c.side === 'n' || c.side === 's' ? b.x : b.z) - (c.span[0] + c.span[1]) / 2) < (c.span[1] - c.span[0]) / 2 + 0.5).length;
    return { id: c.id, name: c.name, side: c.side, width: round(c.span[1] - c.span[0], 1), continuousPaving: !!apron, raisedTable: !!apron && apron.h >= SURFACE.plaza.top + 0.02, edgeBands: edges };
  });

  // --- sight triangles beside each driveway: nothing taller than 0.9 m
  const zonesS = sightZones();
  const sightIssues = [];
  for (const s of zonesS) {
    const hit = (x, y) => x > s.rect[0] && x < s.rect[1] && y > s.rect[2] && y < s.rect[3];
    plan.parts.filter((q) => q.y + q.sy / 2 > 0.95 && q.y - q.sy / 2 < 1.0 && hit(q.x, q.z)).forEach((q) => sightIssues.push(`${s.crossing}: ${q.color} ${q.shape} (${round(q.x, 1)}, ${round(q.z, 1)})`));
    trunks.filter((t) => hit(t.x, t.z)).forEach((t) => sightIssues.push(`${s.crossing}: tree/palm (${round(t.x, 1)}, ${round(t.z, 1)})`));
  }

  // --- private pools: no public clear zone enters the hotel pool court or the podium deck
  const privateAreas = [{ name: 'hotel pool court', poly: [[1.8, -39], [53.4, -39], [53.4, -20], [1.8, -20]] }];
  const privateIssues = clear.filter((c) => c.poly.some(([x, y]) => privateAreas.some((a) => insidePlan(x, y, a.poly)))).map((c) => c.name);
  const hotelInside = clear.filter((c) => c.id !== 'ARC' && c.poly.some(([x, y]) => [HOTEL.front, HOTEL.tower, HOTEL.rear, HOTEL.link].some((p) => insidePlan(x, y, offsetPlan(p, -0.3))))).map((c) => c.name);

  // --- step-free: all routes flat within the site datum band; no stairs in any route
  const tops = [...new Set(ROUTES.map((r) => SURFACE[r.surface].top)), SURFACE.entry.top, SURFACE.plaza.top, 0.15];
  const stepFree = Math.max(...tops) - Math.min(...tops) <= 0.075;

  // --- the fountain stands in the crossing, so each primary route has to pass it on both
  //     sides with at least its own clear width left over on the plaza ring
  const ringPass = ['P1', 'S1', 'S2'].map((id) => {
    const r = ROUTES.find((q) => q.id === id);
    const w = typeof r.width === 'function' ? r.width(FOUNTAIN_CENTRE[0], FOUNTAIN_CENTRE[1]) : r.width;
    return { id, name: r.name, need: round(w, 2), have: round(PLAZA_R - (FOUNTAIN.basin + FOUNTAIN.coping), 2) };
  });

  // --- widths
  const widths = ROUTES.map((r) => {
    const w = typeof r.width === 'function' ? Math.min(...routeSamples(r).map(([x, y]) => r.width(x, y))) : r.width;
    const clearW = r.id === 'ARC' ? 2.1 : w;
    return { id: r.id, name: r.name, type: r.type, minWidth: round(w, 2), clearWidth: clearW, ok: r.type === 'primary' ? clearW >= 4.5 : clearW >= 1.8 };
  });

  // --- lighting at junctions, entrances and crossings
  const poles = (plan.meta.poles || []).filter((p) => p.top > 0.8 && !p.umbrella && !p.bench && !p.bike);
  const streetLights = plan.parts.filter((q) => q.color === 'lamp' && q.y > 3.5).map((q) => ({ x: q.x, z: q.z }));
  const allLights = [...poles, ...streetLights, ...plan.parts.filter((q) => q.color === 'lamp' && q.y < 1.2 && q.sx < 0.3).map((q) => ({ x: q.x, z: q.z }))];
  const litNear = (x, y, r = 9) => allLights.some((p) => Math.hypot(p.x - x, p.z - y) < r);
  const darkNodes = Object.entries(NODES).filter(([, n]) => n.kind !== 'destination').filter(([, n]) => !litNear(...n.at)).map(([, n]) => n.name);
  const darkCrossings = CROSSINGS.filter((c) => { const m = (c.span[0] + c.span[1]) / 2; const p = c.side === 'n' ? [m, -HZ - 2] : c.side === 's' ? [m, HZ + 2] : c.side === 'e' ? [HX + 2, m] : [-HX - 2, m]; return !litNear(...p, 16); }).map((c) => c.name);

  return {
    nodes: Object.keys(NODES).length, routes: ROUTES.length, reach, nodeIssues, ends, deadEnds, blockers: blockerList, trunkIssues, lowCanopies,
    blockedEntrances, tightEntrances, conflicts, crossings, sightIssues, privateIssues, hotelInside, stepFree, tops, widths, darkNodes, darkCrossings, paving, ringPass,
    furnishing: FURNISHING.map((f) => ({ id: f.id, kind: f.kind, name: f.name })),
  };
}

function corners(r) { return [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]]; }
function routeSamples(r) { return (r._centre || r.pts || []); }
