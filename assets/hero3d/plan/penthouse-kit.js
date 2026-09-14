// Shared toolkit for the two penthouse generators (penthouse-tall.js, penthouse-short.js).
//
//   • radial plans about the tower centre (smooth angular bumps, interpolated sampling)
//   • a terrace layout engine: furniture and planting groups are placed in the terrace's
//     own frame (a along the curved edge, b radially outward) and accepted only when every
//     footprint clears the guard, the glass walks, enclosures, basins and other groups
//   • simplified, legible high-end outdoor furniture and built-in planters
//
// Everything here is conceptual geometry for a visual model. Structure, waterproofing,
// drainage, pool engineering, wind and guard loads are unresolved professional matters.
import { D2R, insidePlan, offsetPlan, partsKit } from './core.js';
import { POOL_DETAIL } from './pools.js';

export const EDGE = POOL_DETAIL.tileW + POOL_DETAIL.copingW;   // waterline → coping outer edge

export const bump = (t, centreDeg, halfWidthDeg) => {
  let d = Math.atan2(Math.sin(t - centreDeg * D2R), Math.cos(t - centreDeg * D2R));
  d = Math.abs(d) / (halfWidthDeg * D2R);
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
};
// 1 inside [a0, a1] degrees with smooth shoulders of `soft` degrees
export const sector = (t, a0, a1, soft = 8) => {
  const deg = ((t / D2R) % 360 + 360) % 360;
  const inside = (x) => { const u = ((x - a0) % 360 + 360) % 360; return u <= ((a1 - a0) % 360 + 360) % 360; };
  if (inside(deg)) {
    const u = ((deg - a0) % 360 + 360) % 360, span = ((a1 - a0) % 360 + 360) % 360;
    const e = Math.min(u, span - u);
    return e >= soft ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * e) / soft);
  }
  return 0;
};

export function radialKit(cx, cz, th) {
  const N = th.length;
  const plan = (rs) => rs.map((r, i) => [cx + r * Math.cos(th[i]), cz + r * Math.sin(th[i])]);
  // linear interpolation between samples at any angle
  const at = (rs, t) => {
    const u = ((((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * N;
    const i = Math.floor(u) % N, f = u - Math.floor(u);
    return rs[i] * (1 - f) + rs[(i + 1) % N] * f;
  };
  const pt = (r, t) => [cx + r * Math.cos(t), cz + r * Math.sin(t)];
  const polar = (x, z) => [Math.hypot(x - cx, z - cz), Math.atan2(z - cz, x - cx)];
  // closed sector polygon between radius functions over [a0, a1] degrees
  const sectorPoly = (rIn, rOut, a0, a1, steps = 24) => {
    const span = ((a1 - a0) % 360 + 360) % 360;
    const ts = Array.from({ length: steps + 1 }, (_, k) => (a0 + (span * k) / steps) * D2R);
    return [...ts.map((t) => pt(rOut(t), t)), ...ts.slice().reverse().map((t) => pt(rIn(t), t))];
  };
  // radial growth of star-shaped plans (offsetPlan's averaged normals misbehave on concave
  // radial profiles), and sector polygons grown on all four sides
  const grow = (rs, d) => plan(rs.map((r) => r + d));
  const grownSector = (rIn, rOut, a0, a1, d, steps = 24) => {
    const mid = (a0 + a1) / 2 * D2R;
    const dd = (d / Math.max(1, (rIn(mid) + rOut(mid)) / 2)) / D2R;
    return sectorPoly((t) => rIn(t) - d, (t) => rOut(t) + d, a0 - dd, a1 + dd, steps);
  };
  return { plan, at, pt, polar, sectorPoly, grow, grownSector };
}

// crescent waterline following the perimeter between radius functions r0(t) < r1(t)
export function crescent(pt, r0, r1, a0deg, a1deg, steps = 28) {
  const a0 = a0deg * D2R, a1 = a1deg * D2R;
  const pts = [];
  for (let k = 0; k <= steps; k++) { const t = a0 + ((a1 - a0) * k) / steps; pts.push(pt(r1(t), t)); }
  const cap = (t, from) => {
    const [mx, mz] = pt((r0(t) + r1(t)) / 2, t), w = (r1(t) - r0(t)) / 2;
    for (let k = 1; k < 10; k++) { const u = t + from + (Math.PI * k) / 10; pts.push([mx + w * Math.cos(u), mz + w * Math.sin(u)]); }
  };
  cap(a1, 0);
  for (let k = steps; k >= 0; k--) { const t = a0 + ((a1 - a0) * k) / steps; pts.push(pt(r0(t), t)); }
  cap(a0, Math.PI);
  return pts;
}

export const segDist = (x, z, poly) => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ez = bz - az;
    const u = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(x - ax - ex * u, z - az - ez * u));
  }
  return best;
};

// ---------------------------------------------------------------------------
// Terrace layout engine
// level: { name, D (deck top), deck (edge polygon), guardIn (inside-guard polygon),
//          walkOut (polygons whose surroundings stay clear: enclosure outlines, grown by
//          the walk), faceOut (the same outlines grown 0.25 m, for counters against a wall),
//          basins ([{ outline }]), circles ([{ x, z, r }]), roofs ([{ poly, soffit }]),
//          inner(t), outer(t) radius bounds used to seed candidate positions }
// ---------------------------------------------------------------------------
export function terraceLayout(ctx, level, K) {
  const { cx, cz } = ctx;
  const layout = [];
  const frame = (t, r) => {
    const nx = Math.cos(t), nz = Math.sin(t), ux = -nz, uz = nx;
    return { t, r, tan: t + Math.PI / 2, p: (a, b) => [cx + nx * (r + b) + ux * a, cz + nz * (r + b) + uz * a] };
  };
  const corners = (f, q) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => f.p(q.a + (i * q.la) / 2, q.b + (j * q.lb) / 2));
  const samples = (f, q) => {
    const out = [];
    const na = Math.max(2, Math.ceil(q.la / 0.3)), nb = Math.max(2, Math.ceil(q.lb / 0.3));
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) out.push(f.p(q.a - q.la / 2 + (q.la * i) / na, q.b - q.lb / 2 + (q.lb * j) / nb));
    return out;
  };
  const inQuad = (x, z, quad, pad) => {
    const [a, b, , d] = quad;
    const ex = b[0] - a[0], ez = b[1] - a[1], fx = d[0] - a[0], fz = d[1] - a[1];
    const le = Math.hypot(ex, ez), lf = Math.hypot(fx, fz);
    const u = ((x - a[0]) * ex + (z - a[1]) * ez) / le, v = ((x - a[0]) * fx + (z - a[1]) * fz) / lf;
    return u > -pad && u < le + pad && v > -pad && v < lf + pad;
  };
  const deckIn = offsetPlan(level.deck, -0.12);
  const enclCore = level.walkOut.map((p) => offsetPlan(p, -0.7));
  const roofs = level.roofs.map((r) => ({ soffit: r.soffit, poly: offsetPlan(r.poly, 0.3) }));
  const why = {};
  const fail = (k) => { why[k] = (why[k] || 0) + 1; return false; };
  const fits = (f, rects) => rects.every((q) => {
    const layer = q.layer || 'floor', canopy = layer === 'canopy';
    return samples(f, q).every(([x, z]) => {
      if (!insidePlan(x, z, canopy ? deckIn : level.guardIn)) return fail('edge');
      if (!canopy) {
        for (const p of (q.nearGlass ? level.faceOut : level.walkOut)) if (insidePlan(x, z, p)) return fail('walk');
        for (const b of level.basins) if (insidePlan(x, z, b.outline) || segDist(x, z, b.outline) < EDGE + 0.5) return fail('basin');
        for (const c of level.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.5) return fail('circle');
      } else {
        for (const p of enclCore) if (insidePlan(x, z, p)) return fail('canopy-encl');
      }
      for (const roof of roofs) if (q.top + level.D > roof.soffit - 0.15 && insidePlan(x, z, roof.poly)) return fail('roof');
      return layout.every((o) => o.layer !== layer || !inQuad(x, z, o.quad, 0.4)) || fail('clash');
    }) && (layout.every((o) => o.layer !== layer || !o.quad.some(([x, z]) => inQuad(x, z, corners(f, q), 0.4))) || fail('clash2'));
  });
  // search outward from the preferred angle; radial seeds from the edge inward ('outer') or
  // from the enclosure outward ('inner')
  const place = (name, atDeg, rects, build, { spread = 60, prefer = 'outer' } = {}) => {
    const bMin = Math.min(...rects.map((q) => q.b - q.lb / 2)), bMax = Math.max(...rects.map((q) => q.b + q.lb / 2));
    for (let k = 0; k <= spread; k += 2) {
      for (const sgn of k ? [1, -1] : [1]) {
        const t = (atDeg + sgn * k) * D2R;
        const rIn = level.inner(t) + 0.25 - bMin, rOut = level.outer(t) - 0.45 - bMax;
        if (rOut < rIn) continue;
        for (let s = 0; s <= rOut - rIn + 1e-6; s += 0.15) {
          const f = frame(t, prefer === 'outer' ? rOut - s : rIn + s);
          if (!fits(f, rects)) continue;
          for (const q of rects) layout.push({ name, level: level.name, layer: q.layer || 'floor', quad: corners(f, q), top: +(q.top + level.D).toFixed(2) });
          build(f);
          return f;
        }
      }
    }
    // development hook: report why a group could not be placed
    if (typeof globalThis.__phDebug === 'function') globalThis.__phDebug(level.name, name, atDeg, { ...why }, level);
    for (const k of Object.keys(why)) delete why[k];
    return null;
  };
  return { place, layout };
}

// ---------------------------------------------------------------------------
// Furniture and planting builders (frame-relative). Each returns its footprint rects.
// ---------------------------------------------------------------------------
export function furnitureKit(K, palms) {
  const C = 'context';
  const box = (f, a, b, y0, h, la, lb, color) => K.oriented(...f.p(a, b), y0, h, la, lb, f.tan, color);
  return {
    box,
    // pairs of sun loungers radial to the edge (heads toward the residence), side tables
    loungers: {
      rects: (n) => { const pairs = Math.ceil(n / 2); return [{ a: 0.36, b: 0, la: (pairs - 1) * 2.6 + 2.45, lb: 2.1, top: 0.8 }]; },
      build: (f, D, n) => {
        const pairs = Math.ceil(n / 2);
        for (let pi = 0; pi < pairs; pi++) {
          const c = (pi - (pairs - 1) / 2) * 2.6;
          for (const d of [-0.45, 0.45]) K.loungerAt(...f.p(c + d, 0), D, f.t + Math.PI);
          K.sideTableAt(...f.p(c + 1.3, -0.55), D);
        }
      },
    },
    // two daybeds set end to end along the edge (narrow wraparound terraces)
    daybedsAlong: {
      rects: () => [{ a: 0, b: 0, la: 2.3, lb: 1.7, top: 0.55 }],
      build: (f, D) => { K.daybed(...f.p(0, 0), D, f.tan); },
    },
    // loungers set along the edge (for narrow bands beside a pool)
    loungersAlong: {
      rects: (n) => [{ a: 0, b: 0, la: n * 2.3, lb: 0.9, top: 0.8 }],
      build: (f, D, n) => { for (let k = 0; k < n; k++) K.loungerAt(...f.p((k - (n - 1) / 2) * 2.3, 0), D, f.tan + (k % 2 ? Math.PI : 0)); },
    },
    // low sectional sofa, coffee table and two lounge chairs facing the view
    living: {
      rects: () => [{ a: 0.27, b: 0.11, la: 3.9, lb: 3.2, top: 0.75 }],
      build: (f, D) => {
        box(f, 0, -1.0, D, 0.7, 3.2, 0.85, 'cushion');
        box(f, -1.2, 0.0, D, 0.7, 0.85, 1.4, 'cushion');
        box(f, 0.4, 0.05, D, 0.36, 1.3, 0.8, 'charcoal');
        for (const a of [-0.2, 1.1]) box(f, a, 1.25, D, 0.72, 0.8, 0.8, 'cushion');
        K.sideTableAt(...f.p(1.95, -1.0), D);
      },
    },
    // long dining table for eight
    dining: {
      rects: () => [{ a: 0, b: 0, la: 3.6, lb: 2.3, top: 0.85 }],
      build: (f, D) => {
        box(f, 0, 0, D, 0.75, 3.0, 1.05, 'frame');
        for (const a of [-1.05, -0.35, 0.35, 1.05]) for (const b of [-0.9, 0.9]) box(f, a, b, D, 0.85, 0.46, 0.46, 'cushion');
      },
    },
    // summer kitchen: stone counter with grill and sink inserts against a wall, bar stools
    kitchen: {
      rects: () => [{ a: 0, b: 0.45, la: 4.2, lb: 1.6, top: 1.0, nearGlass: true }],
      build: (f, D) => {
        box(f, 0, 0, D, 0.95, 4.2, 0.75, 'stone');
        box(f, -1.1, 0, D + 0.95, 0.03, 1.0, 0.5, 'charcoal');
        box(f, 0.9, 0, D + 0.95, 0.02, 0.6, 0.4, 'metal');
        for (const a of [-1.2, -0.2, 0.8, 1.8]) K.column(...f.p(a, 0.95), D, 0.75, 0.2, 'metal', C);
      },
    },
    // two daybeds facing out with a low table between
    daybeds: {
      rects: () => [{ a: 0, b: 0, la: 4.2, lb: 2.3, top: 0.55 }],
      build: (f, D) => { for (const a of [-1.25, 1.25]) K.daybed(...f.p(a, 0), D, f.t + Math.PI); K.sideTableAt(...f.p(0, 0.3), D); },
    },
    // pair of lounge chairs and a side table
    chairs: {
      rects: () => [{ a: 0, b: 0, la: 2.8, lb: 1.2, top: 0.75 }],
      build: (f, D) => { for (const a of [-0.8, 0.8]) box(f, a, 0, D, 0.72, 0.85, 0.85, 'cushion'); K.sideTableAt(...f.p(0, 0.1), D); },
    },
    // built-in planter with tall grasses and dense shrubs (a wind and privacy buffer)
    planter: {
      rects: (len = 3.2, depth = 0.8) => [{ a: 0, b: 0, la: len, lb: depth, top: 1.6 }],
      build: (f, D, len = 3.2, depth = 0.8, h = 0.75) => {
        box(f, 0, 0, D, h, len, depth, 'frame');
        box(f, 0, 0, D + h, 0.05, len - 0.2, depth - 0.2, 'planter');
        const n = Math.max(2, Math.round(len / 0.55));
        for (let k = 0; k < n; k++) {
          const a = (k - (n - 1) / 2) * (len - 0.4) / Math.max(1, n - 1);
          const grass = k % 3 !== 1;
          const [x, z] = f.p(a, (k % 2 ? 0.12 : -0.12) * depth);
          if (grass) K.add('cone', x, D + h + 0.55, z, 0.34, 1.1, 0.34, k % 2 ? 'shrubLight' : 'shrub', C);
          else K.add('cone', x, D + h + 0.35, z, 0.7, 0.7, 0.7, 'shrubDark', C);
        }
      },
    },
    // privacy screen planter set radially (perpendicular to the edge)
    screenPlanter: {
      rects: (len = 2.4) => [{ a: 0, b: 0, la: 0.8, lb: len, top: 1.6 }],
      build: (f, D, len = 2.4) => {
        box(f, 0, 0, D, 0.8, 0.8, len, 'frame');
        box(f, 0, 0, D + 0.8, 0.05, 0.6, len - 0.2, 'planter');
        for (let k = 0; k < Math.round(len / 0.45); k++) {
          const [x, z] = f.p(0, -len / 2 + 0.3 + k * 0.45);
          K.add('cone', x, D + 0.8 + 0.65, z, 0.36, 1.3, 0.36, k % 2 ? 'shrubLight' : 'shrubDark', C);
        }
      },
    },
    // sculptural small tree in a protected square planter (trees array entry)
    treePlanter: (trees, s = 1) => ({
      rects: () => [{ a: 0, b: 0, la: 1.6 * s, lb: 1.6 * s, top: 0.9 }, { a: 0, b: 0, la: 2.4 * s, lb: 2.4 * s, top: 3.4, layer: 'canopy' }],
      build: (f, D, tag) => {
        box(f, 0, 0, D, 0.9, 1.6 * s, 1.6 * s, 'frame');
        box(f, 0, 0, D + 0.9, 0.05, 1.6 * s - 0.2, 1.6 * s - 0.2, 'planter');
        const [x, z] = f.p(0, 0);
        trees.push({ x, z, y: D + 0.9, r: 1.05 * s, kind: 'round', lush: true, tone: 0.4, start: 0.68, dur: 0.05, deck: true, penthouse: tag, planterH: 0.9 });
      },
    }),
    light: {
      rects: () => [{ a: 0, b: 0, la: 0.3, lb: 0.3, top: 0.6 }],
      build: (f, D) => K.deckLight(...f.p(0, 0), D, 0.45),
    },
  };
}

export { partsKit };
