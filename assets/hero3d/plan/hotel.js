// B — contemporary Art Deco hotel: curved volumes (rounded corners, eyebrows),
// a private pool court, and a conceptual ground-floor plan that separates guest
// arrival and amenities from receiving, refuse, housekeeping, staff and kitchen
// routes. The plan is simplified and mostly hidden in the hero view.
import { GROUND, FLOOR, RES, GLAZE, floorsToHeight, roundedRectPlan, offsetPlan, box, partsKit } from './core.js';

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
  floors.push({ y: roofY, thick: 0.45, outer: offsetPlan(plan, 0.35), inner });  // parapet cornice
  return { kind: 'slab', floors };
}

export function hotelMasses() {
  const deco = (name, plan, h, timing, parent = null, opts = {}) => ({
    name, type: 'prism', kind: opts.kind ?? 'stucco', glaze: opts.glaze ?? GLAZE.deco, module: RES, parent, y0: opts.y0 ?? 0, h,
    start: timing[0], dur: timing[1], pts: plan, slabs: opts.slabs, ramp: opts.ramp, ribs: opts.ribs ?? 12,
  });
  const plain = { glaze: GLAZE.none };
  const drum = (x0, x1, corner) => roundedRectPlan(x0, -20, x1, -4, { [corner]: 6 });
  const drumSlab = (p) => ({ kind: 'slab', floors: [{ y: FLOOR, thick: 0.3, outer: offsetPlan(p, 0.5), inner: offsetPlan(p, -0.12) }] });
  return [
    deco('B.rear', HOTEL.rear, HOTEL_WING_TOP, [0.318, 0.065], null, { slabs: eyebrows(HOTEL.rear, 5, 1.2, HOTEL_WING_TOP) }),
    deco('B.link', HOTEL.link, HOTEL_WING_TOP, [0.326, 0.065], null, { slabs: eyebrows(HOTEL.link, 5, 1.8, HOTEL_WING_TOP) }),
    deco('B.front', HOTEL.front, HOTEL_FRONT_TOP, [0.315, 0.072], null, { slabs: eyebrows(HOTEL.front, 6, 1.8, HOTEL_FRONT_TOP) }),
    deco('B.centre', HOTEL.centre, HOTEL_CENTRE_TOP, [0.322, 0.090], null, {
      glaze: GLAZE.decoCentre, ramp: [28, -12, 3.0, 0],
      slabs: { kind: 'slab', floors: [{ y: HOTEL_CENTRE_TOP, thick: 0.6, outer: offsetPlan(HOTEL.centre, 0.5), inner: offsetPlan(HOTEL.centre, -0.12) }] },
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
    deco('B.canopy', roundedRectPlan(21, -2.5, 35, 2.5, { se: 2.2, sw: 2.2 }), 0.6, [0.400, 0.010], null, { kind: 'frame', y0: 4.4, ...plain }),
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
  ];
}

export function hotelSlabs() {
  const t = (i) => [0.662 + i * 0.003, 0.05];
  return [
    box('L.hcourt', 1.8, 54, -39, -20, 0, 0.08, 'paving', 'L', t(4)),
    box('L.hcope', 11.5, 40.5, -33.5, -25.5, 0, 0.12, 'coping', 'L', t(5)),
    box('L.hpool', 12, 36.5, -33, -26, 0, 0.16, 'pool', 'L', t(6)),
    box('L.hshelf', 36.5, 40, -33, -26, 0, 0.16, 'shelf', 'L', t(7)),
    box('L.hbed', 4, 40, -38.6, -37.2, 0, 0.6, 'planter', 'L', t(8)),
    box('L.fore', 18, 38, -2, 8, 0, 0.05, 'terrazzo', 'L', t(9)),
    box('L.arrive', 66, 73, -36, -20, 0, 0.05, 'terrazzo', 'L', t(10)),
    box('L.drive', 73, 79.5, -42, -10, 0, 0.06, 'drive', 'L', t(11)),
    box('L.hroof', 36.5, 47.5, -19.5, -4.5, HOTEL_FRONT_TOP, 0.25, 'paving', 'L', t(17)),
  ];
}

export function hotelParts(tier) {
  const out = [];
  const K = partsKit(out);
  const { block, column, lounger, umbrella, bed } = K;
  // reeded pilasters on the centrepiece
  for (let k = 0; k < 4; k++) {
    for (const x of [20.55 + k * 0.72, 35.45 - k * 0.72]) block(x - 0.17, x + 0.17, GROUND + 0.6, HOTEL_CENTRE_TOP - 0.5, -2.0, -1.6, 'stucco');
  }
  column(77.8, -31.3, 0, 4.8, 0.3);                                     // porte-cochère columns
  column(77.8, -24.7, 0, 4.8, 0.3);
  // service frontage on the north street: dock, refuse, staff door, dock canopy
  block(50, 58, 0, 4.4, -51.2, -50.8, 'void');
  block(60.5, 63.5, 0, 3.0, -51.2, -50.8, 'void');
  block(41.2, 42.8, 0, 2.4, -51.2, -50.8, 'void');
  block(49.0, 59.0, 4.45, 4.75, -53.6, -51.0, 'frame');
  block(65.8, 66.2, 0, 3.0, -30, -26, 'void');                         // bell desk / luggage door on the arrival court
  // pool court
  for (let x = 13.5; x <= 34; x += 2.6) { lounger(x - 0.45, -35.2, 0, 'z', -1); lounger(x + 0.45, -35.2, 0, 'z', -1); }
  for (const x of [16, 24.5, 33]) umbrella(x + 1.3, -36.0, 0, 2.6);
  for (const x of [41.5, 43]) lounger(x, -29.5, 0, 'z', -1);
  // rooftop lounge terrace
  const hr = HOTEL_FRONT_TOP + 0.25;
  umbrella(39.2, -5.8, hr, 2.6); umbrella(44.6, -5.8, hr, 2.6);
  bed(36.8, 38.6, -19.2, -18.2, hr, 0.5); bed(45.4, 47.2, -19.2, -18.2, hr, 0.5);
  return out;
}
