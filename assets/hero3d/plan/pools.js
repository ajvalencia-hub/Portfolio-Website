// Shared pool and spa generator (resident resort pool, penthouse pools, hotel pool).
//
// A pool is described by its waterline outline and the top of the surrounding deck.
// It produces, as curved context-phase specs:
//   • coping  — a stone lip set 12 cm outside the waterline, 5 cm proud of the deck
//   • tile    — a dark waterline band between the water and the coping (reads as depth)
//   • water   — the surface, 12 cm below the deck, split into bands (swim, steps, shelf)
// plus the basin as data (shell outline, soffit level) for the structural checks:
// the basin is not rendered because it lies inside the deck build-up.
// All dimensions are conceptual; basin depth, loading, waterproofing and drainage are
// unresolved engineering matters.
import { RES, GLAZE, offsetPlan, clipBand, circlePlan, resampleByAngle } from './core.js';

export const POOL_DETAIL = {
  copingW: 0.45,       // coping width outside the tile band
  tileW: 0.12,         // waterline tile band
  copingUp: 0.05,      // coping lip above the deck
  waterDown: 0.12,     // water surface below the deck
  shell: 0.3,          // basin wall + waterproofing allowance
  slab: 0.3,           // basin floor slab
};

const ctx = (name, extra) => ({
  name, module: RES, parent: null, glaze: GLAZE.none, start: 0.655, dur: 0.01, wire: false, phase: 'context', ...extra,
});

// outline: waterline polygon (star-shaped about [cx, cz]); deckY: top of the surrounding deck.
// bands: [{ from, to, kind }] along `axis` ('x' | 'z'); defaults to one swim band.
// gutter: a recessed charcoal drainage slot outside the coping (the deck opening is then its outer edge)
export function poolSpecs(name, { outline, cx, cz, deckY, depth = 1.2, N = 96, bands = null, axis = 'x', ripple = null, gutter = 0 }) {
  const D = POOL_DETAIL;
  const rs = (poly) => resampleByAngle(poly, cx, cz, N);
  const water = rs(outline);
  const tileOuter = rs(offsetPlan(outline, D.tileW));
  const copingOuter = rs(offsetPlan(outline, D.tileW + D.copingW));
  const W = deckY - D.waterDown;
  const opening = gutter > 0 ? rs(offsetPlan(outline, D.tileW + D.copingW + gutter)) : copingOuter;
  const specs = [
    ctx(`${name}.coping`, { type: 'ring', kind: 'coping', y0: deckY - 0.35, h: 0.35 + D.copingUp, pts: copingOuter, inner: tileOuter }),
    ctx(`${name}.tile`, { type: 'ring', kind: 'poolTile', y0: W - 0.3, h: 0.3 + D.waterDown - 0.03, pts: tileOuter, inner: water }),
  ];
  if (gutter > 0) specs.push(ctx(`${name}.gutter`, { type: 'ring', kind: 'charcoal', y0: deckY - 0.35, h: 0.3, pts: opening, inner: copingOuter }));
  const ramp = ripple ?? [cx, cz, 0, 0];
  const list = bands ?? [{ from: -1e4, to: 1e4, kind: 'pool' }];
  const ax = axis === 'x' ? 0 : 1;
  list.forEach((b, k) => {
    const pts = list.length === 1 ? water : clipBand(water, ax, b.from, b.to);
    if (pts.length >= 3) specs.push(ctx(b.name ?? `${name}.water${k}`, { type: 'prism', kind: b.kind, glaze: GLAZE.water, y0: W - 0.2, h: 0.2, pts, ramp }));
  });
  const shell = offsetPlan(outline, D.shell);
  return {
    specs,
    opening, basin: { name, outline: water, shell, waterY: W, floorY: W - depth, soffitY: W - depth - D.slab, deckY, depth },
  };
}

// Raised spa: coping wall above the deck, water just below its lip.
// integrated: the spa stands in the end of a pool, so its coping wall starts below the pool water
export function spaSpecs(name, { x, z, r, deckY, raise = 0.45, depth = 0.9, seg = 40, integrated = false, coping = 0.55 }) {
  const inner = circlePlan(x, z, r, seg);
  const tile = circlePlan(x, z, r + 0.1, seg);
  const outer = circlePlan(x, z, r + coping, seg);
  const top = deckY + raise;
  return {
    specs: [
      ctx(`${name}.coping`, { type: 'ring', kind: 'coping', y0: deckY - (integrated ? 0.5 : 0.05), h: raise + (integrated ? 0.5 : 0.05), pts: outer, inner: tile }),
      ctx(`${name}.tile`, { type: 'ring', kind: 'poolTile', y0: top - 0.4, h: 0.32, pts: tile, inner }),
      ctx(`${name}.water`, { type: 'prism', kind: 'shelf', glaze: GLAZE.water, y0: top - 0.4, h: 0.3, pts: inner, ramp: [x, z, 0, 1] }),
    ],
    basin: { name, outline: inner, shell: circlePlan(x, z, r + 0.3, seg), waterY: top - 0.1, floorY: top - 0.1 - depth, soffitY: top - 0.1 - depth - 0.25, deckY, depth },
  };
}

// crescent outline following a curved terrace: band between radii r0..r1 about (cx, cz)
// over angles a0..a1 (radians), with semicircular ends
export function crescentOutline(cx, cz, r0, r1, a0, a1, steps = 24) {
  const pts = [];
  const rm = (r0 + r1) / 2, hw = (r1 - r0) / 2;
  const at = (r, a) => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  for (let k = 0; k <= steps; k++) pts.push(at(r1, a0 + ((a1 - a0) * k) / steps));
  const [ex, ez] = at(rm, a1);
  for (let k = 1; k < 10; k++) { const t = a1 + (Math.PI * k) / 10; pts.push([ex + hw * Math.cos(t), ez + hw * Math.sin(t)]); }
  for (let k = steps; k >= 0; k--) pts.push(at(r0, a0 + ((a1 - a0) * k) / steps));
  const [sx, sz] = at(rm, a0);
  for (let k = 1; k < 10; k++) { const t = a0 + Math.PI + (Math.PI * k) / 10; pts.push([sx + hw * Math.cos(t), sz + hw * Math.sin(t)]); }
  return pts;
}

// rotated ellipse-like freeform outline (superellipse exponent n) centred at (x, z)
export function freeformOutline(x, z, a, b, rotRad, n = 2.4, seg = 64) {
  const c = Math.cos(rotRad), s = Math.sin(rotRad);
  return Array.from({ length: seg }, (_, i) => {
    const t = (i / seg) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    const lx = a * Math.sign(ct) * Math.abs(ct) ** (2 / n);
    const lz = b * Math.sign(st) * Math.abs(st) ** (2 / n);
    return [x + lx * c - lz * s, z + lx * s + lz * c];
  });
}
