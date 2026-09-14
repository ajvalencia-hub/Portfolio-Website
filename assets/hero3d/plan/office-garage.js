// Office parking façade (north lane and east street faces of the office base), a more
// artistic, urban counterpart to the residential wave screen — an original composition,
// not a copy of any building or mural:
//   • white piers on the office column grid and charcoal spandrels at each deck edge
//     give the structural frame
//   • bays alternate perforated metal (hole size swelling in an abstract relief),
//     breeze block, folded charcoal fins, warm timber slat panels and planted green-wall
//     bays with ledge planters, varied level to level so the frame reads as composed
//   • panels stand 0.3 m proud of the deck edge for ventilation behind them; all
//     treatments are ≥ 50 % open conceptually; vehicle and loading entrances stay clear
//   • slim warm light lines on alternate piers
// Reusable: bays are data (face, span, per-level treatment); boxes for panels (shaded by
// facade-glsl.js), instanced parts for fins, slats, planters and lights.
import { OFFICE_GROUND, OFFICE_FLOOR, OFFICE, GLAZE, box, partsKit } from './core.js';

const LEVELS = [
  [OFFICE_GROUND, OFFICE_GROUND + OFFICE_FLOOR],                    // P1  6.0 – 10.2
  [OFFICE_GROUND + OFFICE_FLOOR, OFFICE_GROUND + 2 * OFFICE_FLOOR], // P2 10.2 – 14.4
];
// faces: fixed coordinate of the facade, outward sign, axis the bays run along, pier
// base height (east piers start above the car-lift and loading entrance heads)
const FACES = {
  n: { fixed: 14.0, out: -1, along: 'x', pierBase: 0 },
  e: { fixed: 74.0, out: 1, along: 'z', pierBase: 5.6 },
};
export const OFFICE_GARAGE_BAYS = [
  // north (lane) face, west → east
  { face: 'n', span: [22.3, 31.0], levels: ['breeze', 'breeze'], ground: 'breeze' },
  { face: 'n', span: [31.0, 36.0], levels: ['wood', 'wood'] },
  { face: 'n', span: [36.0, 43.6], levels: ['fins', 'fins'], ground: 'breeze' },
  { face: 'n', span: [43.6, 48.9], levels: ['perforated', 'green'], ground: 'breeze' },
  { face: 'n', span: [48.9, 54.2], levels: ['breeze', 'perforated'], ground: 'breeze' },
  { face: 'n', span: [54.2, 61.8], levels: ['fins', 'fins'], ground: 'breeze' },
  { face: 'n', span: [61.8, 67.2], levels: ['green', 'wood'] },
  { face: 'n', span: [67.2, 73.7], levels: ['perforated', 'perforated'] },
  // east (street) face, north → south
  { face: 'e', span: [14.3, 23.0], levels: ['perforated', 'perforated'] },
  { face: 'e', span: [23.0, 31.4], levels: ['fins', 'fins'] },
  { face: 'e', span: [31.4, 39.8], levels: ['breeze', 'wood'] },
  { face: 'e', span: [39.8, 49.7], levels: ['green', 'green'] },
];

export function officeGarageFacade(tier) {
  const full = tier.name !== 'mobile';
  const boxes = [];
  const parts = [];
  const K = partsKit(parts);
  const { block, oriented, add } = K;
  const C = 'context';
  // rectangle helper in face coordinates: a0..a1 along the face, d0..d1 outward from it
  const rectOn = (f, a0, a1, d0, d1) => {
    const F = FACES[f];
    const p0 = F.fixed + F.out * d0, p1 = F.fixed + F.out * d1;
    const [lo, hi] = [Math.min(p0, p1), Math.max(p0, p1)];
    return F.along === 'x' ? [a0, a1, lo, hi] : [lo, hi, a0, a1];
  };
  let n = 0;
  const panel = (f, a0, a1, y0, y1, kind, glaze) => {
    const [x0, x1, z0, z1] = rectOn(f, a0, a1, 0.3, 0.45);
    boxes.push(box(`C.garage${n++}`, x0, x1, z0, z1, y0, y1 - y0, kind, 'C', [0.376, 0.006], null, { glaze, module: OFFICE }));
  };
  const faceAngle = (f) => (FACES[f].along === 'x' ? 0 : Math.PI / 2);   // plan angle of the face direction

  for (const bay of OFFICE_GARAGE_BAYS) {
    const F = FACES[bay.face];
    const a0 = bay.span[0] + 0.37, a1 = bay.span[1] - 0.37;          // clear of the 0.7 m piers
    const bands = [...LEVELS.map(([y0, y1], k) => ({ y0: y0 + 0.3, y1: y1 - 0.35, type: bay.levels[k] }))];
    if (bay.ground && full) bands.unshift({ y0: 0.8, y1: OFFICE_GROUND - 0.5, type: bay.ground });
    for (const { y0, y1, type } of bands) {
      if (type === 'perforated') panel(bay.face, a0, a1, y0, y1, 'perforated', GLAZE.perforated);
      else if (type === 'breeze') panel(bay.face, a0, a1, y0, y1, 'breeze', GLAZE.breezeBlock);
      else if (type === 'wood') {
        // warm timber: a dark backing panel with vertical slats standing off it
        const [x0, x1, z0, z1] = rectOn(bay.face, a0, a1, 0.3, 0.4);
        block(x0, x1, y0, y1, z0, z1, 'charcoal');
        for (let a = a0 + 0.15, k = 0; a < a1 - 0.05; a += full ? 0.24 : 0.48, k++) {
          const [sx0, sx1, sz0, sz1] = rectOn(bay.face, a - 0.05, a + 0.05, 0.42, 0.56);
          block(sx0, sx1, y0 + 0.05, y1 - 0.05, sz0, sz1, k % 3 ? 'wood' : 'woodLight');
        }
      } else if (type === 'fins') {
        // folded fins: charcoal blades turned alternately ±28° from the face
        const step = full ? 0.75 : 1.5;
        for (let a = a0 + 0.35, k = 0; a < a1 - 0.2; a += step, k++) {
          const [cxr, , czr] = [...rectOn(bay.face, a, a, 0.75, 0.75)];
          const cx = F.along === 'x' ? a : cxr, cz = F.along === 'x' ? czr : a;
          const ang = faceAngle(bay.face) + Math.PI / 2 + (k % 2 ? 0.49 : -0.49);
          oriented(cx, cz, y0, y1 - y0, 0.95, 0.07, ang, k % 2 ? 'charcoal' : 'perforated', 'solid');
        }
      } else if (type === 'green') {
        // planted bay: green-wall panel with ledge planters at the base and mid height
        panel(bay.face, a0, a1, y0, y1, 'greenWall', GLAZE.none);
        for (const ly of [y0, (y0 + y1) / 2]) {
          const [x0, x1, z0, z1] = rectOn(bay.face, a0, a1, 0.47, 1.05);
          block(x0, x1, ly, ly + 0.45, z0, z1, 'frame', C);
          const cnt = Math.max(2, Math.round((a1 - a0) / (full ? 0.9 : 1.8)));
          for (let k = 0; k < cnt; k++) {
            const a = a0 + ((k + 0.5) / cnt) * (a1 - a0);
            const [px0, , pz0] = rectOn(bay.face, a, a, 0.76, 0.76);
            add('cone', F.along === 'x' ? a : px0, ly + 0.45 + 0.35, F.along === 'x' ? pz0 : a, 0.8, 0.7, 0.8, k % 2 ? 'shrub' : 'shrubDark', C);
          }
        }
      }
    }
  }

  // white piers on the grid, a corner piece wrapping the north-east corner, charcoal
  // spandrels at each deck edge, warm light lines on alternate piers
  const piers = { n: [22.3, 31.0, 36.0, 43.6, 48.9, 54.2, 61.8, 67.2], e: [23.0, 31.4, 39.8, 49.7] };
  for (const [f, list] of Object.entries(piers)) {
    const F = FACES[f];
    list.forEach((a, k) => {
      const [x0, x1, z0, z1] = rectOn(f, a - 0.35, a + 0.35, 0.02, 1.05);
      block(x0, x1, F.pierBase, 14.3, z0, z1, 'frame');   // tops tuck inside the top spandrel
      if (k % 2 === 1) {
        for (const [y0, y1] of LEVELS) {
          const [lx0, lx1, lz0, lz1] = rectOn(f, a - 0.04, a + 0.04, 1.05, 1.08);
          block(lx0, lx1, y0 + 0.6, y1 - 0.9, lz0, lz1, 'lamp', C);
        }
      }
    });
    const len = f === 'n' ? [22.0, 73.6] : [14.4, 50.0];
    for (const y of [LEVELS[0][1], LEVELS[1][1]]) {
      const [x0, x1, z0, z1] = rectOn(f, len[0], len[1], 0.2, 0.95);
      block(x0, x1, y - 0.36, y - 0.02, z0, z1, 'charcoal');
    }
  }
  block(73.4, 75.06, 0, 14.3, 12.94, 14.6, 'frame');    // corner wrap (north-east)
  return { boxes, parts };
}
