// A — residential: two twisting towers on a retail + structured-parking podium
// whose roof is a resort amenity level.
//
// Structure concept (visual model, not an engineered design):
//   • each tower keeps ONE occupied floorplate shape, and the whole structure turns with
//     it: the plate rotates `plateTwist` degrees over the tower and the ring of perimeter
//     columns rotates with every plate, so the columns are continuous but inclined — each
//     leans COLUMN_TILT metres per floor about a vertical central core. The ring lands
//     square on the podium's column lines at the base, so there is no transfer anywhere
//   • the glass line still only leans a little floor to floor, because the plate turns
//     about its own centre rather than stepping in and out
//   • the twist is carried further by the balcony ribbons, which rotate faster than the
//     floorplates within a cantilever limit measured from that floor's column line
//   • each ribbon carries a glass balustrade, so every floor has a wraparound balcony
//   • tower columns land on the podium's parking module lines (aisle edges and
//     back-to-back stall lines), so they come down through the garage without
//     transfers and without entering drive aisles
//   • penthouses come from separate generators (plan/penthouse-tall.js, penthouse-short.js)
//     that read the top floorplate, column ring, core and ribbon rotation but never alter
//     the typical floors; their declared transfer zones are listed in `transfers`
import { tallPenthouse } from './penthouse-tall.js';
import { shortPenthouse } from './penthouse-short.js';
import { fixtureKit } from './fixtures.js';
import { poolSpecs as sharedPool, spaSpecs as sharedSpa } from './pools.js';
import {
  FLOOR, GROUND, RES, D2R, GLAZE, PODIUM_TOP, DECK_BUILDUP, DECK_Y, ARCADE,
  clamp, superellipse, roundedRectPlan, offsetPlan, arcSamples, insidePlan, polarRadius,
  rayRadius, resampleByAngle, smoothRadii, clipBand, circlePlan, inRect, partsKit, box,
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
  // stacked switchback ramp between the towers: two one-way lanes, 30 m runs. Shifted 2.8 m
  // north of the podium centre so the public galleria (below) passes under the parking
  // decks south of the ramp's turnaround with no vehicle crossing
  ramp: {
    rect: [-46.6, -37.6, -17.8, 12.2], lanes: [[-46.6, -42.4], [-41.8, -37.6]], run: 30,
    // each level change uses two runs (up the west lane, back down the east lane side)
    rises: [GROUND, FLOOR], landing: 'north', connects: 'aisle E north',
  },
  columnLines: [-70.65, -65.25, -57.55, -52.3, -47.05, -42.1, -39.35, -34.0],
  // podium column rows at z = 3.8 ± 8.4 k: the rows at -4.6 and 3.8 frame the galleria's east leg
  columnStep: 8.4, columnOrigin: 3.8,
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
      { name: 'Tower 2 lobby (west entrance)', use: 'lobby', rect: [-72.5, -56.3, -32.0, -25.0] },
      { name: 'Tower 1 lobby (south entrance)', use: 'lobby', rect: [-55.5, -46.5, 31.5, 45.5] },
      { name: 'Electrical / water / pool plant', use: 'plant', rect: [-70.0, -58.5, -12.0, 10.0] },
      { name: 'Bicycle + resident storage', use: 'plant', rect: [-56.0, -48.5, -12.0, -4.0] },
      // Public galleria through the ground floor, lined with shopfronts. It enters on the east
      // face in the middle of the tower base, on the promenade's axis and under the gap in the
      // parking screen, then turns north inside the podium to clear the parking ramp and runs
      // out to the west sidewalk on its original line.
      { name: 'Galleria (public passage, east leg)', use: 'public', rect: [-37.5, -26.0, -1.25, 3.25] },
      { name: 'Galleria (public passage, turn)', use: 'public', rect: [-37.5, -33.0, -1.25, 17.4] },
      { name: 'Galleria (public passage, west leg)', use: 'public', rect: [-76.0, -33.0, 12.9, 17.4] },
      { name: 'Tower 1 lobby (galleria entrance)', use: 'lobby', rect: [-56.0, -47.5, 17.4, 24.3] },
    ],
  },
  // garage stair / lift cores that reach the amenity deck
  cores: [
    { name: 'Podium stair + lift (east)', rect: [-33.6, -29.4, 4.8, 9.0] },
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
// How far a perimeter column may travel horizontally per 3.2 m floor as the structure
// turns (a geometric allowance for the concept, comparable to built twisting towers —
// not an engineered value). 0.45 m is about 8° off vertical.
const COLUMN_TILT = 0.45;
// Balcony balustrade: frameless glass panels, set in from the ribbon edge and started
// just below the balcony paving so the shoe is buried in the slab.
export const BALCONY_GUARD = { h: 1.15, thick: 0.05, inset: 0.12, embed: 0.06, shoe: 0.06 };
const GUARD = BALCONY_GUARD;
// how far (in plan degrees) a balcony edge is rounded where a limit creases it
const BALCONY_ROUND = 14;
// Privacy dividers between units. The residential glazing draws a mullion every MULLION
// metres along each floor's glass line (plan/../layers/facade-glsl.js, glaze 2), measured
// from the plan's first vertex — so a divider placed a whole number of bays along that same
// line lands exactly on a mullion. Each one runs floor to soffit and out to the balustrade.
export const WINDOW_MULLION = 1.6;   // keep in step with glaze 2 in layers/facade-glsl.js
const MULLION = WINDOW_MULLION;
const DIVIDER = { bays: 6, thick: 0.07, slab: 0.36, into: 0.02 };

// Tower 1 — tall rounded triangle; the structure turns 1.7° per floor (36° over the tower)
// and the balcony ribbons turn faster still, 72° over 22 floors. It stands at the SOUTH end
// of the podium (the two towers were swapped: the tall one now closes the view from the park
// and the promenade, the lower one holds the north end over the garage entrance).
const TOWER1 = {
  id: 'A.t1', cx: -52, cz: 28, floors: 22, twist: 72, plateTwist: 36, perimeter: 0.35,
  shape: { R: 13.2, a2: 0.05, p2: -10, a3: 0.12, p3: -90 },
  core: { w: 8.6, d: 7.4 },
  minDepth: 0.9,
  // the ribbon outline has stronger lobes than the floorplate, so its turn reads clearly
  ribbon: (t, g, eMax, shape, tw) => polarRadius({ ...shape, R: shape.R + 1.9, a3: 0.2 }, t - tw * D2R),
  // penthouse: "Sky Villa" duplex (plan/penthouse-tall.js) — angles are plan degrees about the
  // tower centre (90° = south, 180° = west); the principal view is south-west
  penthouse: {
    generator: 'tall', living: [104, 150], pool: [164, 216], room: [28, 98], mech: [236, 318],
    canopy: [20, 104], canopyPosts: [30, 64, 97], pit: 46, dining: 80, kitchen: 60, spaChairs: 240,
    trees: [262, 334], planters: [252, 290, 352, 16], bedroom: 318, screens: [292, 350],
  },
  timing: [0.370, 0.104],
};

// Tower 2 — lower egg-shaped oval, its structure turning −1.6° per floor (−24° over the
// tower, the same turn its ribbons make); ribbons ripple in a wave that climbs the tower.
// Centred at x −52.3 so its column ring clears both garage drive aisles. It stands at the
// NORTH end of the podium.
const TOWER2 = {
  id: 'A.t2', cx: -52.3, cz: -29, floors: 16, twist: -24, plateTwist: -24, perimeter: 0.35,
  shape: { R: 12.6, a1: 0.05, p1: 20, a2: 0.19, p2: 18 },   // a2 < 0.2 keeps the oval convex
  core: { w: 8.0, d: 7.0 },
  minDepth: 0.9,
  ribbon: (t, g, eMax, shape, tw) => eMax + 0.9 + 2.0 * (0.5 + 0.5 * Math.sin(2 * (t - (shape.p2 + tw) * D2R) + g * 0.55)),
  // penthouse: "Garden Pavilion" full-floor residence (plan/penthouse-short.js)
  penthouse: {
    generator: 'short', broad: 178, recess: 5.2, overhang: 100, gardenRoom: 30, mech: [238, 298], pool: 184,
    windbreaks: [18, 312], privateGarden: 336, roofTree: 330, roofPlanters: [0, 66, 102, 312],
  },
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
  const plate = (g) => (cfg.plateTwist * (g - 1)) / (floors - 1);

  // occupied floorplates: one shape, turned about the core at every floor, so the plan itself
  // twists while the glass line still only leans within `perimeter`
  const enc = [];
  for (let g = 1; g <= floors; g++) enc.push(th.map((t) => polarRadius(shape, t - plate(g) * D2R)));
  // the structure turns with the plates: the base ring lands on the podium's column lines,
  // and every floor above carries the same ring rotated with its plate, so each perimeter
  // column inclines by a constant step (COLUMN_TILT metres per floor) about the vertical core
  const columns = placeColumns(cx, cz, th, enc[0].map((r) => r - 0.5));
  const spin = (pts, deg) => {
    const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
    return pts.map(([x, z]) => [cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c]);
  };
  const colRings = Array.from({ length: floors }, (_, k) => spin(columns, plate(k + 1)));
  const colRs = colRings.map((ring) => th.map((t) => rayRadius(cx, cz, ring, t)));
  const colR = colRs[floors - 1];      // the penthouse sits on the top floor's ring

  const slabs = [];
  const guards = [];
  const dividers = [];
  const guardStep = tier.name === 'mobile' ? 2 : 1;
  const thin = (pts) => (guardStep === 1 ? pts : pts.filter((_, i) => i % guardStep === 0));
  for (let g = 1; g <= floors; g++) {
    const e = enc[g - 1];
    const up = g < floors ? enc[g] : null;
    const outer = [], inner = [], loR = [], hiR = [];
    for (let i = 0; i < N; i++) {
      const eMax = up ? Math.max(e[i], up[i]) : e[i];
      const eMin = up ? Math.min(e[i], up[i]) : e[i];
      const lo = eMax + cfg.minDepth;
      loR.push(lo);
      hiR.push(Math.max(lo, colRs[g - 1][i] + MAX_CANTILEVER));
      outer.push(up ? clamp(cfg.ribbon(th[i], g, eMax, shape, twist(g)), lo, hiR[i]) : e[i] + 0.6);
      inner.push(eMin - 0.25);
    }
    // the cantilever and minimum-depth limits leave creases in the ribbon where they take
    // over; round them off, then hold the limits again (the average stays inside them, so
    // only the depth floor can need a nudge back)
    if (up) {
      const soft = smoothRadii(outer, BALCONY_ROUND);
      for (let i = 0; i < N; i++) outer[i] = Math.min(Math.max(soft[i], loR[i]), hiR[i]);
      const soft2 = smoothRadii(outer, BALCONY_ROUND * 0.6);
      for (let i = 0; i < N; i++) outer[i] = Math.min(Math.max(soft2[i], loR[i]), hiR[i]);
    }
    // privacy dividers: one panel per unit boundary, standing on a mullion of this floor's
    // glass line and running out, square to the facade, to the balustrade. They belong to the
    // floor, so they turn with it and spiral up the tower.
    if (g < floors) {
      // the wall standing on this slab belongs to the floor above it (stackGeometry draws the
      // band g·FLOOR → (g+1)·FLOOR from enc[g]), and that is the line the facade measures its
      // mullions along — so the panels must be set out on it, not on the floor below's plan
      const gPts = plan(enc[g]);
      const outPts = plan(outer);
      const step = MULLION * DIVIDER.bays;
      // the panel reaches from the glass out to the balustrade, square to the wall
      const reach = (x, z, nx, nz) => {
        let lo = 0, hi = MAX_CANTILEVER + cfg.minDepth + 2;
        if (!insidePlan(x + nx * 0.1, z + nz * 0.1, outPts)) return 0;
        while (hi - lo > 0.01) { const m = (lo + hi) / 2; if (insidePlan(x + nx * m, z + nz * m, outPts)) lo = m; else hi = m; }
        return lo;
      };
      // the top balcony's ceiling is the penthouse plinth, which has no ribbon slab under it
      const clear = (g === floors - 1 ? FLOOR : FLOOR - DIVIDER.slab) + DIVIDER.into;
      let run = 0, next = step;
      for (let i = 0; i < N; i++) {
        const [ax, az] = gPts[i], [bx, bz] = gPts[(i + 1) % N];
        const len = Math.hypot(bx - ax, bz - az);
        while (next < run + len) {
          const f = (next - run) / len;
          const x = ax + (bx - ax) * f, z = az + (bz - az) * f;
          // square to the wall, not to the radius, so the panel meets the glass exactly on
          // the mullion (a radial panel would slide along the wall where the plan is lobed)
          let nx = (bz - az) / len, nz = -(bx - ax) / len;
          if (nx * (x - cx) + nz * (z - cz) < 0) { nx = -nx; nz = -nz; }
          const d = reach(x, z, nx, nz) - GUARD.inset;
          if (d > 0.5) {
            dividers.push({
              a: [x - nx * 0.06, z - nz * 0.06], b: [x + nx * d, z + nz * d],
              y: g * FLOOR - 0.02, h: clear, t: DIVIDER.thick,
            });
          }
          next += step;
        }
        run += len;
      }
    }
    // the top floor's roof is the penthouse plinth (no separate roof slab sharing its plane)
    if (g < floors) {
      slabs.push({ y: g * FLOOR, thick: 0.36, outer: plan(outer), inner: plan(inner) });
      // glass balustrade along the balcony edge: frameless panels on a slim shoe, set in from
      // the slab edge and started just below the paving so no face shares the slab's plane
      // (coarser plan on mobile — a 1.15 m rail does not need the full floorplate resolution)
      guards.push({
        y: g * FLOOR - GUARD.embed, h: GUARD.h + GUARD.embed,
        outer: thin(plan(outer.map((r) => r - GUARD.inset))),
        inner: thin(plan(outer.map((r) => r - GUARD.inset - GUARD.thick))),
      });
    }
  }

  const specs = [];
  const bodyName = `${id}.body`;
  specs.push({
    name: bodyName, type: 'stack', kind: 'glass', glaze: GLAZE.residential, module: RES, parent: 'A.podium', y0: 0,
    h: floors * FLOOR, floorH: FLOOR, floorPlans: enc.map((r) => plan(r)), pts: plan(enc[0]),
    start: cfg.timing[0], dur: cfg.timing[1], slabs: { kind: 'slab', floors: slabs },
    guards: {
      kind: 'frame', glaze: GLAZE.guardStack, module: [GUARD.embed + GUARD.shoe, FLOOR],
      ramp: [GUARD.h + GUARD.embed, 0, 0, 0], rings: guards, dividers,
    },
  });

  const core = roundedRectPlan(cx - cfg.core.w / 2, cz - cfg.core.d / 2, cx + cfg.core.w / 2, cz + cfg.core.d / 2, 0.6);
  const topY = PODIUM_TOP + floors * FLOOR;
  const top = enc[floors - 1];
  const t0 = cfg.timing[0] + cfg.timing[1];
  const gen = cfg.penthouse.generator === 'tall' ? tallPenthouse : shortPenthouse;
  const suite = gen({
    id, cx, cz, N, th, top, colR, columns: colRings[floors - 1], core, topY, bodyName, t0, maxCantilever: MAX_CANTILEVER, floors,
    ribbon: (t, g, eMax = 0) => cfg.ribbon(t, g, eMax, shape, twist(g)),
  }, cfg.penthouse, tier);
  specs.push(...suite.specs);
  return {
    specs,
    penthouse: suite,
    meta: {
      // `columns` is the base ring (the one that lands in the garage and on the amenity deck);
      // `columnRings` carries every floor's ring, each the base ring turned with its plate
      id, cx, cz, N, floors, topY, body: bodyName, core, columns, columnRings: colRings, columnSize: COLUMN,
      plateTwist: cfg.plateTwist, ribbonTwist: cfg.twist, leanLimit: cfg.perimeter, tiltLimit: COLUMN_TILT, guard: { ...GUARD }, divider: { ...DIVIDER, mullion: MULLION },
      // perimeter columns stop at the plinth (T2) or continue through PH1 to the crown (T1);
      // the core rises to the private elevator arrival on the roof
      columnTopY: cfg.penthouse.generator === 'tall' ? suite.meta.phTopY : topY, coreTopY: suite.meta.roofTopY,
      maxCantilever: MAX_CANTILEVER,
      penthouse: suite.meta,
      transfers: [suite.transfer],
    },
  };
}

// ---------------------------------------------------------------------------
// Resort pool: long axis east–west (site x), matching the hotel pool, set across
// the deck between the two towers. It reads as sitting toward the podium's west side, and
// it does — but it is already as far east as it can go: the basin stops 1.45 m short of the
// parking ramp below (PODIUM_PARKING.ramp, x -46.6 to -37.6), which runs the full 30 m
// between the towers and cannot be spanned by a 1.45 m deep basin. Moving the pool further
// east means moving that ramp. Wide swimming area with
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
// keep the garage stair cores open; the wave runs unbroken past the lobbies below it.
// ---------------------------------------------------------------------------
export const GARAGE_SCREEN = {
  levels: [GROUND + 0.55, PODIUM_TOP - 0.55],
  amplitude: 0.3, wavelength: 22, depthWavelength: 34, depth: [0.45, 1.0], thick: 0.14,
  // The wave runs unbroken past the lobbies — the entrances are at ground level, below the
  // screen, and a gap with a signage panel in it only interrupted the pattern. Breaks are
  // kept where the garage stair cores need an opening.
  breaks: [
    { name: 'Garage stair (north-west)', at: [-76, -18.5], width: 4.5 },
    { name: 'Galleria east portal (over the passage head)', at: [-26, 1.0], width: 5.6 },
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

// The walk between the two tower deck lobbies runs north–south just east of the pool
// terrace. Its ends are found from whichever tower stands at each end, so swapping the two
// towers over does not invert it.
export const DECK_WALK = { x0: -45.0, x1: -42.0 };
function walkEnds() {
  const x = (DECK_WALK.x0 + DECK_WALK.x1) / 2;
  const edge = (t, dir) => {
    const inside = (zz) => Math.hypot(x - t.cx, zz - t.cz) < polarRadius(t.shape, Math.atan2(zz - t.cz, x - t.cx));
    let z = t.cz;
    while (inside(z)) z += dir * 0.1;
    return z - dir * 0.6;
  };
  const north = TOWERS.reduce((a, b) => (a.cz <= b.cz ? a : b));
  const south = TOWERS.find((t) => t !== north);
  return [edge(north, 1), edge(south, -1)];
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
    if (s.nx < -0.9 && Math.abs(s.z - 15.15) < 3.4) continue;              // galleria west portal
    if (s.nx > 0.9 && Math.abs(s.z - 1.0) < 3.6) continue;                 // galleria east portal
    column(s.x - s.nx * 1.0, s.z - s.nz * 1.0, 0, GROUND, 0.38);
  }
  const podiumFine = arcSamples(PODIUM_PLAN, 0.5);
  for (const [test, x, z] of [[(s) => s.nz > 0.9, -50, 49], [(s) => s.nx < -0.9, -76, -28]]) {
    const s = nearest(podiumFine, test, x, z);
    alongFacade(s, 0, 4.35, 0.4, 12, 5, 'frame');
    const tx = -s.nz, tz = s.nx;
    for (const side of [-1, 1]) column(s.x + s.nx * 2.2 + tx * 5.6 * side, s.z + s.nz * 2.2 + tz * 5.6 * side, 0, 4.35, 0.1, 'metal');
  }
  // galleria portals on both storefront lines: a tall dark opening in a white frame with a
  // warm soffit light and a blank sign plaque (the passage runs 4.5 m wide under the decks)
  const storeFine = arcSamples(offsetPlan(PODIUM_PLAN, -ARCADE), 0.25);
  const X = fixtureKit(K);
  for (const side of [-1, 1]) {
    const s = nearest(storeFine, (q) => q.nx * side > 0.9, side > 0 ? -29.5 : -72.5, side > 0 ? 1.0 : 15.15);
    // The east portal is the condo's front door on the park: it faces the fountain plaza
    // straight down the promenade's axis, so it is glazed like the other entrances — a glass
    // screen with four leaves under a tall transom — rather than left as a dark opening. The
    // west portal stays an opening: it gives onto the service street, not the park.
    if (side > 0) X.entranceDoor({ x: s.x, z: s.z, nx: s.nx, nz: s.nz, W: 4.5, H: 4.4, leaves: 4, full });
    else alongFacade(s, 0.05, 0, 4.4, 4.5, 0.3, 'void');
    for (const u of [-1, 1]) add('box', s.x - s.nx * 0.1 + -s.nz * u * 2.6, 2.2, s.z - s.nz * 0.1 + s.nx * u * 2.6, 0.4, 4.4, 0.5, 'frame', 'solid', Math.atan2(-s.nx, -s.nz));
    alongFacade(s, 0.33, 4.4, 0.56, 5.3, 0.56, 'frame');
    alongFacade(s, 0.4, 4.32, 0.05, 4.2, 0.25, 'lamp', C);
    alongFacade(s, 0.62, 4.5, 0.36, 1.4, 0.04, 'charcoal', C);
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
  // --- residential entrance doors -----------------------------------------------------------
  // The two tower lobbies on the street faces, and the two podium stair / lift doors, built
  // on the storefront line so they read as thresholds rather than dark panels on the glass.
  for (const [test, px, pz, W, H, leaves] of [
    [(q) => q.nx < -0.9, -72.5, -28.0, 3.6, 3.4, 2],      // tower 2 lobby, west face
    [(q) => q.nz > 0.9, -50.0, 49.0, 3.6, 3.4, 2],        // tower 1 lobby, south face
    [(q) => q.nx < -0.9, -72.5, -18.5, 1.5, 2.6, 1],      // podium stair, north-west
    [(q) => q.nx > 0.9, -26.0, 6.8, 1.8, 2.6, 1],         // podium stair + lift to the amenity deck
  ]) {
    const s = nearest(storeFine, test, px, pz);
    X.entranceDoor({ x: s.x, z: s.z, nx: s.nx, nz: s.nz, W, H, leaves, full });
  }
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
  for (const z of [-9.4, 9.4]) { bed(-47.6, -46.2, z - 0.7, z + 0.7, PT, 0.9); deckPalm(-46.9, z, 0.9, 6.5 + rand(), PT); }   // drawn in: the south tower's balconies now overhang the terrace's south edge
  // layered beds framing the pool terrace at deck level (low: beneath the balconies)
  for (const [x0, x1] of [[-72.5, -66.0], [-64.5, -58.0], [-56.5, -50.0]]) bed(x0, x1, -15.2, -13.4, DECK_Y, 0.6, { shrubs: true });
  for (const [x0, x1] of [[-72.5, -66.0], [-64.0, -58.5]]) bed(x0, x1, 13.4, 15.2, DECK_Y, 0.6, { shrubs: true });   // clear of the tall tower's plate, which now stands south

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
  // Pushed clear of the tall tower now standing over it: its balcony ribbons reach z 40.7,
  // so the pergola and the daybeds sit south of that line rather than under the overhang.
  pergola(-70.0, -62.0, 41.0, 45.6, DECK_Y);
  block(-69.5, -67.5, DECK_Y, DECK_Y + 0.55, 41.5, 42.5, 'cushion', C);                   // treatment daybeds
  block(-65.5, -63.5, DECK_Y, DECK_Y + 0.55, 41.5, 42.5, 'cushion', C);
  for (const x of [-53.0, -50.6, -48.2, -45.8, -43.4]) lounger(x, 44.6, DECK_Y, 'z', 1);
  umbrella(-51.8, 46.0, DECK_Y, 2.6); umbrella(-44.6, 46.0, DECK_Y, 2.6);
  bed(-41.5, -36.5, 40.5, 42.0, DECK_Y, 0.6, { shrubs: true });
  bed(-60.5, -58.1, 43.3, 45.7, DECK_Y, 0.6, { shrubs: true });
  palmPlanter(-38.2, 44.4, 1.6, 0.9);
  palmPlanter(-73.2, 34.0, 1.6, 0.9);

  // --- west flanks beside the towers: low layered beds beneath the balconies ----------------
  for (const [z0, z1] of [[-41.0, -35.0], [-32.0, -26.0], [17.0, 23.0], [26.0, 31.0]]) bed(-73.6, -72.0, z0, z1, DECK_Y, 0.6, { shrubs: true });

  // --- quiet garden (north, behind tower 2) ------------------------------------------------
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
    add('bush', s.x, DECK_Y + 1.05, s.z, 1.0, 0.8, 1.0, k % 3 ? 'shrub' : 'shrubDark', C);
    k++;
  }

  return { parts: out, palms, trees };
}
