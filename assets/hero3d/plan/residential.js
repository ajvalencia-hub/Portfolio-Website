// A — residential: two twisting towers on a retail + structured-parking podium
// whose roof is a resort amenity level.
//
// Structure concept (visual model, not an engineered design):
//   • each tower keeps ONE occupied floorplate shape; the glass line may lean at
//     most ±0.35 m with the twist, so floors stack over a continuous central core
//     and a fixed ring of perimeter columns that runs from the foundations to the
//     penthouse roof — no transfer at tower floors
//   • the twist is carried by the balcony ribbons, which rotate floor by floor
//     within a cantilever limit measured from the column line
//   • tower columns land on the podium's parking module lines (aisle edges and
//     back-to-back stall lines), so they come down through the garage without
//     transfers and without entering drive aisles
//   • the only declared transfer is the upper penthouse perimeter bearing on the
//     lower penthouse roof (listed in `transfers` with its conceptual allowance)
import { penthouseSuite } from './penthouse.js';
import { fixtureKit } from './fixtures.js';
import { poolSpecs as sharedPool, spaSpecs as sharedSpa } from './pools.js';
import {
  FLOOR, GROUND, RES, D2R, GLAZE, PODIUM_TOP, DECK_BUILDUP, DECK_Y, ARCADE,
  clamp, superellipse, roundedRectPlan, offsetPlan, arcSamples, insidePlan, polarRadius,
  rayRadius, resampleByAngle, clipBand, circlePlan, inRect, partsKit, box,
} from './core.js';

export const PODIUM_PLAN = superellipse(-51, -1, 25, 50, 6, 160);

// ---------------------------------------------------------------------------
// Podium parking module (levels L2 and L3). Stalls 2.6 × 5.4 m, two-way aisles
// 6.8 m. Column lines sit 0.45 m inside the stall rows beside each aisle, on the
// back-to-back strip, and on the ramp median. Rect = [x0, x1, z0, z1].
// ---------------------------------------------------------------------------
export const PODIUM_PARKING = {
  levels: [
    { name: 'Residential P-L2', floor: GROUND, ceiling: GROUND + FLOOR },
    { name: 'Residential P-L3', floor: GROUND + FLOOR, ceiling: PODIUM_TOP },
  ],
  slab: 0.3,                 // flat-plate structural depth (assumption)
  linerDepth: 7.8,           // occupied liner units on the south and east faces of L2/L3 (inside a 0.6 m screen zone)
  aisles: [
    { name: 'aisle W', rect: [-64.8, -58.0, -48.6, 47.4] },
    { name: 'aisle E north', rect: [-46.6, -39.8, -48.6, -15.0] },
    { name: 'aisle E south', rect: [-46.6, -39.8, 15.0, 47.4] },
    { name: 'cross N', rect: [-64.8, -39.8, -48.6, -42.8] },
    { name: 'cross S', rect: [-64.8, -39.8, 40.6, 47.4] },
    { name: 'cross mid', rect: [-64.8, -46.6, -3.4, 3.4] },
  ],
  stallRows: [
    { x: [-70.2, -64.8], aisle: 'aisle W', side: 'w' },
    { x: [-58.0, -52.6], aisle: 'aisle W', side: 'e' },
    { x: [-52.0, -46.6], aisle: ['aisle E north', 'aisle E south'], side: 'w' },
    { x: [-39.8, -34.4], aisle: ['aisle E north', 'aisle E south'], side: 'e' },
  ],
  // stacked switchback ramp between the towers: two one-way lanes, 30 m runs
  ramp: {
    rect: [-46.6, -37.6, -15.0, 15.0], lanes: [[-46.6, -42.4], [-41.8, -37.6]], run: 30,
    // each level change uses two runs (up the west lane, back down the east lane side)
    rises: [GROUND, FLOOR], landing: 'north', connects: 'aisle E north',
  },
  columnLines: [-70.65, -65.25, -57.55, -52.3, -47.05, -42.1, -39.35, -34.0],
  columnStep: 8.4, columnOrigin: -1.0,
  entry: { portal: [-64.6, -58.2], z: -1 - 50 + ARCADE, aisle: 'aisle W' },
  // ground floor: retail liner, lobbies, services and the approach to the ramp
  ground: {
    aisles: [
      { name: 'G entry', rect: [-64.8, -58.0, -48.6, -42.8] },
      { name: 'G cross N', rect: [-64.8, -39.8, -48.6, -42.8] },
      { name: 'G approach', rect: [-46.6, -39.8, -48.6, -15.0] },
    ],
    rooms: [
      { name: 'Residential loading dock', use: 'service', rect: [-39.4, -33.4, -46.0, -38.5] },
      { name: 'Residential refuse + recycling', use: 'service', rect: [-39.4, -33.4, -38.5, -33.0] },
      { name: 'Tower 1 lobby (west entrance)', use: 'lobby', rect: [-72.5, -56.3, -32.0, -25.0] },
      { name: 'Tower 2 lobby (south entrance)', use: 'lobby', rect: [-55.5, -46.5, 31.5, 45.5] },
      { name: 'Electrical / water / pool plant', use: 'plant', rect: [-70.0, -58.5, -12.0, 10.0] },
      { name: 'Bicycle + resident storage', use: 'plant', rect: [-56.0, -48.5, -12.0, -4.0] },
    ],
  },
  // garage stair / lift cores that reach the amenity deck
  cores: [
    { name: 'Podium stair + lift (east)', rect: [-33.6, -29.4, -2.0, 2.2] },
    { name: 'Podium stair (north-west)', rect: [-74.6, -71.0, -21.0, -16.0] },
  ],
};

const FORBIDDEN_FOR_COLUMNS = [
  ...PODIUM_PARKING.aisles.map((a) => a.rect),
  ...PODIUM_PARKING.ground.aisles.map((a) => a.rect),
  PODIUM_PARKING.ramp.rect,
];

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------
const MAX_CANTILEVER = 3.5;  // slab edge beyond the perimeter column line (geometric limit)
const COLUMN = 0.6;          // perimeter column size (assumption, square)

// Tower 1 — tall rounded triangle; balcony ribbons turn 72° over 22 floors.
const TOWER1 = {
  id: 'A.t1', cx: -52, cz: -29, floors: 22, twist: 72, lean: 0.25, perimeter: 0.35,
  shape: { R: 13.2, a2: 0.05, p2: -10, a3: 0.12, p3: -90 },
  core: { w: 8.6, d: 7.4 },
  minDepth: 0.9,
  // the ribbon outline has stronger lobes than the floorplate, so its turn reads clearly
  ribbon: (t, g, eMax, shape, tw) => polarRadius({ ...shape, R: shape.R + 1.9, a3: 0.2 }, t - tw * D2R),
  // penthouse: crescent lap pool on the west-south-west (toward the hero view), a separate spa
  // beyond its west end, the roof sweeping out over a south lounge
  penthouse: { poolAngle: 150, recess: [1.4, 8.0, 100], poolType: 'crescent', spa: 'separate', spaSide: 1, shade: 'overhang', shadeAngle: 80, deckEdge: 2.4,
    layout: [
      { type: 'loungers', n: 4, at: 150 }, { type: 'living', at: 80 }, { type: 'daybeds', at: 112 },
      { type: 'dining', at: 218, pergola: true }, { type: 'bar', at: 30, desktopOnly: true }, { type: 'palms', at: [96, 250, 330] },
      { type: 'planters', at: [55, 180, 275, 5] },
    ] },
  timing: [0.370, 0.104],
};

// Tower 2 — lower egg-shaped oval; ribbons ripple in a wave that climbs the tower.
// Centred at x −52.3 so its column ring clears both garage drive aisles.
const TOWER2 = {
  id: 'A.t2', cx: -52.3, cz: 28, floors: 16, twist: -24, lean: 0.25, perimeter: 0.35,
  shape: { R: 12.6, a1: 0.05, p1: 20, a2: 0.19, p2: 18 },   // a2 < 0.2 keeps the oval convex
  core: { w: 8.0, d: 7.0 },
  minDepth: 0.9,
  ribbon: (t, g, eMax, shape, tw) => eMax + 0.9 + 2.0 * (0.5 + 0.5 * Math.sin(2 * (t - (shape.p2 + tw) * D2R) + g * 0.55)),
  // penthouse: freeform oval pool on the west with a raised spa integrated at its southern
  // end, dining under a white pergola on the south terrace
  penthouse: { poolAngle: 190, recess: [1.3, 7.2, 92], poolType: 'oval', spa: 'integrated', spaSide: -1, shade: 'pergola', shadeAngle: 245, deckEdge: 2.2,
    layout: [
      { type: 'loungers', n: 4, at: 196 }, { type: 'living', at: 135 }, { type: 'dining', at: 245, pergola: true },
      { type: 'bar', at: 330, desktopOnly: true }, { type: 'palms', at: [118, 275, 20] },
      { type: 'planters', at: [95, 160, 300, 50] },
    ] },
  timing: [0.380, 0.090],
};

export const TOWERS = [TOWER1, TOWER2];

const ringSpec = (name, outer, inner, h, parent, timing, opts = {}) => ({
  name, type: 'ring', kind: opts.kind ?? 'frame', glaze: opts.glaze ?? GLAZE.guard, module: opts.module ?? [0, FLOOR],
  parent, y0: opts.y0 ?? 0, h, start: timing[0], dur: timing[1], pts: outer, inner,
  wire: opts.wire ?? (opts.glaze ?? GLAZE.guard) !== GLAZE.guard, phase: opts.phase,
});

// Perimeter columns: where the column ring crosses the podium's column lines,
// then gaps over 8.6 m filled on the ring (or on the nearest inward line when the
// ring point would sit in a drive aisle or the ramp).
function placeColumns(cx, cz, th, ringR) {
  const N = th.length;
  const pt = (i) => [cx + ringR[i % N] * Math.cos(th[i % N]), cz + ringR[i % N] * Math.sin(th[i % N])];
  const blocked = (x, z) => FORBIDDEN_FOR_COLUMNS.some((r) => inRect(x, z, r, COLUMN / 2 + 0.1));
  let cols = [];
  for (const lx of PODIUM_PARKING.columnLines) {
    for (let i = 0; i < N; i++) {
      const [ax, az] = pt(i), [bx, bz] = pt(i + 1);
      if ((ax - lx) * (bx - lx) > 0 || ax === bx) continue;
      const t = (lx - ax) / (bx - ax);
      const z = az + t * (bz - az);
      if (!blocked(lx, z)) cols.push([lx, z]);
    }
  }
  const angle = ([x, z]) => Math.atan2(z - cz, x - cx);
  const dedupe = () => {
    cols.sort((a, b) => angle(a) - angle(b));
    cols = cols.filter((c, k) => k === 0 || Math.hypot(c[0] - cols[k - 1][0], c[1] - cols[k - 1][1]) > 2.0);
  };
  dedupe();
  const ringAt = (a) => {
    const u = (((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * N;
    const i = Math.floor(u), f = u - i;
    return ringR[i % N] * (1 - f) + ringR[(i + 1) % N] * f;
  };
  // fill gaps over 8.6 m with ring points clear of aisles and the ramp; where the whole
  // arc lies over a drive aisle the gap stays open (a long perimeter span, reported)
  const open = new Set();
  const key = (a, b) => `${a[0].toFixed(2)},${a[1].toFixed(2)}|${b[0].toFixed(2)},${b[1].toFixed(2)}`;
  for (let guard = 0; guard < 60; guard++) {
    let worst = -1, gap = 8.6;
    for (let k = 0; k < cols.length; k++) {
      const a = cols[k], b = cols[(k + 1) % cols.length];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d > gap && !open.has(key(a, b))) { gap = d; worst = k; }
    }
    if (worst < 0) break;
    const a = cols[worst], b = cols[(worst + 1) % cols.length];
    let a0 = angle(a), a1 = angle(b);
    if (a1 < a0) a1 += 2 * Math.PI;
    let best = null;
    for (let s = 1; s < 40; s++) {
      const am = a0 + ((a1 - a0) * s) / 40;
      const r = ringAt(am);
      const p = [cx + r * Math.cos(am), cz + r * Math.sin(am)];
      if (blocked(p[0], p[1])) continue;
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < 3 || Math.hypot(p[0] - b[0], p[1] - b[1]) < 3) continue;
      const score = Math.abs(s - 20);
      if (!best || score < best.score) best = { p, score };
    }
    if (!best) { open.add(key(a, b)); continue; }
    cols.push(best.p);
    dedupe();
  }
  return cols;
}

function buildTower(cfg, N, tier) {
  const { id, cx, cz, shape, floors } = cfg;
  const th = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);
  const plan = (rs, ox = 0, oz = 0) => rs.map((r, i) => [cx + ox + r * Math.cos(th[i]), cz + oz + r * Math.sin(th[i])]);
  const twist = (g) => (cfg.twist * (g - 1)) / (floors - 1);
  const base = th.map((t) => polarRadius(shape, t));

  // occupied floorplates: one shape; the glass line leans a little with the twist
  const enc = [];
  for (let g = 1; g <= floors; g++) {
    enc.push(base.map((b, i) => b + clamp(cfg.lean * (polarRadius(shape, th[i] - twist(g) * D2R) - b), -cfg.perimeter, cfg.perimeter)));
  }
  const minEnc = base.map((_, i) => Math.min(...enc.map((e) => e[i])));
  const columns = placeColumns(cx, cz, th, minEnc.map((r) => r - 0.5));
  const colPoly = columns;  // sorted by angle
  const colR = th.map((t) => rayRadius(cx, cz, colPoly, t));

  const slabs = [];
  for (let g = 1; g <= floors; g++) {
    const e = enc[g - 1];
    const up = g < floors ? enc[g] : null;
    const outer = [], inner = [];
    for (let i = 0; i < N; i++) {
      const eMax = up ? Math.max(e[i], up[i]) : e[i];
      const eMin = up ? Math.min(e[i], up[i]) : e[i];
      const lo = eMax + cfg.minDepth;
      outer.push(up ? clamp(cfg.ribbon(th[i], g, eMax, shape, twist(g)), lo, Math.max(lo, colR[i] + MAX_CANTILEVER)) : e[i] + 0.6);
      inner.push(eMin - 0.25);
    }
    // the top floor's roof is the penthouse plinth (no separate roof slab sharing its plane)
    if (g < floors) slabs.push({ y: g * FLOOR, thick: 0.36, outer: plan(outer), inner: plan(inner) });
  }

  const specs = [];
  const bodyName = `${id}.body`;
  specs.push({
    name: bodyName, type: 'stack', kind: 'glass', glaze: GLAZE.residential, module: RES, parent: 'A.podium', y0: 0,
    h: floors * FLOOR, floorH: FLOOR, floorPlans: enc.map((r) => plan(r)), pts: plan(enc[0]),
    start: cfg.timing[0], dur: cfg.timing[1], slabs: { kind: 'slab', floors: slabs },
  });

  const core = roundedRectPlan(cx - cfg.core.w / 2, cz - cfg.core.d / 2, cx + cfg.core.w / 2, cz + cfg.core.d / 2, 0.6);
  const topY = PODIUM_TOP + floors * FLOOR;
  const top = enc[floors - 1];
  const t0 = cfg.timing[0] + cfg.timing[1];
  const suite = penthouseSuite({
    id, cx, cz, N, th, top, colR, columns, core, topY, bodyName, t0, maxCantilever: MAX_CANTILEVER,
  }, cfg.penthouse, tier);
  specs.push(...suite.specs);
  return {
    specs,
    penthouse: suite,
    meta: {
      id, cx, cz, N, floors, topY, body: bodyName, core, columns, columnSize: COLUMN,
      // perimeter columns and core stop at the underside of the penthouse plinth
      columnTopY: topY, coreTopY: suite.meta.phTopY,
      maxCantilever: MAX_CANTILEVER,
      penthouse: suite.meta,
      transfers: [suite.transfer],
    },
  };
}

// ---------------------------------------------------------------------------
// Resort pool: long axis east–west (site x), matching the hotel pool, set across
// the deck between tower 1 (north) and tower 2 (south). Wide swimming area with
// rounded ends, entry steps at the west end and a sun shelf at the east end.
// Depths, basin slab and build-up are explicit conceptual parameters.
// ---------------------------------------------------------------------------
// Free-form outline on a straight axis: the edges swell into a broad swimming lobe at
// the west end and a sun-shelf lobe at the east end with a gentle waist between, and
// are mirrored about the east–west centreline so the pool never reads as skewed.
export const POOL = {
  xW: -66.0, xE: -53.5, cz: 0,
  halfWidth: 5.2,            // mean half-width between the end centres
  lobe: 0.45,                // both ends swell by this much, the waist narrows by it
  taper: 0.2,                // west (swimming) lobe broader than the east (shelf) lobe
  terraceRaise: 0.45,        // raised pool terrace above the general deck
  waterBelowTerrace: 0.12,   // = POOL_DETAIL.waterDown (shared pool generator)
  swimDepth: 1.1,            // CONCEPTUAL — confirm with pool engineer / code
  shelfDepth: 0.3,
  basinSlab: 0.35,           // CONCEPTUAL basin slab + waterproofing
  terrace: roundedRectPlan(-75.0, -12.5, -46.0, 12.5, 2.5),
  mepAllowance: 0.3,         // sprinkler / lighting / drainage below the basin soffit
  carClearance: 2.1,         // standard car clear height (van-accessible stalls need more)
};
POOL.cx = (POOL.xW + POOL.xE) / 2;
POOL.terraceY = DECK_Y + POOL.terraceRaise;
POOL.waterY = POOL.terraceY - POOL.waterBelowTerrace;
POOL.basinSoffitY = POOL.waterY - POOL.swimDepth - POOL.basinSlab;

// half-width at x: zero slope at both end centres, so the semicircular caps join smoothly
export function poolHalfWidth(x) {
  const t = Math.min(1, Math.max(0, (x - POOL.xW) / (POOL.xE - POOL.xW)));
  return POOL.halfWidth + POOL.lobe * Math.cos(2 * Math.PI * t) + POOL.taper * Math.cos(Math.PI * t);
}

function poolOutline() {
  const { xW, xE, cz } = POOL;
  const L = xE - xW;
  const zc = () => cz;   // straight axis
  const hw = poolHalfWidth;
  const pts = [];
  const steps = 24;
  for (let k = 0; k <= steps; k++) { const x = xW + (L * k) / steps; pts.push([x, zc(x) + hw(x)]); }
  for (let k = 1; k < 12; k++) { const a = Math.PI / 2 - (Math.PI * k) / 12; pts.push([xE + hw(xE) * Math.cos(a), zc(xE) + hw(xE) * Math.sin(a)]); }
  for (let k = 0; k <= steps; k++) { const x = xE - (L * k) / steps; pts.push([x, zc(x) - hw(x)]); }
  for (let k = 1; k < 12; k++) { const a = -Math.PI / 2 - (Math.PI * k) / 12; pts.push([xW + hw(xW) * Math.cos(a), zc(xW) + hw(xW) * Math.sin(a)]); }
  return pts;
}

// Built with the shared pool generator (plan/pools.js): raised paved terrace with the pool
// opening, recessed drainage gutter, coping, waterline tile band, and water split into
// entry steps (west), swimming area and sun shelf (east).
function poolSpecs(N) {
  const outline = poolOutline();
  const tipW = POOL.xW - (poolHalfWidth(POOL.xW) + 0.25);
  const shelfX = POOL.xE - 1.5;
  const pool = sharedPool('A.pool', {
    outline, cx: POOL.cx, cz: POOL.cz, deckY: POOL.terraceY, depth: POOL.swimDepth, N, gutter: 0.12, axis: 'x',
    ripple: [POOL.cx, 0, 0, 0],
    bands: [
      { name: 'A.poolStep1', from: -120, to: tipW + 1.2, kind: 'shelf' },
      { name: 'A.poolStep2', from: tipW + 1.2, to: tipW + 2.2, kind: 'shelfDeep' },
      { name: 'A.poolStep3', from: tipW + 2.2, to: POOL.xW - 0.4, kind: 'shelf' },
      { name: 'A.poolSwim', from: POOL.xW - 0.4, to: shelfX, kind: 'pool' },
      { name: 'A.poolShelf', from: shelfX, to: 30, kind: 'shelf' },
    ],
  });
  const terrace = resampleByAngle(POOL.terrace, POOL.cx, POOL.cz, N);
  const specs = [
    { name: 'A.poolTerrace', type: 'prism', kind: 'deck', glaze: GLAZE.pavers, module: [0.9, 0.9], parent: null,
      y0: DECK_Y, h: POOL.terraceRaise, start: 0.655, dur: 0.01, wire: false, phase: 'context', pts: terrace, holes: [pool.opening] },
    ...pool.specs,
  ];
  return { specs, outline: pool.basin.outline, shelfX, stepsX: [tipW, POOL.xW - 0.4], basin: pool.basin };
}

// raised spa on the wellness terrace (no depressed slab: floor at the structural top)
export const SPA = { x: -57.5, z: 42.0, r: 1.45, coping: 0.55, raise: 0.45, depth: 0.9 };

function spaSpecs() {
  return sharedSpa('A.spa', { x: SPA.x, z: SPA.z, r: SPA.r, deckY: DECK_Y, raise: SPA.raise, depth: SPA.depth }).specs;
}

// ---------------------------------------------------------------------------

export function residentialMasses(tier) {
  const N = tier.name === 'mobile' ? 72 : 112;
  const towers = TOWERS.map((cfg) => buildTower(cfg, N, tier));
  const pool = poolSpecs(tier.name === 'mobile' ? 72 : 96);
  const specs = [
    // ground floor: storefronts + residential lobbies, set back behind the arcade
    { name: 'A.base', type: 'prism', kind: 'glass', glaze: GLAZE.storefront, module: RES, parent: null, y0: 0, h: GROUND,
      start: 0.300, dur: 0.055, pts: offsetPlan(PODIUM_PLAN, -ARCADE) },
    // two parking decks; liner units on the street and plaza faces, recessed decks behind the wave screen elsewhere
    { name: 'A.podium', type: 'prism', kind: 'podium', glaze: GLAZE.garageRecess, module: RES, parent: 'A.base', y0: 0, h: 2 * FLOOR,
      start: 0.330, dur: 0.040, pts: PODIUM_PLAN },
    garageWaveScreen(tier),
    // amenity deck: pedestal pavers over the podium roof, glass guard at the edge
    { name: 'A.deck', type: 'prism', kind: 'deck', glaze: GLAZE.bond, module: [1.8, 0.9], parent: 'A.podium', y0: 0, h: DECK_BUILDUP,
      start: 0.368, dur: 0.002, pts: offsetPlan(PODIUM_PLAN, -0.4) },
    ringSpec('A.guard', offsetPlan(PODIUM_PLAN, -0.12), offsetPlan(PODIUM_PLAN, -0.34), 1.6, 'A.podium', [0.368, 0.004], { module: [DECK_BUILDUP, FLOOR] }),
    ...towers.flatMap((t) => t.specs),
    ...pool.specs,
    ...spaSpecs(),
  ];
  return { specs, towers: towers.map((t) => t.meta), penthouses: towers.map((t) => t.penthouse), pool };
}

// ---------------------------------------------------------------------------
// Garage wave screen: a reusable parametric system (built by layers/curves.js, type
// 'waves'). Horizontal white fins wrap the whole podium at the two parking levels,
// each rising and falling in a long wave that echoes the tower balcony ribbons and
// swelling in depth for shadow; phase offsets between fins make the waves drift up the
// facade. Fins are ~80% open for natural ventilation and conceal parked cars. Breaks
// keep the residential lobbies (signage panels) and the garage stair cores open.
// ---------------------------------------------------------------------------
export const GARAGE_SCREEN = {
  levels: [GROUND + 0.55, PODIUM_TOP - 0.55],
  amplitude: 0.3, wavelength: 22, depthWavelength: 34, depth: [0.45, 1.0], thick: 0.14,
  breaks: [
    { name: 'Tower 2 lobby (south)', at: [-50, 49], width: 9, sign: true },
    { name: 'Tower 1 lobby (west)', at: [-76, -28], width: 9, sign: true },
    { name: 'Garage stair (north-west)', at: [-76, -18.5], width: 4.5 },
    { name: 'Garage stair + lift (east)', at: [-26, 0.1], width: 5 },
  ],
};
function nearestOnPlan(plan, [x, z]) {
  const s = arcSamples(plan, 0.25);
  return s.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
}
export function garageScreenBreaks() {
  return GARAGE_SCREEN.breaks.map((b) => ({ ...b, ...nearestOnPlan(PODIUM_PLAN, b.at) }));
}
function garageWaveScreen(tier) {
  const G = GARAGE_SCREEN;
  const full = tier.name !== 'mobile';
  const count = full ? 8 : 6;
  const fins = Array.from({ length: count }, (_, k) => ({ y: G.levels[0] + ((G.levels[1] - G.levels[0]) * k) / (count - 1), phase: k * 0.5 }));
  return {
    name: 'A.garageScreen', type: 'waves', kind: 'frame', glaze: GLAZE.none, module: RES, parent: null, y0: GROUND, h: 2 * FLOOR,
    start: 0.370, dur: 0.004, wire: false, pts: PODIUM_PLAN,
    waves: {
      spacing: full ? 0.5 : 1.0, fins, amplitude: G.amplitude, wavelength: G.wavelength, depthWavelength: G.depthWavelength,
      depth: G.depth, thick: G.thick, lights: full ? [2, 5] : [2],
      breaks: garageScreenBreaks().map((b) => ({ x: b.x, z: b.z, width: b.width })),
    },
  };
}

// the deck walk runs north–south just east of the pool terrace, from inside tower 1's
// deck lobby to inside tower 2's
export const DECK_WALK = { x0: -45.0, x1: -42.0 };
function walkEnds() {
  const x = (DECK_WALK.x0 + DECK_WALK.x1) / 2;
  const edge = (t, dir) => {
    const inside = (zz) => Math.hypot(x - t.cx, zz - t.cz) < polarRadius(t.shape, Math.atan2(zz - t.cz, x - t.cx));
    let z = t.cz;
    while (inside(z)) z += dir * 0.1;
    return z - dir * 0.6;
  };
  return [edge(TOWER1, 1), edge(TOWER2, -1)];
}

export function residentialSlabs() {
  const t = (i) => [0.662 + i * 0.003, 0.05];
  const [z0, z1] = walkEnds();
  return [
    box('L.walk', DECK_WALK.x0, DECK_WALK.x1, z0, z1, PODIUM_TOP, DECK_BUILDUP + 0.03, 'walk', 'L', t(0), null, { glaze: GLAZE.pavers, module: [0.75, 0.75] }),
  ];
}

// ---------------------------------------------------------------------------
// Parts: podium arcade, lobbies, portals, tower terrace columns, amenity level.
// ---------------------------------------------------------------------------
export function residentialParts(tier, towers, rand) {
  const out = [];
  const K = partsKit(out);
  const { block, column, alongFacade, bed, umbrella, lounger, sideTable, dining, sofaGroup, cabana, pergola, bollard, add } = K;
  const C = 'context';
  const palms = [];
  const deckPalm = (x, z, planterH, h = 7 + rand() * 1.5, baseY = DECK_Y) => palms.push({ x, z, y: baseY + planterH, h, r: 2.3 + rand() * 0.5, spin: rand() * Math.PI, start: 0.68, dur: 0.05, deck: true, planterH });
  const palmPlanter = (x, z, size = 1.8, h = 0.9) => { bed(x - size / 2, x + size / 2, z - size / 2, z + size / 2, DECK_Y, h); deckPalm(x, z, h); };
  const full = tier.name !== 'mobile';

  // --- podium arcade, residential lobbies, garage + loading portals -------------
  const nearest = (samples, test, x, z) => samples.filter(test).reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
  for (const s of arcSamples(PODIUM_PLAN, 8.4)) {
    if (s.nz < -0.5 && s.x > -68 && s.x < -28) continue;  // keep the garage and loading frontage clear
    column(s.x - s.nx * 1.0, s.z - s.nz * 1.0, 0, GROUND, 0.38);
  }
  const podiumFine = arcSamples(PODIUM_PLAN, 0.5);
  for (const [test, x, z] of [[(s) => s.nz > 0.9, -50, 49], [(s) => s.nx < -0.9, -76, -28]]) {
    const s = nearest(podiumFine, test, x, z);
    alongFacade(s, 0, 4.35, 0.4, 12, 5, 'frame');
    const tx = -s.nz, tz = s.nx;
    for (const side of [-1, 1]) column(s.x + s.nx * 2.2 + tx * 5.6 * side, s.z + s.nz * 2.2 + tz * 5.6 * side, 0, 4.35, 0.1, 'metal');
  }
  // wave-screen breaks at the lobbies: a flat white signage panel (no lettering) set back
  // in the opening, with a charcoal sign band and a slim warm light line under it
  for (const b of garageScreenBreaks().filter((q) => q.sign)) {
    alongFacade(b, 0.25, GROUND + 0.5, 5.4, b.width - 1.4, 0.3, 'frame');
    alongFacade(b, 0.45, GROUND + 3.0, 0.9, b.width - 3.2, 0.12, 'charcoal');
    alongFacade(b, 0.45, GROUND + 2.86, 0.06, b.width - 3.4, 0.08, 'lamp', C);
  }

  // service doors sit on the storefront line of the curved base (flush door panels)
  const baseFine = arcSamples(offsetPlan(PODIUM_PLAN, -ARCADE), 0.25);
  const facadeDoor = (x, width, h) => alongFacade(nearest(baseFine, (q) => q.nz < -0.5, x, -60), 0.05, 0, h, width, 0.3, 'void');
  const [p0, p1] = PODIUM_PARKING.entry.portal;
  facadeDoor((p0 + p1) / 2, p1 - p0, 4.2);                                                   // garage in / out
  const dock = PODIUM_PARKING.ground.rooms[0].rect;
  facadeDoor(dock[0] + 1.8, 4.5, 4.6);                                                        // residential loading (clear of the curved corner)
  // detailed vehicle entrances under the arcade soffit: framed garage portal with an
  // entry / exit island, card readers, barrier arms and a clearance gantry; framed loading door
  const X = fixtureKit(K);
  for (const [cx, W, H, lanes] of [[(p0 + p1) / 2, p1 - p0, 4.2, 2], [dock[0] + 1.8, 4.5, 4.6, 0]]) {
    const s = nearest(baseFine, (q) => q.nz < -0.5, cx, -60);
    X.vehicleEntrance({ x: s.x, z: s.z, nx: s.nx, nz: s.nz, W, H, maxHead: GROUND, lanes, apron: ARCADE + 0.4 });
  }

  const trees = [];
  const deckTree = (x, z, size = 2.6, h = 1.2) => {
    bed(x - size / 2, x + size / 2, z - size / 2, z + size / 2, DECK_Y, h);
    trees.push({ x, z, y: DECK_Y + h, r: 2.1 + rand() * 0.5, lush: true, tone: rand(), start: 0.68, dur: 0.05, deck: true, planterH: h });
  };

  // --- resort pool terrace ------------------------------------------------------
  const PT = POOL.terraceY;
  block(-46.0, -45.7, DECK_Y, DECK_Y + 0.30, -10.0, 10.0, 'deck');                          // two steps down to the deck walk
  block(-45.7, -45.4, DECK_Y, DECK_Y + 0.15, -10.0, 10.0, 'deck');
  add('wedge', -57.7, DECK_Y + POOL.terraceRaise / 2, 13.25, 5.4, POOL.terraceRaise, 1.5, 'deck', 'solid', 0); // 1:12 ramp, south edge
  // loungers in pairs along both long sides, 1.8 m clear walk to the coping, umbrellas behind
  for (const x of [-67.5, -63.5, -59.5, -55.5, -51.5]) {
    for (const side of [-1, 1]) {
      lounger(x - 0.45, side * 9.3, PT, 'z', side);
      lounger(x + 0.45, side * 9.3, PT, 'z', side);
      umbrella(x, side * 11.0, PT, 2.6);
    }
  }
  cabana(-74.8, -71.9, -12.3, -9.3, PT, 's');
  cabana(-74.8, -71.9, 9.3, 12.3, PT, 's');
  // in-water loungers on the sun shelf (east end)
  for (const z of [-2.2, 0, 2.2]) block(POOL.xE + 0.9, POOL.xE + 2.9, POOL.waterY - 0.12, POOL.waterY + 0.12, z - 0.36, z + 0.36, 'cushion', C);
  // planting along the terrace edges, behind the umbrellas, and palms at the corners
  for (const [x0, x1] of [[-71.0, -66.0], [-65.0, -60.0], [-59.0, -54.0], [-53.0, -48.4]]) {
    bed(x0, x1, -12.45, -11.55, PT, 0.55, { shrubs: true });
    bed(x0, x1, 11.55, 12.45, PT, 0.55, { shrubs: true });
  }
  for (const z of [-5.8, 5.8]) { bed(-74.6, -73.0, z - 0.8, z + 0.8, PT, 0.9); deckPalm(-73.8, z, 0.9, 7 + rand() * 1.5, PT); }
  for (const z of [-10.4, 10.4]) { bed(-49.2, -47.8, z - 0.7, z + 0.7, PT, 0.9); deckPalm(-48.5, z, 0.9, 6.5 + rand(), PT); }
  // layered beds framing the pool terrace at deck level (low: beneath the balconies)
  for (const [x0, x1] of [[-72.5, -66.0], [-64.5, -58.0], [-56.5, -50.0]]) bed(x0, x1, -15.2, -13.4, DECK_Y, 0.6, { shrubs: true });
  for (const [x0, x1] of [[-72.5, -66.0], [-52.5, -47.0]]) bed(x0, x1, 13.4, 15.2, DECK_Y, 0.6, { shrubs: true });

  // --- low deck lights: both edges of the walk between the tower lobbies, and the pool
  //     terrace corners and steps (warm white, no glare at eye level)
  {
    const [wz0, wz1] = walkEnds();
    for (let z = wz0 + 2; z <= wz1 - 2; z += full ? 6 : 12) {
      if (Math.abs(z) < 11.5) continue;   // the terrace steps and palm planters take this stretch
      K.deckLight(DECK_WALK.x0 - 0.35, z, DECK_Y + 0.03); K.deckLight(DECK_WALK.x1 + 0.35, z + 3, DECK_Y + 0.03);
    }
    for (const [x, z] of [[-74.3, -12.0], [-74.3, 12.0], [-46.6, -11.9], [-46.6, 11.9], [-60.5, -11.9], [-60.5, 11.9]]) K.deckLight(x, z, PT);
  }

  // --- palm-lined walk between the tower lobbies ---------------------------------
  for (const z of [-11.0, -5.5, 5.5, 11.0]) palmPlanter(-40.8, z, 1.6);

  // --- outdoor dining + barbecue under a slatted pergola ----------------------------
  pergola(-39.4, -33.9, -13.5, -4.0, DECK_Y);
  block(-38.8, -34.6, DECK_Y, DECK_Y + 0.9, -13.2, -12.4, 'stone', C);                    // barbecue counter
  block(-37.6, -35.8, DECK_Y + 0.9, DECK_Y + 0.96, -13.1, -12.5, 'charcoal', C);          // grill
  dining(-36.65, -9.8, DECK_Y); dining(-36.65, -6.4, DECK_Y);
  // --- shaded lounge -----------------------------------------------------------------
  sofaGroup(-37.6, 7.2, DECK_Y); umbrella(-36.9, 7.5, DECK_Y, 3.0);
  sofaGroup(-35.6, 11.4, DECK_Y); umbrella(-34.9, 11.7, DECK_Y, 3.0);
  // --- garage stair + lift pavilion (deck restrooms), and the north-west stair --------
  for (const c of PODIUM_PARKING.cores) {
    const [x0, x1, z0, z1] = c.rect;
    block(x0, x1, PODIUM_TOP, PODIUM_TOP + 3.4, z0, z1, 'frame');
    block(x0 - 0.2, x1 + 0.2, PODIUM_TOP + 3.4, PODIUM_TOP + 3.7, z0 - 0.2, z1 + 0.2, 'frame');
  }
  // --- layered planting and shade trees on the plaza edge ---------------------------------
  for (const [z0, z1, pz] of [[5.0, 14.0, 9.5], [-14.0, -5.0, -9.5]]) {
    bed(-31.8, -28.6, z0, z1, DECK_Y, 0.9, { shrubs: true });
    deckPalm(-30.2, pz, 0.9);
  }
  for (const z of [-34.0, -24.0, 22.0, 33.0]) deckTree(-30.2, z);

  // --- wellness terrace (south, visible from the hero view) ------------------------------
  pergola(-72.0, -63.0, 38.0, 44.0, DECK_Y);
  block(-70.8, -68.8, DECK_Y, DECK_Y + 0.55, 39.2, 40.2, 'cushion', C);                   // treatment daybeds
  block(-66.6, -64.6, DECK_Y, DECK_Y + 0.55, 39.2, 40.2, 'cushion', C);
  for (const x of [-53.0, -50.6, -48.2, -45.8, -43.4]) lounger(x, 44.6, DECK_Y, 'z', 1);
  umbrella(-51.8, 46.0, DECK_Y, 2.6); umbrella(-44.6, 46.0, DECK_Y, 2.6);
  bed(-41.5, -36.5, 40.5, 42.0, DECK_Y, 0.6, { shrubs: true });
  bed(-62.2, -59.8, 43.3, 45.7, DECK_Y, 0.6, { shrubs: true });
  palmPlanter(-38.2, 44.4, 1.6, 0.9);
  palmPlanter(-73.2, 34.0, 1.6, 0.9);

  // --- west flanks beside the towers: low layered beds beneath the balconies ----------------
  for (const [z0, z1] of [[-41.0, -35.0], [-32.0, -26.0], [17.0, 23.0], [26.0, 31.0]]) bed(-73.6, -72.0, z0, z1, DECK_Y, 0.6, { shrubs: true });

  // --- quiet garden (north, behind tower 1) ------------------------------------------------
  bed(-64.0, -54.0, -48.6, -47.0, DECK_Y, 0.6, { shrubs: true });
  bed(-50.0, -40.0, -48.6, -47.0, DECK_Y, 0.6, { shrubs: true });
  K.bench(-58.0, -45.6, DECK_Y, 3.0, 0); K.bench(-46.0, -45.6, DECK_Y, 3.0, 0);

  // --- planting ribbon along the guard (skipping lobby axes, the pool terrace and the
  //     service corner); low enough to sit beneath balconies
  let k = 0;
  for (const s of arcSamples(offsetPlan(PODIUM_PLAN, -1.6), 3.1)) {
    const lobbyAxis = (s.nz > 0.9 && Math.abs(s.x + 50) < 3) || (s.nx < -0.9 && Math.abs(s.z + 28) < 3);
    const poolEdge = insidePlan(s.x, s.z, offsetPlan(POOL.terrace, 1.2));
    const northService = s.nz < -0.5 && s.x > -40;
    const cores = PODIUM_PARKING.cores.some((c) => inRect(s.x, s.z, c.rect, 2.2));
    if (lobbyAxis || poolEdge || northService || cores) continue;
    alongFacade(s, 0, DECK_Y, 0.6, 3.0, 0.9, 'frame', C);
    alongFacade(s, 0, DECK_Y + 0.6, 0.08, 2.7, 0.6, 'planter', C);
    add('cone', s.x, DECK_Y + 1.05, s.z, 1.0, 0.8, 1.0, k % 3 ? 'shrub' : 'shrubDark', C);
    k++;
  }

  return { parts: out, palms, trees };
}
