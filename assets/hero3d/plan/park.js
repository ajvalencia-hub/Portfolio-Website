// Public park on the condo entrance axis, organised around the fountain plaza
// (plan/pedestrian.js): a continuous paved ring around a white twisting sculpture in a
// reflecting pool, standing where the Central Promenade and the north–south Spine cross.
// The plaza is entered from exactly four directions — the promenade west to the condo
// portal and east to the hotel and office, the spine south to the park gate and north to
// the paseo — so the sculpture closes the view straight out of the podium portal.
// Lawns fill the four sectors between those mouths, out to the park boundary (the podium
// café terrace on the west, the hotel's west end on the north, the office walk on the
// east and the south frontage), with planting beds on the outer edges, shade and
// flowering trees, palms marking each mouth, a bench ring facing the fountain and
// lanterns between the benches. The market hall (plan/pavilions.js) stands in the south
// lawn; café seating stays in the furnishing zones beside the podium arcade and the
// office walk.
import { RES, GLAZE, D2R, circlePlan, rayRadius, insidePlan, partsKit, polarRadius } from './core.js';
import { placeTrees } from './planting.js';
import { PLAZA_R, LAWN_TOP, FOUNTAIN_CENTRE, SURFACE, onRoute, inFurnishing, plazaCorridor, TUCK_UNDER, tuckToPaving } from './pedestrian.js';

export const FOUNTAIN = { x: FOUNTAIN_CENTRE[0], z: FOUNTAIN_CENTRE[1], basin: 6.1, coping: 0.6, copingH: 0.5, waterY: 0.36 };
export const PLAZA_DISC = PLAZA_R;
// Sculpture: an original abstract piece in the development's own language — a stack of
// thin white plates in the rounded-triangle plan of tower 1, each turned a few degrees so
// the stack twists like the towers and swells and narrows like the garage wave screen,
// threaded on a slender white core. It stands on a stone plinth in a calm reflecting pool
// (no jets), lit from below by warm uplights set around the plinth.
export const SCULPTURE = { plinthR: 1.7, plinthH: 0.55, coreR: 0.32, plates: 13, gap: 0.82, thick: 0.1, twist: 13, lobes: { a3: 0.24, p3: -90, a1: 0.08 } };
// The outer limit of the park's green, as a polygon star-shaped about the fountain so the
// sector lawns can be cut along rays from it. It follows what actually bounds the open
// ground: the podium café terrace on the west, the hotel's west end and its plaza face on
// the north, the office-walk margin on the east and the south frontage strip. Paving and
// buildings sit over the grass — the walks stand 80 mm proud and hide what runs beneath —
// so the lawns need only stop at the edge of the block, not at every path.
export const LAWN_BOUNDARY = [
  [-21.8, -12.0],   // west, level with the paseo's south end
  [5.4, -12.0],     // north, stopping short of the hotel's west end
  [5.4, -6.6],      // down the hotel's west face
  [18.9, -6.6],     // 1 m clear of the hotel's plaza face
  [18.9, 50.6],     // east, against the office-walk margin
  [-21.8, 50.6],    // south frontage
];
const LAWN_INNER = PLAZA_DISC - TUCK_UNDER;   // the lawn runs under the plaza's edge
const F = FOUNTAIN;

// the four plaza mouths, in increasing bearing. The half-corridor kept clear of lawn comes
// from the route itself — its widest half-width at the mouth plus its landscape setback —
// so the grass follows whatever width the walk is given rather than a number copied by hand.
export const PLAZA_LINKS = [
  { deg: -90, route: 'S2' },    // spine north, to the paseo
  { deg: 0, route: 'P1' },      // promenade east, to the hotel and office
  { deg: 90, route: 'S1' },     // spine south, to the park gate
  { deg: 180, route: 'P1' },    // promenade west, to the condo portal
].map((l) => ({ ...l, a: l.deg * D2R, clear: plazaCorridor(l.route) }));

// kept for the linework and older tools: the plaza connections as from → to segments
export const PARK_PATHS = PLAZA_LINKS.map((l) => ({
  name: l.route, angle: l.a, width: l.clear * 2 - 1.2,
  from: [F.x + Math.cos(l.a) * (PLAZA_DISC - 0.3), F.z + Math.sin(l.a) * (PLAZA_DISC - 0.3)],
  to: [F.x + Math.cos(l.a) * 26, F.z + Math.sin(l.a) * 26],
}));
export const CAFE_ZONES = [];   // café seating is defined in plan/pedestrian.js (FURNISHING)

const SECTORS = PLAZA_LINKS.map((l, k) => {
  const n = PLAZA_LINKS[(k + 1) % PLAZA_LINKS.length];
  let b = n.a;
  if (b <= l.a) b += Math.PI * 2;
  return { a0: l.a, a1: b, c0: l.clear, c1: n.clear, mid: (l.a + b) / 2, span: b - l.a };
});
const boundaryR = (t) => rayRadius(F.x, F.z, LAWN_BOUNDARY, t);
const at = (r, t) => [F.x + r * Math.cos(t), F.z + r * Math.sin(t)];

// lawn in a sector: inner arc, edges parallel to each link corridor, outer park boundary
function lawnPolygon(s) {
  const pts = [];
  const n = 10;
  if (boundaryR(s.mid) < LAWN_INNER + 1.0) return null;   // no room for grass on this side
  const dA = (r) => Math.asin(Math.min(0.95, s.c0 / r)), dB = (r) => Math.asin(Math.min(0.95, s.c1 / r));
  const tA = s.a0 + dA(LAWN_INNER), tB = s.a1 - dB(LAWN_INNER);
  if (tB <= tA) return null;
  for (let k = 0; k <= n; k++) pts.push(at(LAWN_INNER, tA + ((tB - tA) * k) / n));
  const outerB = boundaryR(s.a1 - dB(18));
  for (let k = 1; k <= n; k++) { const r = LAWN_INNER + ((outerB - LAWN_INNER) * k) / n; pts.push(at(r, s.a1 - dB(r))); }
  const tB2 = s.a1 - dB(outerB), tA2 = s.a0 + dA(boundaryR(s.a0 + dA(18)));
  for (let k = 1; k < 2 * n; k++) { const t = tB2 + ((tA2 - tB2) * k) / (2 * n); pts.push(at(boundaryR(t) - 0.05, t)); }
  const outerA = boundaryR(s.a0 + dA(18));
  for (let k = n; k >= 1; k--) { const r = LAWN_INNER + ((outerA - LAWN_INNER) * k) / n; pts.push(at(r, s.a0 + dA(r))); }
  return pts;
}
const LAWNS = SECTORS.map(lawnPolygon).filter(Boolean);

// Palms mark the axes and the mouths only — they are not the shade strategy. They stand
// just outside the paved ring and flank the park gate; crowns are reserved before trees.
// [x, z, height] — pairs flanking each plaza mouth and the park gate, heights set by hand
// so the group reads as a planted marker rather than a row of identical sticks
const PALM_SPOTS = [
  [4.8, 6.2, 11.5], [4.8, -4.2, 13.0],        // east mouth (promenade to the hotel)
  [-20.8, 6.2, 12.4], [-20.8, -4.2, 10.6],    // west mouth (promenade to the condo portal)
  [-1.2, 13.4, 13.6], [-14.4, 13.4, 11.2],    // south mouth (spine to the park gate)
  [-2.8, -11.8, 10.8], [-13.2, -11.8, 12.8],  // north mouth (spine to the paseo)
  [-13.6, 50.2, 12.0], [-2.4, 50.2, 14.2],    // the park gate itself
  [-4.9, 33.0, 13.4], [17.9, 24.0, 11.8],     // marking the flexible lawn's two long edges
];

// The park's shade. Broad-canopy trees are placed deliberately rather than scattered, so
// the rooms read: a bosque in the west garden room, a frame round the flexible lawn's
// corners, a pair on the market terrace and groups at the plaza mouths. Everything stays
// out of the 22 × 18 m flexible lawn itself, which is meant to be open. `lite` trees are
// the ones the mobile tier drops.
export const FLEX_LAWN = [-5.0, 17.0, 14.2, 32.2];   // x0, x1, z0, z1 — kept clear of trunks
const PARK_TREES = [
  // west garden room: two staggered rows of broad shade trees over the bench line
  { x: -19.0, z: 16.0, kind: 'spread', r: 2.7 },
  { x: -14.6, z: 20.4, kind: 'spread', r: 2.7, lite: true },
  { x: -19.0, z: 24.8, kind: 'broad', r: 2.1 },
  { x: -14.6, z: 29.2, kind: 'spread', r: 2.7, lite: true },
  { x: -19.0, z: 33.6, kind: 'spread', r: 2.7 },
  { x: -14.6, z: 38.0, kind: 'broad', r: 2.1, flower: true, lite: true },
  { x: -19.0, z: 42.4, kind: 'spread', r: 2.7 },
  { x: -14.6, z: 46.8, kind: 'spread', r: 2.6, lite: true },
  { x: -19.4, z: 49.8, kind: 'round', r: 2.0, flower: true },
  // south-west quadrant, framing the park gate approach
  { x: -20.2, z: 11.6, kind: 'round', r: 1.9, flower: true },
  // north-west, the paseo's south end
  { x: -20.6, z: -10.6, kind: 'spread', r: 2.7 },
  // north-east, between the plaza and the hotel's west end
  { x: 3.2, z: -10.2, kind: 'broad', r: 2.0 },
  // east margin, beside the office walk
  { x: 17.8, z: 15.6, kind: 'round', r: 1.6 },
];

// planting beds along the outer edge of each lawn sector, clear of the link corridors
const BED_TOP = 0.34;
const BED_POLYS = SECTORS.map((s) => {
  const cA = (r) => Math.asin(Math.min(0.95, (s.c0 + 0.3) / r)), cB = (r) => Math.asin(Math.min(0.95, (s.c1 + 0.3) / r));
  const outer = (t) => boundaryR(t) - 0.45, inner = (t) => Math.max(LAWN_INNER + 1.4, boundaryR(t) - 2.4);
  const tA = s.a0 + cA(boundaryR(s.a0 + 0.3)), tB = s.a1 - cB(boundaryR(s.a1 - 0.3));
  if (tB - tA < 0.2 || boundaryR(s.mid) < LAWN_INNER + 2.4) return null;
  const n = 18;
  const ts = Array.from({ length: n + 1 }, (_, i) => tA + ((tB - tA) * i) / n)
    .map((t) => Math.min(Math.max(t, s.a0 + cA(outer(t))), s.a1 - cB(outer(t))));
  const pts = [...ts.map((t) => at(outer(t), t)), ...ts.slice().reverse().map((t) => at(inner(t), t))];
  const width = (t) => outer(t) - inner(t);
  if (width(s.mid) < 0.9) return null;
  return {
    pts,
    stations: (step) => {
      const out = [];
      for (const [row, f] of [[0, 0.3], [1, 0.72]]) {
        const rMid = (t) => inner(t) + width(t) * f;
        const arc = (tB - tA) * rMid(s.mid);
        const cnt = Math.max(2, Math.round(arc / step));
        for (let i = 0; i < cnt; i++) {
          const t = tA + ((tB - tA) * (i + 0.5 * row + 0.25)) / cnt;
          if (t <= tB) out.push([...at(rMid(t), t), row]);
        }
      }
      return out;
    },
  };
}).filter(Boolean);

function sculptureSpec(tier, ctx) {
  const Q = SCULPTURE;
  const n = tier.name === 'mobile' ? 40 : 64;
  const floors = [];
  for (let k = 0; k < Q.plates; k++) {
    const u = k / (Q.plates - 1);
    // swelling profile: narrow at the base, broadest two-thirds up, tapering at the crown
    const R = 0.7 + 1.9 * Math.sin(Math.PI * Math.min(1, u * 0.8 + 0.1)) ** 2;
    const turn = k * Q.twist;
    const outer = Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      const r = polarRadius({ R, ...Q.lobes }, t - turn * D2R);
      return [F.x + r * Math.cos(t), F.z + r * Math.sin(t)];
    });
    floors.push({ y: 1.2 + k * Q.gap, thick: Q.thick, outer, inner: circlePlan(F.x, F.z, Q.coreR - 0.12, n) });
  }
  const h = 1.2 + (Q.plates - 1) * Q.gap + 0.9;
  return {
    ...ctx, name: 'P.sculpture', type: 'prism', kind: 'frame', glaze: GLAZE.none, y0: Q.plinthH, h,
    pts: circlePlan(F.x, F.z, Q.coreR, n), slabs: { kind: 'frame', floors }, ribs: 8,
  };
}

export function parkSpecs(tier) {
  const seg = tier.name === 'mobile' ? 48 : 72;
  const ctx = { module: RES, parent: null, start: 0.655, dur: 0.01, wire: false, phase: 'context' };
  return [
    { ...ctx, name: 'P.disc', type: 'prism', kind: SURFACE.plaza.kind, glaze: SURFACE.plaza.glaze, module: SURFACE.plaza.module, ramp: [F.x, F.z, 0, 0], y0: 0, h: SURFACE.plaza.top, pts: circlePlan(F.x, F.z, PLAZA_DISC, seg) },
    // lawns and beds: one merged mesh each
    // the sector lawns run under the walks that bound them, so grass meets paving on the path's edge
    { ...ctx, name: 'P.lawns', type: 'prisms', kind: 'lawn', glaze: GLAZE.none, y0: 0, h: LAWN_TOP, parts: LAWNS.map((pts, k) => ({ pts: tuckToPaving(pts), owner: `lawn${k}` })) },
    { ...ctx, name: 'P.beds', type: 'prisms', kind: 'bed', glaze: GLAZE.none, y0: 0, h: BED_TOP, parts: BED_POLYS.map((b, k) => ({ pts: b.pts, owner: `bed${k}` })) },
    { ...ctx, name: 'P.coping', type: 'ring', kind: 'coping', glaze: GLAZE.none, y0: 0, h: F.copingH, pts: circlePlan(F.x, F.z, F.basin + F.coping, seg), inner: circlePlan(F.x, F.z, F.basin, seg) },
    { ...ctx, name: 'P.water', type: 'prism', kind: 'pool', glaze: GLAZE.water, y0: 0, h: F.waterY, pts: circlePlan(F.x, F.z, F.basin, seg), ramp: [F.x, F.z, 0, 1] },
    sculptureSpec(tier, ctx),
  ];
}

// poles: lights, umbrellas, benches and bike stands from plan/pedestrian.js
// `blocked(x, z, reach)` keeps planting out of the market hall and the promenade pavilion,
// which stand in the park's own lawns.
export function parkParts(tier, rand, poles = [], blocked = () => false) {
  const out = [];
  const K = partsKit(out);
  const { add, column, bench } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const trees = [];
  const palms = [];

  // sculpture plinth: stone drum in the reflecting pool with a white capping ring and warm
  // uplights set into it around the core
  column(F.x, F.z, 0, SCULPTURE.plinthH - 0.08, SCULPTURE.plinthR, 'stone', C);
  column(F.x, F.z, SCULPTURE.plinthH - 0.08, 0.08, SCULPTURE.plinthR + 0.12, 'coping', C);
  const uplights = full ? 8 : 4;
  for (let k = 0; k < uplights; k++) {
    const a = (k / uplights) * Math.PI * 2 + 0.2;
    add('cyl', F.x + Math.cos(a) * 1.05, SCULPTURE.plinthH + 0.03, F.z + Math.sin(a) * 1.05, 0.22, 0.06, 0.22, 'lamp', C);
  }

  // bench ring on the plaza's outer furnishing band, facing the fountain, never across a link
  const seats = [];
  const ringR = PLAZA_DISC - 0.8;
  for (const s of SECTORS) {
    const margin = (c) => Math.asin(Math.min(0.95, (c + 0.6) / ringR));
    const t0 = s.a0 + margin(s.c0), t1 = s.a1 - margin(s.c1);
    const span = t1 - t0;
    if (span <= 0.2) continue;
    const n = Math.max(1, Math.min(3, Math.floor((span * ringR) / 6.5)));
    for (let j = 0; j < n; j++) {
      const a = t0 + (span * (j + 0.5)) / n;
      const [x, z] = at(ringR, a);
      if (poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.8)) continue;
      bench(x, z, SURFACE.plaza.top, 2.6, a + Math.PI / 2);
      seats.push({ x, z, r: 1.3, top: 0.5 });
    }
  }

  // --- layered tropical planting ---------------------------------------------------------
  // palms first (trunks ≥ 0.8 m clear of every route), then trees clear of palms, poles and routes
  PALM_SPOTS.forEach(([x, z, h]) => {
    if (onRoute(x, z, 0.8) || blocked(x, z, 2.6) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 2.6)) return;
    palms.push({ x, z, h });
  });
  const reserve = palms.map((p) => ({ x: p.x, z: p.z, r: 2.4, top: 14 }));
  const candidates = PARK_TREES.filter((t) => full || !t.lite)
    .map((t) => ({ ...t, y: 0, tone: rand(), lush: true }));
  // low canopies (underside below 2.4 m) may not reach over a clear zone
  const overhangs = (x, z, r) => onRoute(x, z, Math.max(0.8, r - 0.2)) || inFurnishing(x, z, r) || blocked(x, z, r);
  trees.push(...placeTrees(candidates, { poles: [...poles, ...reserve, ...seats], blocked: overhangs, gap: 0.15, minScale: 0.55 }));

  // beds: two staggered rows of shrubs with flowering and light-foliage accents
  const shrubAt = (x, z, k, big) => {
    const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
    const c = colors[(k + Math.floor(rand() * 2)) % colors.length];
    const sz = (big ? 1.3 : 1.0) + rand() * 0.4, h = (big ? 1.2 : 0.8) + rand() * 0.5;
    add('bush', x, BED_TOP + h / 2, z, sz, h, sz, c, C);
  };
  let k = 0;
  for (const bed of BED_POLYS) {
    for (const [x, z, row] of bed.stations(full ? 1.25 : 2.5)) {
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.9) || palms.some((q) => Math.hypot(q.x - x, q.z - z) < 0.8) || onRoute(x, z, 0.6) || blocked(x, z, 0.5)) continue;
      shrubAt(x, z, k++, row === 0);
    }
  }
  // groundcover drifts where the lawns meet the plaza, clear of the link mouths
  for (const s of SECTORS) {
    for (const f of [0.35, 0.65]) {
      const t = s.a0 + s.span * f;
      const [x, z] = at(LAWN_INNER + 0.9, t);
      if (onRoute(x, z, 0.8) || blocked(x, z, 0.8) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.0)) continue;
      add('bush', x, LAWN_TOP + 0.25, z, 1.4, 0.5, 1.0, k++ % 3 ? 'shrubLight' : 'shrub', C);
    }
  }
  return { parts: out, trees, palms };
}
