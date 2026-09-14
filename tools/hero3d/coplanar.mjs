// Rendering-stability check: finds surfaces that share a plane (within a depth
// tolerance) and overlap in area while facing the same way — the geometric cause of
// z-fighting flicker. Covers massing boxes, instanced parts (boxes at right-angle
// rotations, cylinder ends), curved prism and stack caps, ring and slab annuli.
// Downward-facing surfaces are skipped (the camera stays above the model). Pairs with
// the same material and colour are flagged separately: they cannot flicker visibly.
//
//   import { coplanarFaces } from './coplanar.mjs'; coplanarFaces(plan, { insidePlan })

const HALF_PI = Math.PI / 2;

export function coplanarFaces(plan, { insidePlan, tol = 0.012, minArea = 0.02 }) {
  const faces = { h: [], x: [], z: [] };
  const add = (list, f) => list.push(f);

  // --- massing boxes at their final heights
  const tops = [];
  plan.boxes.forEach((b, i) => {
    const base = b.parentIndex >= 0 ? tops[b.parentIndex] : b.y0;
    tops[i] = base + b.h;
    const r = [b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2];
    const src = { name: b.name, color: b.kind, layer: 'massing' };
    add(faces.h, { y: tops[i], dir: 1, rect: r, src });
    add(faces.h, { y: base, dir: -1, rect: r, src });
    add(faces.x, { c: r[0], dir: -1, u: [r[2], r[3]], v: [base, tops[i]], src });
    add(faces.x, { c: r[1], dir: 1, u: [r[2], r[3]], v: [base, tops[i]], src });
    add(faces.z, { c: r[2], dir: -1, u: [r[0], r[1]], v: [base, tops[i]], src });
    add(faces.z, { c: r[3], dir: 1, u: [r[0], r[1]], v: [base, tops[i]], src });
  });

  // --- parts
  plan.parts.forEach((q, i) => {
    const src = { name: `part#${i} ${q.shape}`, color: q.color, layer: 'parts' };
    const y0 = q.y - q.sy / 2, y1 = q.y + q.sy / 2;
    if (q.shape === 'box') {
      const k = Math.round((q.rot || 0) / HALF_PI);
      if (Math.abs((q.rot || 0) - k * HALF_PI) > 1e-3) return;   // oblique: cannot align with axis faces
      const odd = Math.abs(k) % 2 === 1;
      const hx = (odd ? q.sz : q.sx) / 2, hz = (odd ? q.sx : q.sz) / 2;
      const r = [q.x - hx, q.x + hx, q.z - hz, q.z + hz];
      add(faces.h, { y: y1, dir: 1, rect: r, src });
      add(faces.h, { y: y0, dir: -1, rect: r, src });
      add(faces.x, { c: r[0], dir: -1, u: [r[2], r[3]], v: [y0, y1], src });
      add(faces.x, { c: r[1], dir: 1, u: [r[2], r[3]], v: [y0, y1], src });
      add(faces.z, { c: r[2], dir: -1, u: [r[0], r[1]], v: [y0, y1], src });
      add(faces.z, { c: r[3], dir: 1, u: [r[0], r[1]], v: [y0, y1], src });
    } else if (q.shape === 'cyl') {
      const h = (q.sx / 2) * 0.7;   // inscribed square of the end disc
      const r = [q.x - h, q.x + h, q.z - h, q.z + h];
      add(faces.h, { y: y1, dir: 1, rect: r, src });
      add(faces.h, { y: y0, dir: -1, rect: r, src });
    }
  });

  // --- curved masses (horizontal surfaces only)
  const cTop = plan.meta.curveTop;
  for (const c of plan.curved) {
    const base = c.parent ? cTop[c.parent] : c.y0;
    const top = base + c.h;
    const src = { name: c.name, color: c.kind, layer: 'curves' };
    if (c.type === 'waves') continue;   // wave fins are generated geometry with sloping surfaces
    if (c.type === 'prisms') {
      // merged paving: each polygon is its own surface (same material, so overlaps are benign)
      c.parts.forEach((q, k) => add(faces.h, { y: top, dir: 1, poly: q.pts, src: { name: `${c.name}#${q.owner ?? k}`, color: c.kind, layer: 'curves' } }));
      continue;
    }
    if (c.type === 'ring') {
      add(faces.h, { y: top, dir: 1, poly: c.pts, hole: c.inner, src });
      add(faces.h, { y: base, dir: -1, poly: c.pts, hole: c.inner, src });
    } else if (c.type === 'stack') {
      add(faces.h, { y: top, dir: 1, poly: c.floorPlans.at(-1), src });
      add(faces.h, { y: base, dir: -1, poly: c.floorPlans[0], src });
    } else if (c.pts) {
      add(faces.h, { y: top, dir: 1, poly: c.pts, holes: c.holes, src });
      add(faces.h, { y: base, dir: -1, poly: c.pts, holes: c.holes, src });
    }
    if (c.slabs) {
      const ssrc = { name: `${c.name} slabs`, color: c.slabs.kind, layer: 'slabs' };
      for (const f of c.slabs.floors) {
        add(faces.h, { y: base + f.y, dir: 1, poly: f.outer, hole: f.inner, src: ssrc });
        add(faces.h, { y: base + f.y - f.thick, dir: -1, poly: f.outer, hole: f.inner, src: ssrc });
      }
    }
  }

  const bbox = (f) => {
    if (f.rect) return f.rect;
    if (!f._bb) {
      const xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]);
      f._bb = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    }
    return f._bb;
  };
  const inside = (f, x, z) => {
    if (f.rect) return x > f.rect[0] && x < f.rect[1] && z > f.rect[2] && z < f.rect[3];
    return insidePlan(x, z, f.poly) && !(f.hole && insidePlan(x, z, f.hole)) && !(f.holes && f.holes.some((h) => insidePlan(x, z, h)));
  };
  // overlap area estimate on a sample grid over the bounding-box intersection
  const hOverlap = (a, b) => {
    const A = bbox(a), B = bbox(b);
    const x0 = Math.max(A[0], B[0]), x1 = Math.min(A[1], B[1]), z0 = Math.max(A[2], B[2]), z1 = Math.min(A[3], B[3]);
    if (x1 - x0 <= 1e-4 || z1 - z0 <= 1e-4) return 0;
    if (a.rect && b.rect) return (x1 - x0) * (z1 - z0);
    const n = 12;
    let hit = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0), z = z0 + ((j + 0.5) / n) * (z1 - z0);
      if (inside(a, x, z) && inside(b, x, z)) hit++;
    }
    if (hit) return (hit / (n * n)) * (x1 - x0) * (z1 - z0);
    // thin annuli (cornices, eaves, guards) slip between grid samples: also probe the
    // inner, middle and outer thirds of each annulus band, which pairs outer and inner vertices
    let band = 0;
    for (const [f, g] of [[a, b], [b, a]]) {
      if (!f.hole || f.hole.length !== f.poly.length) continue;
      f.poly.forEach(([ox, oz], k) => {
        const [ix, iz] = f.hole[k];
        for (const t of [0.1, 0.5, 0.9]) {
          const x = ix + (ox - ix) * t, z = iz + (oz - iz) * t;
          if (x > x0 && x < x1 && z > z0 && z < z1 && inside(g, x, z)) band += Math.hypot(ox - ix, oz - iz) * 0.3;
        }
      });
    }
    return band;
  };
  const vOverlap = (a, b) => Math.max(0, Math.min(a.u[1], b.u[1]) - Math.max(a.u[0], b.u[0])) * Math.max(0, Math.min(a.v[1], b.v[1]) - Math.max(a.v[0], b.v[0]));

  const found = [];
  const scan = (list, key, overlap, kind) => {
    const sorted = list.slice().sort((a, b) => a[key] - b[key]);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length && sorted[j][key] - a[key] < tol; j++) {
        const b = sorted[j];
        if (a.dir !== b.dir || a.src === b.src) continue;
        // downward faces are only seen from below: skip them at grade and under solid roofs
        if (kind === 'horizontal' && a.dir < 0) continue;
        const area = overlap(a, b);
        if (area < minArea) continue;
        found.push({ kind, at: +a[key].toFixed(3), gap: +(b[key] - a[key]).toFixed(4), area: +area.toFixed(2), a: a.src, b: b.src, sameColour: a.src.color === b.src.color && a.src.layer === b.src.layer });
      }
    }
  };
  scan(faces.h, 'y', hOverlap, 'horizontal');
  scan(faces.x, 'c', vOverlap, 'x-facing');
  scan(faces.z, 'c', vOverlap, 'z-facing');
  return found;
}
