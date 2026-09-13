// Procedural site plan for the hero massing study: an original Miami modern
// mixed-use block on a hypothetical parcel, in a clean white palette.
//   A — residential: two twisting towers (continuous cores, fixed column rings)
//       on a retail + parking podium whose roof is a resort amenity level
//   B — hotel: contemporary Art Deco hotel with a private pool court and a
//       conceptual back-of-house plan
//   C — office: stacked blocks with modest cantilevered offsets, timber accents
//       and planted terraces over a parking base served by car lifts
//   P — public park around a fountain
// Pure data in metres (x = east, z = south, y = up) — no three.js here, so the
// program can be reasoned about (and validated by tools/hero3d/audit.mjs).
// The camera views from the south-west: south and west faces are the "front".
import {
  LAYER, LAYER_COUNT, GLAZE, BLOCK, PITCH_X, PITCH_Z, HX, HZ, WALK, ROW, HALF_ROAD, ARCADE,
  rng, box, rect, offsetPlan, insidePlan, planNormals, floorsToHeight, inRect,
} from './plan/core.js';
import { PODIUM_PLAN, PODIUM_PARKING, residentialMasses, residentialSlabs, residentialParts } from './plan/residential.js';
import { HOTEL, hotelMasses, hotelBoxes, hotelSlabs, hotelParts } from './plan/hotel.js';
import { OFFICE_BLOCKS, OFFICE_PARKING, officeMasses, officeSlabs, officeParts } from './plan/office.js';
import { FOUNTAIN, PLAZA_DISC, PARK_PATHS, CAFE_ZONES, parkSpecs, parkParts } from './plan/park.js';
import { streetscapeSpecs, streetscapeSlabs, streetscapeParts, stations, VERGE_CENTRE } from './plan/streetscape.js';
import { groundsSlabs, groundsPlanting } from './plan/grounds.js';

export { LAYER, LAYER_COUNT, GLAZE, BLOCK, planNormals, offsetPlan, insidePlan };

// ---------------------------------------------------------------------------
// Linework: every path carries its own draw window in S.
// ---------------------------------------------------------------------------
function roundedRect(x0, z0, x1, z1, r, seg = 5) {
  const pts = [];
  const corners = [[x1 - r, z0 + r, -Math.PI / 2], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI]];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

const circle = (x, z, r, n = 40) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), z + r * Math.sin((i / n) * Math.PI * 2)]);

function sitePaths(tier, masses, curved, rand) {
  const paths = [];
  const add = (pts, layer, start, dur, opts = {}) =>
    paths.push({ pts, layer, start, dur, closed: !!opts.closed, dash: opts.dash || null, y: opts.y ?? 0.06 });

  add([[-420, -HZ], [420, -HZ]], LAYER.guides, 0.020, 0.09, { dash: [10, 6] });
  add([[-420, HZ], [420, HZ]], LAYER.guides, 0.035, 0.09, { dash: [10, 6] });
  add([[-HX, -300], [-HX, 300]], LAYER.guides, 0.045, 0.09, { dash: [10, 6] });
  add([[HX, -300], [HX, 300]], LAYER.guides, 0.060, 0.09, { dash: [10, 6] });
  [[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]].forEach(([x, z], k) => {
    add([[x - 5, z], [x + 5, z]], LAYER.dimension, 0.030 + k * 0.008, 0.02);
    add([[x, z - 5], [x, z + 5]], LAYER.dimension, 0.034 + k * 0.008, 0.02);
  });

  const R = tier.cityRings;
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      const cx = i * PITCH_X, cz = j * PITCH_Z;
      const ring = Math.max(Math.abs(i), Math.abs(j));
      const s = 0.085 + ring * 0.03 + rand() * 0.02;
      add(roundedRect(cx - HX - WALK, cz - HZ - WALK, cx + HX + WALK, cz + HZ + WALK, 6), LAYER.streets, s, 0.1, { closed: true });
      if (i || j) add(rect(cx - HX, cz - HZ, cx + HX, cz + HZ), LAYER.streets, s + 0.02, 0.09, { closed: true, dash: [5, 3] });
    }
  }

  add(rect(-HX, -HZ, HX, HZ), LAYER.property, 0.100, 0.09, { closed: true, y: 0.08 });
  add(rect(-HX + 4, -HZ + 4, HX - 4, HZ - 4), LAYER.parcel, 0.160, 0.09, { closed: true, dash: [3, 2] });
  add([[-20, -HZ], [-20, HZ]], LAYER.parcel, 0.180, 0.07, { dash: [6, 3] });
  add([[-20, 5], [HX, 5]], LAYER.parcel, 0.195, 0.06, { dash: [6, 3] });
  add([[20, 5], [20, HZ]], LAYER.parcel, 0.205, 0.05, { dash: [6, 3] });

  const dz = HZ + 26;
  add([[-HX, HZ + 2], [-HX, dz + 3]], LAYER.dimension, 0.120, 0.04);
  add([[HX, HZ + 2], [HX, dz + 3]], LAYER.dimension, 0.125, 0.04);
  add([[-HX, dz], [HX, dz]], LAYER.dimension, 0.135, 0.07);
  add([[-HX - 2, dz + 2], [-HX + 2, dz - 2]], LAYER.dimension, 0.150, 0.02);
  add([[HX - 2, dz + 2], [HX + 2, dz - 2]], LAYER.dimension, 0.190, 0.02);

  // footprints (ground volumes solid, upper volumes dashed)
  const byName = Object.fromEntries(masses.map((m) => [m.name, m]));
  const curveByName = Object.fromEntries(curved.map((m) => [m.name, m]));
  const outline = (m) => rect(m.x - m.w / 2, m.z - m.d / 2, m.x + m.w / 2, m.z + m.d / 2);
  add(PODIUM_PLAN, LAYER.footprint, 0.180, 0.07, { closed: true, y: 0.1 });
  [HOTEL.front, HOTEL.rear, HOTEL.link].forEach((pts, k) => add(pts, LAYER.footprint, 0.190 + k * 0.010, 0.06, { closed: true, y: 0.1 }));
  ['C.baseE', 'C.baseW', 'B.poolbar', 'B.svcLink'].forEach((n, k) =>
    add(outline(byName[n]), LAYER.footprint, 0.220 + k * 0.006, 0.06, { closed: true, y: 0.1 }));
  [curveByName['A.t1.body'].pts, curveByName['A.t2.body'].pts, HOTEL.centre].forEach((pts, k) =>
    add(pts, LAYER.tower, 0.215 + k * 0.010, 0.06, { closed: true, dash: [2.5, 1.5], y: 0.1 }));
  ['C.corner', ...OFFICE_BLOCKS.map((b) => b.name)].forEach((n, k) =>
    add(outline(byName[n]), LAYER.tower, 0.239 + k * 0.008, 0.05, { closed: true, dash: [2.5, 1.5], y: 0.1 }));

  // park: gathering circle, fountain basin, radial paths
  add(roundedRect(-19, 3, 19, 53, 5), LAYER.landscape, 0.225, 0.06, { closed: true, y: 0.09 });
  add(circle(FOUNTAIN.x, FOUNTAIN.z, PLAZA_DISC), LAYER.landscape, 0.230, 0.05, { closed: true, y: 0.1 });
  add(circle(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.basin + FOUNTAIN.coping, 32), LAYER.landscape, 0.238, 0.04, { closed: true, y: 0.1 });
  PARK_PATHS.forEach((p, k) => add([p.from, p.to], LAYER.landscape, 0.244 + k * 0.003, 0.03, { y: 0.1, dash: [2, 1.2] }));
  for (const n of ['L.hcourt', 'L.hcope', 'L.fore', 'L.arrive', 'L.drive']) {
    const m = masses.find((b) => b.name === n);
    if (m) add(outline(m), LAYER.landscape, 0.26, 0.04, { closed: true, y: 0.1 });
  }

  // road markings (context phase)
  const xs = [-PITCH_X * 1.5, -PITCH_X / 2, PITCH_X / 2, PITCH_X * 1.5];
  const zs = [-PITCH_Z * 1.5, -PITCH_Z / 2, PITCH_Z / 2, PITCH_Z * 1.5];
  const span = tier.cityRings > 1 ? [0, 1, 2] : [1];
  for (const zc of [zs[1], zs[2]]) for (const k of span) add([[xs[k] + HALF_ROAD + 2, zc], [xs[k + 1] - HALF_ROAD - 2, zc]], LAYER.markings, 0.665 + rand() * 0.05, 0.08, { dash: [3, 6] });
  for (const xc of [xs[1], xs[2]]) for (const k of span) add([[xc, zs[k] + HALF_ROAD + 2], [xc, zs[k + 1] - HALF_ROAD - 2]], LAYER.markings, 0.665 + rand() * 0.05, 0.08, { dash: [3, 6] });
  if (tier.crosswalks) {
    for (const xc of [xs[1], xs[2]]) {
      for (const zc of [zs[1], zs[2]]) {
        const sx = Math.sign(xc), sz = Math.sign(zc);
        const s = 0.70 + rand() * 0.05;
        const xw = xc - sx * (HALF_ROAD + 3.5);
        for (let k = 0; k < 6; k++) { const zz = zc - HALF_ROAD + 1.2 + k * 2.1; add([[xw - 1.5, zz], [xw + 1.5, zz]], LAYER.markings, s + k * 0.004, 0.02); }
        const zw = zc - sz * (HALF_ROAD + 3.5);
        for (let k = 0; k < 6; k++) { const xx = xc - HALF_ROAD + 1.2 + k * 2.1; add([[xx, zw - 1.5], [xx, zw + 1.5]], LAYER.markings, s + 0.02 + k * 0.004, 0.02); }
      }
    }
  }

  // vehicle access, all on secondary frontages: curb cuts across the sidewalk
  const curbN = -HZ - WALK, curbE = HX + WALK;
  const cutNorth = (x0, x1, zEdge) => { add([[x0, zEdge], [x0, curbN]], LAYER.markings, 0.700, 0.04); add([[x1, zEdge], [x1, curbN]], LAYER.markings, 0.705, 0.04); };
  cutNorth(PODIUM_PARKING.entry.portal[0], PODIUM_PARKING.entry.portal[1], -1 - 50 + ARCADE);   // residential garage in / out
  cutNorth(-39.9, -35.3, -47.0);                                                                  // residential loading
  cutNorth(40.6, 64.0, -51);                                                                      // hotel staff, receiving, refuse
  const cutEast = (z0, z1, xEdge) => { add([[xEdge, z0], [curbE, z0]], LAYER.markings, 0.710, 0.04); add([[xEdge, z1], [curbE, z1]], LAYER.markings, 0.715, 0.04); };
  cutEast(-42, -10, 79.5);                                                                        // hotel arrival drive
  cutEast(OFFICE_PARKING.entry.curb[0], OFFICE_PARKING.entry.curb[1], 74);                        // office car lifts
  cutEast(41.5, 48.5, 74);                                                                        // office loading

  // pedestrian routes are modelled as paved walks (plan/grounds.js), not drawn
  return paths;
}

// ---------------------------------------------------------------------------
// Street trees and palms in the sidewalk tree lawns, and the hotel court palms.
// ---------------------------------------------------------------------------
function streetGreenery(tier, rand, masses) {
  const trees = [];
  const palms = [];
  const footprints = [
    ...masses.filter((m) => m.group !== 'L').map((m) => rect(m.x - m.w / 2 - 1, m.z - m.d / 2 - 1, m.x + m.w / 2 + 1, m.z + m.d / 2 + 1)),
    ...[HOTEL.front, HOTEL.centre, HOTEL.rear, HOTEL.link].map((p) => offsetPlan(p, 1)),
  ];
  const keepClear = [
    rect(72, -43, 86, -9), rect(64, -36, 82, -20), rect(72, 13, 86, 30), rect(72, 40, 86, 50),
    rect(-68, -62, -26, -45), rect(38, -62, 66, -50), rect(10, 42, 26, 58),
  ];
  const podiumClear = offsetPlan(PODIUM_PLAN, 2);
  const free = (x, z) => !insidePlan(x, z, podiumClear) && !footprints.some((f) => insidePlan(x, z, f)) && !keepClear.some((f) => insidePlan(x, z, f));
  const startAt = (x, z, base) => Math.min(0.76, base + 0.08 * (Math.hypot(x, z) / 280));
  const tree = (x, z, r, lush = true) => { if (free(x, z)) trees.push({ x, z, y: 0, r, lush, tone: rand(), start: startAt(x, z, 0.665), dur: 0.05 }); };
  const palm = (x, z, h = 8 + rand() * 3) => { if (free(x, z)) palms.push({ x, z, y: 0, h, r: 2.6 + rand() * 0.7, spin: rand() * Math.PI, start: startAt(x, z, 0.675), dur: 0.05 }); };
  const keep = () => tier.treeDensity >= 1 || rand() < tier.treeDensity;

  const o = VERGE_CENTRE;
  for (const x of stations('s')) if (keep()) palm(x, HZ + o);
  for (const x of stations('n')) if (keep()) tree(x, -HZ - o, 1.9 + rand() * 0.9, false);
  const [west, east] = [stations('w'), stations('e')];
  for (let k = 0; k < west.length; k++) {
    if (keep()) tree(-HX - o, west[k], 1.9 + rand() * 0.9, false);
    if (keep()) tree(HX + o, east[k], 1.9 + rand() * 0.9, false);
  }
  [[6, -35.5], [6, -23.5], [44, -24]].forEach(([x, z]) => palm(x, z)); // hotel pool court
  return { trees, palms };
}

// Cars drive on the right: each travel lane carries its heading (rot turns the car's
// +x front toward it), and a parking lane runs along the block-side curb.
const HEAD = { east: 0, west: Math.PI, south: -Math.PI / 2, north: Math.PI / 2 };
function streetCars(tier, rand) {
  const cars = [];
  const car = (x, z, rot, extra = {}) => cars.push({ x, z, y: 0.02, rot, type: rand() < 0.35 ? 'suv' : 'sedan', paint: Math.floor(rand() * 9), start: 0.70 + rand() * 0.07, dur: 0.035, ...extra });
  const lanes = [];
  for (const zc of [-PITCH_Z / 2, PITCH_Z / 2]) {
    lanes.push({ axis: 'x', c: zc + 2.0, rot: HEAD.east, from: -PITCH_X / 2 + 12, to: PITCH_X / 2 - 12 });
    lanes.push({ axis: 'x', c: zc - 2.0, rot: HEAD.west, from: -PITCH_X / 2 + 12, to: PITCH_X / 2 - 12 });
  }
  for (const xc of [-PITCH_X / 2, PITCH_X / 2]) {
    lanes.push({ axis: 'z', c: xc - 2.0, rot: HEAD.south, from: -PITCH_Z / 2 + 12, to: PITCH_Z / 2 - 12 });
    lanes.push({ axis: 'z', c: xc + 2.0, rot: HEAD.north, from: -PITCH_Z / 2 + 12, to: PITCH_Z / 2 - 12 });
  }
  let guard = 0;
  while (cars.length < tier.cars && guard++ < 400) {
    const lane = lanes[Math.floor(rand() * lanes.length)];
    const along = lane.from + rand() * (lane.to - lane.from);
    const x = lane.axis === 'x' ? along : lane.c;
    const z = lane.axis === 'x' ? lane.c : along;
    if (cars.some((c) => Math.hypot(c.x - x, c.z - z) < 9)) continue;   // travel lanes 2.0 m either side of the centreline
    car(x, z, lane.rot);
  }
  // parallel-parked along the block-side curbs, clear of curb cuts and corners
  const P = PITCH_Z / 2 - 5.3, Q = PITCH_X / 2 - 5.3;   // 2.4 m parking lane against the 13 m curb-to-curb street
  const parked = [
    ...[-64, -57.2, -36, 29.6, 36.4, 58].map((x) => [x, P, HEAD.west]),        // south street
    ...[-40, -33.2, 5, 11.8, 34].map((z) => [-Q, z, HEAD.north]),            // west street
    ...[-20, 12, 18.8].map((x) => [x, -P, HEAD.east]),                        // north street
    ...[33].map((z) => [Q, z, HEAD.south]),                                   // east street
  ];
  parked.forEach(([x, z, rot], k) => { if (tier.name !== 'mobile' || k % 3 === 0) car(x, z, rot, { parked: true }); });
  car(75.8, -28, HEAD.north, { y: 0.06, start: 0.72 });   // guests at the porte-cochère
  car(75.8, -39, HEAD.north, { y: 0.06, start: 0.73 });
  return cars;
}

// ---------------------------------------------------------------------------

export function buildSitePlan(tier) {
  const rand = rng(20260913);
  const partsRand = rng(7);
  const masses = [...hotelBoxes(), ...officeMasses()];
  const residential = residentialMasses(tier);
  const curved = [...streetscapeSpecs(tier), ...residential.specs, ...hotelMasses(), ...parkSpecs(tier)];
  const slabs = [...residentialSlabs(), ...hotelSlabs(), ...officeSlabs(), ...streetscapeSlabs(), ...groundsSlabs()];
  const boxes = [...masses, ...slabs];   // the development block only — no neighbouring buildings
  const index = Object.fromEntries(boxes.map((b, i) => [b.name, i]));
  boxes.forEach((b) => { b.parentIndex = b.parent ? index[b.parent] : -1; });

  const curveTop = {};
  for (const c of curved) curveTop[c.name] = (c.parent ? curveTop[c.parent] : c.y0) + c.h;

  const res = residentialParts(tier, residential.towers, partsRand);
  const park = parkParts(tier, partsRand);
  const street = streetGreenery(tier, rand, [...masses, ...slabs]);
  const grounds = groundsPlanting(tier, rng(11));
  const startAt = (x, z, base) => Math.min(0.76, base + 0.08 * (Math.hypot(x, z) / 280));
  const trees = [
    ...street.trees,
    ...grounds.trees,
    ...park.trees.map((t) => ({ x: t.x, z: t.z, y: 0, r: t.r, lush: true, tone: partsRand(), start: startAt(t.x, t.z, 0.665), dur: 0.05 })),
    ...res.trees,
  ];
  const palms = [
    ...street.palms,
    ...grounds.palms,
    ...park.palms.map((p) => ({ x: p.x, z: p.z, y: 0, h: 8 + partsRand() * 2, r: 2.6 + partsRand() * 0.5, spin: partsRand() * Math.PI, start: 0.68, dur: 0.05 })),
    ...res.palms,
  ];

  const rectOfPlan = (pts) => {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  };

  return {
    boxes,
    index,
    curved,
    parts: [...res.parts, ...hotelParts(tier), ...officeParts(tier, partsRand), ...park.parts, ...grounds.parts, ...streetscapeParts(tier, trees, palms)],
    paths: sitePaths(tier, boxes, curved, rand),
    trees,
    palms,
    cars: streetCars(tier, rand),
    shadows: [
      { x: -51, z: -1, w: 50, d: 100 },
      ...[HOTEL.front, HOTEL.rear, HOTEL.link].map(rectOfPlan),
      ...['C.baseE', 'C.baseW'].map((n) => boxes[index[n]]),
    ],
    meta: { towers: residential.towers, pool: residential.pool, curveTop, cafeZones: CAFE_ZONES },
  };
}
