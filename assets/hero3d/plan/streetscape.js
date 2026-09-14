// Streetscape around the development block: the street surface, stone curbs, and
// sidewalks split into a planted tree lawn along the curb (street trees, palms,
// streetlights and groundcover) and a scored concrete walk along the property line,
// with paved breaks at entrances, paths and curb cuts. Plus zebra crosswalks,
// driveway aprons, benches, bike racks and bollards. Ground-level "context" items
// that arrive with the landscape.
import { RES, GLAZE, HX, HZ, WALK, HALF_ROAD, PITCH_X, PITCH_Z, roundedRectPlan, resampleByAngle, offsetPlan, box, partsKit } from './core.js';
import { fixtureKit, FIXTURE } from './fixtures.js';
import { CROSSINGS, inSight } from './pedestrian.js';
import { canopyOf } from './planting.js';

const CURB = [-HX - WALK, HX + WALK, -HZ - WALK, HZ + WALK];          // 84.5 × 59.75
const STREET = 2 * HALF_ROAD;                                          // 13 m curb to curb
export const SIDEWALK_TOP = 0.15;
export const BLOCK_PAVING_TOP = 0.03;
export const CURB_W = 0.3;
export const VERGE_W = 1.8;                                            // tree lawn behind the curb
export const WALK_CLEAR = WALK - CURB_W - VERGE_W;                      // 2.4 m scored walk
export const VERGE_CENTRE = WALK - CURB_W - VERGE_W / 2;               // property line → tree line (3.3 m)
const VERGE_TOP = SIDEWALK_TOP + 0.03;

// curb cuts (driveways across the sidewalk): [side, from, to] — the vehicle crossings of
// plan/pedestrian.js. The hotel arrival drive has separate entry and exit cuts with the
// sidewalk and tree lawn continuous between them; hotel receiving no longer spans the
// staff door.
export const DRIVEWAYS = CROSSINGS.map((c) => [c.side, c.span[0], c.span[1]]);

// street planting stations along each side (trees north, east, west; palms south)
export const STREET_PLANTING = {
  s: { from: -HX + 10, to: HX - 8, pitch: 12, palm: true },
  n: { from: -HX + 9, to: HX - 8, pitch: 10 },
  w: { from: -HZ + 9, to: HZ - 8, pitch: 10 },
  e: { from: -HZ + 9, to: HZ - 8, pitch: 10 },
};
export const stations = (side) => {
  const p = STREET_PLANTING[side];
  const out = [];
  for (let a = p.from; a < p.to; a += p.pitch) out.push(a);
  return out;
};

// paved breaks through the tree lawn: entrances, paths meeting the street, curb cuts
const OPENINGS = {
  n: [[-79, -75], [-14, -8.5], [75, 79]],                                     // crosswalk landings, spine (paseo)
  s: [[-79, -75], [-55, -45], [-3.2, 3.2], [18.6, 34.2], [75, 79]], // landings, tower 2 lobby, spine gate, office walk + lobby
  w: [[-33, -23], [12.2, 18.1]],                                              // tower 1 lobby, galleria
  e: [[2.0, 9.0]],                                                            // promenade
};
const SIDE = {
  n: { axis: 'x', range: [-76, 76], line: -HZ, out: -1 },
  s: { axis: 'x', range: [-76, 76], line: HZ, out: 1 },
  w: { axis: 'z', range: [-50, 50], line: -HX, out: -1 },
  e: { axis: 'z', range: [-50, 50], line: HX, out: 1 },
};

// lawn segments for one side: range minus openings and curb cuts, with a short paved
// crossing midway between every second pair of planting stations
function vergeSegments(side) {
  const cuts = [
    ...OPENINGS[side],
    ...DRIVEWAYS.filter(([s]) => s === side).map(([, a0, a1]) => [a0 - 0.8, a1 + 0.8]),
  ];
  const st = stations(side);
  for (let k = 1; k < st.length; k += 2) { const m = (st[k - 1] + st[k]) / 2; cuts.push([m - 0.9, m + 0.9]); }
  cuts.sort((a, b) => a[0] - b[0]);
  const segs = [];
  let a = SIDE[side].range[0];
  for (const [c0, c1] of cuts) {
    if (c0 > a + 3) segs.push([a, Math.min(c0, SIDE[side].range[1])]);
    a = Math.max(a, c1);
  }
  if (SIDE[side].range[1] > a + 3) segs.push([a, SIDE[side].range[1]]);
  return segs;
}

// plan rectangle across the sidewalk between two distances from the property line
function across(side, a0, a1, d0, d1) {
  const { axis, line, out } = SIDE[side];
  const p0 = line + out * d0, p1 = line + out * d1;
  return axis === 'x' ? [a0, a1, Math.min(p0, p1), Math.max(p0, p1)] : [Math.min(p0, p1), Math.max(p0, p1), a0, a1];
}

export function streetscapeSpecs(tier) {
  const N = tier.name === 'mobile' ? 96 : 160;
  const rs = (poly) => resampleByAngle(poly, 0, 0, N);
  const curb = roundedRectPlan(CURB[0], CURB[2], CURB[1], CURB[3], 6);
  const property = roundedRectPlan(-HX, -HZ, HX, HZ, 0.6);
  const streetOuter = roundedRectPlan(CURB[0] - STREET, CURB[2] - STREET, CURB[1] + STREET, CURB[3] + STREET, 2);
  const ctx = { module: RES, parent: null, start: 0.655, dur: 0.01, wire: false, phase: 'context', glaze: GLAZE.none };
  return [
    { ...ctx, name: 'S.street', type: 'ring', kind: 'asphalt', y0: 0, h: 0.02, pts: rs(streetOuter), inner: rs(curb) },
    { ...ctx, name: 'S.curb', type: 'ring', kind: 'stone', y0: 0, h: SIDEWALK_TOP + 0.01, pts: rs(curb), inner: rs(offsetPlan(curb, -CURB_W)) },
    { ...ctx, name: 'S.sidewalk', type: 'ring', kind: 'sidewalk', glaze: GLAZE.pavers, module: [1.5, 1.5], y0: 0, h: SIDEWALK_TOP, pts: rs(offsetPlan(curb, -CURB_W)), inner: rs(property) },
    { ...ctx, name: 'S.blockPaving', type: 'prism', kind: 'paving', y0: 0, h: BLOCK_PAVING_TOP, pts: property },
  ];
}

export function streetscapeSlabs() {
  const t = (i) => [0.662 + i * 0.002, 0.05];
  const out = [];
  // driveway crossings: the sidewalk's own paving continues across every driveway on a
  // 25 mm raised table, with darker 0.3 m bands marking where the vehicle path crosses
  DRIVEWAYS.forEach(([side, a0, a1], k) => {
    const r = across(side, a0 + 0.3, a1 - 0.3, 0, WALK - CURB_W);
    out.push(box(`S.apron${k}`, r[0], r[1], r[2], r[3], 0, SIDEWALK_TOP + 0.025, 'sidewalk', 'L', t(k), null, { glaze: GLAZE.pavers, module: [1.5, 1.5] }));
    for (const [e0, e1] of [[a0, a0 + 0.3], [a1 - 0.3, a1]]) {
      const b = across(side, e0, e1, 0, WALK - CURB_W);
      out.push(box(`S.apron${k}${e0 === a0 ? 'a' : 'b'}`, b[0], b[1], b[2], b[3], 0, SIDEWALK_TOP + 0.025, 'band', 'L', t(k), null, { glaze: GLAZE.pavers, module: [0.3, 0.3] }));
    }
  });
  // tree lawns
  for (const side of ['n', 's', 'w', 'e']) {
    vergeSegments(side).forEach(([a0, a1], k) => {
      const r = across(side, a0, a1, WALK_CLEAR, WALK - CURB_W);
      out.push(box(`S.verge${side}${k}`, r[0], r[1], r[2], r[3], 0, VERGE_TOP, 'lawn', 'L', t(8)));
    });
  }
  return out;
}

// crosswalks sit on the straight sidewalk runs, 7.5 m back from the cross street's curb
export const CROSSWALK_SETBACK = HALF_ROAD + 7.5;
// paved entrance zones on the sidewalk walk: [side, from, to]
export const ENTRANCE_ZONES = [
  ['s', -54.0, -46.0],   // tower 2 lobby (south)
  ['w', -32.0, -24.0],   // tower 1 lobby (west)
  ['s', 24.5, 33.5],     // office lobby
  ['w', 12.6, 17.7],     // galleria (promenade west end)
  ['e', 2.3, 8.7],       // promenade east end
  ['s', -2.6, 2.6],      // spine: park gate
  ['n', -13.8, -8.7],    // spine: paseo
];
// marked drop-off lay-bys in the kerbside parking lane: [side, from, to]
export const DROP_OFFS = [
  ['w', -35.0, -21.0],   // residential tower 1 arrivals
  ['s', 23.0, 35.0],     // office lobby
];

export function streetscapeEntrances() {
  const t = [0.668, 0.05];
  return ENTRANCE_ZONES.map(([side, a0, a1], k) => {
    const r = across(side, a0, a1, 0.05, WALK_CLEAR - 0.12);
    return box(`S.entry${k}`, r[0], r[1], r[2], r[3], 0, SIDEWALK_TOP + 0.02, 'stone', 'L', t, null, { glaze: GLAZE.pavers, module: [0.6, 0.6] });
  });
}

export function streetscapeParts(tier, trees, palms) {
  const out = [];
  const K = partsKit(out);
  const X = fixtureKit(K);
  const { add, block, bench } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const y = SIDEWALK_TOP;
  const street = [...trees, ...palms].filter((p) => p.y < 1.2 && (Math.abs(p.x) > HX - 1 || Math.abs(p.z) > HZ - 1));
  // clearance to canopies (trees) and crowns (palms) for poles of a given height
  const clearOf = (x, z, top, reach) => street.every((p) => {
    if (p.h) return Math.hypot(p.x - x, p.z - z) > (top > p.h - 1.5 ? p.r + reach + 0.3 : 0.9);   // palm crown / trunk
    const k = canopyOf(p);
    return Math.hypot(k.x - x, k.z - z) > (top > k.y0 ? k.r + reach : 0.9);
  });
  const onDriveway = (side, a, pad = 1.5) => DRIVEWAYS.some(([sd, a0, a1]) => sd === side && a > a0 - pad && a < a1 + pad);
  const inOpening = (side, a, pad = 0.6) => [...OPENINGS[side], ...ENTRANCE_ZONES.filter(([sd]) => sd === side).map(([, a0, a1]) => [a0, a1])].some(([a0, a1]) => a > a0 - pad && a < a1 + pad);

  // stone header at the tree-lawn edge (walk joints are drawn by the paving shader)
  for (const side of ['n', 's', 'w', 'e']) {
    for (const [a0, a1] of vergeSegments(side)) {
      const r = across(side, a0, a1, WALK_CLEAR - 0.1, WALK_CLEAR + 0.02);
      block(r[0], r[1], y, VERGE_TOP + 0.03, r[2], r[3], 'stone', C);
    }
  }

  // zebra crosswalks on the straight sidewalk runs, with flush curb-ramp pads and a
  // tactile warning strip at each block-side landing (the ramp's slope is not modelled)
  const xs = [-PITCH_X / 2, PITCH_X / 2], zs = [-PITCH_Z / 2, PITCH_Z / 2];
  for (const xc of xs) for (const zc of zs) {
    const sx = Math.sign(xc), sz = Math.sign(zc);
    const xw = xc - sx * CROSSWALK_SETBACK;
    for (let k = 0; k < 6; k++) { const zz = zc - HALF_ROAD + 1.2 + k * 2.1; block(xw - 1.6, xw + 1.6, 0.02, 0.035, zz - 0.3, zz + 0.3, 'frame', C); }
    const zw = zc - sz * CROSSWALK_SETBACK;
    for (let k = 0; k < 6; k++) { const xx = xc - HALF_ROAD + 1.2 + k * 2.1; block(xx - 0.3, xx + 0.3, 0.02, 0.035, zw - 1.6, zw + 1.6, 'frame', C); }
    // landings: north/south sidewalks at x = xw, east/west sidewalks at z = zw
    const side1 = sz < 0 ? 'n' : 's';
    const pad1 = across(side1, xw - 1.7, xw + 1.7, WALK_CLEAR - 0.2, WALK - CURB_W);
    block(pad1[0], pad1[1], y, y + 0.05, pad1[2], pad1[3], 'drive', C);
    const t1 = across(side1, xw - 1.5, xw + 1.5, WALK - CURB_W - 0.62, WALK - CURB_W - 0.02);
    block(t1[0], t1[1], y, y + 0.075, t1[2], t1[3], 'tactile', C);
    const side2 = sx < 0 ? 'w' : 'e';
    const pad2 = across(side2, zw - 1.7, zw + 1.7, WALK_CLEAR - 0.2, WALK - CURB_W);
    block(pad2[0], pad2[1], y, y + 0.05, pad2[2], pad2[3], 'drive', C);
    const t2 = across(side2, zw - 1.5, zw + 1.5, WALK - CURB_W - 0.62, WALK - CURB_W - 0.02);
    block(t2[0], t2[1], y, y + 0.075, t2[2], t2[3], 'tactile', C);
  }

  // drop-off lay-bys: white edge lines around a 2.4 m bay in the kerbside lane
  for (const [side, a0, a1] of DROP_OFFS) {
    const d0 = WALK + 0.1, d1 = WALK + 2.5;
    for (const [e0, e1] of [[d0, d0 + 0.15], [d1 - 0.15, d1]]) { const r = across(side, a0, a1, e0, e1); block(r[0], r[1], 0.02, 0.035, r[2], r[3], 'frame', C); }
    for (const a of [a0, a1]) { const r = across(side, a - 0.08, a + 0.08, d0, d1); block(r[0], r[1], 0.02, 0.035, r[2], r[3], 'frame', C); }
  }

  // lighting: roadway poles in the tree lawn every 28 m (arms over the carriageway), and
  // pedestrian lanterns at the building side of the walk halfway between them; both
  // shift along the run to clear canopies, palm crowns, driveways and entrances
  const poles = [];
  const roadEdge = WALK - CURB_W - 0.55;
  const spacing = full ? 28 : 42;
  const inVerge = (side, a) => vergeSegments(side).some(([a0, a1]) => a > a0 + 0.4 && a < a1 - 0.4);
  const place = (side, a0, kind) => {
    const { axis, line, out: o } = SIDE[side];
    const d = kind === 'road' ? roadEdge : 0.45;
    const at = (v) => (axis === 'x' ? [v, line + o * d] : [line + o * d, v]);
    const F = kind === 'road' ? FIXTURE.road : FIXTURE.ped;
    const ok = (v) => {
      const [x, z] = at(v);
      if (onDriveway(side, v) || inOpening(side, v, kind === 'road' ? 0.2 : 0.8) || inSight(...at(v))) return false;
      if (kind === 'road' && !inVerge(side, v)) return false;
      // the road light's head sits over the street, 2 m out from the pole
      const hx = x + (axis === 'x' ? 0 : o * FIXTURE.road.arm), hz = z + (axis === 'x' ? o * FIXTURE.road.arm : 0);
      return clearOf(x, z, F.h, F.reach) && (kind !== 'road' || clearOf(hx, hz, F.h, 0.6));
    };
    for (let k = 0; k < 12; k++) {
      for (const v of [a0 + k * 0.8, a0 - k * 0.8]) {
        if (!ok(v)) continue;
        const [x, z] = at(v);
        if (kind === 'road') X.roadLight(x, z, y, axis === 'x' ? (o > 0 ? Math.PI / 2 : -Math.PI / 2) : (o > 0 ? 0 : Math.PI));
        else X.pedLight(x, z, y);
        poles.push([x, z]);
        return;
      }
    }
  };
  for (const [side, from, to] of [['n', -HX + 12, HX - 8], ['s', -HX + 12, HX - 8], ['w', -HZ + 10, HZ - 6], ['e', -HZ + 10, HZ - 6]]) {
    for (let a = from; a <= to; a += spacing) {
      place(side, a, 'road');
      if (a + spacing / 2 <= to) place(side, a + spacing / 2, 'ped');
    }
  }

  // groundcover and low shrubs along the tree lawns, clear of trunks and posts
  const shrubStep = full ? 2.4 : 4.8;
  let n = 0;
  for (const side of ['n', 's', 'w', 'e']) {
    for (const [a0, a1] of vergeSegments(side)) {
      for (let a = a0 + 0.8; a <= a1 - 0.8; a += shrubStep) {
        const d = VERGE_CENTRE + (n % 2 ? 0.35 : -0.35);
        const r = across(side, a, a, d, d);
        const [x, z] = [r[0], r[2]];
        if (street.some((p) => Math.hypot(p.x - x, p.z - z) < 1.5) || poles.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 1.0) || inSight(x, z)) continue;
        const sz = 0.8 + (n % 3) * 0.2, h = 0.55 + (n % 2) * 0.25;
        add('cone', x, VERGE_TOP + h / 2, z, sz, h, sz, n % 3 === 1 ? 'shrubDark' : 'shrub', C);
        n++;
      }
    }
  }

  // the 2.4 m sidewalk walk stays clear: benches and bicycle stands sit in the site's own
  // furnishing zones (plan/pedestrian.js FURNISHING), not on the public walk
  // bollard lights at the promenade, spine and galleria mouths: on the edges only, never in the walk
  for (const [x, z] of [[HX - 0.5, 1.9], [HX - 0.5, 9.1], [-2.9, HZ - 0.5], [2.9, HZ - 0.5], [-14.1, -HZ + 0.5], [-8.4, -HZ + 0.5]]) X.bollard(x, z, 0.07);

  return out;
}
