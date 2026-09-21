// B — contemporary Art Deco hotel: curved volumes (rounded corners, eyebrows),
// a private pool court, and a conceptual ground-floor plan that separates guest
// arrival and amenities from receiving, refuse, housekeeping, staff and kitchen
// routes. The plan is simplified and mostly hidden in the hero view.
//
// Now that the park sits on the condo entrance axis, the Deco tower has moved from the
// middle of the plaza front to its south-west corner — the corner nearest the fountain —
// so the hotel addresses the park with its tallest element instead of presenting a long
// flank to it. The composition is the usual Deco hierarchy, just re-hung on that corner:
// a 12-storey reeded tower with a streamlined drum corner and a stepped crown, a 7-storey
// wing running east along the plaza, and the 6-storey rear and lobby wings behind. The
// guest entrance moved with the tower, under a deep marquee at its base; vehicle arrival
// stays on the east court. The pool court is unchanged.
import { GROUND, FLOOR, RES, GLAZE, floorsToHeight, roundedRectPlan, offsetPlan, resampleByAngle, box, partsKit } from './core.js';
import { poolSpecs } from './pools.js';
import { fixtureKit } from './fixtures.js';

export const HOTEL = {
  // 7-storey plaza wing. Its whole south face is held back to z = -7.6 so the Central
  // Promenade can run dead straight from the east sidewalk into the podium portal, with the
  // restaurant and café terraces and their frontage walk in the strip between. Its west end
  // was cut back from x = -2 to x = 6 to clear the fountain plaza.
  front: roundedRectPlan(6, -20, 58, -7.6, { se: 6, sw: 2.5 }),
  // 12-storey Deco tower on the corner nearest the fountain. It is set 0.4 m in from the
  // wing's west face and 0.6 m in from its north face so no two facades share a plane, and
  // stands 2.4 m proud of the plaza face, where a 5 m streamlined drum corner turns it to
  // the park.
  tower: roundedRectPlan(6.4, -19.4, 24, -5.2, { sw: 5.0, se: 1.6, nw: 0.8, ne: 0.8 }),
  // Both arms of the U stop on the same line, x = 6. The plaza wing cannot reach further
  // west without running into the fountain plaza, so the rear wing came back 8 m to meet it
  // instead of overshooting the composition.
  rear: roundedRectPlan(6, -51, 66, -39, { nw: 6 }),               // guest rooms over back of house
  link: roundedRectPlan(54, -39.5, 66, -18, 0.6),                  // lobby wing on the arrival court
};
export const HOTEL_FRONT_TOP = floorsToHeight(7);                  // 24.2
export const HOTEL_TOWER_TOP = floorsToHeight(12);                 // 40.2
export const HOTEL_WING_TOP = floorsToHeight(6);                   // 21.0
// The west service bar is gone. Dressing a 21 m opaque box in piers and a cornice never
// stopped it being a service shed on a public walk, so servicing was replanned instead: the
// rear wing now reaches the front wing through the east (arrival) wing, and nothing has to
// run along the paseo.
//
// What stands on that line now is a garden wall, not a building. It closes the open side of
// the U at ground-floor height, in the plane of the two wing ends: both wings present a flat
// west face on x = 6, and the wall continues that same plane between them. Nothing of the
// court stands proud of it, so the hotel's west elevation reads as one unbroken line from the
// plaza wing to the rear wing rather than as a wall thrown across in front of them. It is a
// single leaf of masonry with nothing above it and nothing behind it but planting.
//
// The pool deck came back with it. The court used to run 4.2 m further west than the
// buildings did; that ground is now open lawn on the public side of the wall, which is where
// the planting that masks the wall stands.
//
// Conceptual only: wall construction, footings, lateral support, barrier height, gate
// hardware, opening sizes and climbability are not designed or verified here.
export const COURT_WALL = {
  x: 6.0, thick: 0.44,           // the wing-end plane: both west faces stand on x = 6
  z0: -39.8, z1: -19.2,          // lapped a little into each wing's corner, so there is no gap
  h: 4.6, coping: 0.4,           // top on the ground-floor line at 5.0 m
  pierPitch: 3.8, pier: 0.16,    // shallow pilasters on the guest-room bay
  gate: [-33.2, -31.4],          // the one controlled opening, on the hotel's side
};
// Both faces of the wall are planted. Vines are trained over the coping and hang down each
// side, so neither the court nor the paseo ever sees bare masonry; the paseo side then has a
// deep bank of trees, palms and shrubs standing in front of it (plan/grounds.js), which is
// what actually reads from the walk. Species, soil volume, irrigation, wall fixings and
// establishment are not designed.
export const COURT_VINES = {
  pitch: 1.0,                    // spacing of the hanging masses along each face
  depth: 0.55,                   // how far the foliage stands off the face
  drop: [2.6, 3.6],              // how far it falls from under the coping
};
// The plaza wing's facade is set out on the guest-room bay, so the base piers, the middle
// fins and the balcony bays all land on the same lines. The straight south face runs from
// the tower's east edge to where the 6 m south-east curve takes over.
export const FACADE_BAY = 3.8;        // guest-room module; also the shader's window bay
export const FACADE_PHASE = 722.0;    // the shader's positive-offset constant, 190 × FACADE_BAY

// Distance travelled around a plan from its first vertex to a point lying on it. The facade
// shader's window grid runs on this same perimeter coordinate (`across` in layers/curves.js),
// so it is the only way to put a modelled pier on a real window line rather than near one.
export function runAt(plan, x, z) {
  let run = 0;
  for (let i = 0; i < plan.length; i++) {
    const [ax, az] = plan[i], [bx, bz] = plan[(i + 1) % plan.length];
    const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez);
    if (len > 1e-9) {
      const t = ((x - ax) * ex + (z - az) * ez) / (len * len);
      if (t >= -1e-6 && t <= 1 + 1e-6 && Math.hypot(ax + ex * t - x, az + ez * t - z) < 1e-6) return run + len * t;
    }
    run += len;
  }
  return null;
}

// x positions of the shader's bay boundaries along a straight south-facing run of a plan
export function bayLines(plan, z, x0, x1, { inset = 0 } = {}) {
  const r0 = runAt(plan, x0, z), r1 = runAt(plan, x1, z);
  if (r0 == null || r1 == null) return [];
  const dir = Math.sign(r1 - r0) || 1, scale = (x1 - x0) / (r1 - r0);
  const out = [];
  const lo = Math.min(r0, r1) + inset, hi = Math.max(r0, r1) - inset;
  for (let k = Math.ceil((lo + FACADE_PHASE) / FACADE_BAY); (k * FACADE_BAY - FACADE_PHASE) <= hi; k++) {
    out.push(x0 + (k * FACADE_BAY - FACADE_PHASE - r0) * scale);
  }
  return out.sort((a, b) => a - b);
}

export const WING_BAY = { x0: 24.0, x1: 52.0 };
// The tower's central emphasis: two reeded piers on bay lines, carried from the marquee
// straight through the crown. Everything between them is the entrance and the lobby glazing.
export const TOWER_FACE = { z: -5.2, x0: 11.4, x1: 22.4 };
// The crown: one stepped composition, not a screened box and not the old four-piece stack.
// The shaft gathers into recessed shoulders, then two progressively smaller stages, then a
// compact lantern — so the tower tapers visibly from the front AND the side. The plant is
// inside the louvred first stage. Plant sizing, access and maintenance are not designed.
export const CROWN = {
  shoulder: { plan: [7.0, -18.8, 23.4, -5.8, 4.4], h: 1.8 },
  s1: { plan: [8.0, -18.2, 22.4, -6.6, 2.6], h: 2.8 },
  s2: { plan: [9.4, -17.0, 21.0, -7.6, 1.8], h: 2.2 },
  lantern: { plan: [11.6, -15.6, 18.8, -9.0, 1.2], h: 1.4, cap: 0.35 },
};
export const HOTEL_CROWN_TOP = floorsToHeight(12) + CROWN.shoulder.h + CROWN.s1.h + CROWN.s2.h + CROWN.lantern.h + CROWN.lantern.cap;   // 48.75
export const PIER_TOP = floorsToHeight(12) + CROWN.shoulder.h + CROWN.s1.h;   // piers die into the second stage
// Pulling the front block's west end back to x = 6 took the kitchen away from the service
// link, so the link runs further south and turns east under this spur, round the west end
// of the pool court, into the back-of-house corridor behind the lobby.


// Ground-floor program. zone: guest | public | service. Rooms of the same side
// (service, or guest + public) connect where they share at least 1 m of edge; the
// service and guest sides connect only through the doors declared in HOTEL_DOORS.
export const HOTEL_GROUND = [
  // service
  { name: 'Receiving + loading dock', zone: 'service', rect: [48, 58, -51, -45], door: 'north' },   // the north frontage is unchanged
  { name: 'Refuse + recycling (compactor)', zone: 'service', rect: [58, 64, -51, -45], door: 'north' },
  { name: 'Kitchen stores (dry + cold)', zone: 'service', rect: [44, 48, -51, -45] },
  { name: 'Staff entrance + security', zone: 'service', rect: [40, 44, -51, -45], door: 'north' },
  { name: 'Service elevators (2) + service stair', zone: 'service', rect: [34, 40, -51, -45], core: 'service' },
  { name: 'Housekeeping + linen', zone: 'service', rect: [24, 34, -51, -45] },
  { name: 'Staff lockers, break room, HR', zone: 'service', rect: [17, 24, -51, -45] },
  { name: 'Main electrical / water / fire pump', zone: 'service', rect: [12, 17, -50.4, -45] },
  { name: 'BOH corridor', zone: 'service', rect: [6.5, 64, -45, -43], corridor: true },
  { name: 'West service stair + mechanical', zone: 'service', rect: [6.5, 10, -43, -39.6] },
  { name: 'Pool-bar pantry', zone: 'service', rect: [44.6, 52, -43, -39] },
  { name: 'Pool plant + laundry chute room', zone: 'service', rect: [56.2, 64, -43, -40.1] },
  // Servicing now runs the long way round the court — rear wing, down the arrival wing's
  // west edge, then west behind the lobby — instead of cutting along the public paseo.
  { name: 'Service corridor (arrival wing)', zone: 'service', rect: [53.4, 55.4, -43, -17.6], corridor: true },
  { name: 'Main kitchen + pastry', zone: 'service', rect: [39, 53.4, -19.4, -14] },
  // Guest and public. The plaza wing is laid out as ONE lobby sequence: reception in the
  // tower at the west end, then the restaurant and the lobby bar along the plaza face, then
  // the arrival gallery at the east end where the bell desk and the porte-cochère are. Every
  // one of those rooms spans z = -10.5, so there is an unbroken 50 m sightline from the
  // vehicular arrival to the reception desk. The back-of-house band runs behind them.
  { name: 'Lobby + reception', zone: 'guest', rect: [7, 22, -17.6, -6.0] },
  { name: 'Guest elevators (tower)', zone: 'guest', rect: [11, 17, -16, -10], core: 'guest', within: 'Lobby + reception' },
  { name: 'Lobby gallery', zone: 'guest', rect: [22, 39, -17.6, -14] },
  { name: 'Restaurant (plaza)', zone: 'public', rect: [22, 41, -14, -7.7] },
  { name: 'Lobby bar + café', zone: 'public', rect: [41, 53.4, -14, -7.7] },
  { name: 'Arrival gallery', zone: 'guest', rect: [53.4, 57.8, -17.6, -10.6] },
  { name: 'Arrival lobby + bell desk', zone: 'guest', rect: [55.4, 66, -36, -17.6] },
  { name: 'Guest elevators (link)', zone: 'guest', rect: [56, 62, -39.5, -36], core: 'guest' },
  { name: 'Fitness + spa changing', zone: 'guest', rect: [10, 44, -42.4, -39] },
  { name: 'Pool court', zone: 'guest', rect: [6, 53.4, -39, -20], outdoor: true },
  { name: 'Porte-cochère', zone: 'guest', rect: [66, 80, -34, -22], outdoor: true },
];

export const HOTEL_DOORS = [
  ['Main kitchen + pastry', 'Restaurant (plaza)'],        // service door to the dining room
  ['Main kitchen + pastry', 'Lobby bar + café'],          // and to the lobby bar it also serves
  ['Pool-bar pantry', 'Pool court'],                      // pool bar service hatch
];
// The guest route, as a route rather than a row of touching rectangles. Both front doors
// reach the same reception desk and the same lift door along a declared clear passage that
// turns where it has to: south of the tower core, then west of it. Seating sits outside the
// passage, against the glazing, which is where the park view is anyway.
//
// Conceptual allowance only — no accessibility, egress or occupancy conclusion is claimed.
export const RECEPTION = [9.4, -14.4];          // desk position, facing the park entrance
export const LIFT_DOOR = [11.0, -13.0];         // lift lobby opening in the core's west wall
export const DINING_BAND = [22, 53.4, -10.4, -7.7];   // indoor seating, between the passage and the glass
export const GUEST_ROUTE = {
  width: 2.4,                                    // conceptual clear passage, 2.4–3.0 m target
  fromPark: [[14.0, -6.2], [14.0, -8.0], [9.4, -8.0], [9.4, -14.4]],
  fromCourt: [[58.0, -21.0], [56.6, -19.0], [56.6, -11.7], [19.4, -11.7], [19.4, -8.0], [9.4, -8.0], [9.4, -14.4]],
};
// walls that must not be read as connections even though the rooms touch
export const HOTEL_WALLS = [
  ['Service corridor (arrival wing)', 'Pool court'], ['West service stair + mechanical', 'Fitness + spa changing'],
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
  const drum = (x0, x1, corner) => roundedRectPlan(x0, -20, x1, -7.6, { [corner]: 6 });
  const T = HOTEL.tower;
  const drumSlab = (p) => ({ kind: 'slab', floors: [{ y: FLOOR + 0.2, thick: 0.5, outer: offsetPlan(p, 0.5), inner: offsetPlan(p, -0.12) }] });
  return [
    deco('B.rear', HOTEL.rear, HOTEL_WING_TOP, [0.318, 0.065], null, { slabs: eyebrows(HOTEL.rear, 5, 1.2, HOTEL_WING_TOP) }),
    deco('B.link', HOTEL.link, HOTEL_WING_TOP, [0.326, 0.065], null, { slabs: eyebrows(HOTEL.link, 5, 1.8, HOTEL_WING_TOP) }),
    deco('B.front', HOTEL.front, HOTEL_FRONT_TOP, [0.315, 0.072], null, { slabs: eyebrows(HOTEL.front, 6, 1.8, HOTEL_FRONT_TOP) }),
    // the tower: reeded shaft, its own cornice, then the stepped Deco crown, finial and spire
    deco('B.tower', T, HOTEL_TOWER_TOP, [0.322, 0.090], null, {
      glaze: GLAZE.decoCentre, ramp: [15.2, -12.3, 3.0, 0],
      slabs: { kind: 'slab', floors: [{ y: HOTEL_TOWER_TOP + 0.3, thick: 0.9, outer: offsetPlan(T, 0.5), inner: offsetPlan(T, -0.12) }] },
    }),
    // The stepped crown. Each stage sits on the one below and is plainly smaller than it, so
    // the taper reads from every side; the first stage is louvred and holds the plant.
    deco('B.shoulder', roundedRectPlan(...CROWN.shoulder.plan), CROWN.shoulder.h, [0.408, 0.014], 'B.tower', {
      glaze: GLAZE.none,
      slabs: { kind: 'slab', floors: [{ y: CROWN.shoulder.h - 0.13 - 0.42, thick: 0.42, outer: offsetPlan(roundedRectPlan(...CROWN.shoulder.plan), 0.5), inner: offsetPlan(roundedRectPlan(...CROWN.shoulder.plan), -0.12) }] },
    }),
    deco('B.crown1', roundedRectPlan(...CROWN.s1.plan), CROWN.s1.h, [0.418, 0.012], 'B.shoulder', {
      kind: 'frame', glaze: GLAZE.screen,
      slabs: { kind: 'slab', floors: [{ y: CROWN.s1.h - 0.13 - 0.38, thick: 0.38, outer: offsetPlan(roundedRectPlan(...CROWN.s1.plan), 0.45), inner: offsetPlan(roundedRectPlan(...CROWN.s1.plan), -0.12) }] },
    }),
    deco('B.crown2', roundedRectPlan(...CROWN.s2.plan), CROWN.s2.h, [0.428, 0.010], 'B.crown1', {
      glaze: GLAZE.none,
      slabs: { kind: 'slab', floors: [{ y: CROWN.s2.h - 0.13 - 0.34, thick: 0.34, outer: offsetPlan(roundedRectPlan(...CROWN.s2.plan), 0.4), inner: offsetPlan(roundedRectPlan(...CROWN.s2.plan), -0.12) }] },
    }),
    deco('B.lantern', roundedRectPlan(...CROWN.lantern.plan), CROWN.lantern.h, [0.438, 0.008], 'B.crown2', {
      kind: 'frame', glaze: GLAZE.none,
      slabs: { kind: 'slab', floors: [{ y: CROWN.lantern.h - 0.08, thick: CROWN.lantern.cap, outer: offsetPlan(roundedRectPlan(...CROWN.lantern.plan), 0.34), inner: offsetPlan(roundedRectPlan(...CROWN.lantern.plan), -0.12) }] },
    }),
    deco('B.drumE', drum(48, 58, 'se'), FLOOR, [0.390, 0.012], 'B.front', { glaze: GLAZE.ribbon, slabs: drumSlab(drum(48, 58, 'se')) }),
    deco('B.lounge', roundedRectPlan(37, -17, 46, -9.0, 2.0), 3.6, [0.392, 0.012], 'B.front', { kind: 'glass', glaze: GLAZE.storefront }),
    deco('B.loungeRoof', roundedRectPlan(36, -18, 47, -8.2, 2.6), 0.45, [0.404, 0.006], 'B.lounge', { kind: 'frame', ...plain }),
    // entrance marquee: a deep white blade reaching over the forecourt at the tower's base
    deco('B.canopy', roundedRectPlan(9.0, -5.6, 24.6, -2.0, { se: 2.0, sw: 2.0 }), 0.7, [0.400, 0.010], null, { kind: 'frame', y0: 4.5, ...plain }),
    deco('B.porte', roundedRectPlan(65.5, -34, 80, -22, { ne: 5.5, se: 5.5 }), 0.8, [0.398, 0.010], null, { kind: 'frame', y0: 4.8, ...plain }),
  ];
}

export function hotelBoxes() {
  return [
    box('B.poolbar', 44, 52, -37, -33, 0, 3.4, 'stucco', 'B', [0.360, 0.030], null, { glaze: GLAZE.storefront }),
    // service link: closes the pool court to the paseo and carries kitchen supplies
    box('B.screen', 13, 29, -49, -42, HOTEL_WING_TOP, 2.6, 'frame', 'B', [0.392, 0.020], null, { glaze: GLAZE.screen }),
    box('B.svcOverrun', 34, 40, -51, -45, HOTEL_WING_TOP, 3.4, 'frame', 'B', [0.394, 0.020], null, { glaze: GLAZE.screen }),
    // integrated mechanical screens on the plaza wing and the lobby wing roofs
    box('B.mechFront', 27.5, 36.0, -17.0, -9.0, HOTEL_FRONT_TOP, 2.4, 'frame', 'B', [0.396, 0.020], null, { glaze: GLAZE.screen }),
    box('B.mechLink', 56.5, 63.5, -35.0, -24.5, HOTEL_WING_TOP, 2.4, 'frame', 'B', [0.396, 0.020], null, { glaze: GLAZE.screen }),
  ];
}

export function hotelSlabs() {
  const t = (i) => [0.662 + i * 0.003, 0.05];
  return [
    // guest walks on the pool deck: lobby door to the pool, lobby wing along the south deck
    box('L.hwalkS', 6.3, 53.8, -22.4, -20.2, 0, HOTEL_POOL.deckY + 0.03, 'walk', 'L', t(4), null, { glaze: GLAZE.bond, module: [0.9, 0.45] }),
    box('L.hwalkC', 26.6, 29.4, -25.6, -22.4, 0, HOTEL_POOL.deckY + 0.03, 'walk', 'L', t(5), null, { glaze: GLAZE.bond, module: [0.9, 0.45] }),
    // arrival court: textured entrance paving is laid by plan/pedestrian.js (E-ARRIVAL)
    box('L.arrive', 66, 67.5, -36, -20, 0, 0.05, 'terrazzo', 'L', t(10)),
    box('L.drive', 73, 79.5, -42, -10, 0, 0.06, 'drive', 'L', t(11)),
    box('L.hroof', 36.5, 47.5, -19.5, -8.6, HOTEL_FRONT_TOP, 0.25, 'paving', 'L', t(17)),
  ];
}

// Hotel pool court: raised paved deck, pool with steps (west) and sun shelf (east), guest
// walks from the lobby and the lobby wing, loungers with side tables and umbrellas on the
// sunny north side, two cabanas at the west end, outdoor dining beside the pool bar,
// contained palms and shrub beds, and low deck lights. The court is enclosed on all four
// sides by the two wings, the arrival wing and the garden wall on the paseo, so no separate
// pool fence is modelled at grade. Barrier compliance is not assessed.
export const HOTEL_POOL = {
  outline: roundedRectPlan(11.5, -32.8, 37.5, -26.2, 3.2),
  cx: 24.5, cz: -29.5, deckY: 0.25, depth: 1.4,
  court: [6.0, 53.4, -39, -20],        // west edge on the wing-end plane, under the court wall
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
  const { add, block, column, lounger, umbrella, bed } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const palms = [];
  // --- the tower's central emphasis ------------------------------------------------------
  // Two reeded piers standing on real window lines (the shader's own bay grid, not numbers
  // guessed beside it), rising unbroken from the marquee through the crown. The bays they
  // enclose are the entrance and the lobby glazing; the flanks outside them stay quiet.
  const towerPiers = bayLines(HOTEL.tower, TOWER_FACE.z, TOWER_FACE.x0, TOWER_FACE.x1);
  for (const x of towerPiers) {
    for (const d of [-0.34, 0, 0.34]) block(x + d - 0.15, x + d + 0.15, GROUND + 0.4, PIER_TOP - 0.3, -5.26, -4.9, 'stucco');
  }
  // the crown's recessed slot, lit, in the 0.8 m setback above the shaft
  block(towerPiers[0] - 1.2, towerPiers[towerPiers.length - 1] + 1.2, HOTEL_TOWER_TOP + 0.06, HOTEL_TOWER_TOP + 0.16, -5.18, -5.06, 'lamp', C);
  // schematic reception desk and the lift-lobby opening the route ends at
  block(RECEPTION[0] - 1.6, RECEPTION[0] + 1.6, 0, 1.1, RECEPTION[1] - 0.45, RECEPTION[1] + 0.45, 'frame');
  block(RECEPTION[0] - 1.6, RECEPTION[0] + 1.6, 2.6, 2.68, RECEPTION[1] - 0.3, RECEPTION[1] + 0.3, 'lamp', C);
  block(LIFT_DOOR[0] - 0.08, LIFT_DOOR[0] + 0.02, 0, 2.6, LIFT_DOOR[1] - 1.2, LIFT_DOOR[1] + 1.2, 'void');
  // --- the hospitality base ---------------------------------------------------------------
  // Visible doors: the guest entrance between the piers, and the restaurant and bar with
  // their own openings on the wing, so the base reads as one frontage with three thresholds.
  block(towerPiers[0] + 0.6, towerPiers[1] - 0.6, 0, 3.4, -5.30, -5.21, 'void');
  for (const x of [32.2, 43.6]) block(x - 1.5, x + 1.5, 0, 3.2, -7.64, -7.54, 'void');
  // entrance marquee: slim columns, charcoal sign band (no lettering), warm light line
  for (const [x, z] of [[9.8, -2.8], [23.9, -2.6]]) column(x, z, 0, 4.5, 0.12, 'metal');  // under the marquee's outer corners, clear of the forecourt and the walk
  block(13.5, 20.5, 4.62, 5.02, -2.60, -2.48, 'charcoal');
  block(11.6, 21.8, 4.42, 4.46, -3.35, -3.25, 'lamp', C);
  // warm wall lanterns: on the tower's plaza face beside the entrance, and on the wing's
  // storefront band beside the restaurant and café doors
  for (const x of [12.0, 19.8]) block(x - 0.12, x + 0.12, 3.5, 3.8, -5.32, -5.2, 'lamp', C);
  for (const x of [28.2, 36.0, 39.6, 47.2]) block(x - 0.12, x + 0.12, 3.5, 3.8, -7.62, -7.5, 'lamp', C);   // at bay centres, clear of the fins
  // --- plaza wing: base, middle and crown on one 3.8 m guest-room bay --------------------
  // A 7-storey flank this long needs a rhythm rather than more ornament: a storefront pier
  // at every bay in the base, a shallow fin carrying the same line up the middle floors, and
  // one banded crown under the cornice. Everything projects from the facade plane and laps
  // back into it, so no two surfaces share a plane.
  {
    const B = WING_BAY;
    // the wing reads horizontally: its fins sit on the same window lines but stop well below
    // the parapet, and the eyebrows and the crown band carry the eye along rather than up
    for (const x of bayLines(HOTEL.front, -7.6, B.x0, B.x1)) {
      block(x - 0.2, x + 0.2, 0, GROUND - 0.25, -7.64, -7.34, 'stucco');                       // storefront pier
      block(x - 0.15, x + 0.15, GROUND + 0.55, HOTEL_FRONT_TOP - 3.4, -7.64, -7.44, 'stucco'); // bay fin, held down from the parapet
    }
    block(B.x0, B.x1, HOTEL_FRONT_TOP - 3.4, HOTEL_FRONT_TOP - 2.95, -7.64, -7.26, 'stucco');   // crown band
    block(B.x0 + 0.4, B.x1 - 0.4, 2.62, 2.66, -7.58, -7.48, 'lamp', C);                        // warm line behind the storefront glazing
  }
  // warm light line along the tower's lobby glazing, so the frontage reads as one active base
  block(11.6, 20.6, 2.62, 2.66, -5.18, -5.08, 'lamp', C);
  // selected balconies on the wing's plaza facade (glass guards), floors 2 to 6, on the bay lines
  for (const [bx0, bx1, zf] of [[26.33, 33.93, -7.6], [41.53, 49.13, -7.6]]) {
    for (let j = 2; j <= 6; j++) {
      const y = GROUND + (j - 1) * FLOOR;
      block(bx0, bx1, y - 0.22, y, zf, zf + 1.5, 'slab');
      block(bx0, bx1, y, y + 1.05, zf + 1.42, zf + 1.5, 'guardGlass', C);
      for (const x of [bx0, bx1]) block(x - 0.04, x + 0.04, y, y + 1.05, zf + 0.05, zf + 1.42, 'guardGlass', C);
    }
  }
  // --- the pool court's wall on the paseo --------------------------------------------------
  // The wall that closes the U, standing in the plane of the two wing ends and lapped into
  // each of their corners, carried to the ground-floor line so the west elevation runs
  // unbroken from one wing to the other. Shallow pilasters on the guest-room bay, a stone
  // coping, and one gate the hotel controls. Both faces carry vines over the coping; the
  // paseo face is masked besides by the planting in plan/grounds.js.
  {
    const W = COURT_WALL;
    const t = W.thick / 2;
    const cap = (x0, x1, z0, z1) => {                                   // coping, lapped past the ends
      block(x0 - 0.09, x1 + 0.09, W.h, W.h + W.coping, z0 - 0.09, z1 + 0.09, 'stone');
    };
    // the long run, in two lengths either side of the gate
    for (const [a, b] of [[W.z0, W.gate[0]], [W.gate[1], W.z1]]) {
      block(W.x - t, W.x + t, 0, W.h, a, b, 'stucco');
      cap(W.x - t, W.x + t, a, b);
    }
    block(W.x - t, W.x + t, 3.0, W.h, W.gate[0], W.gate[1], 'stucco');  // lintel over the gate
    cap(W.x - t, W.x + t, W.gate[0], W.gate[1]);
    for (const z of W.gate) block(W.x - t - 0.1, W.x + t + 0.1, 0, 3.24, z - 0.16, z + 0.16, 'stone');
    block(W.x - 0.03, W.x + 0.03, 0.18, 2.86, W.gate[0] + 0.16, W.gate[1] - 0.16, 'metal', C);   // the leaf
    // pilasters on both faces, on the bay
    for (let z = W.z0 + W.pierPitch / 2; z <= W.z1 - 0.4; z += W.pierPitch) {
      if (z > W.gate[0] - 0.8 && z < W.gate[1] + 0.8) continue;
      for (const d of [-1, 1]) block(W.x + d * t - (d < 0 ? W.pier : 0), W.x + d * t + (d > 0 ? W.pier : 0), 0, W.h + 0.06, z - 0.34, z + 0.34, 'stucco');
    }
    // vines: trained over the coping and hanging down both faces, with a continuous trailing
    // band at the top so the wall is green from the first course of the coping down
    const V = COURT_VINES;
    const tone = ['shrubDark', 'shrub', 'shrubDark', 'shrubLight', 'shrub', 'shrubDark'];
    const step = full ? V.pitch : V.pitch * 2;
    let k = 0;
    for (const face of [-1, 1]) {
      const fx = W.x + face * (t + V.depth / 2);
      const lap = [W.x + face * (t - 0.06), W.x + face * (t + V.depth)].sort((a, b) => a - b);
      block(lap[0], lap[1], W.h - 0.32, W.h + 0.14, W.z0, W.z1, 'shrubDark', C);
      for (let z = W.z0 + 0.6 + (face > 0 ? step / 2 : 0); z <= W.z1 - 0.6; z += step, k++) {
        const drop = V.drop[0] + ((k % 3) * (V.drop[1] - V.drop[0])) / 2;
        add('bush', fx, W.h + 0.12 - drop / 2, z, V.depth, drop, step * 1.2, tone[k % tone.length], C);
      }
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
  bed(6.55, 40.0, -38.7, -37.3, D, 0.6, { shrubs: true });                          // planting along the fitness wing
  bed(6.45, 7.5, -37.0, -34.4, D, 0.6, { shrubs: true });                           // planting at the foot of the court wall,
  bed(6.45, 7.5, -24.4, -21.2, D, 0.6, { shrubs: true });                           // in the lengths the cabanas leave free
  K.cabana(6.9, 9.5, -33.6, -30.0, D, 'w'); K.cabana(6.9, 9.5, -28.8, -25.2, D, 'w');   // backed onto the wall
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
  umbrella(39.2, -10.0, hr, 2.6); umbrella(44.6, -10.0, hr, 2.6);
  bed(36.8, 38.6, -19.2, -18.2, hr, 0.5); bed(45.4, 47.2, -19.2, -18.2, hr, 0.5);
  return { parts: out, palms };
}
