// Public park between the podium, the hotel and the office, organised around the
// fountain plaza (plan/pedestrian.js): a continuous paved ring around a white twisting
// sculpture in a reflecting pool, entered from exactly five directions — the spine from
// the south gate, the spine from the central crossing, and secondary links to the podium
// retail arcade, the office lobby and the hotel entrance. Lawns fill the sectors between
// those links (no paths into beds, no leftover triangles), with planting beds on the
// outer edges, shade and flowering trees, palm pairs marking each mouth, a bench ring
// facing the fountain and lanterns between the benches. Café seating stays in the
// furnishing zones beside the podium arcade and the office walk.
import { RES, GLAZE, D2R, circlePlan, roundedRectPlan, rayRadius, insidePlan, partsKit, polarRadius } from './core.js';
import { placeTrees } from './planting.js';
import { PLAZA_R, LAWN_TOP, FOUNTAIN_CENTRE, SURFACE, ROUTES, routeCentreline, onRoute, inFurnishing } from './pedestrian.js';

export const FOUNTAIN = { x: FOUNTAIN_CENTRE[0], z: FOUNTAIN_CENTRE[1], basin: 7.5, coping: 0.7, copingH: 0.5, waterY: 0.36 };
export const PLAZA_DISC = PLAZA_R;
// Sculpture: an original abstract piece in the development's own language — a stack of
// thin white plates in the rounded-triangle plan of tower 1, each turned a few degrees so
// the stack twists like the towers and swells and narrows like the garage wave screen,
// threaded on a slender white core. It stands on a stone plinth in a calm reflecting pool
// (no jets), lit from below by warm uplights set around the plinth.
export const SCULPTURE = { plinthR: 1.7, plinthH: 0.55, coreR: 0.32, plates: 13, gap: 0.82, thick: 0.1, twist: 13, lobes: { a3: 0.24, p3: -90, a1: 0.08 } };
// lawns stop 0.8 m short of the promenade (following its curve on the north-west), the
// office walk and the café zones
export const LAWN_BOUNDARY = (() => {
  const P = ROUTES.find((r) => r.id === 'P1');
  const c = routeCentreline(P);
  const edge = [];
  for (let i = 1; i < c.length - 1; i++) {
    const [ax, az] = c[i - 1], [bx, bz] = c[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const d = P.width(c[i][0]) / 2 + 0.8;
    const q = [c[i][0] + (-(bz - az) / l) * d, c[i][1] + ((bx - ax) / l) * d];
    if (q[0] > -21.4 && q[0] < 14.2) edge.push([q[0], Math.max(9.2, q[1])]);
  }
  return [[-21.4, 54.6], [-21.4, edge[0][1]], ...edge, [14.2, 9.2], [16.7, 11.7], [16.7, 54.6]];
})();
const LAWN_INNER = PLAZA_DISC + 0.5;
const F = FOUNTAIN;

// the five plaza connections: plan angle and the half-corridor kept clear of lawn
export const PLAZA_LINKS = [
  { deg: -90, clear: 3.05, route: 'S2' },
  { deg: -50, clear: 2.1, route: 'C3' },
  { deg: 35, clear: 2.1, route: 'C2' },
  { deg: 90, clear: 3.05, route: 'S1' },
  { deg: 180, clear: 2.1, route: 'C1' },
].map((l) => ({ ...l, a: l.deg * D2R }));

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

// palm pairs mark the plaza mouths and the park gates; crowns are reserved before trees
const PALM_SPOTS = [[-3.9, 50.2], [3.9, 50.2], [-4.3, 10.9], [4.3, 10.9], [-17.4, 24.3], [-17.4, 31.7], [14.4, 13.4], [15.6, 32.2], [9.8, 44.6]];

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
    { ...ctx, name: 'P.lawns', type: 'prisms', kind: 'lawn', glaze: GLAZE.none, y0: 0, h: LAWN_TOP, parts: LAWNS.map((pts, k) => ({ pts, owner: `lawn${k}` })) },
    { ...ctx, name: 'P.beds', type: 'prisms', kind: 'bed', glaze: GLAZE.none, y0: 0, h: BED_TOP, parts: BED_POLYS.map((b, k) => ({ pts: b.pts, owner: `bed${k}` })) },
    { ...ctx, name: 'P.coping', type: 'ring', kind: 'coping', glaze: GLAZE.none, y0: 0, h: F.copingH, pts: circlePlan(F.x, F.z, F.basin + F.coping, seg), inner: circlePlan(F.x, F.z, F.basin, seg) },
    { ...ctx, name: 'P.water', type: 'prism', kind: 'pool', glaze: GLAZE.water, y0: 0, h: F.waterY, pts: circlePlan(F.x, F.z, F.basin, seg), ramp: [F.x, F.z, 0, 1] },
    sculptureSpec(tier, ctx),
  ];
}

// poles: lights, umbrellas, benches and bike stands from plan/pedestrian.js
export function parkParts(tier, rand, poles = []) {
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
  // palms first (trunks ≥ 0.8 m clear of every route), then trees clear of palms, poles and routes
  PALM_SPOTS.forEach(([x, z], k) => {
    if (onRoute(x, z, 0.8) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 2.6)) return;
    palms.push({ x, z, h: 11.5 + ((k * 1.37) % 2.5) });
  });
  const reserve = palms.map((p) => ({ x: p.x, z: p.z, r: 2.4, top: 14 }));
  const candidates = [];
  LAWNS.forEach((poly) => {
    const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]);
    const pts = [];
    for (let i = 0; i < 110; i++) {
      const x = Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs));
      const z = Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs));
      if (!insidePlan(x, z, poly)) continue;
      const e = edgeDist(x, z, poly);
      if (e < 1.3 || onRoute(x, z, 1.4)) continue;
      pts.push({ x, z, e });
    }
    pts.sort((a, b) => b.e - a.e);
    pts.slice(0, 3).forEach((q, k) => candidates.push({ x: q.x, z: q.z, y: 0, tone: rand(), lush: true, kind: k === 2 ? 'broad' : 'spread', flower: k === 2, r: k === 2 ? 2.4 + rand() * 0.4 : 3.0 + rand() * 0.8 }));
    pts.slice(3, full ? 8 : 5).forEach((q, j) => candidates.push({ x: q.x, z: q.z, y: 0, tone: rand(), lush: true, kind: 'round', flower: j === 0 || rand() < 0.3, r: 1.4 + rand() * 0.5 }));
  });
  // low canopies (underside below 2.4 m) may not reach over a clear zone
  const blocked = (x, z, r) => onRoute(x, z, Math.max(0.8, r - 0.2)) || inFurnishing(x, z, r);
  trees.push(...placeTrees(candidates, { poles: [...poles, ...reserve, ...seats], blocked, gap: 0.15, minScale: 0.55 }));

  // beds: two staggered rows of shrubs with flowering and light-foliage accents
  const shrubAt = (x, z, k, big) => {
    const colors = ['shrub', 'shrubDark', 'shrub', 'shrubLight', 'shrubDark', 'shrubFlower'];
    const c = colors[(k + Math.floor(rand() * 2)) % colors.length];
    const sz = (big ? 1.3 : 1.0) + rand() * 0.4, h = (big ? 1.2 : 0.8) + rand() * 0.5;
    add('cone', x, BED_TOP + h / 2, z, sz, h, sz, c, C);
  };
  let k = 0;
  for (const bed of BED_POLYS) {
    for (const [x, z, row] of bed.stations(full ? 1.25 : 2.5)) {
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.9) || palms.some((q) => Math.hypot(q.x - x, q.z - z) < 0.8) || onRoute(x, z, 0.6)) continue;
      shrubAt(x, z, k++, row === 0);
    }
  }
  // groundcover drifts where the lawns meet the plaza, clear of the link mouths
  for (const s of SECTORS) {
    for (const f of [0.35, 0.65]) {
      const t = s.a0 + s.span * f;
      const [x, z] = at(LAWN_INNER + 0.9, t);
      if (onRoute(x, z, 0.8) || poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.0)) continue;
      add('cone', x, LAWN_TOP + 0.25, z, 1.4, 0.5, 1.0, k++ % 3 ? 'shrubLight' : 'shrub', C);
    }
  }
  return { parts: out, trees, palms };
}
