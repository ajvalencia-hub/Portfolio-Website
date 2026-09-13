// Public park between the podium, the hotel and the office: a large contemporary
// fountain as the focal point, a paved gathering circle, radial paths to the
// retail arcade, hotel entrance, office lobby and streets, lawns with shade trees,
// palms and layered planting in the sectors between the paths, benches around the
// fountain, and café seating beside the ground-floor frontages (kept off the
// through routes). Open on all sides — distinct from the private residential deck
// and hotel pool court.
import { RES, GLAZE, circlePlan, roundedRectPlan, rayRadius, partsKit } from './core.js';

export const FOUNTAIN = { x: 0, z: 28, basin: 7.5, coping: 0.7, copingH: 0.5, waterY: 0.36 };
export const PLAZA_DISC = 12.8;                          // paved gathering circle
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

export function parkSpecs(tier) {
  const seg = tier.name === 'mobile' ? 48 : 72;
  const ctx = { module: RES, parent: null, start: 0.655, dur: 0.01, wire: false, phase: 'context' };
  const lawns = SECTORS.map(lawnPolygon).filter(Boolean).map((pts, k) => ({ ...ctx, name: `P.lawn${k}`, type: 'prism', kind: 'lawn', glaze: GLAZE.none, y0: 0, h: 0.22, pts }));
  return [
    { ...ctx, name: 'P.disc', type: 'prism', kind: 'terrazzo', glaze: GLAZE.none, y0: 0, h: 0.06, pts: circlePlan(F.x, F.z, PLAZA_DISC, seg) },
    ...lawns,
    { ...ctx, name: 'P.coping', type: 'ring', kind: 'coping', glaze: GLAZE.none, y0: 0, h: F.copingH, pts: circlePlan(F.x, F.z, F.basin + F.coping, seg), inner: circlePlan(F.x, F.z, F.basin, seg) },
    { ...ctx, name: 'P.water', type: 'prism', kind: 'pool', glaze: GLAZE.water, y0: 0, h: F.waterY, pts: circlePlan(F.x, F.z, F.basin, seg), ramp: [F.x, F.z, 0, 1] },
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

  // fountain: stepped pedestal, two broad bowls with water, a tall central jet, an inner
  // ring of arcing jets and a low outer ring
  column(F.x, F.z, 0, 1.1, 2.0, 'stone', C);
  column(F.x, F.z, 1.1, 0.26, 3.4, 'coping', C);
  column(F.x, F.z, 1.36, 0.03, 3.1, 'pool', C);
  column(F.x, F.z, 1.36, 1.0, 0.65, 'stone', C);
  column(F.x, F.z, 2.36, 0.22, 1.6, 'coping', C);
  column(F.x, F.z, 2.58, 0.03, 1.4, 'pool', C);
  add('cone', F.x, 4.3, F.z, 0.45, 3.4, 0.45, 'spray', C);
  const ring = (r, n, h, w) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      add('cone', F.x + Math.cos(a) * r, F.waterY + h / 2, F.z + Math.sin(a) * r, w, h, w, 'spray', C);
    }
  };
  ring(5.2, full ? 16 : 8, 1.8, 0.22);
  ring(6.6, full ? 24 : 12, 0.8, 0.14);

  // radial paths (paving strips) from the gathering circle
  for (const p of PARK_PATHS) {
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    oriented((p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2, 0, 0.05, len, p.width, p.angle, 'terrazzo');
  }

  // benches around the fountain on the gathering circle, facing it
  for (const s of SECTORS) {
    const n = s.span > 1.3 ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const a = s.a0 + (s.span * (j + 1)) / (n + 1);
      bench(F.x + Math.cos(a) * 10.2, F.z + Math.sin(a) * 10.2, 0, 3.0, a + Math.PI / 2);
    }
  }

  // lawns: shade trees, palms and layered shrub beds, clear of paths and seating
  for (const s of SECTORS) {
    const R = boundaryR(s.mid);
    if (R < LAWN_INNER + 2) continue;
    const at = (r, t) => [F.x + r * Math.cos(t), F.z + r * Math.sin(t)];
    const mid = (LAWN_INNER + R) / 2;
    const clearAngle = (r) => Math.asin(Math.min(0.95, (PATH_CLEAR + 1.4) / r));
    const inSector = (r, t) => t > s.a0 + clearAngle(r) && t < s.a1 - clearAngle(r) && r < boundaryR(t) - 1.4;
    // canopy trees: one per sector, two in wide sectors
    const treeAngles = s.span > 1.3 ? [s.a0 + s.span * 0.32, s.a0 + s.span * 0.68] : [s.mid];
    for (const t of treeAngles) {
      const r = Math.min(mid + 0.8, boundaryR(t) - 2.6);
      if (inSector(r, t)) { const [x, z] = at(r, t); trees.push({ x, z, r: 2.5 + rand() * 0.8 }); }
    }
    // a curved sweep of shrubs along the outer lawn edge
    const outerR = (t) => boundaryR(t) - 1.2;
    const nShrubs = Math.max(3, Math.round(s.span * 7));
    for (let k = 0; k < nShrubs; k++) {
      const t = s.a0 + s.span * ((k + 0.5) / nShrubs);
      const r = outerR(t);
      if (!inSector(r - 0.01, t) && !(t > s.a0 + clearAngle(r) && t < s.a1 - clearAngle(r))) continue;
      const [x, z] = at(r, t);
      add('cone', x, 0.7, z, 1.4 + (k % 3) * 0.3, 1.1 + (k % 2) * 0.4, 1.4 + (k % 3) * 0.3, k % 2 ? 'shrub' : 'shrubDark', C);
    }
    // low planting clusters near the inner lawn edge
    for (const f of [0.3, 0.7]) {
      const t = s.a0 + s.span * f;
      const r = LAWN_INNER + 1.4;
      if (!(t > s.a0 + clearAngle(r) && t < s.a1 - clearAngle(r))) continue;
      const [x, z] = at(r, t);
      add('cone', x, 0.55, z, 1.2, 0.8, 1.2, 'shrub', C);
    }
  }
  // palms marking the path mouths and the lawn corners
  for (const [x, z] of [[-17.2, 24.6], [-17.2, 31.4], [-3.0, 50.6], [3.0, 50.6], [13.4, 12.6], [-13.4, 12.6], [13.6, 47.2]]) palms.push({ x, z });

  // café seating beside the frontages
  const cafes = full ? 1 : 2;   // mobile: every other table
  let n = 0;
  for (let z = 10.6; z <= 24.2; z += 2.7) for (const x of [-20.5, -17.7]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  umbrella(-19.1, 13.3, 0, 2.6); umbrella(-19.1, 18.7, 0, 2.6); umbrella(-19.1, 24.1, 0, 2.6);
  for (const x of [4.2, 7.6, 11.0, 14.4]) for (const z of [3.0, 6.2]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  umbrella(5.9, 4.6, 0, 2.6); umbrella(12.7, 4.6, 0, 2.6);
  for (const x of [41.6, 45.0, 48.4, 51.8, 55.0]) for (const z of [3.0, 6.2]) if (n++ % cafes === 0) cafe(x, z, 0, 'x');
  umbrella(43.3, 4.6, 0, 2.6); umbrella(50.1, 4.6, 0, 2.6);
  for (const z of [30.6, 33.3, 36.0, 38.7]) if (n++ % cafes === 0) cafe(17.8, z, 0, 'z');
  umbrella(17.8, 32.0, 0, 2.4); umbrella(17.8, 37.4, 0, 2.4);

  return { parts: out, trees, palms };
}
