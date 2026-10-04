// X — the park's art museum: a terraced glass building astride the spine, with rounded
// corners, a single-storey apron curving round the fountain plaza, a stepped street elevation
// carrying a cascade, a circular stair to the roof and a roof garden.
//
// The brief was to put a cultural building on the park's open lawn without closing the
// north–south walk that crosses it. So the building is split at the ground: two glazed
// volumes stand either side of the spine, and the two upper floors bridge across between
// them, leaving the walk running through an open, shaded passage under the building. The
// spine keeps its line, its width and its clear zone; nothing stands in it.
//
// Language: seamless floor-to-ceiling glass on flush silicone joints, white concrete floor
// slabs expressed as bands at every level, slim columns at grade, plain parapets, warm
// gallery light inside, and every corner rounded on MUSEUM.corner — the plans are drawn with
// the same soft corner the towers and the hotel use, so nothing on the block is a sharp box.
//
// The section is the building. It steps twice on the street side and once on the plaza side:
//
//                                roof garden 14.35
//                    ┌──────────────────────────┐
//          terrace ┌─┘                          │
//    apron ────────┘                            │ 9.66 / 4.95
//   basin ─┘                                    │
//    (north — the plaza)              (south — the street: flush, no steps, no water)
//
// Everything the section does, it does toward the park. The third floor steps back from the
// second and the second from the apron, and two cascades come down those steps — one on each
// wing, either side of the passage, both facing the fountain. Each is three falls of about
// 4.5 m: a pool on the roof garden spills through a spout in the parapet, lands in a pool on
// the terrace below, spills again onto the apron's roof, and falls a third time into a basin
// at grade. Where the apron's edge is the arc (the west wing) that last pool, spout, sheet and
// basin are set on the arc's tangent; where it is the straight cap (the east wing) they sit on
// the building's own grid. The street elevation is a flush three-storey wall of glass meeting
// the frontage garden, with nothing stepped and no water on it.
//
// On the north the ground floor's face is an arc concentric with the fountain, ARC_CLEAR m
// outside the paved ring, so the two corners either side of the spine are filled and the
// plaza reads as a round room with the museum's glass wrapped round its south half. Only that
// one storey comes out: the bar behind it stays at MUSEUM.zb, because the hero camera has the
// museum between it and the plaza and a ray from the fountain clears a 5 m apron but not a
// 15 m wall.
//
// CONCEPTUAL MASSING ONLY. Structure (especially the two-storey bridge and its transfer),
// stability, fire separation and egress, glazing support, thermal and solar performance,
// accessibility, gallery environmental control and daylight on art are all out of scope. So
// is everything the water needs — tanks, pumps, filtration, wind carry, freeze and splash
// control, waterproofing and the roof garden's soil depth, drainage and irrigation.
import { GLAZE, roundedRectPlan, circlePlan, rect as rectPlan, box, partsKit, clipBand, insidePlan, offsetPlan } from './core.js';
import { WALK_TOP, PLAZA_R, FOUNTAIN_CENTRE, onRoute, pavedAt, inFurnishing } from './pedestrian.js';
import { fixtureKit } from './fixtures.js';
import { crescentOutline } from './pools.js';

// how far outside the plaza's paved ring the apron's curved north face stands
const ARC_CLEAR = 1.4;
// the radius the arc-to-cap shoulder is rounded over, on the apron's two north corners
const SHOULDER = 1.2;

// The spine runs north–south at x = -8 as a 4.5 m primary route, so its clear zone is
// x -10.25 to -5.75. The passage is set wider than that at both sides.
export const MUSEUM = {
  x0: -21.8, x1: 16.6,         // 38.4 m: the park's west boundary to the office coffee-bar terrace
  zn: 11.0,                    // the apron's north edge where the arc is capped, on the flanks
  zb: 18.5,                    // the second floor's north face — the park-side lower step
  z3n: 21.7,                   // the third floor's north face  — the park-side upper step
  z1: 50.6,                    // the south face: flush, all three storeys, on the frontage
  arcR: PLAZA_R + ARC_CLEAR,   // the apron's north face: an arc concentric with the fountain
  gapW: -12.5, gapE: -3.5,     // the open passage: 9 m — it runs the building's whole depth
  ground: 4.6,                 // clear height under the bridge, and the apron's storey
  slab: 0.45,                  // expressed floor plate
  floor: 4.2,                  // gallery floors
  parapet: 0.9,
  corner: 2.4,                 // every plan corner is rounded on this radius
  colR: 0.13, colPitch: 5.2,   // slim columns carrying the bridge
  // The vertical core, in the east wing: a glazed drum with one helical flight per storey,
  // and a compact lift beside it. `turns` is how far a flight rotates between landings, so
  // each one arrives at the same bearing as the landing it leaves — the flights are solved
  // per storey rather than run as one endless helix that misses the floors.
  stair: { x: 10.5, z: 36.0, r: 2.35, rise: 0.185, turns: 1.75, land: Math.PI },
  lift: { x: 10.5, z: 31.3, w: 2.5, d: 2.6 },
  core: 2.6,                   // stair head and lift overrun, both this far above the roof deck
  // the two cascades, both on the park elevation facing the fountain: one on each wing, set
  // on the middle of its own face. The street elevation is flush and carries no water.
  fallW: { x: -16.0, w: 5.0 },
  fallE: { x: 6.0, w: 7.6 },   // the east wing is the larger one, and carries the larger cascade
};
const M = MUSEUM;
const F = FOUNTAIN_CENTRE;
export const MUSEUM_L2 = M.ground + M.slab;                    //  5.05
export const MUSEUM_L3 = MUSEUM_L2 + M.floor + M.slab;         //  9.70
export const MUSEUM_ROOF = MUSEUM_L3 + M.floor;                // 13.90
export const MUSEUM_TOP = MUSEUM_ROOF + M.slab + M.parapet;    // 15.25 — three storeys, no tower
// the three walkable decks, top of finish: the ground floor's roof (the apron on the plaza
// side, the first terrace on the street side), the second floor's roof, and the roof garden
export const MUSEUM_DECK1 = M.ground + 0.35;                   //  4.95
export const MUSEUM_DECK2 = MUSEUM_L3 - 0.04;                  //  9.66
export const MUSEUM_DECK3 = MUSEUM_ROOF + M.slab;              // 14.35
// The stair head and the lift overrun top out together at one height above the roof garden,
// so the core reads as a single object rather than as two boxes of different heights. This is
// the building's true high point; MUSEUM_TOP above is the parapet line the massing is judged on.
export const MUSEUM_CORE_TOP = MUSEUM_DECK3 + M.core;          // 16.95

// The apron's north edge as a function of x: the arc about the fountain where the arc is south
// of the cap, the cap where it is not. `grow` moves the edge north (a positive figure enlarges
// the building), which is what the clash tests want; the plan builders pass the negative of an
// inset, so a face set 0.3 m in from the plan line reads as an arc 0.3 m larger in radius.
export function museumNorthAt(x, grow = 0) {
  const d = (M.arcR - grow) ** 2 - (x - F[0]) ** 2;
  const arc = d > 0 ? F[1] + Math.sqrt(d) : -Infinity;
  const cap = M.zn - grow;
  // A smooth maximum rather than a hard one: the arc meets the cap at 53°, and left as a
  // corner that shoulder is a crease in the glass. This rounds it over SHOULDER metres and is
  // exact everywhere else, so the arc stays truly concentric where it faces the plaza.
  if (!(arc > -Infinity)) return cap;
  const h = Math.min(1, Math.max(0, 0.5 + (arc - cap) / (2 * SHOULDER)));
  return arc * h + cap * (1 - h) + SHOULDER * h * (1 - h);
}
// does the building hold this point at grade? `pad` grows it in every direction
export const museumHolds = (x, z, pad = 0) => x > M.x0 - pad && x < M.x1 + pad
  && z < M.z1 + pad && z > museumNorthAt(x, pad);
// the same at grade, where the passage runs through and the building is in two pieces
export const museumGradeHolds = (x, z, pad = 0) => museumHolds(x, z, pad)
  && (x < M.gapW + pad || x > M.gapE - pad);
// and the two gallery floors, each stepped back from the one below on the street side
export const museumL2Holds = (x, z, pad = 0) => x > M.x0 - pad && x < M.x1 + pad && z > M.zb - pad && z < M.z1 + pad;
export const museumL3Holds = (x, z, pad = 0) => x > M.x0 - pad && x < M.x1 + pad && z > M.z3n - pad && z < M.z1 + pad;

// A ground-floor plan between two x values, inset by `inset` on every side (a negative inset
// expands it). The north edge is sampled along the arc; all four corners are rounded on
// MUSEUM.corner, and the winding matches core.roundedRectPlan so the walls face outward.
const NORTH_SEG = 56;
function gradePlan(xa, xb, inset = 0) {
  const a = xa + inset, b = xb - inset, z1 = M.z1 - inset;
  const r = Math.min(M.corner, (b - a) / 2 - 0.05);
  const quarter = (cx, cz, a0) => Array.from({ length: 7 }, (_, k) => {
    const t = a0 + (k / 6) * (Math.PI / 2);
    return [cx + Math.cos(t) * r, cz + Math.sin(t) * r];
  });
  const pts = [...quarter(a + r, museumNorthAt(a + r, -inset) + r, Math.PI)];   // north-west
  for (let i = 1; i < NORTH_SEG; i++) {
    const x = a + r + ((b - r - (a + r)) * i) / NORTH_SEG;
    pts.push([x, museumNorthAt(x, -inset)]);
  }
  pts.push(...quarter(b - r, museumNorthAt(b - r, -inset) + r, -Math.PI / 2));  // north-east
  pts.push(...quarter(b - r, z1 - r, 0));                                       // south-east
  pts.push(...quarter(a + r, z1 - r, Math.PI / 2));                             // south-west
  return pts;
}
// the gallery floors: rounded rectangles, each stepped back on the street side
const l2Plan = (inset = 0) => roundedRectPlan(M.x0 + inset, M.zb + inset, M.x1 - inset, M.z1 - inset, M.corner);
const l3Plan = (inset = 0) => roundedRectPlan(M.x0 + inset, M.z3n + inset, M.x1 - inset, M.z1 - inset, M.corner);

// The parapet's outer path. It follows the third floor's plan except at the two cascade bays,
// where it dips in to meet its own inner face: the ring has all but no thickness there, so the
// parapet reads as notched and the water leaves over an open lip rather than through a wall.
// The plan constants below stay the clean outlines — this path is the parapet's alone.
function parapetPaths() {
  const dip = M.z3n + 0.36, back = M.z3n + 0.4;
  const bays = [M.fallW, M.fallE].map((W) => [W.x - W.w / 2 - 0.2, W.x + W.w / 2 + 0.2]).sort((a, b) => a[0] - b[0]);
  const outRun = [], inRun = [];
  for (const [a, b] of bays) {
    for (const [x, z] of [[a - 0.15, M.z3n + PLATE_EDGE], [a, dip], [b, dip], [b + 0.15, M.z3n + PLATE_EDGE]]) {
      outRun.push([x, z]);
      inRun.push([x, back]);     // the ring pairs its two paths point for point
    }
  }
  return { outer: [...l3Plan(PLATE_EDGE), ...outRun], inner: [...l3Plan(0.4), ...inRun] };
}

// The stair head: a curved glass wall round the drum with a doorway left open on the landing
// bearing. It is drawn as a thin crescent — out along the outside face, back along the inside —
// so the two ends of the wall are the door jambs.
const HEAD_GAP = 0.42;   // half-angle of the opening, radians
function stairHeadPlan() {
  const S2 = M.stair, n = 18;
  const a0 = S2.land + HEAD_GAP, a1 = S2.land - HEAD_GAP + Math.PI * 2;
  const arc = (r, from, to) => Array.from({ length: n + 1 }, (_, k) => {
    const a = from + ((to - from) * k) / n;
    return [S2.x + Math.cos(a) * r, S2.z + Math.sin(a) * r];
  });
  return [...arc(S2.r, a0, a1), ...arc(S2.r - 0.1, a1, a0)];
}

// The lift head: the same idea as the stair's, squared. A thin glass wall round three sides of
// the shaft with the fourth left open on the west face — the side the stair's doorway faces —
// so both heads on the roof are open the same way and read as a pair.
const LIFT_GAP = 0.72;   // half-width of the opening
function liftHeadPlan() {
  const L2 = M.lift, t = 0.1;
  const x0 = L2.x - L2.w / 2, x1 = L2.x + L2.w / 2, z0 = L2.z - L2.d / 2, z1 = L2.z + L2.d / 2;
  // wound the same way round as every other plan in the model, so the wall faces outward
  return [
    [x0, L2.z + LIFT_GAP], [x0, z1], [x1, z1], [x1, z0], [x0, z0], [x0, L2.z - LIFT_GAP],
    [x0 + t, L2.z - LIFT_GAP], [x0 + t, z0 + t], [x1 - t, z0 + t], [x1 - t, z1 - t], [x0 + t, z1 - t], [x0 + t, L2.z + LIFT_GAP],
  ].reverse();
}

export const MUSEUM_PLAN = gradePlan(M.x0, M.x1);
export const MUSEUM_L2_PLAN = l2Plan();
export const MUSEUM_L3_PLAN = l3Plan();
export const MUSEUM_GROUND_W = gradePlan(M.x0, M.gapW);
export const MUSEUM_GROUND_E = gradePlan(M.gapE, M.x1);
// what planting, furniture and cars must stay out of — the passage is deliberately not here
export const MUSEUM_FOOTPRINTS = [MUSEUM_GROUND_W, MUSEUM_GROUND_E];
export const MUSEUM_RECT = [M.x0, M.x1, M.zn, M.z1];
export const MUSEUM_BAR_PLAN = MUSEUM_L2_PLAN;
// the deepest point of the curved north face (on the spine): anything laid out as a straight
// line across the ground floor has to start south of this to stay inside the glass
export const MUSEUM_ZI = F[1] + M.arcR;
// the public entrance, on the passage, level with the spine junction that serves it:
// plan/pedestrian.js carries the matching door node and entry forecourt
export const MUSEUM_DOOR = [M.gapE, 32.25];

// The garden's reflecting pool, beside the principal sculpture clearing.
// The curtain wall's pane width: each pane runs floor to ceiling and meets the next at a flush
// silicone joint, so the glass reads as one sheet. Twice the earlier 1.55 m bay.
export const MUSEUM_PANE = 3.1;
// Every floor plate, slab band and the roof parapet stop flush with the glass: their outer face
// stands 15 mm proud of the glass line (which is 0.30 m in from the plan line), enough that the
// two faces never share a plane, so the elevation reads as uninterrupted glass with the floors
// seen as thin lines at its face rather than as white ledges projecting from it.
export const PLATE_EDGE = 0.285;

export const MUSEUM_REFLECT = [-13.4, -8.4, 37.0, 39.4];
// the corner the pools are drawn on, a little tighter than the building's own so the coping
// reads as a rim round the water rather than as a second version of the plan
const POOL_R = 0.8;

// A pool's outline at an inset from its rectangle: a rounded rectangle with a fixed number of
// segments on every corner (roundedRectPlan's count follows the radius, and at under a metre it
// drops to a chamfer), wound the same way, so two insets of one pool pair vertex for vertex.
function poolPlan([x0, x1, z0, z1], inset) {
  const r = Math.min(POOL_R + 0.12, Math.min(x1 - x0, z1 - z0) / 2 - 0.05) - inset;
  const a = x0 + inset, b = x1 - inset, c = z0 + inset, d = z1 - inset;
  const pts = [];
  for (const [cx, cz, a0] of [[b - r, c + r, -Math.PI / 2], [b - r, d - r, 0], [a + r, d - r, Math.PI / 2], [a + r, c + r, Math.PI]]) {
    for (let k = 0; k <= 5; k++) {
      const t = a0 + (k / 5) * (Math.PI / 2);
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
  }
  return pts;
}
// the pools a plate carries, as openings cut through it (the water sits in the slab, not on it)
const poolHoles = (deck, keep = () => true) => museumPools()
  .filter(([x0, x1, , , y]) => Math.abs(y - deck) < 0.01 && keep((x0 + x1) / 2))
  .map((q) => poolPlan(q, 0.06));

// The still water of the museum, in one place: three basins per cascade and the reflecting pool
// on the roof. museumWater() draws each one's rim, tile band and water; the parts only lay the
// pale bottom under it.
export function museumPoolsOf(W) {
  const bay = [W.x - W.w / 2, W.x + W.w / 2];
  const rill = W.w * 0.36;
  const zPool = Math.max(...[bay[0], W.x, bay[1]].map((x) => museumNorthAt(x, -PLATE_EDGE))) + 0.15;
  return [
    [bay[0], bay[1], 22.2, 26.8, MUSEUM_DECK3],     // on the roof garden
    [bay[0], bay[1], 18.85, 21.5, MUSEUM_DECK2],    // on the park terrace
    [W.x - rill, W.x + rill, zPool, 18.2, MUSEUM_DECK1],   // the rill on the apron's roof
  ];
}
export const museumPools = () => [
  ...museumPoolsOf(M.fallW), ...museumPoolsOf(M.fallE),
  [MUSEUM_REFLECT[0], MUSEUM_REFLECT[1], MUSEUM_REFLECT[2], MUSEUM_REFLECT[3], MUSEUM_DECK3],
];

// The last drop of each cascade crosses the apron's own edge, which is the arc on the west wing
// and the straight cap on the east, so its spout, sheet and moat are built on a frame taken from
// that edge: the tangent where it curves, the building's own axis where it does not.
function spoutFrame(WB) {
  const edge = museumNorthAt(WB.x, 0.25);
  const onArc = edge > M.zn - 0.24;
  const dx = WB.x - F[0], dz = edge - F[1], R = Math.hypot(dx, dz);
  const out = onArc ? [-dx / R, -dz / R] : [0, -1];       // the way the water leaves
  const ang = Math.atan2(out[0], -out[1]);                // along the lip, across the flow
  const at = (d) => [WB.x + out[0] * d, edge + out[1] * d];
  return { edge, onArc, out, ang, at, WB };
}
// a box's footprint turned to angle `a` (its length runs along a), as a plan outline
// the spout on the apron's edge: a lip from just inside the flush plate edge to 0.2 m past it
// (measured on spoutFrame's line), with the falling sheet hanging just clear of its tip
const SPOUT = { at: -0.35, depth: 1.1, sheet: 0.27 };
function orientedRect(cx, cz, len, w, a) {
  const c = Math.cos(a), sn = Math.sin(a), l = len / 2, h = w / 2;
  return [[-l, -h], [l, -h], [l, h], [-l, h]].map(([u, v]) => [cx + u * c - v * sn, cz + u * sn + v * c]);
}
const boundsOf = (pts, pad = 0) => [
  Math.min(...pts.map((q) => q[0])) - pad, Math.max(...pts.map((q) => q[0])) + pad,
  Math.min(...pts.map((q) => q[1])) - pad, Math.max(...pts.map((q) => q[1])) + pad,
];

// The receiving basins at grade, one at the foot of each cascade. Each is a pool like the
// others on the building — a pale stone rim, a dark waterline tile band, the water 120 mm under
// the rim — drawn to the edge it sits against: on the west wing a band concentric with the
// fountain, following the apron's curve between the glass and the plaza's paving; on the east
// wing a rounded-end basin along the straight cap. Both stand 0.2 m in front of the glass and
// clear of every walk, the plaza and the passage, and both are sized off their cascade's width,
// so the east basin, under the larger fall, is the larger. `outline(inset)` returns the plan at
// an inset from the rim's outer edge, every inset with the same vertex count so the rim and the
// tile band can be built as rings between two of them.
const MOAT = { rim: 0.2, tile: 0.1, clearGlass: 0.2, clearPlaza: 0.3, width: 1.2 };
export function museumMoatBasins() {
  return [M.fallW, M.fallE].map((WB) => {
    const fr = spoutFrame(WB);
    const len = WB.w * 1.2;
    let outline, mid;
    if (fr.onArc) {
      const rOut = M.arcR + 0.3 - MOAT.clearGlass;                 // the glass stands on arcR + 0.3
      const rIn = Math.max(PLAZA_R + MOAT.clearPlaza, rOut - MOAT.width);
      const a = Math.atan2(fr.edge - F[1], WB.x - F[0]);
      const half = (len / 2) / ((rOut + rIn) / 2);
      // Where the arc runs into the wing's rounded corner by the passage, the glass swings out
      // ahead of the true curve; each end of the band is drawn back until the whole rim stands
      // clear of the glass by the same margin as everywhere else.
      const keep = offsetPlan(gradePlan(M.x0, M.gapW, 0.3), MOAT.clearGlass - 0.02);
      const clear = (a0, a1) => crescentOutline(F[0], F[1], rIn, rOut, a0, a1).every(([x, z]) => !insidePlan(x, z, keep));
      let a0 = a - half, a1 = a + half;
      while (!clear(a0, a1) && a1 - a > 0.05) {
        if (!clear(a, a1)) a1 -= 0.005;
        if (!clear(a0, a)) a0 += 0.005;
      }
      outline = (i) => crescentOutline(F[0], F[1], rIn + i, rOut - i, a0, a1);
      mid = [F[0] + Math.cos(a) * (rOut + rIn) / 2, F[1] + Math.sin(a) * (rOut + rIn) / 2];
    } else {
      const zS = museumNorthAt(WB.x, -0.3) - MOAT.clearGlass, zN = zS - MOAT.width;
      const rect = [WB.x - len / 2, WB.x + len / 2, zN, zS];
      outline = (i) => poolPlan(rect, i);
      mid = [WB.x, (zN + zS) / 2];
    }
    return { WB, fr, outline, mid, water: outline(MOAT.rim + MOAT.tile - 0.02) };
  });
}

// The two roofs the section steps down to — the apron over the ground floor, the terrace over
// the second — are planted edge to edge: lawn over everything that is not a pool, a weir, a
// spout or the splash under a fall, and shrubs and grasses in it. The turf stops 150 mm inside
// the edge of the plate it sits on and 50 mm short of the storey above's slab band, and its
// outline follows the rounded corner of the storey above rather than stopping square. Each
// roof is cut into strips at every keep-out edge, so the lawn is exact rather than a grid of
// squares, and the pools' rounded corners are filled back in so the turf wraps the coping.
let LOWER = null;
export function museumLowerRoofs() {
  if (LOWER) return LOWER;
  const shrink = ([x0, x1, z0, z1]) => [x0 + 0.03, x1 - 0.03, z0 + 0.03, z1 - 0.03];
  // the space outside the rounded corner of the storey above, between it and the roof's side
  const nook = (a, side, faceZ) => {
    const k0 = PLATE_EDGE + M.corner;                     // the band's rounded corner, 50 mm clear
    const cx = side < 0 ? M.x0 + k0 : M.x1 - k0, cz = faceZ + k0, R = M.corner + 0.05;
    const cosT = (a - cx) / R;
    if (Math.abs(cosT) >= 1) return null;
    const tEnd = side < 0 ? Math.PI + Math.acos(-cosT) : 2 * Math.PI - Math.acos(cosT);
    const pts = [[a, cz - R]];
    for (let k = 0; k <= 8; k++) {
      const t = 1.5 * Math.PI + (tEnd - 1.5 * Math.PI) * (k / 8);
      pts.push([cx + Math.cos(t) * R, cz + Math.sin(t) * R]);
    }
    return pts;
  };
  const strips = (poly, zCut, keeps) => {
    const xs = [...new Set([-1e4, 1e4, ...keeps.flatMap((k) => [k[0], k[1]])])].sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1];
      if (xb - xa < 0.04) continue;
      const band = clipBand(poly, 0, xa, xb);
      if (band.length < 3) continue;
      const mid = (xa + xb) / 2;
      const held = keeps.filter((k) => k[0] < mid && k[1] > mid).map((k) => [k[2], k[3]]).sort((a, b) => a[0] - b[0]);
      let z = -1e4;
      for (const [b0, b1] of [...held, [zCut, 1e4]]) {
        const top = Math.min(b0, zCut);
        if (top > z + 0.04) {
          const piece = clipBand(band, 1, z, top);
          if (piece.length >= 3) parts.push({ pts: piece });
        }
        z = Math.max(z, b1);
        if (z >= zCut) break;
      }
    }
    return parts;
  };
  const level = (deck, polys, zCut, faceZ, sides, pools, extra) => {
    const keeps = [...pools.map(shrink), ...extra];
    const parts = polys.flatMap((poly) => strips(poly, zCut, keeps));
    for (const [side, a] of sides) { const n = nook(a, side, faceZ); if (n) parts.push({ pts: n }); }
    // the pools' rounded corners: the quarter between the rectangle and the coping's curve
    for (const q of pools) {
      const [a, b, c, d] = shrink(q);
      const ring = poolPlan(q, 0.03);
      [[b, c], [b, d], [a, d], [a, c]].forEach(([x, z], k) => {
        const clear = polys.some((poly) => insidePlan(x, z, poly)) && z < zCut
          && !extra.some((e) => x > e[0] && x < e[1] && z > e[2] && z < e[3]);
        if (clear) parts.push({ pts: [[x, z], ...ring.slice(k * 6, k * 6 + 6)] });
      });
    }
    return { deck, parts, keeps, pools, zCut };
  };
  const wings = [M.fallW, M.fallE];
  const L1pools = museumPools().filter(([, , , , y]) => Math.abs(y - MUSEUM_DECK1) < 0.01);
  const L2pools = museumPools().filter(([, , , , y]) => Math.abs(y - MUSEUM_DECK2) < 0.01);
  const lin = PLATE_EDGE + 0.15;
  // the splash where a fall from the storey above lands, which the turf leaves to the water
  const splash = (zSheet) => wings.map((WB) => [WB.x - WB.w * 0.186 - 0.05, WB.x + WB.w * 0.186 + 0.05, zSheet - 0.6, zSheet + 0.68]);
  LOWER = [
    level(MUSEUM_DECK1, [gradePlan(M.x0, M.gapW, lin), gradePlan(M.gapE, M.x1, lin)], M.zb + PLATE_EDGE - 0.05, M.zb,
      [[-1, M.x0 + lin], [1, M.x1 - lin]], L1pools,
      // the spout lip where each rill leaves the apron, and the splash of the fall onto it
      [...wings.map((WB) => { const fr = spoutFrame(WB); const c = fr.at(SPOUT.at); return boundsOf(orientedRect(c[0], c[1], WB.w * 0.35, SPOUT.depth, fr.ang), 0.08); }), ...splash(17.90)]),
    level(MUSEUM_DECK2, [l2Plan(lin)], M.z3n + PLATE_EDGE - 0.05, M.z3n,
      [[-1, M.x0 + lin], [1, M.x1 - lin]], L2pools,
      // the weir over the park step, and the splash of the fall from the roof
      [...wings.map((WB) => [WB.x - WB.w * 0.175 - 0.05, WB.x + WB.w * 0.175 + 0.05, -1e4, 19.05]), ...splash(21.02)]),
  ];
  return LOWER;
}
// is (x, z) on the lawn of one of the lower roofs?
export const onLowerLawn = (lv, x, z) => lv.parts.some((q) => insidePlan(x, z, q.pts));

// a slab band at a level: the plate's edge, flush with the glass (PLATE_EDGE). It is
// set 20 mm below the storey it belongs to so it laps into the volume beneath instead of
// meeting its top face in the same plane.
const slabBand = (plan) => ({
  kind: 'slab',
  floors: [{ y: -(M.slab + 0.02), thick: M.slab, outer: plan(PLATE_EDGE), inner: plan(PLATE_EDGE + 0.6) }],
});

export function museumMasses() {
  // GLAZE.museum is the model's one see-through envelope: seamless floor-to-ceiling panes on
  // a 3.1 m module, meeting at flush silicone joints with no frame, spandrel or transom
  const glass = { kind: 'glass', glaze: GLAZE.museum, module: [MUSEUM_PANE, 1.0], parent: null, wire: false, ribs: 10 };
  // The main volumes rise in the construction drawing like every other building on the block:
  // ribs up the glass and a ring at each floor, cleared away once the model is built.
  const rising = (floorH, ribs) => ({ wire: true, floorH, ribs });
  // The floors and plates. Floors matter here in a way they would not in an opaque building:
  // this envelope is see-through, so without them you look through the glass at the park's grass
  // running on under the galleries. They are prisms rather than boxes because the ground plan is
  // not a rectangle. The ground floors are stone, flush with the walk outside; the gallery plates
  // are set below the expressed band they sit in, so they lap into it.
  // Floors are cut where the core passes through them: the stair drum and the lift shaft get
  // real openings in every plate they pass, so neither runs through solid slab. The stair's
  // hole is the drum's own bore; the lift's is its shaft, both with a construction margin.
  const CORE_HOLES = [
    circlePlan(M.stair.x, M.stair.z, M.stair.r - 0.12, 20),
    rectPlan(M.lift.x - M.lift.w / 2 - 0.06, M.lift.z - M.lift.d / 2 - 0.06, M.lift.x + M.lift.w / 2 + 0.06, M.lift.z + M.lift.d / 2 + 0.06),
  ];
  const plate = (name, kind, y0, h, pts, start, holes) => ({
    name, kind, type: 'prism', glaze: GLAZE.none, module: [1.6, 1.6], parent: null, wire: false, y0, h, pts, start, dur: 0.012, holes,
  });
  return [
    // ground: two volumes, one either side of the walk, each carried out to the plaza's curve
    { ...glass, ...rising(M.ground, 12), name: 'X.groundW', type: 'prism', y0: 0, h: M.ground, start: 0.340, dur: 0.052, pts: gradePlan(M.x0, M.gapW, 0.3) },
    { ...glass, ...rising(M.ground, 16), name: 'X.groundE', type: 'prism', y0: 0, h: M.ground, start: 0.344, dur: 0.052, pts: gradePlan(M.gapE, M.x1, 0.3), holes: CORE_HOLES },
    plate('X.floorW', 'stone', 0, WALK_TOP, gradePlan(M.x0, M.gapW, PLATE_EDGE), 0.346),
    plate('X.floorE', 'stone', 0, WALK_TOP, gradePlan(M.gapE, M.x1, PLATE_EDGE), 0.350, CORE_HOLES),
    // the ground floor's roof: the apron on the plaza side, the first terrace on the street side
    plate('X.deck1W', 'slab', MUSEUM_DECK1 - 0.5, 0.5, gradePlan(M.x0, M.gapW, PLATE_EDGE), 0.356, poolHoles(MUSEUM_DECK1, (x) => x < M.gapW)),
    plate('X.deck1E', 'slab', MUSEUM_DECK1 - 0.5, 0.5, gradePlan(M.gapE, M.x1, PLATE_EDGE), 0.360, [...CORE_HOLES, ...poolHoles(MUSEUM_DECK1, (x) => x > M.gapE)]),
    // second floor, stepped back from the ground floor on the street side
    { ...glass, ...rising(M.floor, 20), name: 'X.l2', type: 'prism', y0: MUSEUM_L2, h: M.floor, start: 0.372, dur: 0.040, pts: l2Plan(0.3), slabs: slabBand(l2Plan), holes: CORE_HOLES },
    plate('X.floor2', 'slab', MUSEUM_L2 - 0.18, 0.16, l2Plan(PLATE_EDGE), 0.374, CORE_HOLES),
    plate('X.deck2', 'slab', MUSEUM_DECK2 - 0.16, 0.16, l2Plan(PLATE_EDGE), 0.378, [...CORE_HOLES, ...poolHoles(MUSEUM_DECK2)]),
    // third floor, stepped back again
    { ...glass, ...rising(M.floor, 20), name: 'X.l3', type: 'prism', y0: MUSEUM_L3, h: M.floor, start: 0.392, dur: 0.040, pts: l3Plan(0.3), slabs: slabBand(l3Plan), holes: CORE_HOLES },
    plate('X.deck3', 'slab', MUSEUM_ROOF, M.slab, l3Plan(PLATE_EDGE), 0.410, [...CORE_HOLES, ...poolHoles(MUSEUM_DECK3)]),
    {
      name: 'X.parapet', type: 'ring', kind: 'frame', glaze: GLAZE.none, module: [1, 1], parent: null,
      y0: MUSEUM_DECK3 - 0.02, h: M.parapet + 0.02, start: 0.416, dur: 0.016, wire: false,
      pts: parapetPaths().outer, inner: parapetPaths().inner,
    },
    // The circular stair. Below the roof it is a glazed tube; above it the head is a curved
    // glass wall with a doorway cut out of it on the landing bearing, under a white plate —
    // so the exit is something you walk out of rather than a sealed cylinder with a door
    // drawn on the inside. The three pieces lap into one another so no two faces share a plane.
    { ...glass, ...rising(M.floor, 8), name: 'X.stair', type: 'prism', y0: 0, h: MUSEUM_DECK3 + 0.12, start: 0.402, dur: 0.030,
      pts: circlePlan(M.stair.x, M.stair.z, M.stair.r, 24),
      holes: [circlePlan(M.stair.x, M.stair.z, M.stair.r - 0.12, 20)] },
    { ...glass, name: 'X.stairHead', type: 'prism', y0: MUSEUM_DECK3 - 0.05, h: MUSEUM_CORE_TOP - 0.2 - (MUSEUM_DECK3 - 0.05),
      start: 0.406, dur: 0.026, pts: stairHeadPlan() },
    { name: 'X.stairCap', type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [1.6, 1.6], parent: null, wire: false,
      y0: MUSEUM_CORE_TOP - 0.3, h: 0.3, start: 0.412, dur: 0.012,
      pts: circlePlan(M.stair.x, M.stair.z, M.stair.r + 0.12, 24) },
    // The lift beside it, built the same way as the stair: a glazed shaft to the roof, then a
    // head above it that is open on the same side as the stair's doorway, under its own plate.
    // Both tops meet at MUSEUM_CORE_TOP, so the core reads as one object rather than a tower.
    { ...glass, ...rising(M.floor, 4), name: 'X.lift', type: 'prism', y0: 0, h: MUSEUM_DECK3 + 0.12, start: 0.404, dur: 0.028,
      pts: rectPlan(M.lift.x - M.lift.w / 2, M.lift.z - M.lift.d / 2, M.lift.x + M.lift.w / 2, M.lift.z + M.lift.d / 2),
      holes: [rectPlan(M.lift.x - M.lift.w / 2 + 0.12, M.lift.z - M.lift.d / 2 + 0.12, M.lift.x + M.lift.w / 2 - 0.12, M.lift.z + M.lift.d / 2 - 0.12)] },
    { ...glass, name: 'X.liftHead', type: 'prism', y0: MUSEUM_DECK3 - 0.05, h: MUSEUM_CORE_TOP - 0.2 - (MUSEUM_DECK3 - 0.05),
      start: 0.408, dur: 0.026, pts: liftHeadPlan() },
    { name: 'X.liftCap', type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [1.6, 1.6], parent: null, wire: false,
      y0: MUSEUM_CORE_TOP - 0.3, h: 0.3, start: 0.414, dur: 0.012,
      pts: rectPlan(M.lift.x - M.lift.w / 2 - 0.12, M.lift.z - M.lift.d / 2 - 0.12, M.lift.x + M.lift.w / 2 + 0.12, M.lift.z + M.lift.d / 2 + 0.12) },
    ...museumWater(),
    ...museumLawns(),
  ];
}

// the lawns on the two lower roofs, one merged mesh a level
export function museumLawns() {
  return museumLowerRoofs().map((lv, i) => ({
    name: `X.lawn${i + 1}`, type: 'prisms', kind: 'lawn', glaze: GLAZE.none, module: [1, 1], parent: null,
    wire: false, y0: lv.deck - 0.045, h: 0.1, start: 0.43, dur: 0.012, parts: lv.parts,
  }));
}

export function museumBoxes() {
  return [];
}

// The still water, built the way every other pool in the model is (plan/pools.js): the water
// in the 'pool' blue on the water glaze, 120 mm under the deck, a dark waterline tile band
// between it and the coping, and a pale coping standing 80 mm proud — so the museum's water
// is the same colour and the same surface as the resort, hotel and penthouse pools. Each pool
// is a rounded rectangle let into its plate through a rounded opening (poolHoles); the coping
// and the tile band lap over one another and over the cut, so no edge of it shows. Every pool
// on one level is merged into one prism set per material — three meshes a level.
export function museumWater() {
  const levels = [MUSEUM_DECK1, MUSEUM_DECK2, MUSEUM_DECK3];
  const ringOf = (here, i0, i1) => here.flatMap((q) => {
    const o = poolPlan(q, i0), n = poolPlan(q, i1);
    return o.map((_, k) => {
      const j = (k + 1) % o.length;
      return { pts: [o[k], o[j], n[j], n[k]], owner: `ring${q[0]}` };
    });
  });
  const specs = levels.flatMap((deck, i) => {
    const here = museumPools().filter(([, , , , y]) => Math.abs(y - deck) < 0.01);
    if (!here.length) return [];
    return [{
      name: `X.water${i}`, type: 'prisms', kind: 'pool', glaze: GLAZE.water, module: [1.4, 1.4],
      parent: null, wire: false, y0: deck - 0.32, h: 0.2, start: 0.42 + i * 0.006, dur: 0.012,
      parts: here.map((q) => ({ pts: poolPlan(q, 0.22), owner: `pool${q[0]}` })),
    }, {
      name: `X.tile${i}`, type: 'prisms', kind: 'poolTile', glaze: GLAZE.none, module: [1.4, 1.4],
      parent: null, wire: false, y0: deck - 0.34, h: 0.31, start: 0.42 + i * 0.006, dur: 0.012,
      parts: ringOf(here, 0.1, 0.24),
    }, {
      name: `X.coping${i}`, type: 'prisms', kind: 'coping', glaze: GLAZE.none, module: [1.4, 1.4],
      parent: null, wire: false, y0: deck - 0.12, h: 0.2, start: 0.42 + i * 0.006, dur: 0.012,
      parts: ringOf(here, 0, 0.12),
    }];
  });
  // and the two basins at grade, built the same way: rim, tile band and water
  const basins = museumMoatBasins();
  const ringsOf = (i0, i1) => basins.flatMap((b) => {
    const o = b.outline(i0), n = b.outline(i1);
    return o.map((_, k) => ({ pts: [o[k], o[(k + 1) % o.length], n[(k + 1) % o.length], n[k]], owner: `moat${b.WB.x}` }));
  });
  specs.push({
    name: 'X.waterMoat', type: 'prisms', kind: 'pool', glaze: GLAZE.water, module: [1.4, 1.4],
    parent: null, wire: false, y0: 0.05, h: 0.18, start: 0.44, dur: 0.012,
    parts: basins.map((b) => ({ pts: b.water, owner: `moat${b.WB.x}` })),
  }, {
    name: 'X.tileMoat', type: 'prisms', kind: 'poolTile', glaze: GLAZE.none, module: [1.4, 1.4],
    parent: null, wire: false, y0: 0.01, h: 0.31, start: 0.44, dur: 0.012,
    parts: ringsOf(MOAT.rim - 0.02, MOAT.rim + MOAT.tile),
  }, {
    name: 'X.copingMoat', type: 'prisms', kind: 'coping', glaze: GLAZE.none, module: [1.4, 1.4],
    parent: null, wire: false, y0: 0.0, h: 0.35, start: 0.44, dur: 0.012,
    parts: ringsOf(0, MOAT.rim),
  });
  return specs;
}

export function museumSlabs() {
  // The entry forecourt is an entrance zone in plan/pedestrian.js (E-MUSEUM), paved by the
  // circulation layer like every other door's, so it cannot overlap the spine's own surface.
  return [];
}

// Parts: the columns, the lit soffit over the passage, the entry canopy, the gallery fit-out
// read through the glass, the circular stair, the roof garden, the terrace planting and the
// cascade down the street elevation.
export function museumParts(tier, { onGreen = () => true } = {}) {
  const out = [];
  const K = partsKit(out);
  const { add, block, column } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';

  // --- the structure at grade --------------------------------------------------------------
  // Two rows of columns flank the passage and carry the bridge, with a matching row on each
  // outer face so the ground volumes read as glass round supports rather than as boxes.
  // They stand outside the walk's clear zone, so the crossing stays open. Each column is a
  // shaft with a spread base and a head bracket, and each row is tied by a white edge beam at
  // the underside of the second floor: the beam tells you the columns are carrying something,
  // and it sits above the passage clearance, not in it.
  // They stand just inside the glass line, so nothing projects from the flush face; the glass
  // is see-through, so the structure still reads through it.
  const colRows = [M.gapW - 0.48, M.gapE + 0.48, M.x0 + 0.48, M.x1 - 0.48];
  const colTop = M.ground + M.slab - 0.06;
  for (const x of colRows) {
    const z0 = museumNorthAt(x) + 1.2;
    for (let z = z0; z <= M.z1 - 1.0; z += M.colPitch) {
      column(x, z, 0, colTop, M.colR, 'frame');
      column(x, z, WALK_TOP - 0.02, 0.22, M.colR + 0.07, 'frame');                 // spread base
      column(x, z, colTop - 0.52, 0.5, M.colR + 0.05, 'frame');                    // head bracket
    }
    // the edge beam along the row, stopping clear of the curved north face
    block(x - 0.17, x + 0.17, M.ground + 0.02, colTop, z0 - 1.0, M.z1 - 0.7, 'frame');
  }

  // --- the passage under the bridge -----------------------------------------------------
  // The crossing is meant to read as a room you walk through, not as a gap between two
  // buildings: a dark coffered soffit, white ribs on the column grid expressing the transfer
  // that carries the bridge, a recessed light line in every coffer, and a low wash along each
  // wall. Everything is at or above the 4.6 m clear height and nothing stands in the walk.
  // North of the bar the walk runs between the two apron wings in the open, so the soffit
  // starts at the bar's own line.
  const pz0 = M.zb + 0.1;
  // the coffer field is 100 mm up inside the slab; the ribs come down to the clear height and
  // no further, so the lowest thing over the walk is still exactly M.ground
  const soff = M.ground + 0.10;
  block(M.gapW, M.gapE, soff, soff + 0.08, pz0, M.z1 - 0.1, 'charcoal', C);
  const ribs = [];
  for (let z = pz0 + 1.6; z <= M.z1 - 1.6; z += M.colPitch) ribs.push(z);
  for (const z of full ? ribs : ribs.filter((_, i) => i % 2 === 0)) {
    block(M.gapW + 0.06, M.gapE - 0.06, M.ground, M.ground + 0.26, z - 0.26, z + 0.26, 'frame', C);   // transfer rib
  }
  // one light line between each pair of ribs, straddling the face of the coffer
  for (let i = 0; i < ribs.length - 1; i++) {
    if (!full && i % 2) continue;
    const z = (ribs[i] + ribs[i + 1]) / 2;
    block(M.gapW + 0.75, M.gapE - 0.75, soff - 0.04, soff + 0.04, z - 0.13, z + 0.13, 'lamp', C);
  }
  // A low wash along each wall, tight to the glass and well outside the walk's clear zone. It
  // starts at the apron's own north edge rather than at the bar, so the mouth of the passage
  // is lit where it meets the plaza — that end of the crossing was dark before.
  for (const x of [M.gapW - 0.32, M.gapE + 0.32]) {
    for (let z = museumNorthAt(x) + 1.2; z <= M.z1 - 3.0; z += full ? 7.4 : 14.8) {
      block(x - 0.07, x + 0.07, 0.30, 0.38, z - 1.6, z + 1.6, 'lamp', C);
    }
  }

  // --- the entrances, facing each other across the tunnel ---------------------------------
  // The passage is the museum's front door: one glazed entrance into each wing, opposite each
  // other, each with a blade of canopy over it and a light line under that. They stand on the
  // passage walls, 2 m back from the walk's clear zone, so the crossing stays its full width
  // and keeps the passage's own 4.6 m head height.
  const X = fixtureKit(K);
  const zD = MUSEUM_DOOR[1];
  for (const [xFace, nx] of [[M.gapE, -1], [M.gapW, 1]]) {
    // dark bronze stiles and rails against the white lining, so the door reads as the way in
    // from the far end of the passage rather than as one more panel of the curtain wall
    X.entranceDoor({ x: xFace, z: zD, nx, nz: 0, W: 3.6, H: 3.4, leaves: 4, full, stile: 'charcoal' });
    // the canopy blade reaches out over the doors, into the passage, never back into the
    // gallery: a white plate on a slim fascia, with the light line recessed under its front
    const c0 = xFace + nx * 1.35, c1 = xFace - nx * 0.1;
    const [ca, cb] = [Math.min(c0, c1), Math.max(c0, c1)];
    block(ca, cb, 3.72, 3.96, zD - 3.9, zD + 3.9, 'frame');
    block(ca, cb, 3.62, 3.72, zD - 3.72, zD + 3.72, 'frame');
    const l0 = xFace + nx * 1.2;
    block(Math.min(l0, xFace + nx * 0.3), Math.max(l0, xFace + nx * 0.3), 3.56, 3.61, zD - 3.5, zD + 3.5, 'lamp', C);
    // the threshold: a light stone band across the doors, standing 16 mm proud of the paving
    block(Math.min(xFace + nx * 0.14, xFace + nx * 1.9), Math.max(xFace + nx * 0.14, xFace + nx * 1.9), 0.10, 0.166, zD - 2.6, zD + 2.6, 'stone', C);
    // and a warm line of lobby light on the wall inside, seen through the glass
    block(Math.min(xFace - nx * 0.55, xFace - nx * 0.45), Math.max(xFace - nx * 0.55, xFace - nx * 0.45), 2.62, 2.70, zD - 2.9, zD + 2.9, 'lamp', C);
  }

  // --- the circular stair and the lift ------------------------------------------------------
  // One flight per storey inside the glazed drum, each solved to land exactly on its floor:
  // the rise is whatever divides that storey's height into equal steps near MUSEUM.stair.rise,
  // and the flight turns MUSEUM.stair.turns of a revolution so it arrives back at the landing
  // bearing. Each tread is a wedge built from two treads of different length, so it widens
  // toward the outside the way a radial tread does; a stepped stringer follows them under the
  // nosings and a rail runs above at every step. Landings are real platforms in the floor
  // openings cut for them (CORE_HOLES), and each has a door frame facing the galleries.
  const S = M.stair;
  const rIn = 0.34, rOut = S.r - 0.2;
  const landings = [WALK_TOP, MUSEUM_L2, MUSEUM_L3, MUSEUM_DECK3];
  column(S.x, S.z, WALK_TOP, MUSEUM_CORE_TOP - 0.42 - WALK_TOP, 0.3, 'frame');     // the mast
  const atR = (a, r) => [S.x + Math.cos(a) * r, S.z + Math.sin(a) * r];
  for (let f = 0; f < landings.length - 1; f++) {
    const y0 = landings[f], y1 = landings[f + 1];
    const n = Math.max(12, Math.round((y1 - y0) / S.rise));
    const rise = (y1 - y0) / n, sweep = (S.turns * Math.PI * 2) / n;
    for (let k = 1; k <= n; k++) {
      const a = S.land + (f % 2 ? -1 : 1) * k * sweep;     // alternate handing, floor to floor
      const y = y0 + k * rise;
      if (k < n) {
        // the tread proper: an inner and an outer piece, so it reads as a wedge, not a plank
        K.oriented(...atR(a, (rIn + rOut) / 2 - 0.36), y - 0.035, 0.07, 0.72, 0.42, a, 'stone', C);
        K.oriented(...atR(a, rOut - 0.44), y - 0.035, 0.07, 0.95, 0.62, a, 'stone', C);
        if (full) K.oriented(...atR(a, rOut - 0.06), y - 0.34, 0.30, 0.16, 0.34, a, 'frame', C);  // stringer
      }
      // handrail: a short run at every step, following the helix
      K.oriented(...atR(a, rOut - 0.08), y + 0.96, 0.05, 0.2, 0.36, a, 'metal', C);
      if (full) K.oriented(...atR(a, rOut - 0.08), y + 0.48, 0.04, 0.18, 0.3, a, 'metal', C);
    }
    // the landing at the top of the flight: a quarter-plate in the floor opening, with a
    // guard on its open side and a door frame out to the gallery
    // the landing: three lapping pieces reading as one platform across the bore, wide enough
    // to stand on and turn out through the door
    const la = S.land + (f % 2 ? -1 : 1) * S.turns * Math.PI * 2;
    for (const j of [-0.44, 0, 0.44]) {
      K.oriented(...atR(la + j, (rIn + rOut) / 2 + 0.1), landings[f + 1] + 0.02, 0.07, rOut - rIn + 0.2, 1.5, la + j, 'stone', C);
    }
  }
  // door frames out of the drum at each landing, on the bearing the flights arrive at
  for (const y of landings) {
    const roof = Math.abs(y - MUSEUM_DECK3) < 0.01;
    // the jambs sit in the ends of the wall — on the roof those ends are the open head's own,
    // so the frame reads as a doorway rather than as a bar behind glass
    for (const s2 of [-1, 1]) K.oriented(...atR(S.land + s2 * HEAD_GAP, S.r - 0.05), y + 0.02, roof ? 2.34 : 2.5, 0.18, 0.2, S.land + s2 * HEAD_GAP + Math.PI / 2, 'charcoal', C);
    K.oriented(...atR(S.land, S.r - 0.05), y + (roof ? 2.36 : 2.5), 0.14, 2.3, 0.2, S.land, 'charcoal', C);
    K.oriented(...atR(S.land, S.r - 0.42), y + 0.02, 0.05, 2.1, 1.1, S.land, 'stone', C);     // threshold
    if (roof) {
      // a stone landing band running out of the door onto the garden's paving, and a light
      // line under the head's plate so the exit reads at dusk
      K.oriented(...atR(S.land, S.r + 0.85), MUSEUM_DECK3 + 0.045, 0.045, 2.3, 1.9, S.land, 'stone', C);
      K.oriented(...atR(S.land, S.r - 0.2), MUSEUM_CORE_TOP - 0.34, 0.05, 1.9, 0.12, S.land, 'lamp', C);
    }
  }

  // --- the lift, beside the drum -------------------------------------------------------------
  // A cab in a glazed shaft on guide rails, with landing doors at all four levels and a small
  // arrival platform at each. It is deliberately quieter than the stair: no separate tower, an
  // overrun that stops under the stair head, and nothing of it inside the spiral's mast.
  const L = M.lift;
  for (const sx of [-1, 1]) {
    column(L.x + sx * (L.w / 2 - 0.12), L.z - L.d / 2 + 0.12, 0, MUSEUM_CORE_TOP - 0.1, 0.1, 'frame');
    column(L.x + sx * (L.w / 2 - 0.12), L.z + L.d / 2 - 0.12, 0, MUSEUM_CORE_TOP - 0.1, 0.1, 'frame');
  }
  block(L.x - 0.09, L.x + 0.09, 0.2, MUSEUM_CORE_TOP - 0.3, L.z - 0.09, L.z + 0.09, 'metal', C);   // guide rail
  block(L.x - L.w / 2 + 0.16, L.x + L.w / 2 - 0.16, MUSEUM_L2 + 0.06, MUSEUM_L2 + 2.5,
    L.z - L.d / 2 + 0.16, L.z + L.d / 2 - 0.16, 'stucco', C);                                   // the cab, at L2
  block(L.x - L.w / 2 + 0.2, L.x + L.w / 2 - 0.2, MUSEUM_L2 + 2.3, MUSEUM_L2 + 2.38,
    L.z - L.d / 2 + 0.2, L.z + L.d / 2 - 0.2, 'lamp', C);                                       // its ceiling light
  // The landing doors face west at every level — the same way the stair's doorway faces — so
  // you leave both by the same side and the two arrivals share one strip of floor.
  const face = L.x - L.w / 2;
  for (const y of landings) {
    for (const s2 of [-1, 1]) block(face - 0.02, face + 0.12, y + 0.03, y + 2.3, L.z + s2 * 0.42, L.z + s2 * 0.58, 'charcoal', C);
    block(face - 0.02, face + 0.12, y + 2.3, y + 2.42, L.z - 0.62, L.z + 0.62, 'charcoal', C);
    block(face - 1.6, face - 0.04, y + 0.02, y + 0.06, L.z - L.d / 2 - 0.05, L.z + L.d / 2 + 0.05, 'stone', C);
    if (Math.abs(y - MUSEUM_DECK3) < 0.01) block(face - 0.12, face + 0.02, y + 2.44, y + 2.5, L.z - 0.55, L.z + 0.55, 'lamp', C);
  }

  // --- a cascade on each wing, both facing the fountain --------------------------------------
  // Four levels of water apiece: a pool on the roof garden spilling through a spout in the
  // parapet, one on each roof the section steps down to on the park side, and a basin at grade
  // where it ends. The pools are sunk into their plates through rounded openings, the spouts
  // project clear of the face below, and every sheet falls into the pool beneath it.
  // The street elevation is flush and dry: nothing steps and no water runs on it.
  // A basin rather than a panel of colour: a rounded pale rim, the water held 100 mm below its
  // top so the edge casts into it, on the water shader so it ripples and takes a reflection;
  // the moving water (weirs, sheets, the splash at the foot) stays a paler tone.
  // The rim and the water are drawn level by level in museumWater(), each pool a rounded
  // rectangle let into an opening in its plate; all that is left here is the pale bottom,
  // lapped into the underside of the water.
  const pool = (x0, x1, z0, z1, deck) => {
    block(x0 + 0.4, x1 - 0.4, deck - 0.36, deck - 0.3, z0 + 0.4, z1 - 0.4, 'basinBed', C);
  };
  // The spillway. Every width here is a fraction of the bay it belongs to, so one number on
  // MUSEUM.fallW / fallE sets the pool, the lip, the sheet, the rill and the moat together:
  // a wider cascade widens all the way down instead of a broad pool feeding a narrow spout.
  const spill = (W, deck, zOut, zIn, zSheet, yBelow) => {
    const [a0, a1] = zIn < zOut ? [zIn, zOut] : [zOut, zIn];
    const cx = W.x, lip = W.w * 0.175, wet = W.w * 0.142, sheet = W.w * 0.124;
    block(cx - lip, cx + lip, deck - 0.11, deck + 0.015, a0, a1, 'coping', C);          // the weir
    block(cx - wet, cx + wet, deck - 0.08, deck - 0.03, a0 + 0.06, a1 - 0.06, 'basinFall', C);
    // the falling sheet is thin and paler than the still water it lands in
    block(cx - sheet, cx + sheet, yBelow, deck + 0.005, zSheet, zSheet + 0.09, 'basinFall', C);
    // and it breaks where it lands: a low band of disturbed water across the basin below
    block(cx - sheet * 1.5, cx + sheet * 1.5, yBelow - 0.035, yBelow + 0.045, zSheet - 0.55, zSheet + 0.62, 'basinFall', C);
  };
  // planting beside the water on the roof garden: layered foliage either side of the bay, kept
  // inside the parapet — nothing trails over the edge
  const bayPlanting = (W, deck, zBed) => {
    for (const side of [-1, 1]) {
      const x0 = W.x + side * (W.w / 2 + 0.55);
      K.bed(Math.min(x0, x0 + side * 2.3), Math.max(x0, x0 + side * 2.3), zBed - 0.75, zBed + 0.75, deck, 0.36);
      const n = full ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const bx = x0 + side * (0.4 + (i * 1.5) / (n - 1 || 1));
        const tall = i === 1;
        add('bush', bx, deck + 0.36 + (tall ? 0.6 : 0.4), zBed + ((i % 2) - 0.5) * 0.5,
          tall ? 1.4 : 1.1, tall ? 1.2 : 0.8, tall ? 1.2 : 1.0, i % 2 ? 'shrub' : 'shrubDark', C);
      }
    }
  };
  // One cascade, on the middle of one wing's park face. The three upper levels sit on
  // rectangular decks and are drawn on the grid; the last one crosses the apron's own edge,
  // which is the arc on the west wing and the straight cap on the east, so its spout, sheet
  // and basin are built on a frame taken from that edge — the tangent where it curves, the
  // building's own axis where it does not.
  const cascade = (WB) => {
    const bay = [WB.x - WB.w / 2, WB.x + WB.w / 2];
    const rects = museumPoolsOf(WB);
    pool(...rects[0]);                                                // on the roof garden
    spill(WB, MUSEUM_DECK3, 21.25, 22.2, 21.02, MUSEUM_DECK2 + 0.02); // out through the notched parapet
    bayPlanting(WB, MUSEUM_DECK3, 24.6);
    pool(...rects[1]);                                                // on the park terrace
    spill(WB, MUSEUM_DECK2, 18.15, 19.0, 17.90, MUSEUM_DECK1 + 0.02); // over the park step
    // the apron's roof: a rill rather than a pool the width of the bay — the water has a long
    // way to travel to the edge here, and a tank that size would read as a tank. It still
    // widens with the bay, so the east run is the broader one all the way down.
    pool(...rects[2]);
    const { edge, onArc, out, ang, at } = spoutFrame(WB);
    const spoutAt = at(SPOUT.at);
    // the levels here are tight — deck 4.950, rim 4.850/5.020, water 4.900/4.985 — so the lip,
    // its water and the sheet are threaded through the gaps between them
    const lip = WB.w * 0.35, wet = WB.w * 0.28, sheet = WB.w * 0.245;
    K.oriented(spoutAt[0], spoutAt[1], MUSEUM_DECK1 - 0.08, 0.095, lip, SPOUT.depth, ang, 'coping', C);
    K.oriented(spoutAt[0], spoutAt[1], MUSEUM_DECK1 - 0.06, 0.045, wet, SPOUT.depth - 0.1, ang, 'basinFall', C);
    // the sheet hangs just past the lip's tip and drops into the middle of the basin below,
    // breaking on its surface
    const sheetAt = at(SPOUT.sheet);
    K.oriented(sheetAt[0], sheetAt[1], 0.22, MUSEUM_DECK1 - 0.045 - 0.22, sheet, 0.09, ang, 'basinFall', C);
    K.oriented(sheetAt[0], sheetAt[1], 0.21, 0.05, sheet * 1.3, 0.5, ang, 'basinFall', C);   // the splash
    return { bay, at, ang, out, edge, onArc, WB };
  };
  cascade(M.fallW);   // the smaller, west wing — over the arc
  cascade(M.fallE);   // the larger, east wing  — over the straight cap

  // --- the receiving basins -----------------------------------------------------------------
  // Drawn with the other pools in museumWater() — rim, tile band and water; this is the pale
  // floor under the water.
  for (const b of museumMoatBasins()) {
    const [x0, x1, z0, z1] = boundsOf(b.water);
    const c = insidePlan((x0 + x1) / 2, (z0 + z1) / 2, b.water) ? [(x0 + x1) / 2, (z0 + z1) / 2] : b.mid;
    K.oriented(c[0], c[1], 0.09, 0.03, 0.5, 0.4, b.fr.ang, 'basinBed', C);
  }

  // --- the two lower roofs: lawn and planting -------------------------------------------------
  // The apron and the park terrace are grassed edge to edge (museumLowerRoofs / museumLawns) and
  // planted in it: a rank of shrubs along the glass of the storey above, drifts of shrubs and
  // grasses across the turf, and on the apron a ring of them round each rill. The terrace has no
  // railing. Every plant is placed only where its whole spread lands on the lawn, so nothing
  // hangs past the edge of a roof, over the water or against the glass.
  const hashL = (a, b) => { const v = Math.sin(a * 91.345 + b * 47.853) * 24634.6345; return v - Math.floor(v); };
  for (const lv of museumLowerRoofs()) {
    const placed = [];
    const fits = (x, z, r) => {
      if (!onLowerLawn(lv, x, z)) return false;
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * Math.PI * 2;
        if (!onLowerLawn(lv, x + Math.cos(t) * (r + 0.08), z + Math.sin(t) * (r + 0.08))) return false;
      }
      return !placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < (q[2] + r) * 0.72);
    };
    const plant = (x, z, kind) => {
      const h = hashL(x, z ?? lv.zCut);
      const spec = kind === 'back'
        ? { shape: 'bush', w: 1.1 + h * 0.3, hgt: 0.85 + h * 0.3, col: h < 0.5 ? 'shrubDark' : 'shrub' }
        : kind === 'front'
        ? (h < 0.6 ? { shape: 'cone', w: 0.6 + h * 0.15, hgt: 0.5 + h * 0.2, col: 'shrubLight' } : { shape: 'bush', w: 0.8, hgt: 0.4, col: 'shrub' })
        : h < 0.45 ? { shape: 'bush', w: 0.8 + h * 0.6, hgt: 0.55 + h * 0.4, col: h < 0.22 ? 'shrub' : 'shrubDark' }
        : h < 0.8 ? { shape: 'cone', w: 0.6 + (h - 0.45) * 0.5, hgt: 0.55 + (h - 0.45) * 0.4, col: 'shrubLight' }
        : { shape: 'bush', w: 1.0, hgt: 0.45, col: 'shrubLight' };
      const r = spec.w / 2;
      if (z === null) z = kind === 'front' ? zFront + r + 0.1 : lv.zCut - r - 0.1;   // the two ranks
      if (!fits(x, z, r)) return;
      placed.push([x, z, r]);
      add(spec.shape, x, lv.deck + 0.04 + spec.hgt / 2, z, spec.w, spec.hgt, spec.w * 0.95, spec.col, C);
    };
    const xs = lv.parts.flatMap((q) => q.pts.map((pt) => pt[0]));
    const zs = lv.parts.flatMap((q) => q.pts.map((pt) => pt[1]));
    const [xa, xb, za] = [Math.min(...xs), Math.max(...xs), Math.min(...zs)];
    const zFront = za;
    // along the glass of the storey above
    for (let x = xa + 0.7; x <= xb - 0.7; x += full ? 1.25 : 1.9) plant(x, null, 'back');
    // a low rank of grasses along the terrace's open edge, where it meets the drop to the apron
    if (lv.deck === MUSEUM_DECK2) for (let x = xa + 0.5; x <= xb - 0.5; x += full ? 1.3 : 2.0) plant(x, null, 'front');
    // round the rills on the apron
    if (lv.deck === MUSEUM_DECK1) {
      for (const [x0, x1, z0, z1] of lv.pools) {
        for (let z = z0 + 0.8; z <= z1 - 0.5; z += full ? 1.1 : 1.8) for (const x of [x0 - 0.62, x1 + 0.62]) plant(x, z, 'ring');
      }
    }
    // drifts across the rest of the turf
    const stepL = full ? 1.45 : 2.2;
    for (let x = xa + 0.5; x <= xb - 0.5; x += stepL) {
      for (let z = za + 0.5; z <= lv.zCut - 0.3; z += stepL) {
        const h = hashL(z, x);
        if (h < 0.4) continue;                                    // leave open lawn between drifts
        plant(x + (h - 0.7) * 0.8, z + (hashL(x + 3, z) - 0.5) * 0.8, 'drift');
      }
    }
  }

  // --- the rooftop sculpture garden ----------------------------------------------------------
  // An outdoor museum rather than a plant deck. The ground is planted and the paving is cut
  // through it as one continuous loop from the stair and lift arrival, past a sculpture court
  // and a reflecting pool, round to the north overlook and back — so what you read from the
  // air is foliage with paths in it, not paving with pots on it. Planting is layered from the
  // path edge inward (groundcover, then shrubs, then a few taller specimens), in a South
  // Florida native palette — coontie, cocoplum, muhly grass, bay cedar — drawn with different
  // silhouettes so the species tell apart. Every position here is deterministic: the garden is
  // the same on every load.
  //
  // Assumed, not designed: soil depth and build-up, drainage and irrigation, root barriers and
  // waterproofing, wind exposure at 14 m, and the roof's loading with wet soil and standing
  // water. Species are chosen as Miami-Dade natives for their habit; nothing here is a planting
  // schedule.
  const deck = MUSEUM_DECK3;
  const G = { x0: M.x0 + 1.0, x1: M.x1 - 1.0, z0: M.z3n + 0.9, z1: M.z1 - 1.1 };
  const palms = [];
  const hash = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

  // the walking loop, as a closed curve: a few waypoints rounded off by repeated subdivision
  const LOOP = [[6.9, 29.4], [6.9, 38.6], [2.4, 44.2], [-7.4, 47.2], [-16.6, 45.2], [-19.4, 36.4], [-17.2, 27.4], [-6.2, 24.4], [3.2, 28.4]];
  let path = LOOP;
  for (let k = 0; k < 3; k++) {
    const sub = path.flatMap((b, n) => { const c = path[(n + 1) % path.length]; return [b, [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]]; });
    path = sub.map((b, n) => {
      const a2 = sub[(n - 1 + sub.length) % sub.length], c = sub[(n + 1) % sub.length];
      return [(a2[0] + 2 * b[0] + c[0]) / 4, (a2[1] + 2 * b[1] + c[1]) / 4];
    });
  }
  const PATH_W = 1.9;
  const nearPath = (x, z, pad) => {
    for (let n = 0; n < path.length; n++) {
      const [ax, az] = path[n], [bx, bz] = path[(n + 1) % path.length];
      const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len2 || 1)));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < PATH_W / 2 + pad) return true;
    }
    return false;
  };
  // the paving: one oriented slab per stretch of the loop, lapping into the next
  const step = full ? 2 : 3;
  for (let n = 0; n < path.length; n += step) {
    const [ax, az] = path[n], [bx, bz] = path[(n + step) % path.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    block(0, 0, 0, 0, 0, 0, 'stone', C);   // placeholder replaced below
    out.pop();
    K.oriented((ax + bx) / 2, (az + bz) / 2, deck + 0.02, 0.05, len + 0.5, PATH_W, Math.atan2(bz - az, bx - ax), 'stone', C);
  }

  // clearings off the loop: paved rooms for sculpture and seating
  const CLEARINGS = [
    { x: -10.6, z: 33.4, w: 7.4, d: 5.8 },    // the principal work, in the biggest room
    { x: -17.4, z: 41.2, w: 3.8, d: 3.4 },
    { x: -1.2, z: 46.4, w: 5.0, d: 3.8 },
    { x: 2.6, z: 33.4, w: 4.4, d: 4.2 },
    { x: 13.0, z: 45.8, w: 4.2, d: 4.2 },
  ];
  for (const c of CLEARINGS) block(c.x - c.w / 2, c.x + c.w / 2, deck + 0.02, deck + 0.07, c.z - c.d / 2, c.z + c.d / 2, 'stone', C);
  const inClearing = (x, z, pad) => CLEARINGS.some((c) => Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad);
  // and the paved aprons outside the two core doors, which the loop meets
  block(7.05, 9.45, deck + 0.02, deck + 0.07, 29.8, 38.8, 'stone', C);

  // the reflecting pool beside the principal clearing: the same basin detail as the cascade
  // pools — its rounded rim and water come from museumWater(), its opening from the plate —
  // a still sheet that takes the sculpture and the foliage round it
  const RP = MUSEUM_REFLECT;
  block(RP[0] + 0.4, RP[1] - 0.4, deck - 0.36, deck - 0.3, RP[2] + 0.4, RP[3] - 0.4, 'basinBed', C);

  // everything the garden must not plant on
  // The walk, the water and the core hold the full clearance a bed has to keep off them; the
  // clearings and the garden's own boundary are soft edges the planting may run right up to,
  // because a bed lapping onto the edge of a paved room is what a planted ground looks like.
  const keepOut = (x, z, pad) => {
    const soft = Math.min(pad, 0.12);
    return nearPath(x, z, pad) || inClearing(x, z, soft)
      || (x > RP[0] - pad - 0.4 && x < RP[1] + pad + 0.4 && z > RP[2] - pad - 0.4 && z < RP[3] + pad + 0.4)
      || Math.hypot(x - S.x, z - S.z) < S.r + 1.2 + pad
      || (Math.abs(x - L.x) < L.w / 2 + 1.4 + pad && Math.abs(z - L.z) < L.d / 2 + 1.2 + pad)
      || (x > 7.1 && x < 9.5 && z > 29.7 && z < 38.9)
      || museumPools().some(([a2, b2, c2, d2, y2]) => Math.abs(y2 - deck) < 0.01 && x > a2 - 0.8 - pad && x < b2 + 0.8 + pad && z > c2 - 0.8 - pad && z < d2 + 0.8 + pad)
      || x < G.x0 + soft || x > G.x1 - soft || z < G.z0 + soft || z > G.z1 - soft;
  };

  // --- the planted ground --------------------------------------------------------------------
  // soil first, as overlapping rounds on a coarse grid so the beds read as one interlocking
  // mass with curved edges rather than as a row of planters
  // Each round is set out so its rim stops at the edge of whatever it meets — the path keeps its
  // full clear width, and the beds still meet one another and read as one mass.
  // Each round takes the largest radius that still clears whatever it meets, so the beds run
  // right up to the paving and the parapet margin and stop dead there — the path keeps its full
  // clear width, and the varied radii give the planted mass a curved, uneven edge.
  const SOIL = full ? 1.3 : 1.6;
  const SR = SOIL * 0.86;
  const fit = (x, z) => {
    for (const r of [SR, SR * 0.8, SR * 0.62, SR * 0.46, SR * 0.32]) if (!keepOut(x, z, r - 0.05)) return r;
    return 0;
  };
  const planted = [];
  for (let x = G.x0 + 0.5; x <= G.x1 - 0.5; x += SOIL) {
    for (let z = G.z0 + 0.5; z <= G.z1 - 0.5; z += SOIL) {
      const jx = x + (hash(x, z) - 0.5) * 0.55, jz = z + (hash(z, x) - 0.5) * 0.55;
      const r = fit(jx, jz);
      if (!r) continue;
      planted.push([jx, jz, r]);
      add('cyl', jx, deck + 0.16, jz, r * 2, 0.26, r * 2, 'planter', C);
    }
  }
  // then the foliage: four natives, each with its own silhouette, laid on a finer grid and
  // graded so the low things sit by the paths and the tall ones stand back from them
  const PLANT = full ? 1.45 : 1.9;
  let n2 = 0;
  for (let x = G.x0 + 0.5; x <= G.x1 - 0.5; x += PLANT) {
    for (let z = G.z0 + 0.5; z <= G.z1 - 0.5; z += PLANT) {
      const jx = x + (hash(x * 3, z) - 0.5) * 0.85, jz = z + (hash(z * 3, x) - 0.5) * 0.85;
      if (keepOut(jx, jz, 0.35)) continue;
      if (!planted.some(([px, pz, pr]) => Math.hypot(px - jx, pz - jz) < pr - 0.12)) continue;
      const edge = keepOut(jx, jz, 1.5);              // within reach of a path or a clearing
      const h2 = hash(jx * 7, jz * 5), k = Math.floor(h2 * 10);
      const y0 = deck + 0.29;
      n2++;
      if (edge || k < 3) {
        // muhly grass at the edges: fine blades, a low haze, with the odd plume
        add('cone', jx, y0 + 0.34, jz, 0.78, 0.68, 0.78, 'shrubLight', C);
        if (full && k === 2) add('cone', jx, y0 + 0.78, jz, 0.5, 0.34, 0.5, 'shrubFlower', C);
      } else if (k < 5) {
        // coontie: a squat cycad, a rosette of stiff fronds
        add('cone', jx, y0 + 0.26, jz, 1.15, 0.52, 1.15, 'shrub', C);
        if (full) for (const s2 of [-1, 1]) add('cone', jx + s2 * 0.34, y0 + 0.4, jz + (k % 2 ? 0.3 : -0.3), 0.42, 0.62, 0.42, 'shrubDark', C, s2 * 0.5);
      } else if (k < 8) {
        // cocoplum: dense broad leaf, the body of the planting
        add('bush', jx, y0 + 0.48, jz, 1.45, 0.96, 1.35, k % 2 ? 'shrub' : 'shrubDark', C);
      } else if (k === 8) {
        // bay cedar: a low grey-green mound
        add('bush', jx, y0 + 0.34, jz, 1.65, 0.68, 1.55, 'shrubDark', C);
      } else {
        // the taller specimens, kept few and back from the paths
        add('bush', jx, y0 + 0.86, jz, 1.7, 1.72, 1.6, 'shrubDark', C);
        if (full) add('bush', jx + 0.35, y0 + 1.5, jz - 0.2, 1.2, 0.9, 1.1, 'shrub', C);
      }
    }
  }
  // a few sabal palms for height, standing in the planting away from the parapet
  for (const [px, pz, ph] of full
    ? [[-14.0, 29.6, 6.4], [-3.0, 33.0, 5.8], [13.4, 31.0, 6.2], [0.0, 41.5, 5.6], [-17.4, 34.0, 6.0]]
    : [[-14.0, 29.6, 6.4], [-3.0, 33.0, 5.8], [13.4, 31.0, 6.2]]) {
    if (keepOut(px, pz, 0.6)) continue;
    K.bed(px - 0.98, px + 0.98, pz - 0.98, pz + 0.98, deck + 0.07, 0.3);
    palms.push({ x: px, z: pz, y: deck + 0.37, h: ph, r: 2.1, spin: 0.6 * px, start: 0.72, dur: 0.05, deck: true, planterH: 0.95 });
  }

  // --- the sculptures --------------------------------------------------------------------------
  // Six originals, each with its own silhouette and material, each with a base and room to
  // stand back from it: a folded plane in the principal clearing, a ribbon, a pierced monolith,
  // a balanced composition, and two smaller pieces to come across in the planting.
  const plinthAt = (x, z, w2, d2, h3, tone) => block(x - w2 / 2, x + w2 / 2, deck + 0.07, deck + 0.07 + h3, z - d2 / 2, z + d2 / 2, tone, C);
  const artLight = (x, z) => block(x - 0.12, x + 0.12, deck + 0.09, deck + 0.15, z - 0.12, z + 0.12, 'lamp', C);
  // 1 — the folded plane
  plinthAt(-10.6, 33.4, 4.0, 3.0, 0.40, 'stone');
  K.oriented(-11.4, 33.4, deck + 0.45, 3.3, 2.5, 0.22, 0.34, 'frame', C);
  K.oriented(-9.6, 33.2, deck + 0.45, 2.5, 2.2, 0.22, -0.5, 'frame', C);
  K.oriented(-10.5, 34.6, deck + 0.45, 1.7, 1.8, 0.2, 1.1, 'frame', C);
  artLight(-12.4, 32.2); artLight(-8.9, 34.5);
  // 2 — the ribbon: a run of turning blades
  plinthAt(-1.2, 46.4, 3.2, 2.4, 0.36, 'stone');
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    K.oriented(-2.4 + t * 2.4, 46.4 + Math.sin(t * Math.PI) * 0.55, deck + 0.42, 1.5 + Math.sin(t * Math.PI) * 1.2, 0.95, 0.12, 0.5 + t * 1.9, 'metal', C);
  }
  artLight(-2.9, 45.4);
  // 3 — the pierced monolith
  plinthAt(2.6, 33.4, 2.6, 2.2, 0.44, 'stone');
  block(1.9, 3.3, deck + 0.5, deck + 1.5, 32.9, 33.9, 'stone', C);
  block(1.9, 3.3, deck + 2.1, deck + 3.4, 32.9, 33.9, 'stone', C);
  for (const s2 of [-1, 1]) block(1.9 + (s2 > 0 ? 1.18 : 0), 1.9 + (s2 > 0 ? 1.4 : 0.22), deck + 1.5, deck + 2.1, 32.9, 33.9, 'stone', C);
  artLight(1.4, 32.6);
  // 4 — the balanced composition
  plinthAt(13.0, 45.8, 2.4, 2.4, 0.40, 'charcoal');
  add('cyl', 13.0, deck + 1.05, 45.8, 0.6, 1.2, 0.6, 'charcoal', C);
  K.oriented(13.0, 45.8, deck + 1.5, 0.3, 2.9, 0.9, 0.7, 'frame', C);
  add('box', 12.1, deck + 2.1, 46.4, 0.8, 0.8, 0.8, 'frame', C, 0.5);
  artLight(14.1, 44.9);
  // 5 and 6 — the smaller pieces, found in the planting
  for (const [sx, sz, kind] of [[-15.4, 31.4, 'disc'], [11.4, 41.2, 'lean']]) {
    plinthAt(sx, sz, 1.8, 1.8, 0.36, 'stone');
    if (kind === 'disc') {
      add('cyl', sx, deck + 0.9, sz, 1.5, 1.2, 1.5, 'metal', C);
      add('cyl', sx, deck + 1.55, sz, 0.9, 0.2, 0.9, 'stone', C);
    } else {
      K.oriented(sx, sz, deck + 0.42, 2.2, 1.1, 0.26, 0.9, 'stone', C);
      add('box', sx + 0.5, deck + 0.6, sz + 0.4, 0.6, 0.6, 0.6, 'charcoal', C, 0.4);
    }
    artLight(sx - 1.2, sz - 0.9);
  }

  // --- seats and shade -------------------------------------------------------------------------
  // benches let into the planting along the loop, two of them looking down the cascades, and a
  // light white fin canopy over the seats in the principal clearing
  for (const [bx, bz, ba] of [[-13.6, 33.4, Math.PI / 2], [-7.4, 33.4, -Math.PI / 2], [-1.6, 44.4, 0],
    [-17.0, 43.0, 0.6], [11.2, 44.0, -0.4], [-10.6, 24.9, Math.PI], [1.0, 25.4, Math.PI], [5.6, 34.6, Math.PI / 2]]) {
    if (keepOut(bx, bz, 0.1) && !inClearing(bx, bz, 0.9) && !nearPath(bx, bz, 1.1)) continue;
    K.oriented(bx, bz, deck + 0.07, 0.44, 2.2, 0.55, ba, 'stone', C);
  }
  // No shade structure up here: the garden is planting, seats and sculpture, and a canopy in
  // the middle of it fought with the roof's clean line. The seat that stood under it stays.
  if (full) K.oriented(-6.0, 37.6, deck + 0.07, 0.44, 2.6, 0.55, 0, 'stone', C);
  // path lights: a few low markers at the loop's turns, not a line of them
  for (let n = 0; n < path.length; n += full ? 9 : 18) {
    const [px, pz] = path[n];
    const [qx, qz] = path[(n + 2) % path.length];
    const a2 = Math.atan2(qz - pz, qx - px) + Math.PI / 2;
    block(px + Math.cos(a2) * 1.25 - 0.07, px + Math.cos(a2) * 1.25 + 0.07, deck + 0.10, deck + 0.68, pz + Math.sin(a2) * 1.25 - 0.07, pz + Math.sin(a2) * 1.25 + 0.07, 'lamp', C);
  }

  // --- the galleries, read through the glass --------------------------------------------------
  // Rooms rather than a grid. Each floor is laid out as a short sequence: walls set to make
  // three or four connected rooms with a sightline running between them, an open bay for
  // sculpture, benches to sit on, and artwork of varied size on the walls. The ground floor
  // takes the arrival — a reception desk and an orientation wall by the passage doors, with a
  // featured piece beyond — because that is the floor people meet first. Nothing stands in the
  // circulation between the doors, the drum and the lift, nothing within 1 m of the glass, and
  // the light-sensitive pieces hang on the inboard faces, away from the curtain wall.
  const galleryLight = (x0, x1, y0, z) => {
    // a track with three heads on it, rather than a glowing strip
    block(x0, x1, y0 + 0.06, y0 + 0.11, z - 0.05, z + 0.05, 'metal', C);
    if (!full) return;
    for (let k = 0; k < 3; k++) add('cone', x0 + ((k + 0.5) / 3) * (x1 - x0), y0 - 0.03, z, 0.22, 0.2, 0.22, 'lamp', C);
  };
  // a display wall with art on it: `long` walls run in x, the others in z
  const displayWall = (wx, wz, y0, long, h, style) => {
    const sx = long ? 2.1 : 0.1, sz = long ? 0.1 : 2.1;
    block(wx - sx, wx + sx, y0 + 0.02, y0 + h, wz - sz, wz + sz, 'stucco');
    galleryLight(wx - sx * 0.85, wx + sx * 0.85, y0 + h, wz + (long ? 0.55 : 0));
    // two or three works on the inboard face, in different proportions and with frames
    // each work is a white frame on the wall's inboard face with the canvas standing proud of
    // it, so the frame reads as a frame rather than as a line around a painted-on panel
    const hung = style % 3 === 0 ? [[-1.0, 0.95, 1.3], [0.55, 1.45, 0.8]]
      : style % 3 === 1 ? [[-0.75, 1.3, 1.0], [0.95, 0.75, 0.75]]
        : [[-1.1, 0.8, 0.8], [0.1, 0.95, 1.15], [1.25, 0.7, 0.62]];
    const span = (c, d0, d1) => [Math.min(c + d0, c + d1), Math.max(c + d0, c + d1)];
    for (const [o, pw, ph] of hung) {
      if (long) {
        const cx = wx + o, cz = wz + 0.13;
        block(cx - pw, cx + pw, y0 + 1.0, y0 + 1.0 + ph, cz - 0.05, cz + 0.05, 'frame', C);
        block(cx - pw * 0.86, cx + pw * 0.86, y0 + 1.06, y0 + 0.94 + ph, ...span(cz, 0.02, 0.08), 'charcoal', C);
      } else {
        const cx = wx + 0.13, cz = wz + o;
        block(cx - 0.05, cx + 0.05, y0 + 1.0, y0 + 1.0 + ph, cz - pw, cz + pw, 'frame', C);
        const [x0, x1] = span(cx, 0.02, 0.08);
        block(x0, x1, y0 + 1.06, y0 + 0.94 + ph, cz - pw * 0.86, cz + pw * 0.86, 'charcoal', C);
      }
    }
  };
  const plinth = (px, pz, y0, kind) => {
    add('box', px, y0 + 0.24, pz, 0.96, 0.44, 0.96, 'stone', C, 0.4);
    if (kind === 0) { add('cyl', px, y0 + 1.06, pz, 0.62, 1.2, 0.62, 'frame', C); add('cyl', px, y0 + 1.78, pz, 0.3, 0.3, 0.3, 'stone', C); }
    else if (kind === 1) { add('box', px, y0 + 0.92, pz, 0.6, 0.92, 0.6, 'frame', C, 0.7); add('box', px, y0 + 1.5, pz, 0.42, 0.34, 0.42, 'stone', C, 0.2); }
    else { add('cone', px, y0 + 1.0, pz, 0.9, 1.1, 0.9, 'frame', C); }
  };
  const bench = (bx, bz, y0, a2) => K.oriented(bx, bz, y0 + 0.02, 0.42, 1.8, 0.48, a2, 'stone', C);

  // the floors, each with its own layout. `holds` keeps everything inside the floor it is on.
  const floors = [
    { y: 0.0, h: M.ground, holds: museumGradeHolds, z0: MUSEUM_ZI, z1: M.z1 },
    { y: MUSEUM_L2, h: M.floor, holds: museumL2Holds, z0: M.zb, z1: M.z1 },
    { y: MUSEUM_L3, h: M.floor, holds: museumL3Holds, z0: M.z3n, z1: M.z1 },
  ];
  const freeOfCore = (x, z, pad) => Math.hypot(x - S.x, z - S.z) > S.r + pad
    && !(Math.abs(x - L.x) < L.w / 2 + pad && Math.abs(z - L.z) < L.d / 2 + pad)
    && !(Math.abs(x - M.gapE) < 3.0 + pad && Math.abs(z - MUSEUM_DOOR[1]) < 4.0 + pad)
    && !(Math.abs(x - M.gapW) < 3.0 + pad && Math.abs(z - MUSEUM_DOOR[1]) < 4.0 + pad);
  floors.forEach((F2, li) => {
    const y0 = F2.y;
    // the rooms: a line of walls across each wing, set at alternating depths so the plan reads
    // as connected rooms with a sightline between them rather than as a grid of panels
    const wings = li === 0 ? [[M.x0 + 1.4, M.gapW - 1.4], [M.gapE + 1.4, M.x1 - 1.4]] : [[M.x0 + 1.4, M.x1 - 1.4]];
    let piece = li;
    wings.forEach((wing, wi) => {
      const [a2, b2] = wing;
      const rooms = Math.max(1, Math.round((b2 - a2) / 11.5));
      for (let r = 0; r < rooms; r++) {
        const cx = a2 + ((r + 0.5) / rooms) * (b2 - a2);
        const cz = (Math.max(F2.z0, MUSEUM_ZI) + F2.z1) / 2 + ((r % 2) - 0.5) * 6.0;
        // a long wall with the sightline past one end, and a short return making the room
        if (freeOfCore(cx, cz, 2.6) && F2.holds(cx, cz, -2.6)) {
          displayWall(cx, cz, y0, true, 3.1 + (r % 2) * 0.3, piece++);
          if (freeOfCore(cx + 2.9, cz + 3.0, 2.4) && F2.holds(cx + 2.9, cz + 3.0, -2.4)) {
            displayWall(cx + 2.9, cz + 3.0, y0, false, 3.0, piece++);
          }
          // the open bay: a piece on a plinth in front of the wall, with room around it
          if (full && freeOfCore(cx - 1.4, cz + 4.2, 1.6)) plinth(cx - 1.4, cz + 4.2, y0, (r + li) % 3);
          if (full && freeOfCore(cx + 1.6, cz - 3.4, 1.6)) bench(cx + 1.6, cz - 3.4, y0, r % 2 ? 0 : Math.PI / 2);
        }
      }
      // one long wall set back from the glass at each wing's far end, to close the sequence
      const ez = F2.z1 - 4.2;
      if (freeOfCore(a2 + 3.0 + wi * 0.6, ez, 2.6) && F2.holds(a2 + 3.0, ez, -2.6)) displayWall(a2 + 3.0 + wi * 0.6, ez, y0, true, 3.2, piece++);
    });
  });

  // the arrival, on the ground floor either side of the passage: a reception desk facing the
  // doors, a low orientation wall behind it, and a bench to wait on
  for (const [xFace, nx] of [[M.gapE, 1], [M.gapW, -1]]) {
    const dx = xFace + nx * 2.6, dz = MUSEUM_DOOR[1];
    block(dx - (nx > 0 ? 0.5 : 1.7), dx + (nx > 0 ? 1.7 : 0.5), 0.17, 1.12, dz - 1.5, dz + 1.5, 'stucco');
    block(dx - (nx > 0 ? 0.5 : 1.7), dx + (nx > 0 ? 1.7 : 0.5), 1.12, 1.18, dz - 1.6, dz + 1.6, 'stone', C);   // the counter top
    block(dx + nx * 2.2, dx + nx * 2.3, 0.17, 2.9, dz - 2.6, dz + 2.6, 'stucco');                              // orientation wall
    galleryLight(Math.min(dx + nx * 2.1, dx + nx * 2.4), Math.max(dx + nx * 2.1, dx + nx * 2.4), 2.9, dz);
    bench(dx + nx * 1.1, dz + 3.4, 0, Math.PI / 2);
  }

  // --- low planting round the base ----------------------------------------------------------
  // The building is meant to sit in the park rather than on it, so its base is softened where
  // there is ground to do it with: a drift of low tropical foliage along the west face, and a
  // run either side of each cascade basin on the park side, following the arc. Nothing goes in
  // the spine, in the passage or in front of the glass at eye height — the planting stops at
  // knee height so the transparent ground floor still reads as transparent. A shrub goes in only
  // where its whole spread lands in planted ground (a lawn or a bed, passed in as onGreen): off
  // the block's paving, every walk and sidewalk, the café terraces beside the condo podium and
  // the office, and so clear of their umbrellas.
  const openGround = (x, z, r) => [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * (r + 0.1), Math.sin(k * Math.PI / 4) * (r + 0.1)])]
    .every(([u, v]) => onGreen(x + u, z + v) && !pavedAt(x + u, z + v) && !onRoute(x + u, z + v) && !inFurnishing(x + u, z + v, 0.15) && !museumHolds(x + u, z + v));
  const baseDrift = (x, z, i) => {
    const big = i % 3 === 0, w = big ? 1.5 : 1.15, d = big ? 1.3 : 1.05;
    if (!openGround(x, z, Math.max(w, d) / 2)) return;
    add('bush', x, 0.07 + (big ? 0.58 : 0.42), z, w, big ? 1.1 : 0.8, d, i % 2 ? 'shrub' : 'shrubDark', C);
  };
  let bi = 0;
  for (let z = M.zb + 4.0; z <= M.z1 - 3.0; z += full ? 3.6 : 7.2) baseDrift(M.x0 - 0.95, z, bi++);
  // the park side: the band between the apron's curved edge and the park's ground, skipping
  // the two basins and the mouth of the passage
  for (let t = -1.0; t <= 1.0; t += full ? 0.075 : 0.15) {
    const x = M.x0 + (t * 0.5 + 0.5) * (M.x1 - M.x0);
    if (x > M.gapW - 2.6 && x < M.gapE + 2.6) continue;
    if ([M.fallW, M.fallE].some((W) => Math.abs(x - W.x) < W.w / 2 + 2.2)) continue;
    const z = museumNorthAt(x, 0.25) - 0.75;
    if (Math.hypot(x - F[0], z - F[1]) < PLAZA_R + 0.35) continue;   // never on the plaza paving
    baseDrift(x, z, bi++);
  }

  // --- planting at the passage's south mouth ------------------------------------------------
  // The north mouth has none of its own: the apron's curved face stands 1.4 m off the plaza's
  // paving ring there, which is a strip of the park's own lawn, not room for beds.
  [[M.gapE + 0.4, M.gapE + 3.4], [M.gapW - 3.0, M.gapW - 0.4]].forEach(([a0, a1], j) => {
    K.bed(a0, a1, M.z1 + 0.3, M.z1 + 1.5, 0.07, 0.4);
    const n = full ? 3 : 2;
    for (let i = 0; i < n; i++) {
      add('bush', a0 + ((i + 0.5) / n) * (a1 - a0), 0.47 + 0.3, M.z1 + 0.9, 1.0, 0.6, 0.9, (i + j) % 3 ? 'shrubDark' : 'shrub', C);
    }
  });
  // Palms flank the passage's south mouth, on the frontage strip, marking the park gate — the
  // work the gate's own pair used to do before the building reached that frontage.
  const mouth = full
    ? [[M.gapW - 0.9, M.z1 + 2.0, 12.4], [M.gapE + 0.9, M.z1 + 2.0, 13.8]]
    : [[M.gapE + 0.9, M.z1 + 2.0, 13.8]];
  for (const [x, z, h] of mouth) {
    K.bed(x - 0.8, x + 0.8, z - 0.8, z + 0.8, 0.07, 0.5);
    palms.push({ x, z, y: 0.57, h, r: 2.5, spin: 0.7 * x, start: 0.69, dur: 0.05 });
  }
  return { parts: out, palms };
}
