// B — contemporary Art Deco hotel: curved volumes (rounded corners, eyebrows),
// a private pool court, and a conceptual ground-floor plan that separates guest
// arrival and amenities from receiving, refuse, housekeeping, staff and kitchen
// routes. The plan is simplified and mostly hidden in the hero view.
import { GROUND, FLOOR, RES, GLAZE, floorsToHeight, roundedRectPlan, offsetPlan, resampleByAngle, box, partsKit } from './core.js';
import { poolSpecs } from './pools.js';
import { fixtureKit } from './fixtures.js';

export const HOTEL = {
  front: roundedRectPlan(-2, -20, 58, -4, { se: 6, sw: 6 }),       // 7-storey plaza front
  centre: roundedRectPlan(20, -22, 36, -2, 0.6),                   // 10-storey reeded centrepiece
  rear: roundedRectPlan(-2, -51, 66, -39, { nw: 6 }),              // guest rooms over back of house
  link: roundedRectPlan(54, -39.5, 66, -18, 0.6),                  // lobby wing on the arrival court
};
export const HOTEL_FRONT_TOP = floorsToHeight(7);                  // 24.2
export const HOTEL_CENTRE_TOP = floorsToHeight(10);                // 33.8
export const HOTEL_WING_TOP = floorsToHeight(6);                   // 21.0
export const SERVICE_LINK = [-2, 1.8, -39, -20];                   // single-storey service corridor building on the paseo

// Ground-floor program. zone: guest | public | service. Rooms of the same side
// (service, or guest + public) connect where they share at least 1 m of edge; the
// service and guest sides connect only through the doors declared in HOTEL_DOORS.
export const HOTEL_GROUND = [
  // service
  { name: 'Receiving + loading dock', zone: 'service', rect: [48, 58, -51, -45], door: 'north' },
  { name: 'Refuse + recycling (compactor)', zone: 'service', rect: [58, 64, -51, -45], door: 'north' },
  { name: 'Kitchen stores (dry + cold)', zone: 'service', rect: [44, 48, -51, -45] },
  { name: 'Staff entrance + security', zone: 'service', rect: [40, 44, -51, -45], door: 'north' },
  { name: 'Service elevators (2) + service stair', zone: 'service', rect: [34, 40, -51, -45], core: 'service' },
  { name: 'Housekeeping + linen', zone: 'service', rect: [24, 34, -51, -45] },
  { name: 'Staff lockers, break room, HR', zone: 'service', rect: [10, 24, -51, -45] },
  { name: 'Main electrical / water / fire pump', zone: 'service', rect: [0, 10, -50, -45] },
  { name: 'BOH corridor', zone: 'service', rect: [0, 64, -45, -43], corridor: true },
  { name: 'West service stair + mechanical', zone: 'service', rect: [1.5, 10, -43, -39.6] },
  { name: 'Pool-bar pantry', zone: 'service', rect: [44.6, 52, -43, -39] },
  { name: 'Pool plant + laundry chute room', zone: 'service', rect: [52.6, 64, -43, -40.1] },
  { name: 'Service link corridor', zone: 'service', rect: [-1.5, 1.5, -43, -20], corridor: true },
  { name: 'Main kitchen', zone: 'service', rect: [-1, 12, -20, -12] },
  { name: 'Pastry + restaurant prep', zone: 'service', rect: [12, 19.6, -20, -12] },
  // guest and public
  { name: 'Restaurant (plaza)', zone: 'public', rect: [-2, 20, -12, -4] },
  { name: 'Lobby + reception', zone: 'guest', rect: [20, 36, -20, -2] },
  { name: 'Guest elevators (centre)', zone: 'guest', rect: [24, 32, -17, -11], core: 'guest', within: 'Lobby + reception' },
  { name: 'Lobby gallery', zone: 'guest', rect: [36, 54, -20, -12] },
  { name: 'Lobby bar + café', zone: 'public', rect: [36, 53.5, -12, -4] },
  { name: 'Arrival lobby + bell desk', zone: 'guest', rect: [54, 66, -36, -18] },
  { name: 'Guest elevators (link)', zone: 'guest', rect: [56, 62, -39.5, -36], core: 'guest' },
  { name: 'Fitness + spa changing', zone: 'guest', rect: [10, 44, -42.4, -39] },
  { name: 'Pool court', zone: 'guest', rect: [1.8, 54, -39, -20], outdoor: true },
  { name: 'Porte-cochère', zone: 'guest', rect: [66, 80, -34, -22], outdoor: true },
];

export const HOTEL_DOORS = [
  ['Main kitchen', 'Restaurant (plaza)'],                 // service door to the dining room
  ['Pastry + restaurant prep', 'Restaurant (plaza)'],
  ['Pool-bar pantry', 'Pool court'],                      // pool bar service hatch
];
// walls that must not be read as connections even though the rooms touch
export const HOTEL_WALLS = [
  ['Main kitchen', 'Pool court'], ['Pastry + restaurant prep', 'Pool court'], ['West service stair + mechanical', 'Fitness + spa changing'],
];

// continuous eyebrows (and a deep ground-floor canopy band) following a plan
function eyebrows(plan, upperFloors, groundDepth, roofY) {
  const floors = [];
  const inner = offsetPlan(plan, -0.12);
  if (groundDepth > 0) floors.push({ y: GROUND - 0.3, thick: 0.25, outer: offsetPlan(plan, groundDepth), inner });
  for (let j = 1; j <= upperFloors; j++) floors.push({ y: GROUND + (j - 1) * FLOOR + 2.72, thick: 0.14, outer: offsetPlan(plan, 0.75), inner });
  // parapet cornice: rises 0.3 m above the roof so it never shares the roof plane
  floors.push({ y: roofY + 0.3, thick: 0.75, outer: offsetPlan(plan, 0.35), inner });
  return { kind: 'slab', floors };
}

export function hotelMasses() {
  const deco = (name, plan, h, timing, parent = null, opts = {}) => ({
    name, type: 'prism', kind: opts.kind ?? 'stucco', glaze: opts.glaze ?? GLAZE.deco, module: RES, parent, y0: opts.y0 ?? 0, h,
    start: timing[0], dur: timing[1], pts: plan, slabs: opts.slabs, ramp: opts.ramp, ribs: opts.ribs ?? 12,
  });
  const plain = { glaze: GLAZE.none };
  const drum = (x0, x1, corner) => roundedRectPlan(x0, -20, x1, -4, { [corner]: 6 });
  const drumSlab = (p) => ({ kind: 'slab', floors: [{ y: FLOOR + 0.2, thick: 0.5, outer: offsetPlan(p, 0.5), inner: offsetPlan(p, -0.12) }] });
  return [
    deco('B.rear', HOTEL.rear, HOTEL_WING_TOP, [0.318, 0.065], null, { slabs: eyebrows(HOTEL.rear, 5, 1.2, HOTEL_WING_TOP) }),
    deco('B.link', HOTEL.link, HOTEL_WING_TOP, [0.326, 0.065], null, { slabs: eyebrows(HOTEL.link, 5, 1.8, HOTEL_WING_TOP) }),
    deco('B.front', HOTEL.front, HOTEL_FRONT_TOP, [0.315, 0.072], null, { slabs: eyebrows(HOTEL.front, 6, 1.8, HOTEL_FRONT_TOP) }),
    deco('B.centre', HOTEL.centre, HOTEL_CENTRE_TOP, [0.322, 0.090], null, {
      glaze: GLAZE.decoCentre, ramp: [28, -12, 3.0, 0],
      slabs: { kind: 'slab', floors: [{ y: HOTEL_CENTRE_TOP + 0.3, thick: 0.9, outer: offsetPlan(HOTEL.centre, 0.5), inner: offsetPlan(HOTEL.centre, -0.12) }] },
    }),
    deco('B.step1', roundedRectPlan(21.4, -20.6, 34.6, -3.4, 0.6), 2.4, [0.412, 0.010], 'B.centre', plain),
    deco('B.step2', roundedRectPlan(23.6, -18.4, 32.4, -5.6, 0.6), 2.2, [0.422, 0.010], 'B.step1', plain),
    deco('B.finial', roundedRectPlan(27.4, -14.5, 28.6, -7, 0.55), 4.0, [0.432, 0.010], 'B.step2', plain),
    deco('B.spire', roundedRectPlan(27.5, -12.6, 28.5, -8.8, 0.45), 3.6, [0.442, 0.010], 'B.finial', plain),
    deco('B.drumW', drum(-2, 8, 'sw'), FLOOR, [0.388, 0.012], 'B.front', { glaze: GLAZE.ribbon, slabs: drumSlab(drum(-2, 8, 'sw')) }),
    deco('B.capW', roundedRectPlan(-1.2, -19.2, 7.2, -4.8, { sw: 5.2 }), 1.1, [0.400, 0.008], 'B.drumW', plain),
    deco('B.drumE', drum(48, 58, 'se'), FLOOR, [0.390, 0.012], 'B.front', { glaze: GLAZE.ribbon, slabs: drumSlab(drum(48, 58, 'se')) }),
    deco('B.capE', roundedRectPlan(48.8, -19.2, 57.2, -4.8, { se: 5.2 }), 1.1, [0.402, 0.008], 'B.drumE', plain),
    deco('B.lounge', roundedRectPlan(37, -17, 46, -7, 2.0), 3.6, [0.392, 0.012], 'B.front', { kind: 'glass', glaze: GLAZE.storefront }),
    deco('B.loungeRoof', roundedRectPlan(36, -18, 47, -6, 2.6), 0.45, [0.404, 0.006], 'B.lounge', { kind: 'frame', ...plain }),
    // arrival canopy: a deep white blade reaching over the forecourt on slim columns
    deco('B.canopy', roundedRectPlan(18.6, -2.0, 37.4, 5.6, { se: 3.2, sw: 3.2 }), 0.7, [0.400, 0.010], null, { kind: 'frame', y0: 4.5, ...plain }),
    deco('B.porte', roundedRectPlan(65.5, -34, 80, -22, { ne: 5.5, se: 5.5 }), 0.8, [0.398, 0.010], null, { kind: 'frame', y0: 4.8, ...plain }),
  ];
}

export function hotelBoxes() {
  return [
    box('B.poolbar', 44, 52, -37, -33, 0, 3.4, 'stucco', 'B', [0.360, 0.030], null, { glaze: GLAZE.storefront }),
    // service link: closes the pool court to the paseo and carries kitchen supplies
    box('B.svcLink', SERVICE_LINK[0], SERVICE_LINK[1], SERVICE_LINK[2], SERVICE_LINK[3], 0, 4.2, 'stucco', 'B', [0.352, 0.030], null, { glaze: GLAZE.none }),
    box('B.screen', 4, 26, -49, -42, HOTEL_WING_TOP, 2.6, 'frame', 'B', [0.392, 0.020], null, { glaze: GLAZE.screen }),
    box('B.svcOverrun', 34, 40, -51, -45, HOTEL_WING_TOP, 3.4, 'frame', 'B', [0.394, 0.020], null, { glaze: GLAZE.screen }),
    // integrated mechanical screens on the plaza wing and the lobby wing roofs
    box('B.mechFront', 9.5, 18.5, -17.0, -8.0, HOTEL_FRONT_TOP, 2.4, 'frame', 'B', [0.396, 0.020], null, { glaze: GLAZE.screen }),
    box('B.mechLink', 56.5, 63.5, -35.0, -24.5, HOTEL_WING_TOP, 2.4, 'frame', 'B', [0.396, 0.020], null, { glaze: GLAZE.screen }),
  ];
}

export function hotelSlabs() {
  const t = (i) => [0.662 + i * 0.003, 0.05];
  return [
    // guest walks on the pool deck: lobby door to the pool, lobby wing along the south deck
    box('L.hwalkS', 3.8, 53.8, -22.4, -20.2, 0, HOTEL_POOL.deckY + 0.03, 'walk', 'L', t(4), null, { glaze: GLAZE.bond, module: [0.9, 0.45] }),
    box('L.hwalkC', 26.6, 29.4, -25.6, -22.4, 0, HOTEL_POOL.deckY + 0.03, 'walk', 'L', t(5), null, { glaze: GLAZE.bond, module: [0.9, 0.45] }),
    // arrival court: textured entrance paving is laid by plan/pedestrian.js (E-ARRIVAL)
    box('L.arrive', 66, 67.5, -36, -20, 0, 0.05, 'terrazzo', 'L', t(10)),
    box('L.drive', 73, 79.5, -42, -10, 0, 0.06, 'drive', 'L', t(11)),
    box('L.hroof', 36.5, 47.5, -19.5, -4.5, HOTEL_FRONT_TOP, 0.25, 'paving', 'L', t(17)),
  ];
}

// Hotel pool court: raised paved deck, pool with steps (west) and sun shelf (east), guest
// walks from the lobby and the lobby wing, loungers with side tables and umbrellas on the
// sunny north side, two cabanas at the west end, outdoor dining beside the pool bar,
// contained palms and shrub beds, and low deck lights. The court is enclosed on all four
// sides by the hotel and its service link, so no pool fence is modelled at grade.
export const HOTEL_POOL = {
  outline: roundedRectPlan(11.5, -32.8, 37.5, -26.2, 3.2),
  cx: 24.5, cz: -29.5, deckY: 0.25, depth: 1.4,
  court: [1.8, 54, -39, -20],
};

export function hotelPoolSpecs(tier) {
  const P = HOTEL_POOL;
  const N = tier.name === 'mobile' ? 64 : 96;
  const pool = poolSpecs('B.pool', {
    outline: P.outline, cx: P.cx, cz: P.cz, deckY: P.deckY, depth: P.depth, N, gutter: 0.1, axis: 'x',
    bands: [
      { name: 'B.poolSteps', from: -100, to: 13.6, kind: 'shelf' },
      { name: 'B.poolSwim', from: 13.6, to: 34.4, kind: 'pool' },
      { name: 'B.poolShelf', from: 34.4, to: 100, kind: 'shelf' },
    ],
  });
  const [x0, x1, z0, z1] = P.court;
  const deck = resampleByAngle(roundedRectPlan(x0, z0, x1, z1, 0.4), P.cx, P.cz, N);
  return {
    specs: [
      { name: 'B.poolDeck', type: 'prism', kind: 'deck', glaze: GLAZE.pavers, module: [1.2, 1.2], parent: null, y0: 0, h: P.deckY,
        start: 0.655, dur: 0.01, wire: false, phase: 'context', pts: deck, holes: [pool.opening] },
      ...pool.specs,
    ],
    basin: pool.basin,
  };
}

export function hotelParts(tier) {
  const out = [];
  const K = partsKit(out);
  const { block, column, lounger, umbrella, bed } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const palms = [];
  // reeded pilasters on the centrepiece
  for (let k = 0; k < 4; k++) {
    for (const x of [20.55 + k * 0.72, 35.45 - k * 0.72]) block(x - 0.17, x + 0.17, GROUND + 0.6, HOTEL_CENTRE_TOP - 0.5, -2.0, -1.6, 'stucco');
  }
  // arrival canopy: slim columns, charcoal sign band (no lettering), warm light line, planters
  for (const x of [19.1, 36.9]) column(x, 2.15, 0, 4.5, 0.12, 'metal');   // at the forecourt's outer corners, clear of the promenade and the entry zone
  block(23.5, 32.5, 4.62, 5.02, 5.64, 5.76, 'charcoal');
  block(21.6, 34.4, 4.42, 4.46, 4.95, 5.05, 'lamp', C);
  // warm wall lanterns on the storefront band beside the restaurant and café doors
  for (const x of [8.0, 16.0, 41.0, 49.0]) block(x - 0.12, x + 0.12, 3.5, 3.8, -4.12, -4.0, 'lamp', C);
  // selected balconies on the plaza facade (glass guards), floors 2 to 6, clear of the centrepiece
  for (const [bx0, bx1] of [[9.2, 16.4], [39.6, 46.8]]) {
    for (let j = 2; j <= 6; j++) {
      const y = GROUND + (j - 1) * FLOOR;
      block(bx0, bx1, y - 0.22, y, -4.0, -2.5, 'slab');
      block(bx0, bx1, y, y + 1.05, -2.58, -2.5, 'guardGlass', C);
      for (const x of [bx0, bx1]) block(x - 0.04, x + 0.04, y, y + 1.05, -3.95, -2.58, 'guardGlass', C);
    }
  }
  column(77.8, -31.3, 0, 4.8, 0.3);                                     // porte-cochère columns
  column(77.8, -24.7, 0, 4.8, 0.3);
  // vehicle arrival (valet — the hotel has no garage of its own): lit entry / exit pylons
  // with blank panels at both drive mouths, trench drains across the drive, a valet
  // podium and key kiosk under the porte-cochère, bollards and a luggage cart
  const X = fixtureKit(K);
  // pylons stand on the planted island between the entry and exit cuts, outside both sight triangles
  for (const [z, drain] of [[-31.6, -39.2], [-20.4, -12.8]]) {
    block(79.56, 79.86, 0.06, 2.7, z - 0.45, z + 0.45, 'charcoal', C);
    block(79.5, 79.56, 1.1, 2.35, z - 0.32, z + 0.32, 'frame', C);
    block(79.5, 79.54, 2.45, 2.52, z - 0.36, z + 0.36, 'lamp', C);
    block(73.3, 79.3, 0.04, 0.08, drain - 0.18, drain + 0.18, 'charcoal', C);
  }
  block(66.6, 67.3, 0.05, 1.12, -35.4, -34.6, 'charcoal', C);          // valet podium (beside the court, off the clear zone)
  block(66.65, 67.25, 1.12, 1.16, -35.35, -34.65, 'lamp', C);
  block(66.0, 66.45, 0.05, 1.9, -33.6, -32.4, 'charcoal', C);          // key kiosk on the lobby wing
  block(66.45, 66.48, 1.2, 1.6, -33.4, -32.6, 'lamp', C);
  block(66.55, 67.25, 0.25, 0.3, -25.9, -24.2, 'metal', C);            // luggage cart
  for (const z of [-25.8, -24.3]) column(66.9, z, 0.3, 1.5, 0.03, 'metal', C);
  block(66.85, 66.95, 1.8, 1.85, -25.9, -24.2, 'metal', C);
  for (const z of [-35.4, -30.6, -25.4, -20.8]) X.bollard(72.85, z, 0.05);   // edge of the court along the drive
  // service frontage on the north street: dock, refuse, staff door, dock canopy
  block(50, 58, 0, 4.4, -51.2, -50.8, 'void');
  block(60.5, 63.5, 0, 3.0, -51.2, -50.8, 'void');
  block(41.2, 42.8, 0, 2.4, -51.2, -50.8, 'void');
  block(49.0, 59.0, 4.45, 4.75, -53.6, -51.0, 'frame');
  block(65.8, 66.2, 0, 3.0, -30, -26, 'void');                         // bell desk / luggage door on the arrival court
  // pool court (deck top HOTEL_POOL.deckY)
  const D = HOTEL_POOL.deckY;
  const pairs = full ? [14.2, 19.4, 24.6, 29.8, 35.0] : [16.8, 27.2];
  for (const x of pairs) {
    lounger(x - 0.5, -35.1, D, 'z', -1); lounger(x + 0.5, -35.1, D, 'z', -1);
    K.sideTableAt(x + 1.35, -35.6, D);
    umbrella(x + 1.35, -36.6, D, 2.6);
  }
  bed(4.0, 40.0, -38.7, -37.3, D, 0.6, { shrubs: true });                          // planting along the fitness wing
  bed(2.3, 3.5, -36.0, -23.8, D, 0.6, { shrubs: true });                           // planting along the service link
  K.cabana(4.2, 7.4, -33.6, -30.0, D, 'w'); K.cabana(4.2, 7.4, -28.8, -25.2, D, 'w');
  // outdoor dining beside the pool bar, under umbrellas
  for (const [x, z] of [[42.5, -29.6], [47.5, -29.6], [42.5, -25.2], [47.5, -25.2]]) { K.dining(x, z, D, full ? 4 : 2); if (full || x < 45) umbrella(x, z, D, 2.8); }
  // daybeds on the south deck facing the pool, either side of the lobby walk
  K.daybed(20.5, -24.2, D, Math.PI / 2); K.daybed(35.0, -24.2, D, Math.PI / 2);
  // contained palms at the court corners (planters rather than loose trees)
  for (const [x, z] of [[9.2, -35.8], [9.2, -24.0], [38.8, -35.8], [52.2, -23.4]]) { bed(x - 0.8, x + 0.8, z - 0.8, z + 0.8, D, 0.9); palms.push({ x, z, y: D + 0.9, h: 7.5, r: 2.4 }); }
  // low deck lights along the pool and the walks
  for (let x = 12.5; x <= 36.5; x += full ? 4 : 8) { K.deckLight(x, -33.95, D); K.deckLight(x, -25.05, D); }
  // rooftop lounge terrace
  const hr = HOTEL_FRONT_TOP + 0.25;
  umbrella(39.2, -5.8, hr, 2.6); umbrella(44.6, -5.8, hr, 2.6);
  bed(36.8, 38.6, -19.2, -18.2, hr, 0.5); bed(45.4, 47.2, -19.2, -18.2, hr, 0.5);
  return { parts: out, palms };
}
