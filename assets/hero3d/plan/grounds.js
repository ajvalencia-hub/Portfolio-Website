// Grounds between the buildings: the landscape beds that frame the pedestrian routes
// (plan/pedestrian.js). Beds are simple lawn slabs set 35 mm below the lowest paving, so
// the route surfaces lie over them cleanly; every shrub, tree, palm and bench is placed
// clear of the route clear zones, the furnishing zones, the light poles and the driveway
// sight triangles.
//   - the paseo between the podium arcade and the hotel: a dense tropical garden west of the
//     spine (shade-tree canopy, palm clusters, a shrub understory), and a shade-tree strip
//     east of it
//   - the office planting strip along the promenade (canopy trees with benches between)
//   - the hotel entrance gardens either side of the garden walk and north of the arrival court
//   - frontage strips between the buildings and the perimeter sidewalks
import { HX, HZ, GLAZE, box, partsKit, rng, insidePlan } from './core.js';
import { placeTrees, TREE_FORMS } from './planting.js';
import { LAWN_TOP, onRoute, inFurnishing, inSight, tuckToPaving } from './pedestrian.js';

// [name, x0, x1, z0, z1]
export const GROUND_LAWNS = [
  // paseo, either side of the spine on its new line at x = -8
  ['G.paseoW', -25.6, -10.6, -51.0, -11.6],
  ['G.hotelGardenN', -5.4, -1.7, -50.5, -19.6],   // runs right up under the pool court wall
  ['G.hotelRearW', -1.7, 5.2, -50.5, -39.8],
  ['G.hotelCourtW', -1.7, 5.9, -39.4, -19.6],   // the strip the pool court gave up when the wall came back to the wing line   // ground the rear wing released when the U's arms were squared off
  ['G.hotelGardenS', -5.4, -2.2, -20.4, -11.6],
  // The hotel's south-west corner garden. It used to stop at z = -13.8, which left the
  // pocket between the hotel's west end and the paseo garden with no ground treatment at
  // all — a bare patch of the block's base paving showing through beside the fountain.
  // It now runs the full depth of that pocket and laps under the building and the pool
  // court wall, so grass meets masonry with no sliver between them.
  ['G.hotelCorner', -2.4, 6.1, -20.4, -11.6],
  // office planting strip along the promenade
  ['G.officeStrip', 22.8, 73.6, 9.2, 12.7],
  // park margin beside the office walk: the strip the art museum stops short of, between its
  // east face and the walk, carrying the office coffee bar's terrace along part of its length
  ['G.parkEdgeE', 16.9, 18.9, 14.6, 54.6],
  // hotel entrance gardens
  ['G.hotelGarden0', 59.2, 69.7, -17.4, 1.9],
  ['G.hotelGarden1', 72.95, 78.8, -9.2, 1.9],
  ['G.hotelGarden2', 66.4, 72.4, -50.8, -37.5],
  // frontages
  ['G.podiumSouth0', -68.0, -57.5, 51.0, 54.2],
  ['G.podiumSouth1', -42.5, -27.5, 51.0, 54.2],
  // The art museum's own south frontage. Its street side used to be the park's bare frontage
  // paving, which read as a glass wall standing on asphalt; it now carries the same planted
  // strip as the condo podium either side of it and the office beyond, on the same lines, so
  // the block's whole south frontage is green. The park gate walk crosses it on the spine.
  ['G.museumSouth', -21.8, 16.6, 51.0, 54.2],
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

// A lawn that stops short of the walk beside it leaves a sliver of bare paving between the
// two — the ragged edge you see from above. The walks sit 80 mm higher and hide whatever runs
// beneath them, so each lawn is drawn as a polygon whose outline is pushed out, point by
// point, until it is under paving and a little further. Where a stretch of edge faces open
// ground or a building it stays put, so grass never spills onto the plaza.
const rectOutline = ([, x0, x1, z0, z1]) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// one merged mesh for all the ground lawns, like the park's
export function groundsSurfaces() {
  return [{
    name: 'G.lawns', type: 'prisms', kind: 'lawn', glaze: GLAZE.none, module: [1, 1], parent: null,
    y0: 0, h: LAWN_TOP, start: 0.666, dur: 0.05, wire: false, phase: 'context',
    parts: GROUND_LAWNS.map((l) => ({ pts: tuckToPaving(rectOutline(l)), owner: l[0] })),
  }];
}

// poles: lights, umbrellas, benches and bicycle stands from the pedestrian layout
export function groundsPlanting(tier, rand, poles = []) {
  const out = [];
  const K = partsKit(out);
  const { add, bench, block } = K;
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
  for (const z of [-48.2, -34.6, -24.0, -14.8]) palm(-21.4, z);                                   // the paseo garden's first palms (the rest is planted below)
  for (const z of [-46.5, -42.2, -17.4]) tree(-4.0, z, 1.5 + rand() * 0.2, { lush: true });         // paseo shade-tree strip, north and south of the court wall
  for (const x of [27.5, 38.0, 48.5, 59.0, 69.5]) tree(x, 11.0, 1.7 + rand() * 0.15, { lush: false }); // office planting strip
  for (const x of [-65.0, -60.5, -39.0, -32.0]) tree(x, 52.6, 1.6 + rand() * 0.2, { lush: false });   // podium south frontage
  // the museum's south frontage: the same street trees as its neighbours, clear of the park
  // gate walk on the spine and of the palms flanking the passage's south mouth
  for (const x of [-19.0, 1.8, 7.6, 13.4]) tree(x, 52.6, 1.6 + rand() * 0.2, { lush: false });
  for (const x of [42.0, 52.0, 62.0]) tree(x, 52.8, 1.7 + rand() * 0.2, { lush: false });            // office south frontage
  // hotel entrance gardens: broad shade trees clear of the hotel canopies, a flowering accent
  // and palm clusters of varied height along the garden walk and the east lawn
  tree(64.2, -10.2, 2.7, { kind: 'spread' });
  tree(66.8, -14.6, 2.3, { kind: 'spread' });
  tree(61.4, -14.4, 1.5, { kind: 'round', flower: true });
  palm(67.9, -15.2, 9.5); palm(67.6, -5.2, 11.5); palm(68.0, -0.6, 8.8);
  palm(75.9, -6.4, 10.5); palm(76.4, -1.4, 9.0);
  palm(69.6, -47.8, 10.0); palm(70.4, -41.0, 8.5); palm(68.9, -39.6, 11.0);
  // The mask in front of the pool court wall. The wall itself is a single storey of masonry
  // on a public walk, so the paseo never sees it plainly: palms carry the eye above it,
  // broad crowns cover its full height, and a shrub bank closes the foot. Layered front to
  // back rather than lined up, so it reads as a planted edge rather than a hedge on a wall.
  // Two staggered ranks of broad shade trees through the middle of the strip and a rank of
  // palms tight to the wall, so the wall is behind a grove rather than behind a hedge.
  for (const z of [-20.2, -25.0, -29.8, -34.6]) tree(0.6, z, 2.2 + rand() * 0.3, { kind: 'spread' });
  for (const z of [-22.6, -27.4, -32.2, -37.0]) tree(-3.0, z, 1.7 + rand() * 0.2, { kind: 'spread' });   // smaller in the outer rank, clear of the walk
  for (const z of [-19.8, -23.4, -27.0, -30.6, -34.2, -37.8]) palm(3.8, z, 9.5 + rand() * 2.0);

  // --- benches facing the gardens, just outside the clear zones -------------------------------
  const seats = [];
  const seat = (x, z, a) => {
    if (onRoute(x, z, 0.3) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) return;
    seats.push([x, z, a]); bench(x, z, LAWN_TOP, 2.2, a);
  };
  for (const z of [-38.6, -29.0, -21.0]) seat(-11.5, z, Math.PI / 2);    // spine west edge, facing into the paseo garden
  for (const z of [-34.5, -25.5]) seat(-4.6, z, Math.PI / 2);            // spine east edge, beside the shade-tree strip
  for (const z of [-12.2, -7.6]) seat(69.2, z, Math.PI / 2);             // garden walk, facing the hotel garden
  const nearSeat = (x, z) => seats.some(([sx, sz, a]) => (a ? Math.abs(x - sx) < 1.0 && Math.abs(z - sz) < 1.8 : Math.abs(x - sx) < 1.8 && Math.abs(z - sz) < 1.0));

  // --- layered shrubs along lawn edges: never in a clear zone, furnishing zone or sight triangle
  const planted = () => [...trees, ...palms];
  const PASEO = lawn('G.paseoW');
  const inPaseo = (x, z) => x > PASEO[0] && x < PASEO[1] && z > PASEO[2] && z < PASEO[3];
  const free = (x, z, clear) => !inPaseo(x, z) && !onRoute(x, z, 0.55) && !inFurnishing(x, z, 0.5) && !inSight(x, z) && !nearSeat(x, z)
    && !planted().some((p) => Math.hypot(p.x - x, p.z - z) < clear) && !poles.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9);
  const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
  let k = 0;
  const shrub = (x, z, big, rect = null) => {
    k++;
    const s = (big ? 1.2 : 0.9) + (k % 3) * 0.2, h = (big ? 1.0 : 0.65) + (k % 4) * 0.16;
    // the crown stays on its own lawn: an edge row is drawn in far enough that nothing hangs
    // over the paving or the sidewalk beside the bed
    if (rect) {
      const r = s / 2 + 0.05;
      x = rect[1] - rect[0] > 2 * r ? Math.min(Math.max(x, rect[0] + r), rect[1] - r) : (rect[0] + rect[1]) / 2;
      z = rect[3] - rect[2] > 2 * r ? Math.min(Math.max(z, rect[2] + r), rect[3] - r) : (rect[2] + rect[3]) / 2;
    }
    if (!free(x, z, 1.3)) return;
    add('bush', x, LAWN_TOP + h / 2, z, s, h, s, colors[k % colors.length], C);
  };
  const edges = (name, { step = full ? 1.5 : 3.6, inset = 0.55, rows = 2 } = {}) => {
    const [x0, x1, z0, z1] = lawn(name);
    const alongX = x1 - x0 >= z1 - z0;
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const [b0, b1] = alongX ? [z0, z1] : [x0, x1];
    const lines = rows === 1 || b1 - b0 < 2.6 ? [(b0 + b1) / 2] : [b0 + inset, b1 - inset];
    lines.forEach((b, li) => {
      for (let a = a0 + 0.7 + li * step * 0.5; a <= a1 - 0.7; a += step) shrub(...(alongX ? [a, b] : [b, a]), li === 0, [x0, x1, z0, z1]);
    });
  };
  for (const n of ['G.paseoW', 'G.hotelGardenN', 'G.hotelRearW', 'G.hotelCourtW', 'G.hotelGardenS', 'G.hotelGarden0', 'G.hotelGarden1', 'G.hotelGarden2', 'G.podiumSouth0', 'G.podiumSouth1', 'G.museumSouth', 'G.officeSouth']) edges(n);
  for (const n of ['G.officeStrip', 'G.parkEdgeE', 'G.hotelCorner', 'G.podiumWest0', 'G.podiumWest1', 'G.podiumWest2', 'G.podiumNorth0', 'G.podiumNorth1', 'G.podiumNorth2', 'G.hotelNorth', 'G.officeEast']) edges(n, { rows: 1, step: full ? 1.4 : 3.4 });
  // groundcover drifts in the larger gardens
  if (full) {
    for (const n of ['G.hotelGarden0', 'G.paseoW', 'G.hotelGardenN']) {
      const [x0, x1, z0, z1] = lawn(n);
      for (let i = 0; i < 14; i++) {
        const x = x0 + 2.2 + rand() * (x1 - x0 - 4.4), z = z0 + 2.2 + rand() * (z1 - z0 - 4.4);
        if (!free(x, z, 2.2)) continue;
        add('bush', x, LAWN_TOP + 0.22, z, 1.5, 0.44, 1.1, i % 3 ? 'shrubLight' : 'shrub', C);
      }
    }
  }
  // the shrub bank at the foot of the pool court wall, two ranks deep, planted tight to the
  // face so there is no strip of bare wall left below the crowns. The front rank is sized so its
  // crowns stop just short of the pilasters on the wall's face (x 5.62) rather than running
  // into the masonry; the rank behind laps over it.
  for (const [x, rank, w] of [[5.07, 0, 1.0], [4.35, 1, 1.25]]) {
    let n = 0;
    for (let z = -38.7 + rank * 0.5; z <= -20.1; z += full ? 1.4 : 2.8, n++) {
      if (onRoute(x, z, 0.5) || inSight(x, z)) continue;
      const h = (rank ? 1.9 : 2.5) + (n % 3) * 0.18;
      add('bush', x, LAWN_TOP + h / 2, z, w + (rank ? (n % 2) * 0.2 : 0), h, 1.35, n % 3 ? 'shrubDark' : 'shrub', C);
    }
  }
  // Low planted island between the hotel arrival drive (to x 79.5) and the east sidewalk (from
  // x 80): a kerbed planter filling the strip between the hotel's two pylons, with the shrubs
  // standing in its soil and sized to it, so nothing sits on the drive or hangs over either
  // edge. Planter and shrubs together stay under 0.9 m, the sight-triangle limit.
  const island = { x0: 79.53, x1: 79.97, z0: -31.0, z1: -21.0, top: 0.2 };
  block(island.x0, island.x1, 0.04, island.top, island.z0, island.z1, 'frame', C);                          // kerb
  block(island.x0 + 0.04, island.x1 - 0.04, island.top, island.top + 0.03, island.z0 + 0.04, island.z1 - 0.04, 'planter', C);   // soil
  const islandW = island.x1 - island.x0 - 0.12;
  for (let z = island.z0 + 0.4; z <= island.z1 - 0.4; z += full ? 0.8 : 1.6) {
    if (inSight((island.x0 + island.x1) / 2, z)) continue;
    add('bush', (island.x0 + island.x1) / 2, island.top + 0.03 + 0.22, z, islandW, 0.44, 0.6, 'shrubDark', C);
  }

  // --- the paseo garden -----------------------------------------------------------------------
  // The lawn between the podium arcade and the spine is planted as a dense tropical garden
  // rather than a lawn with a few palms: a canopy of broad shade trees in staggered ranks, two
  // poinciana-like trees with a high canopy that may shade the spine's edge, small flowering
  // trees in the gaps, palm clusters of varied height round the first palms, and a shrub and
  // grass understory under all of it, with one lawn clearing and the spine-edge benches kept
  // open. It draws on its own seeded sequence, so the rest of the block is unchanged. Every
  // trunk and every low canopy keeps clear of the walks, every shrub stands wholly in the lawn,
  // and the light poles and benches keep their room.
  {
    const prand = rng(4127);
    const [x0, x1, z0, z1] = PASEO;
    const clearing = { x: -18.6, z: -31.2, r: 1.9 };
    const inClearing = (x, z, r = 0) => Math.hypot(x - clearing.x, z - clearing.z) < clearing.r + r;
    const nearPalm = (x, z, d) => palms.some((q) => Math.hypot(q.x - x, q.z - z) < d);
    // a low canopy may not reach over a walk; a high one (underside at 2.4 m or more) may
    const blockedTree = (x, z, reach, under) => (under < 2.4 && onRoute(x, z, reach * 0.95)) || onRoute(x, z, 0.8)
      || x - reach < x0 + 0.1 || z - reach < z0 - 0.4 || inSight(x, z) || inClearing(x, z, 0.4) || nearPalm(x, z, 1.5);
    const cand = (x, z, r, kind, lite, extra = {}) => ({ x, z, y: 0, r, kind, lush: true, lite, tone: prand(), start: startAt(x, z), dur: 0.05, ...extra });
    const candidates = [
      // the main room: three staggered ranks of shade trees
      cand(-13.7, -39.0, 2.2, 'spread', true), cand(-13.7, -25.4, 2.3, 'spread', true),
      cand(-18.3, -36.4, 2.3, 'spread', true), cand(-18.3, -24.6, 2.2, 'spread', false),
      cand(-23.1, -40.0, 2.0, 'spread', true), cand(-23.1, -29.8, 2.1, 'spread', false), cand(-23.0, -19.8, 2.0, 'spread', true),
      cand(-13.9, -20.4, 1.9, 'spread', false),
      // poinciana-like trees with a high canopy beside the spine
      cand(-12.4, -33.6, 1.9, 'broad', true, { flower: true }), cand(-12.6, -18.9, 1.7, 'broad', false, { flower: true }),
      // the north room and the south strip
      cand(-24.0, -48.6, 1.7, 'spread', true), cand(-17.4, -48.4, 1.8, 'spread', false), cand(-13.5, -48.6, 1.6, 'spread', true),
      cand(-23.4, -13.1, 1.2, 'round', true, { flower: true }), cand(-15.4, -13.1, 1.1, 'round', true, { flower: true }),   // the park's own tree stands between them, across the walk
      // small flowering trees in the gaps of the main room
      cand(-20.8, -38.4, 1.3, 'round', false, { flower: true }), cand(-15.9, -28.6, 1.3, 'round', true), cand(-20.9, -21.6, 1.2, 'round', false, { flower: true }),
      cand(-16.1, -41.0, 1.1, 'round', false), cand(-24.2, -35.4, 1.2, 'round', false, { flower: true }),
    ].filter((c) => full || c.lite);
    const poleObs = poles.map((q) => ({ x: q.x, z: q.z, r: 0.35, top: q.top ?? 4.5 }));
    const accepted = placeTrees(candidates, {
      existing: trees, poles: poleObs, gap: 0.12, minScale: 0.6,
      blocked: (x, z, reach) => {
        const t = candidates.find((c) => Math.abs(c.x - x) < 1e-6 && Math.abs(c.z - z) < 1e-6);
        const f = TREE_FORMS[t?.kind ?? 'spread'];
        return blockedTree(x, z, reach, (reach / f.extent) * f.bottom);   // the canopy's underside at this size
      },
    });
    for (const t of accepted) { const { lite, ...rest } = t; trees.push(rest); }

    // palm clusters round the first palms, of varied height so the crowns step
    const clusters = [
      [-22.7, -46.8, 10.6, true], [-20.2, -49.7, 7.8, false],
      [-20.1, -33.2, 7.6, true], [-22.7, -36.0, 11.4, false],
      [-22.6, -22.6, 9.4, true], [-20.6, -12.7, 8.2, true],
    ];
    for (const [x, z, h, lite] of clusters) {
      if (!full && !lite) continue;
      if (onRoute(x, z, 0.8) || inSight(x, z) || lightsNear(x, z, 2.2) || nearPalm(x, z, 1.4)
        || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue;
      palms.push({ x, z, y: 0, h, r: 2.3 + prand() * 0.6, spin: prand() * Math.PI, start: startAt(x, z) + 0.01, dur: 0.05 });
    }

    // the understory: shrubs and grasses in drifts, each one wholly on the lawn
    const placed = [];
    const onLawn = (x, z) => x > x0 + 0.1 && x < x1 - 0.1 && z > z0 + 0.1 && z < z1 - 0.1;
    const fits = (x, z, rx, rz) => [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * (rx + 0.05), Math.sin(i * Math.PI / 4) * (rz + 0.05)])]
      .every(([u, v]) => onLawn(x + u, z + v) && !onRoute(x + u, z + v) && !inFurnishing(x + u, z + v) && !inSight(x + u, z + v))
      && !nearSeat(x, z) && !inClearing(x, z, Math.max(rx, rz))
      && !poles.some((q) => Math.hypot(q.x - x, q.z - z) < Math.max(rx, rz) + 0.4)
      && !trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.55 + Math.max(rx, rz) * 0.6)
      && !palms.some((t) => Math.hypot(t.x - x, t.z - z) < 0.75 + Math.max(rx, rz) * 0.6)
      && !placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < (q[2] + Math.max(rx, rz)) * 0.7);
    const kinds = [
      ['bush', 1.5, 1.0, 1.3, 'shrubDark'], ['bush', 1.2, 0.8, 1.1, 'shrub'], ['cone', 0.8, 0.75, 0.8, 'shrubLight'],
      ['bush', 1.4, 0.45, 1.1, 'shrubLight'], ['bush', 1.1, 0.9, 1.0, 'shrubFlower'], ['bush', 1.3, 1.1, 1.2, 'shrub'],
    ];
    const step = full ? 1.05 : 1.9;
    for (let z = z0 + 0.6; z <= z1 - 0.5; z += step) {
      for (let x = x0 + 0.6; x <= x1 - 0.5; x += step) {
        const h0 = prand(), jx = (prand() - 0.5) * step * 0.7, jz = (prand() - 0.5) * step * 0.7;
        if (h0 < 0.12) continue;                                    // a little open ground between drifts
        const [shape, w, hgt, d, col] = kinds[Math.floor(prand() * kinds.length)];
        const px = x + jx, pz = z + jz;
        for (const sc of [1, 0.8, 0.65]) {
          if (!fits(px, pz, (w * sc) / 2, (d * sc) / 2)) continue;
          placed.push([px, pz, Math.max(w, d) * sc / 2]);
          add(shape, px, LAWN_TOP + (hgt * sc) / 2 - 0.02, pz, w * sc, hgt * sc, d * sc, col, C);
          break;
        }
      }
    }
  }
  return { parts: out, trees, palms };
}
