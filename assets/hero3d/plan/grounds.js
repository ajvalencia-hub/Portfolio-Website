// Grounds between the buildings: paved walks with scored joints, lawns, shade and
// street trees, palms and layered shrub planting in
//   - the paseo between the podium and the hotel (arcade walk, a palm lawn with
//     benches, a promenade and a shade-tree lawn along the hotel),
//   - the west edge of the park beside the podium arcade,
//   - the lane between the hotel and the office, and the walk along the office,
//   - the frontage strips between the buildings and the sidewalks,
//   - the hotel entrance garden: lawns, layered beds, shade trees and palms filling the
//     open ground between the plaza entrance, the arrival court and the east street,
//     with a garden walk from the lane to the porte-cochère.
// Walks stay clear for the park and paseo routes checked in program.js.
import { HZ, GLAZE, box, partsKit } from './core.js';

const PATH_TOP = 0.07;     // over the block paving (0.03) and the park's radial paths (0.05)
const LAWN_TOP = 0.10;

// [name, x0, x1, z0, z1]
export const GROUND_PATHS = [
  ['G.arcadeWalk', -26.0, -21.5, -HZ, HZ],       // along the podium arcade, street to street
  ['G.promenade', -13.5, -9.0, -HZ, -2.0],       // paseo promenade beside the hotel garden
  ['G.cross0', -21.5, -13.5, -45.5, -42.5],
  ['G.cross1', -21.5, -13.5, -17.0, -14.0],
  ['G.lane', 20.5, 80.0, 7.8, 10.2],             // hotel ↔ office lane
  ['G.officeWalk', 19.8, 22.0, 10.2, HZ],        // along the office's west face to the south street
  ['G.arrivalWalk', 69.6, 73.0, -20.0, 7.8],     // hotel garden walk: lane ↔ arrival court
];

export const GROUND_LAWNS = [
  // paseo: palm lawn between the walks, shade-tree lawn along the hotel
  ['G.paseoLawn0', -21.5, -13.5, -51.0, -45.5],
  ['G.paseoLawn1', -21.5, -13.5, -42.5, -17.0],
  ['G.paseoLawn2', -21.5, -13.5, -14.0, -6.0],
  ['G.hotelGarden', -9.0, -3.0, -50.5, -6.0],
  // park west edge (between the arcade path and the south-west path)
  ['G.arcadeLawn', -21.5, -16.6, 32.8, 43.2],
  // park east edge beside the office walk
  ['G.parkEast', 16.2, 19.8, 14.8, 28.6],
  // lane: planted strip in front of the office
  ['G.laneLawn', 22.0, 73.5, 10.2, 13.4],
  // frontages
  ['G.podiumSouth0', -68.0, -57.5, 51.0, 54.2],
  ['G.podiumSouth1', -42.5, -27.5, 51.0, 54.2],
  ['G.podiumWest0', -79.4, -77.2, -45.0, -35.5],
  ['G.podiumWest1', -79.4, -77.2, -21.0, 43.0],
  ['G.podiumNorth0', -73.0, -66.2, -54.8, -52.4],
  ['G.podiumNorth1', -56.6, -41.6, -54.8, -52.4],
  ['G.podiumNorth2', -33.6, -27.5, -54.8, -52.4],
  ['G.hotelNorth', 2.0, 37.5, -54.8, -52.2],
  ['G.officeSouth', 37.0, 72.0, 51.2, 54.4],
  ['G.officeEast', 75.2, 79.4, 29.5, 40.0],
  // hotel entrance garden (east of the plaza entrance and south of the lobby wing)
  ['G.hotelGarden0', 58.8, 69.6, -17.4, 7.2],
  ['G.hotelGarden1', 73.4, 78.8, -9.2, 7.2],
  ['G.hotelGarden2', 66.4, 72.4, -50.8, -37.5],   // beside the lobby wing, north of the arrival court
];

export function groundsSlabs() {
  const t = (i) => [0.664 + i * 0.002, 0.05];
  return [
    ...GROUND_PATHS.map(([n, x0, x1, z0, z1]) => box(n, x0, x1, z0, z1, 0, PATH_TOP, 'pathStone', 'L', t(0), null, { glaze: GLAZE.bond, module: [1.2, 0.6] })),
    ...GROUND_LAWNS.map(([n, x0, x1, z0, z1]) => box(n, x0, x1, z0, z1, 0, LAWN_TOP, 'lawn', 'L', t(1))),
  ];
}

export function groundsPlanting(tier, rand) {
  const out = [];
  const K = partsKit(out);
  const { add, block, bench } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const trees = [];
  const palms = [];
  const startAt = (x, z) => Math.min(0.76, 0.668 + 0.08 * (Math.hypot(x, z) / 280));
  const tree = (x, z, r, lush) => trees.push({ x, z, y: 0, r, lush, tone: rand(), start: startAt(x, z), dur: 0.05 });
  const palm = (x, z, h = 8.5 + rand() * 2) => palms.push({ x, z, y: 0, h, r: 2.5 + rand() * 0.6, spin: rand() * Math.PI, start: startAt(x, z) + 0.01, dur: 0.05 });
  const lawn = (name) => GROUND_LAWNS.find((l) => l[0] === name).slice(1);

  // --- trees and palms ----------------------------------------------------------------
  for (const z of [-48.2, -36.0, -24.0, -10.0]) palm(-17.5, z);                          // paseo palm lawn
  for (const z of [-45.5, -36.5, -27.5, -18.5, -10.0]) tree(-6.2, z, 2.1 + rand() * 0.3, true);   // hotel garden
  tree(-19.0, 38.0, 2.3, true);                                                          // park west edge
  tree(18.0, 21.5, 1.6, false);                                                          // park east edge
  for (const x of [35.5, 45.5, 55.5, 65.5]) tree(x, 11.8, 1.5 + rand() * 0.2, false);   // lane
  for (const x of [-65.0, -60.5, -39.0, -32.0]) tree(x, 52.6, 1.6 + rand() * 0.2, false); // podium south frontage
  for (const x of [42.0, 52.0, 62.0]) tree(x, 52.8, 1.7 + rand() * 0.2, false);         // office south frontage
  // hotel entrance garden: two broad shade trees clear of the hotel canopies, a flowering
  // accent, and palm clusters of varied height along the garden walk and the east lawn
  const gardenTree = (x, z, r, extra) => trees.push({ x, z, y: 0, r, lush: true, tone: rand(), start: startAt(x, z), dur: 0.05, ...extra });
  gardenTree(64.2, -10.2, 2.7, { kind: 'spread' });
  gardenTree(63.8, 2.2, 2.8, { kind: 'spread' });
  gardenTree(62.4, -3.9, 1.6, { kind: 'round', flower: true });
  palm(67.9, -15.2, 9.5); palm(67.6, -5.6, 11.5); palm(66.6, -7.4, 8.5);
  palm(75.9, -6.4, 10.5); palm(76.2, 4.6, 9.0); palm(77.6, 3.0, 11.8);
  palm(69.6, -47.8, 10.0); palm(70.4, -41.0, 8.5); palm(68.9, -39.6, 11.0);

  // --- benches facing the walks ------------------------------------------------------------
  const seats = [];
  const seat = (x, z, y, a) => { seats.push([x, z, a]); bench(x, z, y, 2.4, a); };
  for (const z of [-39.0, -30.0, -21.0]) seat(-21.85, z, PATH_TOP, Math.PI / 2);   // arcade walk edge, facing the palm lawn
  for (const z of [-32.0, -23.0]) seat(-9.35, z, PATH_TOP, Math.PI / 2);    // promenade edge, facing the hotel garden
  for (const x of [40.5, 50.5, 60.5]) seat(x, 10.6, LAWN_TOP, 0);
  for (const z of [-11.8, 1.4]) seat(69.25, z, LAWN_TOP, Math.PI / 2);   // garden walk edge, facing the hotel garden
  const nearSeat = (x, z) => seats.some(([sx, sz, a]) => (a ? Math.abs(x - sx) < 1.0 && Math.abs(z - sz) < 1.9 : Math.abs(x - sx) < 1.9 && Math.abs(z - sz) < 1.0));

  // --- layered shrubs along the lawn edges, clear of trunks and benches ------------------
  const planted = () => [...trees, ...palms];
  const shrubRows = (name, { rows = 2, step = full ? 1.6 : 3.2, inset = 0.55, clear = 1.4 } = {}) => {
    const [x0, x1, z0, z1] = lawn(name);
    const alongX = x1 - x0 >= z1 - z0;
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const [b0, b1] = alongX ? [z0, z1] : [x0, x1];
    const lines = rows === 1 ? [(b0 + b1) / 2] : [b0 + inset, b1 - inset];
    let k = 0;
    for (const [li, b] of lines.entries()) {
      for (let a = a0 + 0.7 + li * step * 0.5; a <= a1 - 0.7; a += step) {
        const [x, z] = alongX ? [a, b] : [b, a];
        k++;
        if (nearSeat(x, z) || planted().some((p) => Math.hypot(p.x - x, p.z - z) < clear)) continue;
        const s = 0.9 + (k % 3) * 0.25, h = 0.6 + (k % 4) * 0.2;
        add('cone', x, LAWN_TOP + h / 2, z, s, h, s, k % 3 === 0 ? 'shrubDark' : 'shrub', C);
      }
    }
  };
  ['G.paseoLawn0', 'G.paseoLawn1', 'G.paseoLawn2', 'G.hotelGarden', 'G.laneLawn', 'G.officeSouth', 'G.podiumSouth0', 'G.podiumSouth1'].forEach((n) => shrubRows(n));
  ['G.arcadeLawn', 'G.parkEast'].forEach((n) => shrubRows(n, { clear: 1.6 }));
  // hotel garden: layered beds of mixed foliage with flowering accents, then groundcover
  // drifts across the open lawn
  for (const n of ['G.hotelGarden0', 'G.hotelGarden1', 'G.hotelGarden2']) {
    const [x0, x1, z0, z1] = lawn(n);
    let k = 0;
    const clearOf = (x, z, d) => !nearSeat(x, z) && !planted().some((p) => Math.hypot(p.x - x, p.z - z) < d);
    const colors = ['shrub', 'shrubDark', 'shrubFlower', 'shrubLight', 'shrub', 'shrubDark'];
    const edge = (x, z, big) => {
      k++;
      if (!clearOf(x, z, 1.3)) return;
      const sz = (big ? 1.3 : 0.9) + (k % 3) * 0.2, h = (big ? 1.1 : 0.7) + (k % 4) * 0.18;
      add('cone', x, LAWN_TOP + h / 2, z, sz, h, sz, colors[k % colors.length], C);
    };
    const step = full ? 1.3 : 2.6;
    for (let z = z0 + 0.7; z <= z1 - 0.7; z += step) { edge(x0 + 0.6, z, true); edge(x0 + 1.7, z + step / 2, false); edge(x1 - 0.6, z + step / 3, false); }
    for (let x = x0 + 0.7; x <= x1 - 0.7; x += step) { edge(x, z0 + 0.6, true); edge(x + step / 2, z0 + 1.7, false); edge(x + step / 3, z1 - 0.6, false); }
    if (full) for (let i = 0; i < 10; i++) {
      const x = x0 + 2.6 + rand() * (x1 - x0 - 5.2), z = z0 + 2.6 + rand() * (z1 - z0 - 5.2);
      if (x1 - x0 < 6 || !clearOf(x, z, 2.2)) continue;
      add('cone', x, LAWN_TOP + 0.25, z, 1.6, 0.5, 1.2, i % 3 ? 'shrubLight' : 'shrub', C);
    }
  }
  // low path lights along the garden walk
  for (let z = -17.5; z <= 5.5; z += full ? 4.6 : 9.2) K.deckLight(73.25, z, 0.03, 0.85);
  // hotel garden: layered beds of mixed foliage with flowering accents, then groundcover
  // drifts across the open lawn
  for (const n of ['G.hotelGarden0', 'G.hotelGarden1']) {
    const [x0, x1, z0, z1] = lawn(n);
    let k = 0;
    const clearOf = (x, z, d) => !nearSeat(x, z) && !planted().some((p) => Math.hypot(p.x - x, p.z - z) < d);
    const colors = ['shrub', 'shrubDark', 'shrubFlower', 'shrubLight', 'shrub', 'shrubDark'];
    const edge = (x, z, big) => {
      k++;
      if (!clearOf(x, z, 1.3)) return;
      const sz = (big ? 1.3 : 0.9) + (k % 3) * 0.2, h = (big ? 1.1 : 0.7) + (k % 4) * 0.18;
      add('cone', x, LAWN_TOP + h / 2, z, sz, h, sz, colors[k % colors.length], C);
    };
    const step = full ? 1.3 : 2.6;
    for (let z = z0 + 0.7; z <= z1 - 0.7; z += step) { edge(x0 + 0.6, z, true); edge(x0 + 1.7, z + step / 2, false); edge(x1 - 0.6, z + step / 3, false); }
    for (let x = x0 + 0.7; x <= x1 - 0.7; x += step) { edge(x, z0 + 0.6, true); edge(x + step / 2, z0 + 1.7, false); edge(x + step / 3, z1 - 0.6, false); }
    if (full) for (let i = 0; i < 10; i++) {
      const x = x0 + 2.6 + rand() * (x1 - x0 - 5.2), z = z0 + 2.6 + rand() * (z1 - z0 - 5.2);
      if (x1 - x0 < 6 || !clearOf(x, z, 2.2)) continue;
      add('cone', x, LAWN_TOP + 0.25, z, 1.6, 0.5, 1.2, i % 3 ? 'shrubLight' : 'shrub', C);
    }
  }
  // low path lights along the garden walk
  for (let z = -17.5; z <= 5.5; z += full ? 4.6 : 9.2) K.deckLight(73.25, z, 0.03, 0.85);
  ['G.podiumWest0', 'G.podiumWest1', 'G.podiumNorth0', 'G.podiumNorth1', 'G.podiumNorth2', 'G.hotelNorth', 'G.officeEast'].forEach((n) => shrubRows(n, { rows: 1, step: full ? 1.4 : 2.8 }));

  return { parts: out, trees, palms };
}
