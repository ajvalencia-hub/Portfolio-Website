// Tower 1 — "Sky Villa" duplex penthouse.
//
// Concept: a two-storey home in the sky that completes the tall tower's rotation.
//   PH1 — the principal residence: a full floor of recessed floor-to-ceiling curved glass
//         (4.5 m clear level vs 3.2 m typical) set back behind a continuous wraparound
//         terrace whose slab edge keeps turning with the tower's balcony ribbons; the
//         primary bedroom wing opens onto a quieter north-east terrace screened by planters.
//   Crown — a deep white structural slab (1.7 m: structure, pool basins, drainage, pool
//         plant) that overhangs the PH1 terrace as a shading eave and resolves the twist.
//   PH2 — the roof level: a glass entertaining pavilion wrapped around the private elevator
//         foyer at the core, a concealed louvred mechanical court on the rear, and a roof
//         terrace with a long infinity-edge pool following the curved west perimeter, a
//         separate raised spa, an open dining pavilion and summer kitchen under a thin
//         sculptural canopy blade, a sunken conversation lounge and wind-tolerant planters.
//   The double-height living room (≈ 10 m) faces the principal south-west view: its glass
//   rises from the PH1 floor through a notch in the crown to the pavilion roof.
//
// Structure concept (visual model, not an engineered design): perimeter columns and the
// core continue through PH1 to the crown; the crown acts as a transfer zone for the PH2
// pavilion and the basins; the pool sits over the enclosed PH1 floor, inside the column
// line plus a declared 0.45 m edge-beam allowance, and never over the double-height room.
import { D2R, GLAZE, insidePlan, offsetPlan, rayRadius, partsKit } from './core.js';
import { poolSpecs, spaSpecs } from './pools.js';
import { EDGE, bump, sector, radialKit, crescent, terraceLayout, furnitureKit } from './penthouse-kit.js';

export const T1_PH = { deck: 0.45, ph1H: 4.5, crown: 1.7, ph2H: 4.2, roof: 0.45, canopy: 0.22 };

export function tallPenthouse(ctx, cfg, tier) {
  const { id, cx, cz, th, top, colR, core, topY, bodyName, t0 } = ctx;
  const H = T1_PH;
  const full = tier.name !== 'mobile';
  const R = radialKit(cx, cz, th);
  const { plan, at, pt } = R;
  const coreR = th.map((t) => rayRadius(cx, cz, core, t));
  const S = (fn) => th.map((t, i) => fn(t, i));

  // --- radial plans ------------------------------------------------------------------------
  const g1 = S((t, i) => Math.max(colR[i] + 0.3, top[i] - 1.4));                                  // PH1 glass line
  const d1 = S((t, i) => Math.min(Math.max(top[i] + 2.4, ctx.ribbon(t, ctx.floors) - 0.3), colR[i] + ctx.maxCantilever - 0.05));  // PH1 terrace edge (continues the ribbons)
  const crownBase = S((t, i) => Math.min(Math.max(g1[i] + 1.1, ctx.ribbon(t, ctx.floors + 1) - 0.4), colR[i] + 3.2));
  const crownR = S((t, i) => crownBase[i] + (colR[i] + 1.05 - crownBase[i]) * sector(t, cfg.pool[0] - 8, cfg.pool[1] + 8, 8));
  const LIV = cfg.living;                                                                         // [a0, a1] degrees
  const livIn = (t) => at(coreR, t) + 1.4, livOut = (t) => at(g1, t) + 0.1;
  const livingPoly = R.sectorPoly(livIn, livOut, LIV[0], LIV[1], 20);
  const room = cfg.room;                                                                          // PH2 lounge / bar room sector
  const pav = S((t, i) => coreR[i] + 1.6 + Math.max(0, g1[i] - 4.2 - coreR[i] - 1.6) * sector(t, room[0], room[1], 10));
  const mechIn = (t) => at(coreR, t) + 1.6, mechOut = (t) => at(coreR, t) + 4.2;
  const mechPoly = R.sectorPoly(mechIn, mechOut, cfg.mech[0], cfg.mech[1], 18);
  // pavilion roof: a slim white plate following the pavilion and the double-height room with
  // a 0.5 m eave, gently smoothed; the mechanical court keeps its own louvred enclosure so the
  // roof never grows into a cap over the whole terrace
  const roofRaw = S((t, i) => Math.max(pav[i], (g1[i] + 0.1) * sector(t, LIV[0] - 4, LIV[1] + 4, 4)) + 0.5);
  const win = Math.round(th.length * 10 / 360);
  const roofR = roofRaw.map((_, i) => {
    let acc = 0;
    for (let k = -win; k <= win; k++) acc += roofRaw[(i + k + th.length) % th.length];
    return Math.max(acc / (2 * win + 1), pav[i] + 0.35, (g1[i] + 0.3) * sector(th[i], LIV[0], LIV[1], 2));
  });

  const D1 = topY + H.deck;
  const Y1 = D1 + H.ph1H;              // crown base
  const D2 = Y1 + H.crown;             // roof terrace (crown top)
  const Y2 = D2 + H.ph2H;              // pavilion roof base
  const specs = [];
  const parts = [];
  const K = partsKit(parts);
  const FK = furnitureKit(K);
  const trees = [];
  const basins = [];
  const C = 'context';

  // --- roof-terrace water ---------------------------------------------------------------------
  const [pa0, pa1] = cfg.pool;
  const w1 = (t) => at(colR, t) - 0.15, w0 = (t) => w1(t) - 2.0;
  const poolOutline = crescent(pt, w0, w1, pa0, pa1, 30);
  const poolMid = pt((w0(((pa0 + pa1) / 2) * D2R) + w1(((pa0 + pa1) / 2) * D2R)) / 2, ((pa0 + pa1) / 2) * D2R);
  const pool = poolSpecs(`${id}.pool`, { outline: poolOutline, cx: poolMid[0], cz: poolMid[1], deckY: D2 + 0.03, depth: 1.2, N: full ? 110 : 72 });
  specs.push(...pool.specs);
  basins.push({ ...pool.basin, kind: 'pool', level: 'PH2', zoneBase: Y1, support: 'PH1 floor, inside the column line + edge beam', infinity: true });
  // infinity edge: a dark catch trough just beyond the outer coping, then the glass guard
  // sunken conversation lounge cut into the crown
  const pitT = cfg.pit * D2R;
  const pitR = at(pav, pitT) + 1.0 + 2.25;
  const [pitX, pitZ] = pt(pitR, pitT);
  const pitHole = Array.from({ length: 40 }, (_, k) => [pitX + 2.1 * Math.cos((k / 40) * Math.PI * 2), pitZ + 2.1 * Math.sin((k / 40) * Math.PI * 2)]);
  // raised spa: nearest free position past the pool's southern end, inside the crown edge
  let spa = null;
  for (let deg = pa1 + 6; deg < pa1 + 60 && !spa; deg += 2) {
    const t = deg * D2R;
    // over the enclosed PH1 floor, inside the column line + edge-beam allowance
    for (let r = Math.min(at(crownR, t) - 0.45, at(colR, t) + 0.4) - 1.35; r > at(pav, t) + 1.0 + 1.4; r -= 0.2) {
      const [x, z] = pt(r, t);
      if (poolOutline.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.3 + EDGE + 0.7)) continue;
      if (Math.hypot(x - pitX, z - pitZ) < 2.1 + 1.3 + 0.8) continue;
      if (insidePlan(x, z, offsetPlan(livingPoly, 2.4))) continue;
      spa = { x, z }; break;
    }
  }
  if (spa) {
    const s = spaSpecs(`${id}.spa`, { x: spa.x, z: spa.z, r: 0.85, coping: 0.45, deckY: D2 + 0.03, raise: 0.45, depth: 0.9, seg: full ? 40 : 28 });
    specs.push(...s.specs);
    basins.push({ ...s.basin, kind: 'spa', level: 'PH2', zoneBase: Y1, support: 'crown slab' });
  }

  // --- architecture -------------------------------------------------------------------------------
  const crownPts = plan(crownR);
  const livingHole = offsetPlan(livingPoly, 0.03);
  const tm = (k, d) => ({ start: t0 + k, dur: d });
  specs.push(
    { name: `${id}.ph1deck`, type: 'prism', kind: 'slab', glaze: GLAZE.bond, module: [1.2, 0.6], parent: bodyName, y0: 0, h: H.deck, ...tm(0, 0.004), pts: plan(d1), wire: false },
    { name: `${id}.guard1`, type: 'ring', kind: 'frame', glaze: GLAZE.guard, module: [0, 3.2], parent: `${id}.ph1deck`, y0: 0, h: 1.1, ...tm(0.004, 0.003), pts: plan(d1.map((r) => r - 0.06)), inner: plan(d1.map((r) => r - 0.24)), wire: false },
    { name: `${id}.ph1`, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, H.ph1H], floorH: H.ph1H, parent: `${id}.ph1deck`, y0: 0, h: H.ph1H, ...tm(0.004, 0.006), pts: plan(g1) },
    { name: `${id}.living`, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, H.ph1H + H.crown + H.ph2H], floorH: H.ph1H + H.crown + H.ph2H, parent: `${id}.ph1deck`, y0: 0, h: H.ph1H + H.crown + H.ph2H, ...tm(0.004, 0.012), pts: livingPoly, wire: false },
    { name: `${id}.crown`, type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [0, H.crown], parent: `${id}.ph1`, y0: 0, h: H.crown, ...tm(0.010, 0.003), pts: crownPts, holes: [livingHole, pool.opening, pitHole], wire: false },
    { name: `${id}.crownPave`, type: 'prism', kind: 'paving', glaze: GLAZE.bond, module: [1.2, 0.6], parent: `${id}.crown`, y0: 0, h: 0.03, ...tm(0.013, 0.002), pts: offsetPlan(crownPts, -0.3), holes: [offsetPlan(livingPoly, 0.12), pool.opening, pitHole], wire: false },
    { name: `${id}.guard2`, type: 'ring', kind: 'frame', glaze: GLAZE.guard, module: [0, 3.2], parent: `${id}.crown`, y0: 0, h: 1.1, ...tm(0.013, 0.003), pts: offsetPlan(crownPts, -0.06), inner: offsetPlan(crownPts, -0.24), wire: false },
    { name: `${id}.pav`, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, H.ph2H], floorH: H.ph2H, parent: `${id}.crown`, y0: 0, h: H.ph2H, ...tm(0.013, 0.006), pts: plan(pav) },
    { name: `${id}.mech`, type: 'prism', kind: 'screen', glaze: GLAZE.screen, module: [0, 3.2], parent: `${id}.crown`, y0: 0, h: H.ph2H - 0.6, ...tm(0.013, 0.006), pts: mechPoly, wire: false },
    { name: `${id}.roof`, type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [0, H.roof], parent: `${id}.pav`, y0: 0, h: H.roof, ...tm(0.019, 0.002), pts: plan(roofR), wire: false },
  );
  // canopy blade: a thin white plane springing from the pavilion glass 3.35 m above the roof
  // terrace — below the pavilion roof, so it reads as its own sculptural element — sweeping
  // over the dining pavilion, kitchen and sunken lounge and tapering to points at both ends;
  // slim white posts at its outer edge. Built as a slab ring on the crown (zero width elsewhere).
  const [c0, c1] = cfg.canopy;
  const CAN_Y = 3.35;
  const canopyW = (t) => {
    const u = ((t / D2R - c0) % 360 + 360) % 360 / (c1 - c0);
    return u > 1 ? 0 : Math.sin(Math.PI * u) ** 0.6;
  };
  const canopyOut = (t) => at(pav, t) + (at(crownR, t) - 0.9 - at(pav, t)) * canopyW(t);
  const canopyPoly = R.sectorPoly((t) => at(pav, t), canopyOut, c0, c1, 28);
  specs.find((q) => q.name === `${id}.crown`).slabs = {
    kind: 'frame', floors: [{ y: H.crown + CAN_Y, thick: H.canopy, outer: plan(th.map((t) => canopyOut(t) + 0.001)), inner: plan(pav) }],
  };
  const posts = [];
  for (const deg of cfg.canopyPosts) {
    const t = deg * D2R;
    const [x, z] = pt(canopyOut(t) - 0.35, t);
    K.column(x, z, D2 + 0.03, CAN_Y - H.canopy - 0.03, 0.08, 'frame');
    posts.push({ x, z, r: 0.2 });
  }
  // infinity-edge catch trough: a dark channel just beyond the outer coping
  specs.push({ name: `${id}.trough`, type: 'prism', kind: 'charcoal', glaze: GLAZE.none, module: [0, 0.3], parent: null, y0: D2 - 0.3, h: 0.35, start: 0.655, dur: 0.01, wire: false, phase: 'context',
    pts: R.sectorPoly((t) => w1(t) + EDGE + 0.03, (t) => w1(t) + EDGE + 0.36, pa0 + 2, pa1 - 2, 30) });
  // sunken lounge: floor, a built-in curved banquette and a low table
  specs.push(
    { name: `${id}.pitFloor`, type: 'prism', kind: 'paving', glaze: GLAZE.none, module: [0, 0.05], parent: null, y0: D2 - 0.55, h: 0.05, start: 0.655, dur: 0.01, wire: false, phase: 'context', pts: offsetPlan(pitHole, -0.01) },
    { name: `${id}.pitSeat`, type: 'ring', kind: 'cushion', glaze: GLAZE.none, module: [0, 0.4], parent: null, y0: D2 - 0.5, h: 0.42, start: 0.655, dur: 0.01, wire: false, phase: 'context', pts: offsetPlan(pitHole, -0.05), inner: offsetPlan(pitHole, -0.7) },
  );
  K.column(pitX, pitZ, D2 - 0.5, 0.36, 0.55, 'charcoal', C);

  // --- terrace layouts ---------------------------------------------------------------------------
  const ph1Pts = plan(g1), pavPts = plan(pav);
  const lay = [];
  const PH2 = terraceLayout(ctx, {
    name: 'PH2', D: D2 + 0.03, deck: crownPts, guardIn: R.grow(crownR, -0.4),
    walkOut: [R.grow(pav, 1.0), R.grownSector(mechIn, mechOut, cfg.mech[0], cfg.mech[1], 1.0), R.grownSector(livIn, livOut, LIV[0], LIV[1], 1.0)],
    faceOut: [R.grow(pav, 0.25), R.grownSector(mechIn, mechOut, cfg.mech[0], cfg.mech[1], 1.0), R.grownSector(livIn, livOut, LIV[0], LIV[1], 1.0)],
    basins: [{ outline: poolOutline }], circles: [...(spa ? [{ x: spa.x, z: spa.z, r: 1.3 }] : []), { x: pitX, z: pitZ, r: 2.1 }, ...posts],
    roofs: [{ poly: plan(roofR), soffit: Y2 }, { poly: canopyPoly, soffit: D2 + CAN_Y - H.canopy }], inner: (t) => at(pav, t), outer: (t) => at(crownR, t),
  }, K);
  const P1 = terraceLayout(ctx, {
    name: 'PH1', D: D1, deck: plan(d1), guardIn: R.grow(d1, -0.4),
    walkOut: [R.grow(g1, 0.9), R.grownSector(livIn, livOut, LIV[0], LIV[1], 0.9)], faceOut: [R.grow(g1, 0.25)],
    basins: [], circles: [], roofs: [], inner: (t) => at(g1, t), outer: (t) => at(d1, t),
  }, K);
  const TP = FK.treePlanter(trees);
  const g = (L, name, deg, rects, build, opts) => L.place(name, deg, rects, build, opts);
  // PH2: dining pavilion and summer kitchen under the canopy, loungers along the pool,
  // lounge chairs by the spa, sculptural trees and grasses on the windward rear
  g(PH2, 'dining', cfg.dining, FK.dining.rects(), (f) => FK.dining.build(f, D2 + 0.03), { spread: 20 });
  g(PH2, 'kitchen', cfg.kitchen, FK.kitchen.rects(), (f) => FK.kitchen.build(f, D2 + 0.03), { spread: 24, prefer: 'inner' });
  for (const deg of [pa0 + 12, pa0 + 22]) g(PH2, 'lounger', deg, FK.loungersAlong.rects(1), (f) => FK.loungersAlong.build(f, D2 + 0.03, 1), { spread: 10, prefer: 'inner' });
  g(PH2, 'chairs', cfg.spaChairs, FK.chairs.rects(), (f) => FK.chairs.build(f, D2 + 0.03), { spread: 30 });
  for (const deg of cfg.trees.slice(0, full ? 2 : 1)) g(PH2, 'tree', deg, TP.rects(), (f) => TP.build(f, D2 + 0.03, id), { spread: 20 });
  for (const deg of cfg.planters) g(PH2, 'planter', deg, FK.planter.rects(), (f) => FK.planter.build(f, D2 + 0.03), { spread: 14 });
  for (let deg = 10; deg < 360; deg += full ? 40 : 80) g(PH2, 'light', deg, FK.light.rects(), (f) => FK.light.build(f, D2 + 0.03), { spread: 8 });
  // PH1: the primary bedroom terrace behind planted privacy screens, chairs beneath the
  // double-height living room, low lights along the wraparound terrace
  g(P1, 'daybeds', cfg.bedroom, FK.daybedsAlong.rects(), (f) => FK.daybedsAlong.build(f, D1), { spread: 20 });
  for (const deg of cfg.screens) g(P1, 'screen', deg, FK.screenPlanter.rects(1.3), (f) => FK.screenPlanter.build(f, D1, 1.3), { spread: 10 });
  g(P1, 'chairs', (LIV[0] + LIV[1]) / 2, FK.chairs.rects(), (f) => FK.chairs.build(f, D1), { spread: 20 });
  g(P1, 'planter', cfg.bedroom + 30, FK.planter.rects(2.6), (f) => FK.planter.build(f, D1, 2.6), { spread: 10 });
  for (let deg = 25; deg < 360; deg += full ? 45 : 90) g(P1, 'light', deg, FK.light.rects(), (f) => FK.light.build(f, D1), { spread: 8 });
  lay.push(...PH2.layout, ...P1.layout);

  const minTerrace = Math.min(...d1.map((r, i) => r - g1[i]));
  const meta = {
    type: 'duplex', concept: 'Sky Villa duplex: principal floor + roof pavilion, double-height living, infinity pool, canopy blade, sunken lounge',
    deckY: D1, phTopY: Y1, roofTopY: Y2 + H.roof, crownDepth: H.crown,
    levels: [
      { name: 'PH1', D: D1, deck: plan(d1), guardH: 1.1, enclosures: [ph1Pts, livingPoly], minTerrace, wrap: true },
      { name: 'PH2', D: D2 + 0.03, deck: crownPts, guardH: 1.1, enclosures: [pavPts, mechPoly, livingPoly], minTerrace: Math.min(...crownR.map((r, i) => r - pav[i])), wrap: true },
    ],
    enclosures: [
      { name: 'PH1 principal floor', poly: ph1Pts, y0: D1, y1: Y1 },
      { name: 'Double-height living room', poly: livingPoly, y0: D1, y1: Y2 },
      { name: 'PH2 pavilion + private elevator foyer', poly: pavPts, y0: D2, y1: Y2 },
    ],
    mech: { name: 'Louvred mechanical court beside the pavilion (screened walls and roof grille)', poly: mechPoly, y0: D2, y1: Y2 - 0.6, footprint: crownPts },
    living: livingPoly, pitCircle: [pitX, pitZ, 2.1], basins, layout: lay, minTerrace, spaPlaced: !!spa, poolType: 'infinity crescent',
    canopy: canopyPoly, core,
    radii: Array.from({ length: 24 }, (_, k) => { const t = (k * 15) * D2R; return { deg: k * 15, core: +at(coreR, t).toFixed(1), col: +at(colR, t).toFixed(1), top: +at(top, t).toFixed(1), g1: +at(g1, t).toFixed(1), d1: +at(d1, t).toFixed(1), crown: +at(crownR, t).toFixed(1), pav: +at(pav, t).toFixed(1) }; }),
  };
  // mobile: drop purely cosmetic layers (terrace paving inlay, banquette) to save draw calls
  const lite = new Set([`${id}.crownPave`, `${id}.pitSeat`]);
  return {
    specs: full ? specs : specs.filter((q) => !lite.has(q.name)), parts, palms: [], trees, meta,
    transfer: {
      name: 'Tower 1 crown (PH2 transfer zone)', y: Y1, outer: plan(colR), inner: core, allowance: H.crown,
      note: 'PH2 pavilion posts, the roof pool, spa and sunken lounge bear on a 1.7 m crown slab spanning core → column ring; the pool’s outer wall sits on a declared edge beam at the column line; loading, deflection, waterproofing, drainage and pool plant unresolved',
    },
  };
}
