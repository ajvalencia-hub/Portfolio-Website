// C — office: three stacked blocks over a parking base.
//
// Structure concept (visual model, not an engineered design):
//   • one column grid for the whole building, set out from the parking module
//     (aisle-edge and back-to-back lines), so columns run continuously from the
//     base to each block's roof — every block's column lines are a subset of the
//     block below, so no transfer structure is implied
//   • projections come only from slab-edge cantilevers beyond those column lines
//     (0.6 m typical, 2.4–3.0 m at the offset edges); each block projects 2.4 m
//     past the block below, down from the earlier 4 m
//   • warm timber soffits, louvres and pergolas, integrated terrace planters, and
//     hanging planting only over parking screens or solid frame bands
import { OFFICE_GROUND, OFFICE_FLOOR, OFFICE, GLAZE, box, partsKit } from './core.js';
import { fixtureKit } from './fixtures.js';

export const OFFICE_BASE_TOP = OFFICE_GROUND + 2 * OFFICE_FLOOR;   // 14.4
export const OFFICE_GRID = {
  x: [22.6, 31.0, 36.0, 43.6, 48.9, 54.2, 61.8, 67.2, 73.4],
  z: [14.6, 23.0, 31.4, 39.8, 49.4],
};
export const OFFICE_BASE_RECT = [22, 74, 14, 50];

export const OFFICE_BLOCKS = [
  { name: 'C.b1', cols: { x: [31.0, 67.2], z: [14.6, 39.8] }, edges: { w: 0.6, e: 0.6, n: 0.6, s: 2.4 } },
  { name: 'C.b2', cols: { x: [36.0, 67.2], z: [14.6, 31.4] }, edges: { w: 0.6, e: 3.0, n: 0.6, s: 0.6 } },  // 2.4 m past b1 to the east
  // crown: 29.4 × 20.4 m (was 21.8 × 12), on b2's own column lines, still projecting 2.4 m west + south
  { name: 'C.b3', cols: { x: [36.0, 61.8], z: [14.6, 31.4] }, edges: { w: 3.0, e: 0.6, n: 0.6, s: 3.0 } },
].map((b, k) => ({
  ...b,
  rect: [b.cols.x[0] - b.edges.w, b.cols.x[1] + b.edges.e, b.cols.z[0] - b.edges.n, b.cols.z[1] + b.edges.s],
  y0: OFFICE_BASE_TOP + k * 3 * OFFICE_FLOOR,
  y1: OFFICE_BASE_TOP + (k + 1) * 3 * OFFICE_FLOOR,
}));
export const OFFICE_BLOCK_TOPS = OFFICE_BLOCKS.map((b) => b.y1);    // 27.0, 39.6, 52.2
// crown roof: integrated mechanical enclosure on the north-east, terrace on the south + west
export const OFFICE_CROWN = {
  mech: [45.2, 61.6, 14.8, 27.0], mechH: 3.6,
  terraces: [[33.4, 62.0, 28.4, 34.0], [33.4, 44.2, 14.4, 28.4]],
};
export const OFFICE_CORE = [43.6, 54.2, 23.4, 31.0];                // inside b3, continuous to the ground lobby

// Office parking P1 (floor 6.0) and P2 (floor 10.2), served by two car lifts.
export const OFFICE_PARKING = {
  levels: [
    { name: 'Office P1', floor: OFFICE_GROUND, ceiling: OFFICE_GROUND + OFFICE_FLOOR },
    { name: 'Office P2', floor: OFFICE_GROUND + OFFICE_FLOOR, ceiling: OFFICE_BASE_TOP },
  ],
  slab: 0.3,
  zone: [31.0, 73.4, 14.6, 41.0],          // behind the office liner on the south and west faces
  aisles: [
    { name: 'aisle A', rect: [36.4, 43.2, 15.2, 41.0] },
    { name: 'aisle B', rect: [54.6, 61.4, 15.2, 41.0] },
    { name: 'cross N', rect: [36.4, 66.6, 15.2, 22.0] },
    { name: 'cross S', rect: [36.4, 61.4, 32.0, 38.8] },
  ],
  stallRows: [
    { x: [31.0, 36.4], aisle: 'aisle A', side: 'w' },
    { x: [43.2, 48.6], aisle: 'aisle A', side: 'e' },
    { x: [49.2, 54.6], aisle: 'aisle B', side: 'w' },
    { x: [61.4, 66.8], aisle: 'aisle B', side: 'e' },
  ],
  lifts: { name: 'Car lifts (2)', rect: [66.6, 73.0, 15.2, 21.6], connects: 'cross N' },
  columnStep: null,  // columns on OFFICE_GRID intersections
  ground: {
    rooms: [
      { name: 'Office lobby', use: 'lobby', rect: [24.5, 34.0, 38.0, 47.5] },
      { name: 'Car-lift queue (2 cars)', use: 'vehicle', rect: [62.0, 73.4, 21.6, 28.0] },
      { name: 'Office loading dock', use: 'service', rect: [62.0, 73.4, 41.5, 48.5] },
      { name: 'Office refuse + recycling', use: 'service', rect: [56.0, 62.0, 43.0, 48.5] },
    ],
  },
  entry: { curb: [15.0, 28.0], x: 74 },
};

export function officeMasses() {
  const FLOORS = { glaze: GLAZE.office, module: OFFICE };
  const BASE = { glaze: GLAZE.officePodium, module: OFFICE };
  const blocks = OFFICE_BLOCKS.map((b, k) => {
    const [x0, x1, z0, z1] = b.rect;
    const glaze = k === OFFICE_BLOCKS.length - 1 ? { glaze: GLAZE.officeCrown, module: OFFICE } : FLOORS;
    return box(b.name, x0, x1, z0, z1, 0, 3 * OFFICE_FLOOR, 'concrete', 'C', [0.372 + k * 0.040, 0.042], k ? OFFICE_BLOCKS[k - 1].name : 'C.baseE', glaze);
  });
  return [
    box('C.baseE', 34, 74, 14, 50, 0, OFFICE_BASE_TOP, 'concrete', 'C', [0.320, 0.052], null, BASE),
    box('C.baseW', 22, 34, 14, 38, 0, OFFICE_BASE_TOP, 'concrete', 'C', [0.325, 0.047], null, BASE),
    // double-height corner lobby, recessed 2.5 m under the office floor above
    box('C.lobby', 24.5, 34, 38, 47.5, 0, OFFICE_GROUND + OFFICE_FLOOR, 'glass', 'C', [0.322, 0.040], null, { glaze: GLAZE.storefront, module: OFFICE }),
    box('C.corner', 22, 34, 38, 50, 0, OFFICE_FLOOR, 'concrete', 'C', [0.362, 0.010], 'C.lobby', FLOORS),
    ...blocks,
    // mechanical enclosure on the crown roof: white louvred screen continuing the facade frame
    box('C.screen', ...OFFICE_CROWN.mech, 0, OFFICE_CROWN.mechH, 'frame', 'C', [0.494, 0.006], 'C.b3', { glaze: GLAZE.screen }),
  ];
}

// terraces created by the offsets; each lies on its roof, clear of the block (and its
// 0.5 m frame) standing on it
export const OFFICE_TERRACES = [
  { name: 'L.oBaseW', rect: [22.4, 29.8, 14.4, 49.6], y: OFFICE_BASE_TOP, host: -1 },
  { name: 'L.oBaseS', rect: [29.8, 73.6, 42.8, 49.6], y: OFFICE_BASE_TOP, host: -1 },
  { name: 'L.oBaseE', rect: [68.4, 73.6, 14.4, 42.8], y: OFFICE_BASE_TOP, host: -1 },
  { name: 'L.o1W', rect: [30.8, 34.8, 14.4, 41.8], y: OFFICE_BLOCK_TOPS[0], host: 0 },
  { name: 'L.o1S', rect: [34.8, 67.4, 32.6, 41.8], y: OFFICE_BLOCK_TOPS[0], host: 0 },
  { name: 'L.o2E', rect: [63.4, 69.8, 14.4, 31.6], y: OFFICE_BLOCK_TOPS[1], host: 1 },
  { name: 'L.o3S', rect: OFFICE_CROWN.terraces[0], y: OFFICE_BLOCK_TOPS[2], host: 2 },
  { name: 'L.o3W', rect: OFFICE_CROWN.terraces[1], y: OFFICE_BLOCK_TOPS[2], host: 2 },
];

export function officeSlabs() {
  return OFFICE_TERRACES.map((t, i) => box(t.name, t.rect[0], t.rect[1], t.rect[2], t.rect[3], t.y, 0.3, 'paving', 'L', [0.70 + i * 0.003, 0.05]));
}

// Planters: [x0, x1, z0, z1, baseY, hang] — hang = hanging planting length and the
// face it hangs over ('screen' allows long strands; 'band' keeps them over the frame only)
export const OFFICE_PLANTERS = [];
{
  const B = OFFICE_BASE_TOP, [t1, t2] = OFFICE_BLOCK_TOPS;
  const seg = (a0, a1, len = 4.2, gap = 0.9) => { const out = []; for (let a = a0; a + len <= a1 + 1e-6; a += len + gap) out.push([a, a + len]); return out; };
  for (const [z0, z1] of seg(15.0, 42.0)) OFFICE_PLANTERS.push({ rect: [72.6, 73.8, z0, z1], y: B, hang: { face: 'e', at: 74.75, over: 'band', max: 0.6 } });   // trails over the spandrel in front of the garage panels
  for (const [x0, x1] of seg(30.5, 72.5)) OFFICE_PLANTERS.push({ rect: [x0, x1, 48.4, 49.6], y: B, hang: null });
  for (const [z0, z1] of seg(15.0, 37.0)) OFFICE_PLANTERS.push({ rect: [22.3, 23.5, z0, z1], y: B, hang: null });
  for (const [x0, x1] of seg(36.0, 66.5)) OFFICE_PLANTERS.push({ rect: [x0, x1, 40.6, 41.8], y: t1, hang: { face: 's', at: 42.8, over: 'band', max: 0.6 } });
  for (const [z0, z1] of seg(15.2, 40.5)) OFFICE_PLANTERS.push({ rect: [31.0, 32.2, z0, z1], y: t1, hang: { face: 'w', at: 29.8, over: 'band', max: 0.6 } });
  for (const [z0, z1] of seg(15.2, 30.8)) OFFICE_PLANTERS.push({ rect: [68.4, 69.6, z0, z1], y: t2, hang: { face: 'e', at: 70.8, over: 'band', max: 0.6 } });
  const t3 = OFFICE_BLOCK_TOPS[2];
  for (const [x0, x1] of seg(45.4, 61.6, 3.6, 1.2)) OFFICE_PLANTERS.push({ rect: [x0, x1, 32.6, 33.6], y: t3, hang: { face: 's', at: 34.95, over: 'band', max: 0.6 } });   // crown terrace, south edge
  for (const [z0, z1] of seg(15.2, 27.6, 3.6, 1.2)) OFFICE_PLANTERS.push({ rect: [33.8, 34.8, z0, z1], y: t3, hang: { face: 'w', at: 32.45, over: 'band', max: 0.6 } });   // crown terrace, west edge
}
export const PLANTER = { rim: 0.9, soil: 0.75, drainage: 0.15, access: 0.9 };
export const PARAPET = 0.45;   // roof parapet above each office roof

export function officeParts(tier, rand) {
  const out = [];
  const K = partsKit(out);
  const { block, column, add, pergola, dining } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const [t1, t2, t3] = OFFICE_BLOCK_TOPS;

  // --- white frames: roof band, floor band, slab edges, corner piers ------------------
  // The roof band is a parapet ring that rises PARAPET above the roof (a solid band
  // flush with the roof would share its plane and z-fight); piers stop just under it.
  for (const b of OFFICE_BLOCKS) {
    const [x0, x1, z0, z1] = b.rect;
    const o = 0.5;
    const ring = (y0, y1, out, inset) => {
      block(x0 - out, x1 + out, y0, y1, z0 - out, z0 + inset, 'frame');
      block(x0 - out, x1 + out, y0, y1, z1 - inset, z1 + out, 'frame');
      block(x0 - out, x0 + inset, y0, y1, z0 + inset, z1 - inset, 'frame');
      block(x1 - inset, x1 + out, y0, y1, z0 + inset, z1 - inset, 'frame');
    };
    ring(b.y1 - 0.8, b.y1 + PARAPET, o, 0.3);
    block(x0 - o, x1 + o, b.y0, b.y0 + 0.6, z0 - o, z1 + o, 'frame');
    for (let k = 1; k < 3; k++) {
      const y = b.y0 + k * OFFICE_FLOOR;
      block(x0 - 0.3, x1 + 0.3, y - 0.35, y, z0 - 0.3, z1 + 0.3, 'frame');
    }
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) block(cx - o - 0.02, cx + o + 0.02, b.y0 + 0.6, b.y1 - 0.8, cz - o - 0.02, cz + o + 0.02, 'frame');
  }

  // --- warm timber soffits beneath the projecting edges ----------------------------------
  block(68.3, 70.7, 26.94, 27.0, 13.6, 32.4, 'woodLight');                 // b2, east
  block(32.6, 35.4, 39.54, 39.6, 13.6, 32.0, 'woodLight');                 // b3, west
  block(32.6, 62.8, 39.54, 39.6, 32.0, 34.8, 'woodLight');                 // b3, south

  // --- timber louvres (selective): b1 south, b3 west and part of b3 south -----------------
  const louvre = (face, a0, a1, fixed, y0, y1, step = 1.5) => {
    for (let a = a0; a <= a1; a += step) {
      if (face === 's') block(a - 0.04, a + 0.04, y0, y1, fixed, fixed + 0.5, 'wood');
      if (face === 'w') block(fixed - 0.5, fixed, y0, y1, a - 0.04, a + 0.04, 'wood');
    }
  };
  louvre('s', 44.0, 66.0, 42.2, OFFICE_BASE_TOP + 0.6, t1 - 0.8);
  louvre('w', 15.0, 22.6, 33.0, t2 + 0.6, t3 - 0.8);
  louvre('s', 33.8, 43.0, 34.4, t2 + 0.6, t3 - 0.8);

  // --- integrated terrace planters with physical depth, and controlled hanging planting ---
  for (const p of OFFICE_PLANTERS) {
    // inset 4 cm so the planter walls never share a plane with the terrace slab edges
    const [x0, x1, z0, z1] = [p.rect[0] + 0.04, p.rect[1] - 0.04, p.rect[2] + 0.04, p.rect[3] - 0.04];
    block(x0, x1, p.y, p.y + PLANTER.rim, z0, z1, 'frame', C);
    block(x0 + 0.12, x1 - 0.12, p.y + PLANTER.rim, p.y + PLANTER.rim + 0.06, z0 + 0.12, z1 - 0.12, 'planter', C);
    const along = x1 - x0 > z1 - z0;
    const n = Math.round(Math.max(x1 - x0, z1 - z0) / 1.4);
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      add('cone', along ? x0 + (x1 - x0) * f : (x0 + x1) / 2, p.y + PLANTER.rim + 0.4, along ? (z0 + z1) / 2 : z0 + (z1 - z0) * f, 1.0, 0.8, 1.0, k % 2 ? 'shrub' : 'shrubDark', C);
    }
    if (p.hang) {
      const spacing = full ? 0.35 : 0.7;
      const a0 = along ? x0 : z0, a1 = along ? x1 : z1;
      for (let a = a0 + 0.2; a < a1 - 0.1; a += spacing) {
        const len = p.hang.over === 'screen' ? 1.6 + rand() * (p.hang.max - 1.6) : 0.25 + rand() * (p.hang.max - 0.25);
        const color = rand() < 0.5 ? 'vine' : 'vineLight';
        const yTop = p.y + (p.hang.over === 'screen' ? 0.6 : 0.2);
        if (p.hang.face === 'e' || p.hang.face === 'w') block(p.hang.at - 0.06, p.hang.at + 0.06, yTop - len, yTop, a - 0.11, a + 0.11, color, C);
        else block(a - 0.11, a + 0.11, yTop - len, yTop, p.hang.at - 0.06, p.hang.at + 0.06, color, C);
      }
    }
  }

  // --- shaded outdoor workspaces and seating ---------------------------------------------
  // base-roof west terrace: timber pergola over long work tables
  pergola(24.4, 29.4, 17.5, 35.5, OFFICE_BASE_TOP + 0.3, { color: 'wood', slat: 0.5 });
  for (const z of [20.0, 25.5, 31.0]) {
    block(25.4, 28.4, OFFICE_BASE_TOP + 0.3, OFFICE_BASE_TOP + 1.04, z - 0.5, z + 0.5, 'wood', C);
    for (const x of [25.9, 26.9, 27.9]) for (const s of [-1, 1]) block(x - 0.2, x + 0.2, OFFICE_BASE_TOP + 0.3, OFFICE_BASE_TOP + 0.75, z + s * 0.85 - 0.2, z + s * 0.85 + 0.2, 'charcoal', C);
  }
  // b1 south terrace: louvred timber canopy over dining + lounge seating
  pergola(41.0, 63.0, 33.6, 39.2, t1 + 0.3, { color: 'wood', slat: 0.45 });
  for (const x of [44.0, 49.0, 54.0, 59.0]) dining(x, 36.4, t1 + 0.3, full ? 4 : 2);
  // b2 east terrace: tables under umbrellas
  K.umbrella(66.0, 19.5, t2 + 0.3, 2.6); K.dining(66.0, 19.5, t2 + 0.3, 4);
  K.umbrella(66.0, 26.5, t2 + 0.3, 2.6); K.dining(66.0, 26.5, t2 + 0.3, 4);

  // --- crown: large glazed bays between white fins on the column rhythm, a crown terrace
  //     (glass guard, timber pergola, lounge) and the integrated mechanical enclosure ---------
  const b3 = OFFICE_BLOCKS[2];
  const [cx0, cx1, cz0, cz1] = b3.rect;
  for (const x of [36.0, 43.6, 48.9, 54.2, 61.8]) block(x - 0.2, x + 0.2, b3.y0 + 0.6, b3.y1 - 0.8, cz1 + 0.52, cz1 + 1.1, 'frame');   // south fins
  for (const z of [14.6, 23.0, 31.4]) block(cx0 - 1.1, cx0 - 0.52, b3.y0 + 0.6, b3.y1 - 0.8, z - 0.2, z + 0.2, 'frame');                // west fins
  const tY = t3 + 0.3;
  for (const [x0, x1, z0, z1] of OFFICE_CROWN.terraces) {
    // glass guard panels on the outer edges, inside the parapet
    if (z1 > 33.9) block(x0, x1, t3 + 0.45, t3 + 1.5, z1 + 0.06, z1 + 0.14, 'guardGlass', C);
    if (x0 < 33.5) block(x0 - 0.14, x0 - 0.06, t3 + 0.45, t3 + 1.5, z0, z1, 'guardGlass', C);
  }
  pergola(35.0, 43.0, 28.8, 31.8, tY, { color: 'wood', slat: 0.5 });
  for (const x of [37.0, 41.0]) K.dining(x, 30.3, tY, full ? 4 : 2);
  K.sofaGroup(38.8, 18.5, tY); K.umbrella(39.5, 19.0, tY, 2.8);
  K.sofaGroup(38.8, 24.4, tY);
  // mechanical enclosure: roof blade and a slim warm light line under it
  block(45.0, 61.8, t3 + OFFICE_CROWN.mechH + 0.02, t3 + OFFICE_CROWN.mechH + 0.32, 14.6, 27.2, 'frame');
  block(45.1, 61.7, t3 + OFFICE_CROWN.mechH - 0.18, t3 + OFFICE_CROWN.mechH - 0.12, 27.22, 27.28, 'lamp', C);

  // --- entrance, service ---------------------------------------------------------------------
  column(22.6, 49.4, 0, OFFICE_GROUND + OFFICE_FLOOR, 0.5);                     // lobby corner column
  block(23.5, 34.5, 4.72, 5.0, 47.5, 53, 'frame');                              // lobby entrance canopy
  block(23.6, 34.4, 4.64, 4.72, 47.6, 52.9, 'woodLight');                       // timber soffit
  column(24.2, 52.4, 0, 4.64, 0.1, 'metal'); column(33.8, 52.4, 0, 4.64, 0.1, 'metal');
  block(73.8, 74.2, 0, 4.6, OFFICE_PARKING.entry.curb[0] + 1, OFFICE_PARKING.entry.curb[1] - 1, 'void');  // car-lift entry
  block(73.8, 74.2, 0, 4.6, 42.0, 48.0, 'void');                                // loading dock
  // detailed vehicle entrances (framed portals below the east garage piers at +5.6 m):
  // two car-lift bays with an entry / exit island, and the loading dock
  const X = fixtureKit(K);
  const [e0, e1] = OFFICE_PARKING.entry.curb;
  X.vehicleEntrance({ x: 74.2, z: (e0 + e1) / 2, nx: 1, nz: 0, W: e1 - e0 - 2, H: 4.6, maxHead: 5.58, lifts: true, apron: 4.0 });
  X.vehicleEntrance({ x: 74.2, z: 45.0, nx: 1, nz: 0, W: 6.0, H: 4.6, maxHead: 5.58, lanes: 0, apron: 4.0 });
  return out;
}
