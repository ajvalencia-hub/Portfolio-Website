// Tower 2 — "Garden Pavilion" full-floor penthouse.
//
// Concept: a more intimate single-level home in the sky with a small roof garden room.
//   Main level — a full floor of curved floor-to-ceiling glass (4.6 m level), set deeply
//         back on the south-west to open a broad, asymmetrical wraparound terrace; a refined
//         white roof overhang sweeps out over the outdoor dining, summer kitchen and shaded
//         lounge on the south; a curvilinear plunge pool and a separate spa sit in the
//         broad terrace inside the column ring; a private garden terrace with planted
//         windbreaks wraps the quieter north-east bedroom side.
//   Roof — a compact glass garden room on the core (private elevator and stair arrival),
//         its roof extended over a louvred mechanical court on the rear, and a planted roof
//         terrace behind a glass guard set inside the parapet.
//
// Structure concept (visual model, not an engineered design): the tower's columns and core
// stop at a 1.6 m plinth over the top residential floor; the enclosure, pool and spa bear
// on it inside the column ring (a declared transfer, as before); the roof garden room bears
// on the core and the enclosure's roof structure.
import { D2R, GLAZE, insidePlan, offsetPlan, rayRadius, partsKit } from './core.js';
import { poolSpecs, spaSpecs, freeformOutline } from './pools.js';
import { EDGE, bump, sector, radialKit, terraceLayout, furnitureKit } from './penthouse-kit.js';

export const T2_PH = { plinth: 1.6, phH: 4.6, pavH: 3.4 };

export function shortPenthouse(ctx, cfg, tier) {
  const { id, cx, cz, th, top, colR, core, topY, bodyName, t0 } = ctx;
  const H = T2_PH;
  const full = tier.name !== 'mobile';
  const R = radialKit(cx, cz, th);
  const { plan, at, pt } = R;
  const coreR = th.map((t) => rayRadius(cx, cz, core, t));
  const S = (fn) => th.map((t, i) => fn(t, i));

  // --- radial plans ---------------------------------------------------------------------------
  const g = S((t, i) => Math.max(coreR[i] + 3.6, top[i] - (1.0 + cfg.recess * bump(t, cfg.broad, 110))));        // glass line
  const d = S((t, i) => Math.min(Math.max(top[i] + 2.2, ctx.ribbon(t, ctx.floors, top[i]) - 0.2), colR[i] + ctx.maxCantilever - 0.05));
  const eave = S((t, i) => Math.min(g[i] + 0.7 + 3.0 * bump(t, cfg.overhang, 52), d[i] - 0.55));                  // refined roof overhang
  const pvR = S((t, i) => coreR[i] + 1.4 + 2.6 * bump(t, cfg.gardenRoom, 55));                                     // roof garden room
  const mechIn = (t) => at(coreR, t) + 1.4, mechOut = (t) => at(coreR, t) + 3.8;
  const mechPoly = R.sectorPoly(mechIn, mechOut, cfg.mech[0], cfg.mech[1], 16);
  const pvRoof = S((t, i) => Math.max(pvR[i], (coreR[i] + 3.8) * sector(t, cfg.mech[0] - 7, cfg.mech[1] + 7, 6)) + 0.7);

  const D0 = topY + H.plinth;          // main terrace (plinth top)
  const D = D0 + 0.03;                 // on the paving layer
  const Y1 = D0 + H.phH;               // roof terrace level
  const specs = [];
  const parts = [];
  const K = partsKit(parts);
  const FK = furnitureKit(K);
  const trees = [];
  const basins = [];
  const C = 'context';

  // --- plunge pool: a soft curvilinear oval set along the broad terrace inside the column ring
  const P = cfg.pool * D2R;
  const lo = (t) => at(g, t) + 1.0 + EDGE, hi = (t) => at(colR, t) - 0.6 - EDGE;
  const rc = (lo(P) + Math.min(hi(P), lo(P) + 3.2)) / 2;
  const b = Math.min(1.45, (Math.min(hi(P), lo(P) + 3.2) - lo(P)) / 2);
  const inBand = (x, z, pad) => {
    const t = Math.atan2(z - cz, x - cx), r = Math.hypot(x - cx, z - cz);
    return r >= lo(t) - EDGE + pad - 1e-6 && r <= hi(t) + EDGE - pad + 1e-6;
  };
  const [pcx, pcz] = pt(rc, P);
  let a = 5.2;
  let outline = freeformOutline(pcx, pcz, a, b, P + Math.PI / 2, 2.6, 64);
  while (a > 2.4 && !outline.every(([x, z]) => inBand(x, z, EDGE))) { a -= 0.1; outline = freeformOutline(pcx, pcz, a, b, P + Math.PI / 2, 2.6, 64); }
  const pool = poolSpecs(`${id}.pool`, { outline, cx: pcx, cz: pcz, deckY: D, depth: 1.1, N: full ? 96 : 64 });
  specs.push(...pool.specs);
  basins.push({ ...pool.basin, kind: 'pool', level: 'main', zoneBase: topY, support: 'plinth, inside the column ring' });
  // separate raised spa: nearest free spot beyond the pool's northern end, inside the band
  let spa = null;
  for (let k = 0; k < 70 && !spa; k += 2) {
    for (const sgn of [1, -1]) {
      const t = (cfg.pool + sgn * (18 + k)) * D2R;
      // the raised spa needs no depressed slab: its shell stays inside the column ring
      const r = (at(g, t) + 1.0 + at(colR, t) + 0.6) / 2;
      const [x, z] = pt(r, t);
      const ok = Array.from({ length: 16 }, (_, j) => (j / 16) * Math.PI * 2).every((u) => {
        const qx = x + Math.cos(u) * 1.2, qz = z + Math.sin(u) * 1.2;
        const tt = Math.atan2(qz - cz, qx - cx), rr = Math.hypot(qx - cx, qz - cz);
        return rr >= at(g, tt) + 1.0 && rr <= at(colR, tt) + 0.6;   // on the column line: declared edge-beam allowance
      });
      if (ok && outline.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.2 + EDGE + 0.6)) { spa = { x, z }; break; }
    }
  }
  if (spa) {
    const s = spaSpecs(`${id}.spa`, { x: spa.x, z: spa.z, r: 0.8, coping: 0.4, deckY: D, raise: 0.45, depth: 0.9, seg: full ? 40 : 28 });
    specs.push(...s.specs);
    basins.push({ ...s.basin, kind: 'spa', level: 'main', zoneBase: topY, support: 'plinth, at the column line (edge beam allowance)' });
  }

  // --- architecture --------------------------------------------------------------------------------
  const deckPts = plan(d), gPts = plan(g), pvPts = plan(pvR);
  const tm = (k, dd) => ({ start: t0 + k, dur: dd });
  specs.push(
    { name: `${id}.deck`, type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [0, H.plinth], parent: bodyName, y0: 0, h: H.plinth, ...tm(0, 0.004), pts: deckPts, holes: [pool.opening], wire: false },
    { name: `${id}.paving`, type: 'prism', kind: 'paving', glaze: GLAZE.bond, module: [1.2, 0.6], parent: `${id}.deck`, y0: 0, h: 0.03, ...tm(0.004, 0.003), pts: offsetPlan(deckPts, -0.3), holes: [pool.opening], wire: false },
    { name: `${id}.guard`, type: 'ring', kind: 'frame', glaze: GLAZE.guard, module: [0, 3.2], parent: `${id}.deck`, y0: 0, h: 1.1, ...tm(0.004, 0.003), pts: plan(d.map((r) => r - 0.06)), inner: plan(d.map((r) => r - 0.24)), wire: false },
    {
      name: `${id}.ph`, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, H.phH], floorH: H.phH, parent: `${id}.deck`, y0: 0, h: H.phH, ...tm(0.005, 0.007), pts: gPts,
      // refined white roof overhang: the fascia rises 0.3 m above the roof (never sharing its plane)
      slabs: { kind: 'slab', floors: [{ y: H.phH + 0.3, thick: 0.55, outer: plan(eave), inner: plan(g.map((r) => r - 0.3)) }] },
    },
    { name: `${id}.roofPave`, type: 'prism', kind: 'paving', glaze: GLAZE.bond, module: [1.2, 0.6], parent: `${id}.ph`, y0: 0, h: 0.03, ...tm(0.012, 0.002), pts: plan(g.map((r) => r - 0.62)), wire: false },
    { name: `${id}.roofGuard`, type: 'ring', kind: 'frame', glaze: GLAZE.guard, module: [0, 3.2], parent: `${id}.ph`, y0: 0, h: 1.1, ...tm(0.012, 0.002), pts: plan(g.map((r) => r - 0.34)), inner: plan(g.map((r) => r - 0.52)), wire: false },
    {
      name: `${id}.pav`, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, H.pavH], floorH: H.pavH, parent: `${id}.ph`, y0: 0, h: H.pavH, ...tm(0.012, 0.005), pts: pvPts,
      slabs: { kind: 'slab', floors: [{ y: H.pavH + 0.3, thick: 0.45, outer: plan(pvRoof), inner: plan(pvR.map((r) => r - 0.3)) }] },
    },
    { name: `${id}.mech`, type: 'prism', kind: 'screen', glaze: GLAZE.screen, module: [0, 3.2], parent: `${id}.ph`, y0: 0, h: H.pavH - 0.75, ...tm(0.012, 0.005), pts: mechPoly, wire: false },
  );

  // --- terrace layouts --------------------------------------------------------------------------------
  const main = terraceLayout(ctx, {
    name: 'main', D, deck: deckPts, guardIn: R.grow(d, -0.4),
    walkOut: [R.grow(g, 1.0)], faceOut: [R.grow(g, 0.25)],
    basins: [{ outline }], circles: spa ? [{ x: spa.x, z: spa.z, r: 1.2 }] : [],
    roofs: [{ poly: plan(eave), soffit: D0 + H.phH + 0.3 - 0.55 }], inner: (t) => at(g, t), outer: (t) => at(d, t),
  }, K);
  const roofLevel = Y1 + 0.03;
  const garden = terraceLayout(ctx, {
    name: 'roof', D: roofLevel, deck: plan(g.map((r) => r - 0.52)), guardIn: plan(g.map((r) => r - 0.9)),
    walkOut: [R.grow(pvR, 1.0), R.grownSector(mechIn, mechOut, cfg.mech[0], cfg.mech[1], 1.0)], faceOut: [R.grow(pvR, 0.25)],
    basins: [], circles: [], roofs: [{ poly: plan(pvRoof), soffit: Y1 + H.pavH + 0.3 - 0.45 }], inner: (t) => at(pvR, t), outer: (t) => at(g, t) - 0.52,
  }, K);
  const TP = FK.treePlanter(trees);
  // main level: dining and summer kitchen under the overhang, a shaded lounge, loungers by the
  // pool, and the private garden terrace (planted windbreaks, a sculptural tree) on the bedroom side
  main.place('kitchen', cfg.overhang - 30, FK.kitchen.rects(), (f) => FK.kitchen.build(f, D), { spread: 20, prefer: 'inner' });
  main.place('dining', cfg.overhang, FK.dining.rects(), (f) => FK.dining.build(f, D), { spread: 18 });
  main.place('living', cfg.overhang + 40, FK.living.rects(), (f) => FK.living.build(f, D), { spread: 24 });
  main.place('loungers', cfg.pool + 2, FK.loungers.rects(full ? 4 : 2), (f) => FK.loungers.build(f, D, full ? 4 : 2), { spread: 30 });
  const TPs = FK.treePlanter(trees, 0.85);
  main.place('tree', cfg.privateGarden, TPs.rects(), (f) => TPs.build(f, D, id), { spread: 24 });
  main.place('chairs', cfg.privateGarden + 26, FK.chairs.rects(), (f) => FK.chairs.build(f, D), { spread: 30 });
  for (const deg of cfg.windbreaks) main.place('planter', deg, FK.planter.rects(), (f) => FK.planter.build(f, D), { spread: 12 });
  for (let deg = 15; deg < 360; deg += full ? 40 : 80) main.place('light', deg, FK.light.rects(), (f) => FK.light.build(f, D), { spread: 8 });
  // roof garden: grasses and dense shrubs as a windbreak round the west, lounge chairs, a tree
  if (full) garden.place('tree', cfg.roofTree, TP.rects(), (f) => TP.build(f, roofLevel, id), { spread: 30 });
  garden.place('chairs', cfg.gardenRoom - 10, FK.chairs.rects(), (f) => FK.chairs.build(f, roofLevel), { spread: 30 });
  for (const deg of cfg.roofPlanters) garden.place('planter', deg, FK.planter.rects(2.6, 0.7), (f) => FK.planter.build(f, roofLevel, 2.6, 0.7, 0.6), { spread: 14 });

  const meta = {
    type: 'fullFloor', concept: 'Garden Pavilion: full-floor residence, broad asymmetrical terrace, plunge pool and spa, roof garden room',
    deckY: D0, phTopY: Y1, roofTopY: Y1 + H.pavH + 0.3, plinth: H.plinth,
    levels: [
      { name: 'main', D, deck: deckPts, guardH: 1.1, enclosures: [gPts], minTerrace: Math.min(...d.map((r, i) => r - g[i])), wrap: true },
      { name: 'roof', D: roofLevel, deck: plan(g.map((r) => r - 0.52)), guardH: 1.1, enclosures: [pvPts, mechPoly], minTerrace: Math.min(...g.map((r, i) => r - 0.52 - pvR[i])), wrap: false },
    ],
    enclosures: [
      { name: 'Full-floor residence', poly: gPts, y0: D0, y1: Y1 },
      { name: 'Roof garden room + private elevator arrival', poly: pvPts, y0: Y1, y1: Y1 + H.pavH },
    ],
    mech: { name: 'Louvred mechanical court under the garden-room roof', poly: mechPoly, y0: Y1, y1: Y1 + H.pavH - 0.75, footprint: plan(pvRoof) },
    living: null, basins, layout: [...main.layout, ...garden.layout], minTerrace: Math.min(...d.map((r, i) => r - g[i])),
    broadTerrace: Math.max(...d.map((r, i) => r - g[i])), spaPlaced: !!spa, poolType: 'curvilinear plunge', core,
    radii: Array.from({ length: 24 }, (_, k) => { const t = (k * 15) * D2R; return { deg: k * 15, core: +at(coreR, t).toFixed(1), col: +at(colR, t).toFixed(1), top: +at(top, t).toFixed(1), g: +at(g, t).toFixed(1), d: +at(d, t).toFixed(1), eave: +at(eave, t).toFixed(1), pv: +at(pvR, t).toFixed(1) }; }),
  };
  const lite = new Set([`${id}.paving`, `${id}.roofPave`]);
  return {
    specs: full ? specs : specs.filter((q) => !lite.has(q.name)), parts, palms: [], trees, meta,
    transfer: {
      name: 'Tower 2 penthouse plinth', y: topY, outer: plan(colR), inner: core, allowance: H.plinth,
      note: 'the full-floor enclosure, plunge pool and spa bear on a 1.6 m plinth spanning core → column ring; loading, deflection, waterproofing, drainage and pool plant unresolved',
    },
  };
}
