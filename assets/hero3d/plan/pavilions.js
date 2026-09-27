// M — the small structures that hold the edges of the park now that it sits on the condo
// entrance axis. Moving the fountain plaza onto the promenade left three pieces of open
// ground around it, and a park whose edges are only grass reads as leftover space:
//
//   • M.hall      — garden café on the park's south-east edge: one low glazed room under a
//                   thin white canopy, entered from the spine on the west and the office
//                   walk on the east. It was a 9 m market hall with a clerestory; lowering
//                   it to a single 4 m storey keeps the lawn's horizon open and stops it
//                   competing with the hotel tower behind.
//   • M.pav       — promenade pavilion on the east wedge: an open public shade shelter,
//                   closing the corner where the promenade, the lawn and the office walk
//                   meet. Its kiosk was removed so all serving happens in the café.
//   • M.colonnade — a free-standing colonnade along the paseo, west of the spine. The
//                   paseo is only 15 m wide between the podium storefronts and the spine,
//                   so a liner building there would wall the storefronts off; a covered
//                   walk gives the same built edge without blocking them.
//
// Conceptual massing only — no structure, envelope, servicing or code compliance is
// designed or verified here.
import { GLAZE, roundedRectPlan, offsetPlan, insidePlan, box, partsKit } from './core.js';
import { fixtureKit } from './fixtures.js';
import { onRoute, ENTRANCES, inFurnishing } from './pedestrian.js';

// The hall was pulled out of the middle of the southern lawn and set on the park's
// south-east corner, where it holds an edge instead of splitting the green, and shrunk
// from 327 m² so the flexible lawn north of it clears 18 m of depth.
export const MARKET = {
  plan: roundedRectPlan(0.0, 34.4, 15.6, 50.0, 1.4),   // 15.6 × 15.6 m
  hallH: 4.0,                                    // one glazed storey, glazing recessed under the canopy
  parapetH: 0.9,                                 // planted roof edge; nothing occupies the roof
  canopy: { y: 3.1, out: 1.8, thick: 0.34 },     // one thin canopy over the doors and the terrace seats
  columnPitch: 4.2,
};
export const MARKET_TOP = MARKET.hallH + MARKET.parapetH;   // 4.9 m of visible roof edge
export const PAVILION = {
  roof: roundedRectPlan(10.6, 4.0, 18.4, 12.8, 1.4),
  y: 4.6, thick: 0.5,
  columns: [[11.2, 4.6], [17.8, 4.6], [11.2, 8.4], [17.8, 8.4], [11.2, 12.2], [17.8, 12.2]],
};
// paseo colonnade: paired columns on a 3.2 m bay carrying a white roof slab
export const COLONNADE = { x0: -15.8, x1: -12.4, z0: -41.5, z1: -17.8, y: 3.8, thick: 0.45, bay: 3.2 };

// footprints that planting, furniture and cars must stay out of
export const PAVILION_FOOTPRINTS = [MARKET.plan, PAVILION.roof];
export const MARKET_RECT = [0.0, 15.6, 34.4, 50.0];
export const PAVILION_RECT = [10.6, 18.4, 4.0, 12.8];

export function pavilionMasses() {
  const M = MARKET;
  const canopy = {
    kind: 'frame',
    floors: [{ y: M.canopy.y, thick: M.canopy.thick, outer: offsetPlan(M.plan, M.canopy.out), inner: offsetPlan(M.plan, -0.12) }],
  };
  return [
    {
      name: 'M.hall', type: 'prism', kind: 'glass', glaze: GLAZE.storefront, module: [1.5, 1.6], parent: null,
      y0: 0, h: M.hallH, start: 0.336, dur: 0.062, wire: false, ribs: 10, pts: offsetPlan(M.plan, -0.35), slabs: canopy,
    },
    {
      // planted roof edge: a low parapet standing on the glazing line, so the roof reads as
      // a clean horizontal from the hero camera with nothing occupying it
      name: 'M.parapet', type: 'ring', kind: 'frame', glaze: GLAZE.none, module: [1, 1], parent: 'M.hall',
      y0: 0, h: M.parapetH, start: 0.404, dur: 0.016, wire: false,
      pts: M.plan, inner: offsetPlan(M.plan, -0.45),
    },
    {
      name: 'M.pav', type: 'prism', kind: 'frame', glaze: GLAZE.none, module: [1, 1], parent: null,
      y0: PAVILION.y, h: PAVILION.thick, start: 0.352, dur: 0.014, wire: false, ribs: 8, pts: PAVILION.roof,
    },
  ];
}

// The café's back of house: counter, preparation and store, a toilet allowance and the
// screened holding space that restocking and refuse use, all against the south perimeter so
// service never crosses the lawn or the plaza.
export const MARKET_SERVICE = [10.2, 15.25, 44.6, 49.65];

export function pavilionBoxes() {
  return [
    box('M.service', MARKET_SERVICE[0], MARKET_SERVICE[1], MARKET_SERVICE[2], MARKET_SERVICE[3], 0, MARKET.hallH - 0.1, 'stucco', 'M', [0.346, 0.030], null, { glaze: GLAZE.none }),
    box('M.colRoof', COLONNADE.x0, COLONNADE.x1, COLONNADE.z0, COLONNADE.z1, COLONNADE.y, COLONNADE.thick, 'frame', 'M', [0.358, 0.026]),
  ];
}

export function pavilionParts(tier) {
  const out = [];
  const K = partsKit(out);
  const { add, block, column } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const M = MARKET;

  // a column may not stand on a walking surface or in an entrance forecourt
  const free = (x, z) => !onRoute(x, z, 0.4) && !inFurnishing(x, z, 0.3)
    && !ENTRANCES.some((e) => insidePlan(x, z, e.poly));

  // --- market hall: veranda columns on the canopy's outer line -------------------------
  const ring = offsetPlan(M.plan, M.canopy.out - 0.55);
  let carry = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = carry; s < len; s += M.columnPitch) {
      const t = s / len;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (free(x, z)) column(x, z, 0, M.canopy.y + 0.06, 0.13, 'frame');   // tops end inside the canopy
      carry = s + M.columnPitch - len;
    }
    if (carry < 0) carry = 0;
  }
  // door reveals on the two public faces and the discreet service door on the south
  // the two hall entrances, built as real doors on the hall's own face
  const XF = fixtureKit(K);
  XF.entranceDoor({ x: 0.0, z: 42.0, nx: -1, nz: 0, W: 3.2, H: 3.0, leaves: 2, full });
  XF.entranceDoor({ x: 15.6, z: 41.0, nx: 1, nz: 0, W: 3.2, H: 3.0, leaves: 2, full });
  block(11.6, 13.8, 0, 2.6, 49.55, 49.72, 'void');               // service door, south perimeter
  for (const [x0, x1, z] of [[2.0, 13.6, 34.6], [2.0, 13.6, 49.8]]) block(x0, x1, M.canopy.y - 0.08, M.canopy.y - 0.04, z - 0.06, z + 0.06, 'lamp', C);
  // one café counter with its back-of-house wall behind it, then flexible seating: the rows
  // of market stalls are gone, so the room reads as a single light-service café
  block(3.0, 9.6, 0, 1.05, 45.4, 46.4, 'frame');                 // counter
  block(3.0, 9.6, 2.5, 2.6, 45.1, 46.7, 'lamp', C);              // light line over it
  for (const [x, z] of (full ? [[4.2, 37.4], [8.4, 37.4], [4.2, 41.2], [8.4, 41.2], [12.2, 37.4]] : [[4.2, 38.6], [8.4, 41.2]])) K.cafe(x, z, 0.02, 'x');

  // --- promenade pavilion: an open public shade shelter, nothing to buy ------------------
  for (const [x, z] of PAVILION.columns) column(x, z, 0, PAVILION.y, 0.12, 'frame');
  for (const z of [6.2, 8.4, 10.6]) K.bench(14.5, z, 0.07, 3.0, 0, 'frame');
  add('cyl', 12.6, PAVILION.y - 0.14, 8.4, 0.22, 0.1, 0.22, 'lamp', C);
  add('cyl', 16.4, PAVILION.y - 0.14, 8.4, 0.22, 0.1, 0.22, 'lamp', C);

  // --- paseo colonnade: paired columns on each bay, with a light line under the slab -----
  const L = COLONNADE;
  for (let z = L.z0 + 0.6; z <= L.z1 - 0.6; z += L.bay) {
    for (const x of [L.x0 + 0.45, L.x1 - 0.45]) if (free(x, z)) column(x, z, 0, L.y, 0.14, 'frame');
  }
  block(L.x0 + 0.3, L.x1 - 0.3, L.y - 0.1, L.y - 0.06, L.z0 + 0.4, L.z1 - 0.4, 'lamp', C);
  return { parts: out };
}
