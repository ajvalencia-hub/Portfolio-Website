// Penthouse suites for the residential towers: one enclosed, occupied penthouse level
// on a deep structural plinth over the top residential floor, a generous curved private
// terrace, a pool basin set into the plinth, a separate raised spa, a white roof
// overhang or pergola for shade, contained tropical planting, a glass guard at the
// terrace edge and a mechanical screen integrated on the penthouse roof.
//
// Structure concept (visual model, not an engineered design):
//   • the tower's perimeter columns and core stop at the plinth, a 1.8 m structural
//     zone spanning core → column ring; the penthouse perimeter posts and both basins
//     bear on it (a declared transfer, recorded in meta.transfers)
//   • the pool and spa sit inside the column ring, clear of the core and of the
//     penthouse enclosure; the terrace beyond the column ring is a cantilevered slab
//     that carries only furniture, planters and the guard
//   • basin depth, loading, waterproofing and drainage are unresolved professional matters
import { D2R, GLAZE, clamp, offsetPlan, rayRadius, insidePlan, partsKit, polarRadius } from './core.js';
import { poolSpecs, spaSpecs, POOL_DETAIL } from './pools.js';

export const PLINTH = 1.8;          // structural / basin zone above the top residential floor
export const PENTHOUSE_H = 4.8;     // one tall occupied level
const EDGE = POOL_DETAIL.tileW + POOL_DETAIL.copingW;   // waterline → coping outer edge
const CLEAR_GLASS = 1.0;           // walkway between penthouse glass and coping
const CLEAR_COLUMNS = 0.6;         // coping to the column line (chord between column centres)

const bump = (t, centre, halfWidth) => {
  let d = Math.atan2(Math.sin(t - centre), Math.cos(t - centre));
  d = Math.abs(d) / halfWidth;
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
};

// ctx: { id, cx, cz, N, th, top (radii of the top floorplate), colR (column ring radii),
//        columns, core (plan), topY (world), bodyName, t0, shape }
// cfg: { poolAngle, recess: [min, max, halfWidth°], poolType: 'crescent' | 'oval',
//        spa: 'separate' | 'integrated', spaSide: ±1,
//        shade: 'overhang' | 'pergola', shadeAngle, deckEdge }
export function penthouseSuite(ctx, cfg, tier) {
  const { id, cx, cz, N, th, top, colR, core, topY, bodyName, t0 } = ctx;
  const full = tier.name !== 'mobile';
  const plan = (rs) => rs.map((r, i) => [cx + r * Math.cos(th[i]), cz + r * Math.sin(th[i])]);
  const idx = (t) => ((Math.round((((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * N)) % N);
  const at = (rs, t) => rs[idx(t)];
  const P = cfg.poolAngle * D2R;
  const [rMin, rMax, hw] = cfg.recess;

  // --- plans ------------------------------------------------------------------------
  // penthouse enclosure: recessed deeply on the pool side, closer to the edge elsewhere
  const phR = th.map((t, i) => top[i] - (rMin + (rMax - rMin) * bump(t, P, hw * D2R)));
  // terrace deck: beyond the top floorplate, within the balcony cantilever limit
  const deckR = th.map((t, i) => Math.min(top[i] + cfg.deckEdge, colR[i] + ctx.maxCantilever - 0.05));
  // radial band available to water + coping: glass walkway inside, column clearance outside
  const lo = (t) => at(phR, t) + CLEAR_GLASS + EDGE;
  const hi = (t) => at(colR, t) - CLEAR_COLUMNS - EDGE;

  const D = topY + PLINTH;                       // terrace deck top (world)
  const basins = [];
  const specs = [];
  const parts = [];
  const K = partsKit(parts);
  const C = 'context';
  const palms = [];
  const trees = [];

  // --- pool ---------------------------------------------------------------------------
  const SPA_R = 0.8, SPA_COPING = 0.45;
  let poolOutline, poolCentre, poolSpan = 0, integratedSpa = null;
  if (cfg.poolType === 'crescent') {
    // follows the curved terrace; the arc grows while the band keeps ≥ 2.6 m of water
    const width = (t) => Math.min(3.0, hi(t) - lo(t));
    for (let s = 0.05; s < 0.25; s += 0.005) { if (width(P - s) < 2.6 || width(P + s) < 2.6) break; poolSpan = s; }   // ≤ ±14°, leaving room for the spa
    const steps = 28;
    const pts = [];
    const pt = (r, t) => [cx + r * Math.cos(t), cz + r * Math.sin(t)];
    const a0 = P - poolSpan, a1 = P + poolSpan;
    const r0 = (t) => lo(t), r1 = (t) => lo(t) + width(t);
    for (let k = 0; k <= steps; k++) { const t = a0 + ((a1 - a0) * k) / steps; pts.push(pt(r1(t), t)); }
    const endCap = (t, flip) => {
      const [mx, mz] = pt((r0(t) + r1(t)) / 2, t), w = (r1(t) - r0(t)) / 2;
      for (let k = 1; k < 10; k++) { const u = t + (flip ? Math.PI : 0) + (Math.PI * k) / 10; pts.push([mx + w * Math.cos(u), mz + w * Math.sin(u)]); }
    };
    endCap(a1, false);
    for (let k = steps; k >= 0; k--) { const t = a0 + ((a1 - a0) * k) / steps; pts.push(pt(r0(t), t)); }
    endCap(a0, true);
    poolOutline = pts;
    poolCentre = pt((lo(P) + hi(P)) / 2, P);
  } else {
    // freeform oval set tangentially in the widest part of the terrace; with an integrated
    // spa the oval shortens until the raised spa at its end also fits the band
    const rc = (lo(P) + Math.min(hi(P), lo(P) + 3.6)) / 2;
    const b = Math.min(1.8, (Math.min(hi(P), lo(P) + 3.6) - lo(P)) / 2);
    const tx = -Math.sin(P), tz = Math.cos(P), nx = Math.cos(P), nz = Math.sin(P);
    const make = (aa) => Array.from({ length: 64 }, (_, i) => {
      const u = (i / 64) * Math.PI * 2;
      const lx = aa * Math.sign(Math.cos(u)) * Math.abs(Math.cos(u)) ** (2 / 2.6);
      const lz = b * Math.sign(Math.sin(u)) * Math.abs(Math.sin(u)) ** (2 / 2.6);
      return [cx + nx * rc + tx * lx + nx * lz, cz + nz * rc + tz * lx + nz * lz];
    });
    const inBand = (x, z, pad) => {
      const t = Math.atan2(z - cz, x - cx), r = Math.hypot(x - cx, z - cz);
      return r >= lo(t) - EDGE + pad - 1e-6 && r <= hi(t) + EDGE - pad + 1e-6;
    };
    const spaAt = (aa) => [cx + nx * rc + tx * cfg.spaSide * (aa - 0.1), cz + nz * rc + tz * cfg.spaSide * (aa - 0.1)];
    const spaFits = (aa) => {
      const [sx0, sz0] = spaAt(aa);
      return Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2).every((u) => inBand(sx0 + Math.cos(u) * (SPA_R + SPA_COPING), sz0 + Math.sin(u) * (SPA_R + SPA_COPING), 0));
    };
    let a = 4.8;
    while (a > 2.4 && !(make(a).every(([x, z]) => inBand(x, z, EDGE)) && (cfg.spa !== 'integrated' || spaFits(a)))) a -= 0.05;
    poolOutline = make(a);
    poolCentre = [cx + nx * rc, cz + nz * rc];
    poolSpan = a / rc;
    if (cfg.spa === 'integrated') integratedSpa = spaAt(a);
  }
  const pool = poolSpecs(`${id}.pool`, {
    outline: poolOutline, cx: poolCentre[0], cz: poolCentre[1], deckY: D, depth: 1.2, N: full ? 96 : 64,
  });
  // relabel: penthouse water belongs to the tower group but arrives with the landscape
  specs.push(...pool.specs);
  basins.push({ ...pool.basin, kind: 'pool' });

  // --- spa: integrated at the pool's end, or the first position beyond the pool end with
  //     room for its coping inside the structural band
  const spaR = SPA_R;
  let spa = null;
  const side = cfg.spaSide;
  if (integratedSpa) {
    spa = { x: integratedSpa[0], z: integratedSpa[1], integrated: true };
  } else {
    // search the whole plinth band: the spa's coping circle must stay between the penthouse
    // walkway and the column line, with a 0.6 m walk to the pool coping; nearest to the pool wins
    const circleFits = (x, z, rad) => Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2).every((u) => {
      const px = x + Math.cos(u) * rad, pz = z + Math.sin(u) * rad;
      const t = Math.atan2(pz - cz, px - cx), r = Math.hypot(px - cx, pz - cz);
      return r >= at(phR, t) + CLEAR_GLASS && r <= at(colR, t) - CLEAR_COLUMNS;
    });
    let best = null;
    for (let deg = 0; deg < 360; deg += 1) {
      const t = deg * D2R;
      for (let r = at(phR, t) + CLEAR_GLASS + spaR + SPA_COPING; r <= at(colR, t) - CLEAR_COLUMNS - spaR - 0.55; r += 0.1) {
        const x = cx + r * Math.cos(t), z = cz + r * Math.sin(t);
        if (!circleFits(x, z, spaR + SPA_COPING)) continue;
        if (!poolOutline.every(([px, pz]) => Math.hypot(px - x, pz - z) > spaR + SPA_COPING + EDGE + 0.6)) continue;
        const d = Math.abs(Math.atan2(Math.sin(t - P), Math.cos(t - P)));
        const score = d + (Math.sign(Math.sin(t - P)) === side ? 0 : 0.2);
        if (!best || score < best.score) best = { x, z, score };
      }
    }
    if (best) spa = { x: best.x, z: best.z };
  }
  if (spa) {
    const s = spaSpecs(`${id}.spa`, { x: spa.x, z: spa.z, r: spaR, coping: SPA_COPING, deckY: D, raise: 0.45, depth: 0.9, seg: full ? 40 : 28, integrated: !!spa.integrated });
    specs.push(...s.specs);
    basins.push({ ...s.basin, kind: 'spa', integrated: !!spa.integrated });
  }

  // --- plinth deck with the pool opening, penthouse, roof, screen, guard -----------------
  const deckPts = plan(deckR);
  const phPts = plan(phR);
  specs.unshift({
    name: `${id}.deck`, type: 'prism', kind: 'slab', glaze: GLAZE.none, module: [0, PLINTH], parent: bodyName, y0: 0, h: PLINTH,
    start: t0, dur: 0.006, pts: deckPts, holes: [pool.opening], wire: false,
  });
  // the plinth reads as white structure like the tower; the terrace floor is a 30 mm pale
  // stone paving layer inset 0.3 m from the slab edge (never sharing the plinth's faces)
  specs.splice(1, 0, {
    name: `${id}.paving`, type: 'prism', kind: 'paving', glaze: GLAZE.bond, module: [1.2, 0.6], parent: `${id}.deck`, y0: 0, h: 0.03,
    start: t0 + 0.004, dur: 0.004, pts: offsetPlan(deckPts, -0.3), holes: [pool.opening], wire: false,
  });
  // shade: the roof slab sweeps out over one side of the terrace
  const S = cfg.shadeAngle * D2R;
  const eaveR = th.map((t, i) => {
    const reach = 0.7 + (cfg.shade === 'overhang' ? 3.2 * bump(t, S, 55 * D2R) : 0);
    return Math.min(phR[i] + reach, deckR[i] - 0.6);
  });
  const phName = `${id}.ph`;
  specs.push({
    name: phName, type: 'prism', kind: 'glass', glaze: GLAZE.penthouse, module: [0, PENTHOUSE_H], floorH: PENTHOUSE_H,
    parent: `${id}.deck`, y0: 0, h: PENTHOUSE_H, start: t0 + 0.007, dur: 0.008, pts: phPts,
    // roof slab: fascia rises 0.3 m above the roof so it never shares the roof plane
    slabs: { kind: 'slab', floors: [{ y: PENTHOUSE_H + 0.3, thick: 0.75, outer: plan(eaveR), inner: plan(phR.map((r) => r - 0.3)) }] },
  });
  const screenR = phR.map((r) => r * 0.5);
  specs.push({
    name: `${id}.screen`, type: 'ring', kind: 'frame', glaze: GLAZE.screen, module: [0, 3.2], parent: phName, y0: 0, h: 1.9,
    start: t0 + 0.016, dur: 0.004, pts: plan(screenR), inner: plan(screenR.map((r) => r - 0.3)),
  });
  specs.push({
    name: `${id}.guard`, type: 'ring', kind: 'frame', glaze: GLAZE.guard, module: [0, 3.2], parent: `${id}.deck`, y0: 0, h: 1.1,
    start: t0 + 0.007, dur: 0.004, pts: plan(deckR.map((r) => r - 0.06)), inner: plan(deckR.map((r) => r - 0.24)), wire: false,
  });

  // --- terrace layout -----------------------------------------------------------------------
  // Furniture groups are laid out in the terrace's own frame (tangent a along the curved
  // edge, radial b away from the core) and accepted only where every footprint stays
  //   • ≥ 1.0 m off the penthouse glass (a continuous walk around the enclosure),
  //   • ≥ 0.45 m inside the glass guard (canopies ≥ 0.15 m), so nothing crosses the edge,
  //   • ≥ 0.5 m clear of the pool and spa copings,
  //   • clear of every other group (0.4 m), and below the roof eave where it passes over.
  // Groups that cannot fit are searched along the terrace, then dropped rather than forced.
  const layout = [];
  const EAVE_SOFFIT = D + PENTHOUSE_H + 0.3 - 0.75;
  const eaveAt = (t) => at(eaveR, t);
  const frame = (t, r) => {
    const nx = Math.cos(t), nz = Math.sin(t), ux = -nz, uz = nx;
    const p = (a, b) => [cx + nx * (r + b) + ux * a, cz + nz * (r + b) + uz * a];
    return { t, r, p, tan: t + Math.PI / 2 };
  };
  const corners = (f, q) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => f.p(q.a + (i * q.la) / 2, q.b + (j * q.lb) / 2));
  const samples = (f, q) => {
    const out = [];
    const na = Math.max(2, Math.ceil(q.la / 0.3)), nb = Math.max(2, Math.ceil(q.lb / 0.3));
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) out.push(f.p(q.a - q.la / 2 + (q.la * i) / na, q.b - q.lb / 2 + (q.lb * j) / nb));
    return out;
  };
  const inQuad = (x, z, quad, pad) => {
    // quad corners in order; point inside the rectangle grown by pad
    const [a, b, , d] = quad;
    const ex = b[0] - a[0], ez = b[1] - a[1], fx = d[0] - a[0], fz = d[1] - a[1];
    const le = Math.hypot(ex, ez), lf = Math.hypot(fx, fz);
    const u = ((x - a[0]) * ex + (z - a[1]) * ez) / le, v = ((x - a[0]) * fx + (z - a[1]) * fz) / lf;
    return u > -pad && u < le + pad && v > -pad && v < lf + pad;
  };
  const segDist = (x, z, poly) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const ex = bx - ax, ez = bz - az;
      const u = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
      best = Math.min(best, Math.hypot(x - ax - ex * u, z - az - ez * u));
    }
    return best;
  };
  const SPA_CLEAR = spaR + SPA_COPING + 0.5;
  // clearance outlines measured along the plan normals (the radial tests below are coarse)
  const dPlan = plan(deckR), gPlan = plan(phR);
  const insideGuard = offsetPlan(dPlan, -0.4), insideDeck = offsetPlan(dPlan, -0.15);
  const glassWalk = offsetPlan(gPlan, 1.0), glassFace = offsetPlan(gPlan, 0.25);
  const fits = (f, rects) => rects.every((q) => {
    const layer = q.layer || 'floor', canopy = layer === 'canopy';
    return samples(f, q).every(([x, z]) => {
      const t = Math.atan2(z - cz, x - cx), r = Math.hypot(x - cx, z - cz);
      if (r > at(deckR, t) - (canopy ? 0.15 : 0.45)) return false;
      if (!canopy && r < at(phR, t) + (q.nearGlass ? 0.25 : 1.0)) return false;
      if (canopy && r < at(phR, t) + 0.3) return false;
      if (q.top > EAVE_SOFFIT - 0.15 && r < eaveAt(t) + 0.3) return false;
      if (!insidePlan(x, z, canopy ? insideDeck : insideGuard)) return false;
      if (!canopy && insidePlan(x, z, q.nearGlass ? glassFace : glassWalk)) return false;
      if (!canopy) {
        if (insidePlan(x, z, poolOutline) || segDist(x, z, poolOutline) < EDGE + 0.5) return false;
        if (spa && Math.hypot(x - spa.x, z - spa.z) < SPA_CLEAR) return false;
      }
      return layout.every((o) => o.layer !== layer || !inQuad(x, z, o.quad, 0.4));
    }) && layout.every((o) => o.layer !== layer || !o.quad.some(([x, z]) => inQuad(x, z, corners(f, q), 0.4)));
  });
  // search outward from the preferred angle; radial position from the guard inward ('outer')
  // or from the glass outward ('inner')
  const place = (name, at0, rects, build, { spread = 70, prefer = 'outer' } = {}) => {
    const bMin = Math.min(...rects.map((q) => q.b - q.lb / 2)), bMax = Math.max(...rects.map((q) => q.b + q.lb / 2));
    for (let k = 0; k <= spread; k += 2) {
      for (const sgn of k ? [1, -1] : [1]) {
        const t = (at0 + sgn * k) * D2R;
        const rIn = at(phR, t) + 0.25 - bMin, rOut = at(deckR, t) - 0.45 - bMax;
        if (rOut < rIn) continue;
        for (let s = 0; s <= rOut - rIn + 1e-6; s += 0.15) {
          const f = frame(t, prefer === 'outer' ? rOut - s : rIn + s);
          if (!fits(f, rects)) continue;
          for (const q of rects) layout.push({ name, layer: q.layer || 'floor', quad: corners(f, q), top: q.top });
          build(f);
          return f;
        }
      }
    }
    return null;
  };
  const box = (f, a, b, y0, h, la, lb, color) => K.oriented(...f.p(a, b), y0, h, la, lb, f.tan, color);
  const cfgLayout = cfg.layout;

  // sun loungers in pairs with side tables and umbrellas, heads toward the penthouse
  const loungers = (f, n) => {
    const pairs = Math.ceil(n / 2);
    for (let pi = 0; pi < pairs; pi++) {
      const c = (pi - (pairs - 1) / 2) * 2.6;
      for (const d of n - pi * 2 >= 2 ? [-0.45, 0.45] : [0]) K.loungerAt(...f.p(c + d, 0), D, f.t + Math.PI);
      K.sideTableAt(...f.p(c + 1.3, -0.55), D);
      if (pi % 2 === 0) K.umbrella(...f.p(c + 1.3, 0.15), D, 2.4);
    }
  };
  const loungerRects = (n) => {
    const pairs = Math.ceil(n / 2), la = (pairs - 1) * 2.6 + 2.45;
    return [{ a: 0.36, b: 0, la, lb: 2.1, top: 0.8 }, { a: 1.3 - (pairs - 1) * 1.3, b: 0.15, la: 2.4, lb: 2.4, top: 3.05, layer: 'canopy' }];
  };
  // outdoor living: L-sofa backed toward the penthouse, coffee table, two lounge chairs
  const living = (f) => {
    box(f, 0, -1.0, D, 0.7, 3.2, 0.85, 'cushion');
    box(f, -1.2, 0.0, D, 0.7, 0.85, 1.4, 'cushion');
    box(f, 0.4, 0.05, D, 0.36, 1.3, 0.8, 'frame');
    for (const a of [-0.2, 1.1]) box(f, a, 1.25, D, 0.72, 0.8, 0.8, 'cushion');
    K.sideTableAt(...f.p(1.95, -1.0), D);
  };
  const livingRects = [{ a: 0.27, b: 0.11, la: 3.9, lb: 3.2, top: 0.75 }];
  // outdoor dining for six under a slatted white pergola
  const dining = (f, pergola) => {
    box(f, 0, 0, D, 0.75, 2.4, 1.0, 'frame');
    for (const a of [-0.8, 0, 0.8]) for (const b of [-0.85, 0.85]) box(f, a, b, D, 0.85, 0.45, 0.45, 'cushion');
    if (!pergola) return;
    for (const a of [-2.0, 2.0]) for (const b of [-1.3, 1.3]) K.column(...f.p(a, b), D, 2.7, 0.08, 'frame', C);
    for (const b of [-1.3, 1.3]) box(f, 0, b, D + 2.7, 0.18, 4.3, 0.16, 'frame');
    for (let a = -1.95; a <= 1.96; a += 0.43) box(f, a, 0, D + 2.88, 0.1, 0.12, 2.9, 'frame');
  };
  const diningRects = (pergola) => pergola
    ? [{ a: 0, b: 0, la: 4.3, lb: 2.9, top: 2.98 }, { a: 0, b: 0, la: 4.3, lb: 2.9, top: 2.98, layer: 'canopy' }]
    : [{ a: 0, b: 0, la: 2.9, lb: 2.3, top: 0.85 }];
  // two daybeds facing out, a low table between them
  const daybeds = (f) => { for (const a of [-1.25, 1.25]) K.daybed(...f.p(a, 0), D, f.t + Math.PI); K.sideTableAt(...f.p(0, 0.3), D); };
  const daybedRects = [{ a: 0, b: 0, la: 4.2, lb: 2.3, top: 0.55 }];
  // outdoor kitchen counter against the penthouse wall with stools
  const bar = (f) => {
    box(f, 0, 0, D, 0.95, 3.2, 0.7, 'stone');
    box(f, -0.6, 0, D + 0.95, 0.03, 0.9, 0.5, 'charcoal');
    for (const a of [-1.0, 0, 1.0]) K.column(...f.p(a, 0.85), D, 0.75, 0.2, 'metal', C);
  };
  const barRects = [{ a: 0, b: 0.4, la: 3.2, lb: 1.5, top: 1.0, nearGlass: true }];
  // palm in a planter: trunk footprint on the floor, crown as a canopy below the eave
  const palmPlanter = (f, h) => {
    const soil = K.planterAt(...f.p(0, 0), D, 1.4, 1.4, f.tan, 0.9, false);
    for (const [a, b] of [[-0.35, -0.35], [0.35, 0.35]]) K.add('cone', ...((p) => [p[0], soil + 0.3, p[1]])(f.p(a, b)), 0.6, 0.6, 0.6, 'shrub', C);
    const [x, z] = f.p(0, 0);
    palms.push({ x, z, y: soil, h, r: 1.25, spin: f.t * 3, start: 0.68, dur: 0.05, deck: true, planterH: 0.9, penthouse: true });
  };
  const palmRects = (h) => [{ a: 0, b: 0, la: 1.4, lb: 1.4, top: 0.9 }, { a: 0, b: 0, la: 2.5, lb: 2.5, top: 0.9 + h, layer: 'canopy' }];
  // long low planters inside the guard, framing the groups
  const planterRun = (f) => K.planterAt(...f.p(0, 0), D, 3.4, 0.8, f.tan, 0.6, true);
  const planterRects = [{ a: 0, b: 0, la: 3.4, lb: 0.8, top: 1.3 }];

  const palmH = (k) => 2.5 + ((k * 0.37) % 0.6);   // crowns stay below the roof eave
  for (const g of cfgLayout) {
    if (!full && g.desktopOnly) continue;
    if (g.type === 'loungers') { const n = full ? g.n : 2; place('loungers', g.at, loungerRects(n), (f) => loungers(f, n), g); }
    if (g.type === 'living') place('living', g.at, livingRects, living, g);
    if (g.type === 'dining') place('dining', g.at, diningRects(g.pergola), (f) => dining(f, g.pergola), g);
    if (g.type === 'daybeds') place('daybeds', g.at, daybedRects, daybeds, g);
    if (g.type === 'bar') place('bar', g.at, barRects, bar, { ...g, prefer: 'inner' });
    if (g.type === 'planters') g.at.forEach((a) => place('planter', a, planterRects, planterRun, { spread: 16 }));
    if (g.type === 'palms') g.at.slice(0, full ? g.at.length : 1).forEach((a, k) => place('palm', a, palmRects(palmH(k)), (f) => palmPlanter(f, palmH(k)), { spread: 30 }));
  }
  // low lights mark the walk inside the guard
  for (let a = 5; a < 360; a += full ? 24 : 48) place('light', a, [{ a: 0, b: 0, la: 0.3, lb: 0.3, top: 0.6 }], (f) => K.deckLight(...f.p(0, 0), D, 0.45), { spread: 6 });

  const phMeta = {
    deckY: D, deckTopY: D, phTopY: D + PENTHOUSE_H, plinth: PLINTH, deck: deckPts, enclosure: phPts, basins,
    minTerrace: Math.min(...deckR.map((r, i) => r - phR[i])),
    layout: layout.map((o) => ({ name: o.name, layer: o.layer, quad: o.quad, top: +(o.top + D).toFixed(2) })), eave: plan(eaveR), eaveSoffit: EAVE_SOFFIT,
    spaPlaced: !!spa, poolType: cfg.poolType, poolLength: +(poolSpan * 2 * (lo(P) + 1.3) + 2.6).toFixed(1),
  };
  return {
    specs, parts, palms, trees, meta: phMeta,
    transfer: {
      name: `${id === 'A.t1' ? 'Tower 1' : 'Tower 2'} penthouse plinth`,
      y: topY, outer: plan(colR), inner: core, allowance: PLINTH,
      note: 'penthouse perimeter posts, pool and spa basins bear on a 1.8 m structural plinth spanning core → column ring; loading, deflection, waterproofing and drainage unresolved',
    },
  };
}

export { polarRadius, clamp, offsetPlan, rayRadius, insidePlan };
