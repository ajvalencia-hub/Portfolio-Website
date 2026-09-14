// Grounds between the buildings: the landscape beds that frame the pedestrian routes
// (plan/pedestrian.js). Beds are simple lawn slabs set 35 mm below the lowest paving, so
// the route surfaces lie over them cleanly; every shrub, tree, palm and bench is placed
// clear of the route clear zones, the furnishing zones, the light poles and the driveway
// sight triangles.
//   - the paseo between the podium arcade and the hotel: a palm lawn west of the spine and
//     a shade-tree garden east of it
//   - the office planting strip along the promenade (canopy trees with benches between)
//   - the hotel entrance gardens either side of the garden walk and north of the arrival court
//   - frontage strips between the buildings and the perimeter sidewalks
import { HX, HZ, box, partsKit } from './core.js';
import { LAWN_TOP, onRoute, inFurnishing, inSight } from './pedestrian.js';

// [name, x0, x1, z0, z1]
export const GROUND_LAWNS = [
  // paseo
  ['G.paseoW', -25.6, -13.9, -51.0, 9.0],
  ['G.hotelGarden', -8.6, -3.0, -50.5, -9.6],
  ['G.hotelCorner0', -8.6, -2.8, -9.6, -3.7],   // around the spine's turn below the hotel's rounded corner
  ['G.hotelCorner1', -8.6, 4.4, -3.7, 2.1],
  // office planting strip along the promenade
  ['G.officeStrip', 22.8, 73.6, 9.2, 12.7],
  // park margins beside the office walk and the podium café
  ['G.parkEdgeE0', 16.9, 18.9, 9.2, 27.4],
  ['G.parkEdgeE1', 16.9, 18.9, 37.8, 54.6],
  ['G.parkEdgeW', -25.4, -21.6, 38.6, 48.6],
  // hotel entrance gardens
  ['G.hotelGarden0', 59.2, 69.7, -17.4, 1.9],
  ['G.hotelGarden1', 72.95, 78.8, -9.2, 1.9],
  ['G.hotelGarden2', 66.4, 72.4, -50.8, -37.5],
  // frontages
  ['G.podiumSouth0', -68.0, -57.5, 51.0, 54.2],
  ['G.podiumSouth1', -42.5, -27.5, 51.0, 54.2],
  ['G.podiumWest0', -79.4, -77.2, -45.0, -35.5],
  ['G.podiumWest1', -79.4, -77.2, -21.0, 11.9],
  ['G.podiumWest2', -79.4, -77.2, 18.4, 43.0],
  ['G.podiumNorth0', -73.0, -69.2, -54.8, -52.4],
  ['G.podiumNorth1', -53.6, -44.6, -54.8, -52.4],
  ['G.podiumNorth2', -30.6, -27.5, -54.8, -52.4],
  ['G.hotelNorth', 2.0, 37.5, -54.8, -52.2],
  ['G.officeSouth', 37.0, 72.0, 51.2, 54.4],
  ['G.officeEast', 75.2, 79.4, 31.0, 38.5],
];

export function groundsSlabs() {
  const t = (i) => [0.664 + i * 0.002, 0.05];
  return GROUND_LAWNS.map(([n, x0, x1, z0, z1]) => box(n, x0, x1, z0, z1, 0, LAWN_TOP, 'lawn', 'L', t(1)));
}

// poles: lights, umbrellas, benches and bicycle stands from the pedestrian layout
export function groundsPlanting(tier, rand, poles = []) {
  const out = [];
  const K = partsKit(out);
  const { add, bench } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const trees = [];
  const palms = [];
  const startAt = (x, z) => Math.min(0.76, 0.668 + 0.08 * (Math.hypot(x, z) / 280));
  const lightsNear = (x, z, r) => poles.some((p) => Math.hypot(p.x - x, p.z - z) < r + (p.top > 3 ? 0.6 : 0.4));
  // a tree or palm is accepted only with its trunk ≥ 0.8 m from every clear zone and its
  // canopy clear of light heads and umbrellas
  const tree = (x, z, r, extra = {}) => {
    if (onRoute(x, z, 0.8) || inSight(x, z) || lightsNear(x, z, r)) return;
    trees.push({ x, z, y: 0, r, lush: true, tone: rand(), start: startAt(x, z), dur: 0.05, ...extra });
  };
  const palm = (x, z, h = 8.5 + rand() * 2) => {
    if (onRoute(x, z, 0.8) || inSight(x, z) || lightsNear(x, z, 2.2)) return;
    palms.push({ x, z, y: 0, h, r: 2.5 + rand() * 0.6, spin: rand() * Math.PI, start: startAt(x, z) + 0.01, dur: 0.05 });
  };
  const lawn = (name) => GROUND_LAWNS.find((l) => l[0] === name).slice(1);

  // --- trees and palms ----------------------------------------------------------------------
  for (const z of [-48.2, -36.0, -24.0, -8.0]) palm(-18.6, z);                                    // paseo palm lawn
  for (const z of [-46.5, -37.0, -27.5, -18.5]) tree(-5.8, z, 2.1 + rand() * 0.3, { lush: true }); // paseo shade-tree garden
  for (const x of [27.5, 38.0, 48.5, 59.0, 69.5]) tree(x, 11.0, 1.7 + rand() * 0.15, { lush: false }); // office planting strip
  for (const x of [-65.0, -60.5, -39.0, -32.0]) tree(x, 52.6, 1.6 + rand() * 0.2, { lush: false });   // podium south frontage
  for (const x of [42.0, 52.0, 62.0]) tree(x, 52.8, 1.7 + rand() * 0.2, { lush: false });            // office south frontage
  tree(-23.5, 43.6, 1.9, { kind: 'round' });                                                         // park west margin
  // hotel entrance gardens: broad shade trees clear of the hotel canopies, a flowering accent
  // and palm clusters of varied height along the garden walk and the east lawn
  tree(64.2, -10.2, 2.7, { kind: 'spread' });
  tree(63.6, -3.4, 2.3, { kind: 'spread' });
  tree(61.4, -14.4, 1.5, { kind: 'round', flower: true });
  palm(67.9, -15.2, 9.5); palm(67.6, -5.2, 11.5); palm(68.0, -0.6, 8.8);
  palm(75.9, -6.4, 10.5); palm(76.4, -1.4, 9.0);
  palm(69.6, -47.8, 10.0); palm(70.4, -41.0, 8.5); palm(68.9, -39.6, 11.0);

  // --- benches facing the gardens, just outside the clear zones -------------------------------
  const seats = [];
  const seat = (x, z, a) => {
    if (onRoute(x, z, 0.3) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) return;
    seats.push([x, z, a]); bench(x, z, LAWN_TOP, 2.2, a);
  };
  for (const z of [-39.0, -30.0, -22.0]) seat(-14.35, z, Math.PI / 2);   // spine west edge, facing the palm lawn's walk
  for (const z of [-34.5, -25.5]) seat(-8.3, z, Math.PI / 2);            // spine east edge, beside the shade-tree garden
  for (const z of [-12.2, -7.6]) seat(69.2, z, Math.PI / 2);             // garden walk, facing the hotel garden
  const nearSeat = (x, z) => seats.some(([sx, sz, a]) => (a ? Math.abs(x - sx) < 1.0 && Math.abs(z - sz) < 1.8 : Math.abs(x - sx) < 1.8 && Math.abs(z - sz) < 1.0));

  // --- layered shrubs along lawn edges: never in a clear zone, furnishing zone or sight triangle
  const planted = () => [...trees, ...palms];
  const free = (x, z, clear) => !onRoute(x, z, 0.55) && !inFurnishing(x, z, 0.5) && !inSight(x, z) && !nearSeat(x, z)
    && !planted().some((p) => Math.hypot(p.x - x, p.z - z) < clear) && !poles.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9);
  const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
  let k = 0;
  const shrub = (x, z, big) => {
    k++;
    if (!free(x, z, 1.3)) return;
    const s = (big ? 1.2 : 0.9) + (k % 3) * 0.2, h = (big ? 1.0 : 0.65) + (k % 4) * 0.16;
    add('cone', x, LAWN_TOP + h / 2, z, s, h, s, colors[k % colors.length], C);
  };
  const edges = (name, { step = full ? 1.5 : 3.0, inset = 0.55, rows = 2 } = {}) => {
    const [x0, x1, z0, z1] = lawn(name);
    const alongX = x1 - x0 >= z1 - z0;
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const [b0, b1] = alongX ? [z0, z1] : [x0, x1];
    const lines = rows === 1 || b1 - b0 < 2.6 ? [(b0 + b1) / 2] : [b0 + inset, b1 - inset];
    lines.forEach((b, li) => {
      for (let a = a0 + 0.7 + li * step * 0.5; a <= a1 - 0.7; a += step) shrub(...(alongX ? [a, b] : [b, a]), li === 0);
    });
  };
  for (const n of ['G.paseoW', 'G.hotelGarden', 'G.hotelCorner0', 'G.hotelCorner1', 'G.hotelGarden0', 'G.hotelGarden1', 'G.hotelGarden2', 'G.podiumSouth0', 'G.podiumSouth1', 'G.officeSouth']) edges(n);
  for (const n of ['G.officeStrip', 'G.parkEdgeE0', 'G.parkEdgeE1', 'G.parkEdgeW', 'G.podiumWest0', 'G.podiumWest1', 'G.podiumWest2', 'G.podiumNorth0', 'G.podiumNorth1', 'G.podiumNorth2', 'G.hotelNorth', 'G.officeEast']) edges(n, { rows: 1, step: full ? 1.4 : 2.8 });
  // groundcover drifts in the larger gardens
  if (full) {
    for (const n of ['G.hotelGarden0', 'G.paseoW']) {
      const [x0, x1, z0, z1] = lawn(n);
      for (let i = 0; i < 14; i++) {
        const x = x0 + 2.2 + rand() * (x1 - x0 - 4.4), z = z0 + 2.2 + rand() * (z1 - z0 - 4.4);
        if (!free(x, z, 2.2)) continue;
        add('cone', x, LAWN_TOP + 0.22, z, 1.5, 0.44, 1.1, i % 3 ? 'shrubLight' : 'shrub', C);
      }
    }
  }
  // low planted island between the hotel arrival drive and the east sidewalk
  for (let z = -30.6; z <= -21.4; z += full ? 1.1 : 2.2) if (!inSight(79.7, z)) add('cone', 79.72, 0.06 + 0.25, z, 0.5, 0.5, 0.5, 'shrubDark', C);
  return { parts: out, trees, palms };
}
