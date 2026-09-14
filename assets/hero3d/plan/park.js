// Public park between the podium, the hotel and the office: a white twisting sculpture
// rising from a reflecting pool as the focal point, a paved gathering circle, radial paths to the
// retail arcade, hotel entrance, office lobby and streets, lawns with shade trees,
// palms and layered planting in the sectors between the paths, benches around the
// fountain, and café seating beside the ground-floor frontages (kept off the
// through routes). Open on all sides — distinct from the private residential deck
// and hotel pool court.
import { RES, GLAZE, D2R, circlePlan, roundedRectPlan, rayRadius, insidePlan, partsKit, polarRadius } from './core.js';
import { placeTrees } from './planting.js';

export const FOUNTAIN = { x: 0, z: 28, basin: 7.5, coping: 0.7, copingH: 0.5, waterY: 0.36 };
export const PLAZA_DISC = 12.8;
// Sculpture: an original abstract piece in the development's own language — a stack of
// thin white plates in the rounded-triangle plan of tower 1, each turned a few degrees so
// the stack twists like the towers and swells and narrows like the garage wave screen,
// threaded on a slender white core. It stands on a stone plinth in a calm reflecting pool
// (no jets), lit from below by warm uplights set around the plinth.
export const SCULPTURE = { plinthR: 1.7, plinthH: 0.55, coreR: 0.32, plates: 13, gap: 0.82, thick: 0.1, twist: 13, lobes: { a3: 0.24, p3: -90, a1: 0.08 } };                          // paved gathering circle
export const LAWN_BOUNDARY = roundedRectPlan(-15.8, 8.6, 15.8, 50.6, 3);   // clear of the café zones
const LAWN_INNER = PLAZA_DISC + 0.6;
const PATH_CLEAR = 2.2;                                  // lawn edge to path centreline
const F = FOUNTAIN;

// radial paths: [end x, end z, what they connect]
export const PARK_PATHS = [
  { to: [-19.5, 28.0], name: 'retail arcade (podium)' },
  { to: [0.0, 3.0], name: 'lane + hotel restaurant' },
  { to: [19.5, 8.0], name: 'hotel entrance forecourt' },
  { to: [19.5, 46.0], name: 'office lobby' },
  { to: [0.0, 53.0], name: 'south street' },
  { to: [-19.0, 50.0], name: 'podium south lobby corner' },
].map((p) => {
  const a = Math.atan2(p.to[1] - F.z, p.to[0] - F.x);
  const from = [F.x + Math.cos(a) * (PLAZA_DISC - 0.3), F.z + Math.sin(a) * (PLAZA_DISC - 0.3)];
  return { ...p, angle: a, from, width: 3.2 };
});

// café seating zones (occupied), each beside an implied frontage
export const CAFE_ZONES = [
  { name: 'Podium café (retail arcade)', rect: [-21.8, -16.4, 9.6, 24.8] },
  { name: 'Hotel restaurant terrace', rect: [3.0, 16.6, 1.6, 7.6] },
  { name: 'Hotel lobby café', rect: [40.0, 56.0, 1.6, 7.6] },
  { name: 'Office coffee bar', rect: [16.2, 19.4, 29.6, 40.6] },
];

// sectors between consecutive paths
const SECTORS = (() => {
  const angles = PARK_PATHS.map((p) => p.angle).sort((a, b) => a - b);
  return angles.map((a, k) => {
    let b = angles[(k + 1) % angles.length];
    if (b <= a) b += Math.PI * 2;
    return { a0: a, a1: b, mid: (a + b) / 2, span: b - a };
  });
})();
const boundaryR = (t) => rayRadius(F.x, F.z, LAWN_BOUNDARY, t);

// lawn in a sector: inner arc, straight edges 2.2 m off each path, outer park boundary
function lawnPolygon(s) {
  const at = (r, t) => [F.x + r * Math.cos(t), F.z + Math.sin(t) * r];
  const pts = [];
  const n = 10;
  const d = (r) => Math.asin(Math.min(0.95, PATH_CLEAR / r));
  const edgeLen = (t) => boundaryR(t);
  const tA = s.a0 + d(LAWN_INNER), tB = s.a1 - d(LAWN_INNER);
  if (tB <= tA) return null;
  for (let k = 0; k <= n; k++) pts.push(at(LAWN_INNER, tA + ((tB - tA) * k) / n));                // inner arc
  const outerB = edgeLen(s.a1 - d(18));
  for (let k = 1; k <= n; k++) { const r = LAWN_INNER + ((outerB - LAWN_INNER) * k) / n; pts.push(at(r, s.a1 - d(r))); }
  const tB2 = s.a1 - d(outerB), tA2 = s.a0 + d(edgeLen(s.a0 + d(18)));
  for (let k = 1; k < 2 * n; k++) { const t = tB2 + ((tA2 - tB2) * k) / (2 * n); pts.push(at(boundaryR(t) - 0.05, t)); }  // outer boundary
  const outerA = edgeLen(s.a0 + d(18));
  for (let k = n; k >= 1; k--) { const r = LAWN_INNER + ((outerA - LAWN_INNER) * k) / n; pts.push(at(r, s.a0 + d(r))); }
  return pts;
}

// palms mark the path mouths and lawn corners; their crowns are reserved before trees are placed
const PALM_SPOTS = [[-17.2, 24.6], [-17.2, 31.4], [-3.0, 50.6], [3.0, 50.6], [13.4, 12.6], [-13.4, 12.6], [13.6, 47.2]];
const PALM_RESERVE = PALM_SPOTS.map(([x, z]) => ({ x, z, r: 2.4, top: 14 }));

// Planting beds along the outer edge of each lawn sector, clear of the radial paths.
const BED_TOP = 0.34;
const BED_POLYS = SECTORS.map((s) => {
  const clr = (r) => Math.asin(Math.min(0.95, (PATH_CLEAR + 0.3) / r));
  const outer = (t) => boundaryR(t) - 0.45, inner = (t) => Math.max(LAWN_INNER + 1.4, boundaryR(t) - 2.6);
  const tA = s.a0 + clr(boundaryR(s.a0 + 0.3)), tB = s.a1 - clr(boundaryR(s.a1 - 0.3));
  if (tB - tA < 0.2 || boundaryR(s.mid) < LAWN_INNER + 2.4) return null;
  const at = (r, t) => [F.x + r * Math.cos(t), F.z + r * Math.sin(t)];
  const n = 18;
  const ts = Array.from({ length: n + 1 }, (_, i) => tA + ((tB - tA) * i) / n)
    .map((t) => [t, Math.max(t, s.a0 + clr(outer(t))), Math.min(t, s.a1 - clr(outer(t)))]).map(([t, lo, hi]) => Math.min(Math.max(t, lo), hi));
  const pts = [...ts.map((t) => at(outer(t), t)), ...ts.slice().reverse().map((t) => at(inner(t), t))];
  const width = (t) => outer(t) - inner(t);
  if (width(s.mid) < 0.9) return null;
  return {
    pts,
    // shrub stations in two staggered rows along the bed
    stations: (step) => {
      const out = [];
      for (const [row, f] of [[0, 0.3], [1, 0.72]]) {
        const rMid = (t) => inner(t) + width(t) * f;
        const arc = (tB - tA) * rMid(s.mid);
        const cnt = Math.max(2, Math.round(arc / step));
        for (let i = 0; i < cnt; i++) {
          const t = tA + ((tB - tA) * (i + 0.5 * row + 0.25)) / cnt;
          if (t > tB) continue;
          out.push([...at(rMid(t), t), row]);
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
  const lawns = SECTORS.map(lawnPolygon).filter(Boolean).map((pts, k) => ({ ...ctx, name: `P.lawn${k}`, type: 'prism', kind: 'lawn', glaze: GLAZE.none, y0: 0, h: 0.22, pts }));
  return [
    { ...ctx, name: 'P.disc', type: 'prism', kind: 'terrazzo', glaze: GLAZE.rings, module: [1.6, 1.8], ramp: [F.x, F.z, 0, 0], y0: 0, h: 0.08, pts: circlePlan(F.x, F.z, PLAZA_DISC, seg) },
    ...lawns,
    ...BED_POLYS.map((b, k) => ({ ...ctx, name: `P.bed${k}`, type: 'prism', kind: 'bed', glaze: GLAZE.none, y0: 0, h: BED_TOP, pts: b.pts })),
    { ...ctx, name: 'P.coping', type: 'ring', kind: 'coping', glaze: GLAZE.none, y0: 0, h: F.copingH, pts: circlePlan(F.x, F.z, F.basin + F.coping, seg), inner: circlePlan(F.x, F.z, F.basin, seg) },
    { ...ctx, name: 'P.water', type: 'prism', kind: 'pool', glaze: GLAZE.water, y0: 0, h: F.waterY, pts: circlePlan(F.x, F.z, F.basin, seg), ramp: [F.x, F.z, 0, 1] },
    sculptureSpec(tier, ctx),
  ];
}

export function parkParts(tier, rand) {
  const out = [];
  const K = partsKit(out);
  const { add, column, oriented, umbrella, cafe, bench } = K;
  const C = 'context';
  const full = tier.name !== 'mobile';
  const trees = [];
  const palms = [];

  // sculpture plinth: stone drum in the reflecting pool with a white capping ring and warm
  // uplights set into it around the core
  column(F.x, F.z, 0, SCULPTURE.plinthH - 0.08, SCULPTURE.plinthR, 'stone', C);
  column(F.x, F.z, SCULPTURE.plinthH - 0.08, 0.08, SCULPTURE.plinthR + 0.12, 'coping', C);
  const lights = full ? 8 : 4;
  for (let k = 0; k < lights; k++) {
    const a = (k / lights) * Math.PI * 2 + 0.2;
    add('cyl', F.x + Math.cos(a) * 1.05, SCULPTURE.plinthH + 0.03, F.z + Math.sin(a) * 1.05, 0.22, 0.06, 0.22, 'lamp', C);
  }

  // radial paths (paving strips) from the gathering circle
  for (const p of PARK_PATHS) {
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    oriented((p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2, 0, 0.045, len, p.width, p.angle, 'terrazzo');   // tucks under the disc (0.08) and the walks (0.07)
  }

  // benches around the fountain on the gathering circle, facing it
  for (const s of SECTORS) {
    const n = s.span > 1.3 ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const a = s.a0 + (s.span * (j + 1)) / (n + 1);
      bench(F.x + Math.cos(a) * 10.2, F.z + Math.sin(a) * 10.2, 0, 3.0, a + Math.PI / 2);
    }
  }

  // café seating beside the frontages (umbrellas sized to the table groups)
  const cafes = full ? 1 : 2;   // mobile: every other table
  let n = 0;
  const umbrellas = [];
  const shade = (x, z, size) => { umbrella(x, z, 0, size); umbrellas.push({ x, z, r: size / 2, top: 3.1 }); };
  for (let z = 10.6; z <= 24.2; z += 2.7) for (const x of [-20.5, -17.7]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  shade(-19.1, 13.3, 3.0); shade(-19.1, 18.7, 3.0); shade(-19.1, 24.1, 3.0);
  for (const x of [4.2, 7.6, 11.0, 14.4]) for (const z of [3.0, 6.2]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  shade(5.9, 4.6, 3.0); shade(12.7, 4.6, 3.0);
  for (const x of [41.6, 45.0, 48.4, 51.8, 55.0]) for (const z of [3.0, 6.2]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  shade(43.3, 4.6, 3.0); shade(50.1, 4.6, 3.0);
  for (const z of [30.6, 33.3, 36.0, 38.7]) if (n++ % cafes === 0) cafe(17.8, z, 0, 'z');
  shade(17.8, 32.0, 2.6); shade(17.8, 37.4, 2.6);

  // low path lights along the radial paths (alternating sides) and benches facing the lawns
  const poles = [...umbrellas];
  const pathDist = (x, z, p) => {
    const L = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const u = ((x - p.from[0]) * (p.to[0] - p.from[0]) + (z - p.from[1]) * (p.to[1] - p.from[1])) / L;
    const v = Math.abs(-(x - p.from[0]) * (p.to[1] - p.from[1]) + (z - p.from[1]) * (p.to[0] - p.from[0])) / L;
    return u > -1 && u < L + 1 ? v : Infinity;
  };
  for (const p of PARK_PATHS) {
    const L = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const ux = (p.to[0] - p.from[0]) / L, uz = (p.to[1] - p.from[1]) / L;
    let side = 1;
    for (let d = 2.5; d < L - 1.0; d += full ? 4.5 : 9) {
      const off = p.width / 2 + 0.35;
      const x = p.from[0] + ux * d - uz * off * side, z = p.from[1] + uz * d + ux * off * side;
      if (Math.hypot(x - F.x, z - F.z) > PLAZA_DISC + 0.5 && Math.abs(x) < 19 && z < 53 && z > 3.5) { K.deckLight(x, z, 0.05, 0.85); poles.push({ x, z, r: 0.1, top: 1.0 }); }
      side = -side;
    }
    if (L > 10) {
      const d = L * 0.55, off = p.width / 2 + 0.75;
      const x = p.from[0] + ux * d + uz * off, z = p.from[1] + uz * d - ux * off;
      if (Math.abs(x) < 15 && z > 9 && z < 50) bench(x, z, 0.22, 2.2, p.angle, 'frame');
    }
  }

  // --- layered tropical planting ---------------------------------------------------------
  // candidates per sector: one or two large shade trees in the widest part, understory
  // trees near the gathering circle (a few flowering), a broad flowering accent in the
  // two widest sectors; accepted only where canopies clear each other, the lights and the
  // café umbrellas (plan/planting.js). Controlled randomisation varies size and species.
  const candidates = [];
  const edgeDist = (x, z, poly) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
      best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
    }
    return best;
  };
  SECTORS.map(lawnPolygon).forEach((poly) => {
    if (!poly) return;
    const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]);
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const x = Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs));
      const z = Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs));
      if (!insidePlan(x, z, poly)) continue;
      const e = edgeDist(x, z, poly);
      if (e < 1.3 || PARK_PATHS.some((q) => pathDist(x, z, q) < q.width / 2 + 1.0)) continue;
      pts.push({ x, z, e, d: Math.hypot(x - F.x, z - F.z) });
    }
    // large shade trees where the lawn is deepest, then understory and flowering accents
    pts.sort((a, b) => b.e - a.e);
    pts.slice(0, 3).forEach((q, k) => candidates.push({ x: q.x, z: q.z, y: 0, tone: rand(), lush: true, kind: k === 2 ? 'broad' : 'spread', flower: k === 2, r: k === 2 ? 2.4 + rand() * 0.4 : 3.0 + rand() * 0.9 }));
    pts.slice(3, full ? 9 : 6).forEach((q) => candidates.push({ x: q.x, z: q.z, y: 0, tone: rand(), lush: true, kind: 'round', flower: rand() < 0.25, r: 1.4 + rand() * 0.5 }));
  });
  // palms first reserve their crowns, then trees are accepted largest-first
  trees.push(...placeTrees(candidates, { poles: [...poles, ...PALM_RESERVE], gap: 0.15, minScale: 0.6 }));

  // palms in clusters of varied height at the path mouths and lawn corners
  const palmSpots = PALM_SPOTS;
  palmSpots.forEach(([x, z], k) => {
    palms.push({ x, z, h: 12.5 + rand() * 1.5 });
    const a = rand() * Math.PI * 2;
    const [x2, z2] = [x + Math.cos(a) * 1.7, z + Math.sin(a) * 1.7];
    const onPath = PARK_PATHS.some((p) => pathDist(x2, z2, p) < p.width / 2 + 0.5) || Math.abs(x2) > 18.5 || z2 > 54;
    if (full && !onPath && !umbrellas.some((u) => Math.hypot(u.x - x2, u.z - z2) < 2.4)) palms.push({ x: x2, z: z2, h: 9 + rand() * 1.5 });
  });

  // planting beds along the outer lawn edges (specs in parkSpecs): two staggered rows of
  // shrubs with flowering and light-foliage accents, clear of tree trunks
  const shrubAt = (x, z, k, big) => {
    const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
    const c = colors[(k + Math.floor(rand() * 2)) % colors.length];
    const sz = (big ? 1.3 : 1.0) + rand() * 0.4, h = (big ? 1.2 : 0.8) + rand() * 0.5;
    add('cone', x, BED_TOP + h / 2, z, sz, h, sz, c, C);
  };
  let k = 0;
  for (const bed of BED_POLYS) {
    for (const [x, z, row] of bed.stations(full ? 1.25 : 2.5)) {
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.9) || palms.some((q) => Math.hypot(q.x - x, q.z - z) < 0.8)) continue;
      shrubAt(x, z, k++, row === 0);
    }
  }
  // groundcover drifts where the lawns meet the gathering circle
  for (const s of SECTORS) {
    for (const f of [0.35, 0.65]) {
      const t = s.a0 + s.span * f;
      const r = LAWN_INNER + 0.9;
      const [x, z] = [F.x + r * Math.cos(t), F.z + r * Math.sin(t)];
      if (PARK_PATHS.some((p) => pathDist(x, z, p) < p.width / 2 + 1.0)) continue;
      add('cone', x, 0.22 + 0.25, z, 1.4, 0.5, 1.0, k++ % 3 ? 'shrubLight' : 'shrub', C);
    }
  }

  return { parts: out, trees, palms };
}
