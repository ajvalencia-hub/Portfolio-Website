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
// lanterns between the benches. The art museum (plan/museum.js) now stands on the park's
// whole south side, out to the boundary on three sides, so the sector lawns and their edge
// beds stop at its north face; café seating stays in the furnishing zones beside the podium
// arcade and the office walk.
import { RES, GLAZE, D2R, circlePlan, rayRadius, insidePlan, partsKit, polarRadius } from './core.js';
import { placeTrees } from './planting.js';
import { PLAZA_R, LAWN_TOP, FOUNTAIN_CENTRE, SURFACE, onRoute, inFurnishing, plazaCorridor, TUCK_UNDER, tuckToPaving } from './pedestrian.js';
import { museumHolds } from './museum.js';

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
  // The hotel's plaza frontage. The Deco tower stands 2.4 m proud of the wing, so a single
  // line 1 m off the wing's face at z = -7.6 ran the lawn and its beds under the tower and
  // across the guest entrance. The edge now follows the tower's curved plaza corner 1 m
  // clear, then steps back for the entrance forecourt, which is paved rather than planted.
  [5.4, -7.6],      // down the hotel's west corner
  [8.0, -5.5],      // round the tower's curved plaza corner
  [11.0, -4.2],     // 1 m clear of the tower's plaza face
  [11.0, -1.4],     // clear of the guest entrance forecourt under the marquee: between the
  [18.9, -1.4],     // forecourt and the promenade there is paving, not park
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

// Palms mark the axes and the mouths only — they are not the shade strategy. They stand just
// outside the paved ring; crowns are reserved before trees. [x, z, height] — a pair flanking
// each of the four plaza mouths, heights set by hand so the group reads as a planted marker
// rather than a row of identical sticks. The museum's passage carries its own two pairs.
const PALM_SPOTS = [
  [4.8, 6.2, 11.5], [4.8, -4.2, 13.0],        // east mouth (promenade to the hotel)
  [-20.8, 6.2, 12.4], [-20.8, -4.2, 10.6],    // west mouth (promenade to the condo portal)
  [-2.8, -11.8, 10.8], [-13.2, -11.8, 12.8],  // north mouth (spine to the paseo)
  // Two pairs have gone, both to the art museum. The park gate's pair stood at z = 50.2, which
  // is inside the building now that it runs out to the park's south frontage; the palms at the
  // south mouth of its passage (plan/museum.js) mark the gate instead. The plaza's own south
  // mouth had a pair at z = 13.4, and the museum's curved north face now stands 1.4 m off the
  // plaza's paving ring there, so there is no ground left to plant: that mouth is marked by
  // the 9 m passage portal itself, lit soffit and all, rather than by palms.
];

// The park's shade. Broad-canopy trees are placed deliberately rather than scattered, and
// `lite` trees are the ones the mobile tier drops.
//
// The park used to hold a shaded garden room west of the spine and one open 22 × 18 m lawn
// east of it. The art museum was built on that lawn, grown out to the park's west, east and
// south boundaries, and finally curved round the fountain plaza on the north, so the whole of
// the park's south half is the building. What is left to plant is the ground north and either
// side of the plaza — the two sector lawns above the promenade, and the two wedges between the
// plaza's east and west mouths and the museum's north corners. The museum's own south frontage
// strip is planted in plan/grounds.js, like the condo's and the office's.
const PARK_TREES = [
  // the east wedge between the plaza's east mouth and the museum's north-east corner — the
  // one piece of the park's south half with ground left for canopy trees
  { x: 10.0, z: 7.2, kind: 'broad', r: 2.0 },
  { x: 14.5, z: 7.0, kind: 'round', r: 1.7, flower: true },   // the park's flowering accent on both tiers
  // north-west, the paseo's south end
  { x: -20.6, z: -10.6, kind: 'spread', r: 2.7 },
  // north-east, between the plaza and the hotel's west end
  { x: 3.2, z: -10.2, kind: 'broad', r: 2.0 },
];

// planting beds along the outer edge of each lawn sector, clear of the link corridors
const BED_TOP = 0.34;
const BED_POLYS = SECTORS.map((s) => {
  const cA = (r) => Math.asin(Math.min(0.95, (s.c0 + 0.3) / r)), cB = (r) => Math.asin(Math.min(0.95, (s.c1 + 0.3) / r));
  const outer = (t) => boundaryR(t) - 0.45, inner = (t) => Math.max(LAWN_INNER + 1.4, boundaryR(t) - 2.4);
  let tA = s.a0 + cA(boundaryR(s.a0 + 0.3)), tB = s.a1 - cB(boundaryR(s.a1 - 0.3));
  if (tB - tA < 0.2 || boundaryR(s.mid) < LAWN_INNER + 2.4) return null;
  // The art museum stands on the park's whole south half — out to the boundary on its west,
  // east and south sides, and curved round the plaza on the north — so each sector's edge bed
  // is cut back to the longest stretch of boundary that is still open ground. The shrubs
  // themselves are already kept out of buildings, but the 0.34 m planter they stand in is not,
  // and it would otherwise run on under the glass. The same goes for the café terraces on the
  // park's edge (the office coffee bar stands on it beside the museum): the bed stops where the
  // terrace's paving begins rather than running on across it and under its umbrellas.
  const onOpenGround = (t) => ![outer(t), inner(t)].some((r) => museumHolds(...at(r, t), 0.5))
    && ![outer(t) + 0.3, (outer(t) + inner(t)) / 2, inner(t) - 0.3].some((r) => inFurnishing(...at(r, t), 0.3));
  let best = null, run = null;
  for (let i = 0; i <= 64; i++) {
    const t = tA + ((tB - tA) * i) / 64;
    if (onOpenGround(t)) { run = run || { a: t, b: t }; run.b = t; }
    else { if (run && (!best || run.b - run.a > best.b - best.a)) best = run; run = null; }
  }
  if (run && (!best || run.b - run.a > best.b - best.a)) best = run;
  if (!best || best.b - best.a < 0.2) return null;
  [tA, tB] = [best.a, best.b];
  const tMid = (tA + tB) / 2;
  const n = 18;
  const ts = Array.from({ length: n + 1 }, (_, i) => tA + ((tB - tA) * i) / n)
    .map((t) => Math.min(Math.max(t, s.a0 + cA(outer(t))), s.a1 - cB(outer(t))));
  const pts = [...ts.map((t) => at(outer(t), t)), ...ts.slice().reverse().map((t) => at(inner(t), t))];
  const width = (t) => outer(t) - inner(t);
  if (width(tMid) < 0.9) return null;
  return {
    pts,
    stations: (step) => {
      const out = [];
      for (const [row, f] of [[0, 0.3], [1, 0.72]]) {
        const rMid = (t) => inner(t) + width(t) * f;
        const arc = (tB - tA) * rMid(tMid);
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
  const shrubAt = (x, z, k, big, bed) => {
    const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
    const c = colors[(k + Math.floor(rand() * 2)) % colors.length];
    let sz = (big ? 1.3 : 1.0) + rand() * 0.4;
    const h = (big ? 1.2 : 0.8) + rand() * 0.5;
    // The crown stays inside its own bed. A shrub whose spread would hang over the edge is slid
    // across the bed — the beds run round the fountain, so across is toward or away from it —
    // and, at a bed's tapering end, back along it, until it sits inside; only if no position
    // fits is it taken down a size, and it is left out only if even the smallest cannot fit.
    const inBed = (cx, cz, w) => Array.from({ length: 8 }, (_, i) => [cx + Math.cos(i * Math.PI / 4) * w / 2, cz + Math.sin(i * Math.PI / 4) * w / 2])
      .every(([px, pz]) => insidePlan(px, pz, bed.pts));
    const rl = Math.hypot(x - FOUNTAIN_CENTRE[0], z - FOUNTAIN_CENTRE[1]) || 1;
    const ux = (x - FOUNTAIN_CENTRE[0]) / rl, uz = (z - FOUNTAIN_CENTRE[1]) / rl;
    const shifts = [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.4, 0.4, -0.5, 0.5];
    // near a tapering end of a bed, it may also step back along the bed, away from the tip
    const along = [0, 0.4, -0.4, 0.8, -0.8];
    let spot = null;
    for (const w of [sz, 1.0, 0.8, 0.65].filter((v, i) => i === 0 || v < sz)) {
      for (const t of along) {
        const o = shifts.find((d) => inBed(x + ux * d - uz * t, z + uz * d + ux * t, w));
        if (o !== undefined) { spot = [x + ux * o - uz * t, z + uz * o + ux * t]; sz = w; break; }
      }
      if (spot) break;
    }
    if (!spot) return;
    [x, z] = spot;
    if (onRoute(x, z, sz / 2)) return;          // its whole spread stays off the walk beside the bed
    add('bush', x, BED_TOP + h / 2, z, sz, h, sz, c, C);
  };
  let k = 0;
  for (const bed of BED_POLYS) {
    for (const [x, z, row] of bed.stations(full ? 1.25 : 2.5)) {
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.9) || palms.some((q) => Math.hypot(q.x - x, q.z - z) < 0.8) || onRoute(x, z, 0.6) || inFurnishing(x, z, 0.9) || blocked(x, z, 0.5)) continue;
      shrubAt(x, z, k++, row === 0, bed);
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
