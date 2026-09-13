// Streetscape around the development block: the street surface, stone curbs, and
// sidewalks split into a planted tree lawn along the curb (street trees, palms,
// streetlights and groundcover) and a scored concrete walk along the property line,
// with paved breaks at entrances, paths and curb cuts. Plus zebra crosswalks,
// driveway aprons, benches, bike racks and bollards. Ground-level "context" items
// that arrive with the landscape.
import { RES, GLAZE, HX, HZ, WALK, HALF_ROAD, PITCH_X, PITCH_Z, roundedRectPlan, resampleByAngle, offsetPlan, box, partsKit } from './core.js';

const CURB = [-HX - WALK, HX + WALK, -HZ - WALK, HZ + WALK];          // 84.5 × 59.75
const STREET = 2 * HALF_ROAD;                                          // 13 m curb to curb
export const SIDEWALK_TOP = 0.15;
export const BLOCK_PAVING_TOP = 0.03;
export const CURB_W = 0.3;
export const VERGE_W = 1.8;                                            // tree lawn behind the curb
export const WALK_CLEAR = WALK - CURB_W - VERGE_W;                      // 2.4 m scored walk
export const VERGE_CENTRE = WALK - CURB_W - VERGE_W / 2;               // property line → tree line (3.3 m)
const VERGE_TOP = SIDEWALK_TOP + 0.03;

// curb cuts (driveways across the sidewalk): [side, from, to]
export const DRIVEWAYS = [
  ['n', -64.6, -58.2],   // residential garage
  ['n', -39.9, -35.3],   // residential loading
  ['n', 40.6, 64.0],     // hotel staff entry, receiving, refuse
  ['e', -42.0, -10.0],   // hotel arrival drive
  ['e', 15.0, 28.0],     // office car lifts
  ['e', 41.5, 48.5],     // office loading
];

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
  n: [[-27, -20], [-14, -8]],                                  // paseo walk + promenade
  s: [[-57.5, -42.5], [-27, -20], [-3, 3], [18.5, 23.5]],      // podium lobby, arcade walk, park path, office walk
  w: [[-35.5, -21]],                                           // podium west lobby
  e: [[6.5, 11.5]],                                            // lane
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
    { ...ctx, name: 'S.sidewalk', type: 'ring', kind: 'sidewalk', y0: 0, h: SIDEWALK_TOP, pts: rs(offsetPlan(curb, -CURB_W)), inner: rs(property) },
    { ...ctx, name: 'S.blockPaving', type: 'prism', kind: 'paving', y0: 0, h: BLOCK_PAVING_TOP, pts: property },
  ];
}

export function streetscapeSlabs() {
  const t = (i) => [0.662 + i * 0.002, 0.05];
  const out = [];
  // driveway aprons: drive-coloured paving across the sidewalk, flush with it
  DRIVEWAYS.forEach(([side, a0, a1], k) => {
    const r = across(side, a0, a1, 0, WALK - CURB_W);
    out.push(box(`S.apron${k}`, r[0], r[1], r[2], r[3], 0, SIDEWALK_TOP + 0.005, 'drive', 'L', t(k)));
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

export function streetscapeParts(tier, trees, palms) {
  const out = [];
  const K = partsKit(out);
  const { add, block, column, bench, bollard } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const y = SIDEWALK_TOP;
  const plantings = [...trees, ...palms].filter((p) => p.y === 0 && (Math.abs(p.x) > HX || Math.abs(p.z) > HZ));
  const nearPlanting = (x, z, d = 2.2) => plantings.some((p) => Math.hypot(p.x - x, p.z - z) < d);
  const onDriveway = (side, a, pad = 1.5) => DRIVEWAYS.some(([s, a0, a1]) => s === side && a > a0 - pad && a < a1 + pad);

  // scored concrete walk: control joints across the walk zone, a stone header at the lawn edge
  const jointStep = full ? 1.5 : 3.0;
  for (const side of ['n', 's', 'w', 'e']) {
    const [r0, r1] = SIDE[side].range;
    for (let a = r0 - 2; a <= r1 + 2; a += jointStep) {
      if (onDriveway(side, a, 0.1)) continue;
      const r = across(side, a - 0.025, a + 0.025, 0.02, WALK_CLEAR);
      block(r[0], r[1], y, y + 0.006, r[2], r[3], 'joint', C);
    }
    for (const [a0, a1] of vergeSegments(side)) {
      const r = across(side, a0, a1, WALK_CLEAR - 0.1, WALK_CLEAR + 0.02);
      block(r[0], r[1], y, VERGE_TOP + 0.03, r[2], r[3], 'stone', C);
    }
  }

  // zebra crosswalks at the block's corners, on both streets
  const xs = [-PITCH_X / 2, PITCH_X / 2], zs = [-PITCH_Z / 2, PITCH_Z / 2];
  for (const xc of xs) for (const zc of zs) {
    const sx = Math.sign(xc), sz = Math.sign(zc);
    const xw = xc - sx * (HALF_ROAD + 3.5);
    for (let k = 0; k < 6; k++) { const zz = zc - HALF_ROAD + 1.2 + k * 2.1; block(xw - 1.6, xw + 1.6, 0.02, 0.035, zz - 0.3, zz + 0.3, 'frame', C); }
    const zw = zc - sz * (HALF_ROAD + 3.5);
    for (let k = 0; k < 6; k++) { const xx = xc - HALF_ROAD + 1.2 + k * 2.1; block(xx - 0.3, xx + 0.3, 0.02, 0.035, zw - 1.6, zw + 1.6, 'frame', C); }
  }

  // streetlights in the tree lawn, spaced ~22 m, clear of trees, palms and driveways
  const lights = [];
  const light = (x, z, ax, az) => {
    lights.push([x, z]);
    column(x, z, y, 6.5, 0.08, 'metal', C);
    block(Math.min(x, x + ax * 1.4) - 0.05, Math.max(x, x + ax * 1.4) + 0.05, y + 6.35, y + 6.5, Math.min(z, z + az * 1.4) - 0.05, Math.max(z, z + az * 1.4) + 0.05, 'metal', C);
    block(x + ax * 1.4 - 0.25, x + ax * 1.4 + 0.25, y + 6.2, y + 6.35, z + az * 1.4 - 0.12, z + az * 1.4 + 0.12, 'lamp', C);
  };
  const edge = WALK - CURB_W - 0.6;   // lamp posts 0.6 m behind the curb face
  const spacing = full ? 22 : 33;
  const inVerge = (side, a) => vergeSegments(side).some(([a0, a1]) => a > a0 + 0.3 && a < a1 - 0.3);
  const place = (side, a0, fixed, ax, az) => {
    let a = a0;
    const at = (v) => (SIDE[side].axis === 'x' ? [v, fixed] : [fixed, v]);
    const bad = (v) => nearPlanting(...at(v)) || onDriveway(side, v) || !inVerge(side, v);
    for (let tries = 0; tries < 6 && bad(a); tries++) a += 2.5;
    if (!bad(a)) light(...at(a), ax, az);
  };
  for (let a = -HX + 14; a <= HX - 10; a += spacing) {
    place('n', a, -HZ - edge, 0, -1);
    place('s', a, HZ + edge, 0, 1);
  }
  for (let a = -HZ + 12; a <= HZ - 10; a += spacing) {
    place('w', a, -HX - edge, -1, 0);
    place('e', a, HX + edge, 1, 0);
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
        if (nearPlanting(x, z, 1.5) || lights.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 1.0)) continue;
        const s = 0.8 + (n % 3) * 0.2, h = 0.55 + (n % 2) * 0.25;
        add('cone', x, VERGE_TOP + h / 2, z, s, h, s, n % 3 === 1 ? 'shrubDark' : 'shrub', C);
        n++;
      }
    }
  }

  // benches on the south walk between the palms, backs to the tree lawn
  for (const x of [-40, -4, 8, 32]) if (!nearPlanting(x, HZ + 0.9, 2.0)) bench(x, HZ + 0.9, y, 2.4, 0, 'frame');
  // bike racks beside the office lobby and the podium's south lobby
  const rack = (x0, z, count) => { for (let k = 0; k < count; k++) block(x0 + k * 0.9 - 0.04, x0 + k * 0.9 + 0.04, y, y + 0.8, z - 0.35, z + 0.35, 'metal', C); };
  rack(18.2, HZ + 1.0, 5);
  rack(-30.5, HZ + 1.0, 5);

  // bollards where the paseo walks and the lane meet the street (pedestrian only)
  for (let x = -25.5; x <= -20.5; x += 1.25) { bollard(x, -HZ + 0.6, 0.03); bollard(x, HZ - 0.6, 0.03); }
  for (let x = -13.0; x <= -9.5; x += 1.25) bollard(x, -HZ + 0.6, 0.03);
  for (let z = 1.0; z <= 13.0; z += 1.6) bollard(HX - 0.6, z, 0.03);

  return out;
}
