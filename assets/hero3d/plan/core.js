// Shared constants, plan geometry and the parts kit for the site plan modules.
// Pure data in metres (x = east, z = south, y = up) — no three.js here.

export const FLOOR = 3.2;              // residential / hotel floor-to-floor
export const GROUND = 5.0;             // retail ground floor
export const OFFICE_GROUND = 6.0;      // office ground floor
export const OFFICE_FLOOR = 4.2;       // office floor-to-floor (also used by the office parking levels)
export const RES = [GROUND, FLOOR];
export const OFFICE = [OFFICE_GROUND, OFFICE_FLOOR];
export const D2R = Math.PI / 180;

export const BLOCK = { w: 160, d: 110.5 }; // 17,680 m² ≈ 4.37 ac (hypothetical parcel)
export const ROW = 22;                     // right-of-way, property line to property line
export const WALK = 4.5;                   // sidewalk: property line → curb
export const HALF_ROAD = ROW / 2 - WALK;   // 6.5 m, centreline → curb
export const PITCH_X = BLOCK.w + ROW;      // 182
export const PITCH_Z = BLOCK.d + ROW;      // 132.5
export const HX = BLOCK.w / 2;
export const HZ = BLOCK.d / 2;

export const PODIUM_TOP = GROUND + 2 * FLOOR;  // 11.4: retail + two parking decks (floors at 5.0 and 8.2)
export const DECK_BUILDUP = 0.5;               // pedestal pavers, insulation and falls over the podium roof
export const DECK_Y = PODIUM_TOP + DECK_BUILDUP;
export const ARCADE = 3.5;                     // storefront set back under the podium edge

export const LAYER = {
  guides: 0, streets: 1, property: 2, parcel: 3, footprint: 4,
  tower: 5, landscape: 6, markings: 7, paths: 8, dimension: 9,
};
export const LAYER_COUNT = 10;

// Facade treatments understood by layers/facade-glsl.js.
export const GLAZE = {
  none: 0, ribbon: 1, residential: 2, water: 3, resPodium: 4,
  office: 5, officePodium: 6, deco: 7, screen: 8, storefront: 9,
  guard: 10, penthouse: 11, decoCentre: 12, garageRecess: 13,
  perforated: 14, breezeBlock: 15, pavers: 16, bond: 17, rings: 18, officeCrown: 19, promenade: 20,
};

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const floorsToHeight = (floors) => GROUND + (floors - 1) * FLOOR;

export function box(name, x0, x1, z0, z1, y0, h, kind, group, timing, parent = null, opts = {}) {
  return {
    name, kind, group, parent,
    x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, y0, h, rot: 0,
    glaze: opts.glaze ?? (kind === 'pool' ? GLAZE.water : GLAZE.none),
    module: opts.module ?? RES,
    start: timing[0], dur: timing[1],
  };
}

export function rect(x0, z0, x1, z1) {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

export function superellipse(cx, cz, a, b, n, segments, rotDeg = 0) {
  const r = rotDeg * D2R;
  const cos = Math.cos(r), sin = Math.sin(r);
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const lx = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const lz = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pts.push([cx + lx * cos + lz * sin, cz - lx * sin + lz * cos]);
  }
  return pts;
}

export function circlePlan(cx, cz, r, segments = 48) {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return [cx + r * Math.cos(t), cz + r * Math.sin(t)];
  });
}

// rounded rectangle; r is a radius or { nw, ne, se, sw } (north = −z)
export function roundedRectPlan(x0, z0, x1, z1, r) {
  const rad = typeof r === 'number' ? { nw: r, ne: r, se: r, sw: r } : { nw: 0.6, ne: 0.6, se: 0.6, sw: 0.6, ...r };
  const pts = [];
  const corners = [
    [x1 - rad.ne, z0 + rad.ne, -Math.PI / 2, rad.ne], [x1 - rad.se, z1 - rad.se, 0, rad.se],
    [x0 + rad.sw, z1 - rad.sw, Math.PI / 2, rad.sw], [x0 + rad.nw, z0 + rad.nw, Math.PI, rad.nw],
  ];
  for (const [cx, cz, a0, cr] of corners) {
    const seg = clamp(Math.round(cr * 1.6), 2, 10);
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]);
    }
  }
  return pts;
}

// outward unit normal at each vertex (average of the two adjacent edge normals)
export function planNormals(pts) {
  const n = pts.length;
  let cx = 0, cz = 0;
  for (const [x, z] of pts) { cx += x / n; cz += z / n; }
  const edge = (i) => {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n];
    let nx = -(bz - az), nz = bx - ax;
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    return nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0 ? [-nx, -nz] : [nx, nz];
  };
  return pts.map((_, i) => {
    const [ax, az] = edge((i - 1 + n) % n), [bx, bz] = edge(i);
    const len = Math.hypot(ax + bx, az + bz) || 1;
    return [(ax + bx) / len, (az + bz) / len];
  });
}

export function offsetPlan(pts, d) {
  const nrm = planNormals(pts);
  return pts.map(([x, z], i) => [x + nrm[i][0] * d, z + nrm[i][1] * d]);
}

// evenly spaced points (by arc length) around a closed plan, with outward normals
export function arcSamples(pts, spacing) {
  const nrm = planNormals(pts);
  const out = [];
  let carry = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [ax, az] = pts[i], [bx, bz] = pts[j];
    const len = Math.hypot(bx - ax, bz - az);
    let s = carry;
    while (s < len) {
      const t = s / len;
      const nx = nrm[i][0] + (nrm[j][0] - nrm[i][0]) * t;
      const nz = nrm[i][1] + (nrm[j][1] - nrm[i][1]) * t;
      const nl = Math.hypot(nx, nz) || 1;
      out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, nx: nx / nl, nz: nz / nl });
      s += spacing;
    }
    carry = s - len;
  }
  return out;
}

export function insidePlan(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(a) / 2;
}

// farthest boundary hit along a ray from (cx, cz) at angle t
export function rayRadius(cx, cz, poly, t) {
  const dx = Math.cos(t), dz = Math.sin(t);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ez = bz - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const s = ((ax - cx) * ez - (az - cz) * ex) / den;   // along ray
    const u = ((ax - cx) * dz - (az - cz) * dx) / den;   // along edge
    if (s > 0 && u >= 0 && u <= 1) best = Math.max(best, s);
  }
  return best;
}

// resample a star-shaped plan at N equal angles about (cx, cz) — gives matching vertex counts
export function resampleByAngle(poly, cx, cz, N) {
  return Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const r = rayRadius(cx, cz, poly, t);
    return [cx + r * Math.cos(t), cz + r * Math.sin(t)];
  });
}

// clip a polygon to lo ≤ coord ≤ hi along an axis (0 = x, 1 = z)
export function clipBand(poly, axis, lo, hi) {
  const clip = (pts, keep, edge) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ina = keep(a), inb = keep(b);
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  return clip(clip(poly, (p) => p[axis] >= lo, lo), (p) => p[axis] <= hi, hi);
}

export const rectOverlap = (a, b, pad = 0) => a[0] < b[1] + pad && a[1] > b[0] - pad && a[2] < b[3] + pad && a[3] > b[2] - pad;
export const inRect = (x, z, r, pad = 0) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;

// Polar floorplates about a tower core: r(θ) = R·(1 + a1·cos(θ−p1) + a2·cos 2(θ−p2)
// + a3·cos 3(θ−p3)). a2 gives an oval, a3 a rounded triangle, a1 a soft asymmetry.
export function polarRadius(s, t) {
  return s.R * (1
    + (s.a1 || 0) * Math.cos(t - (s.p1 || 0) * D2R)
    + (s.a2 || 0) * Math.cos(2 * (t - (s.p2 || 0) * D2R))
    + (s.a3 || 0) * Math.cos(3 * (t - (s.p3 || 0) * D2R)));
}

// ---------------------------------------------------------------------------
// Parts kit: instanced boxes, cylinders, cones and wedges with simple furniture,
// planting and shade builders. "solid" parts fade in with the buildings,
// "context" parts (furniture, planting) with the landscape.
// ---------------------------------------------------------------------------
export function partsKit(out) {
  const C = 'context';
  const add = (shape, x, y, z, sx, sy, sz, color, phase = 'solid', rot = 0) =>
    out.push({ shape, x, y, z, sx, sy, sz, color, phase, rot });
  const block = (x0, x1, y0, y1, z0, z1, color, phase) =>
    add('box', (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, phase);
  const column = (x, z, y0, h, r, color = 'frame', phase = 'solid') => add('cyl', x, y0 + h / 2, z, 2 * r, h, 2 * r, color, phase);
  // a box centred at (x, z) whose local x runs along direction angle a (radians, plan)
  const oriented = (x, z, y0, h, len, depth, a, color, phase = C) => add('box', x, y0 + h / 2, z, len, h, depth, color, phase, -a);
  const alongFacade = (s, offset, y0, h, width, depth, color, phase = 'solid') =>
    add('box', s.x + s.nx * offset, y0 + h / 2, s.z + s.nz * offset, width, h, depth, color, phase, Math.atan2(-s.nx, -s.nz));

  const kit = {
    add, block, column, oriented, alongFacade,
    // slatted pergola: posts, two beams, slats across (colour: frame or wood)
    pergola(x0, x1, z0, z1, baseY, { h = 3.0, color = 'frame', slat = 0.6, phase = C } = {}) {
      for (const px of [x0 + 0.25, (x0 + x1) / 2, x1 - 0.25]) for (const pz of [z0 + 0.25, z1 - 0.25]) column(px, pz, baseY, h - 0.2, 0.11, 'frame', phase);   // posts end inside the beams
      for (const bz of [z0 + 0.25, z1 - 0.25]) block(x0, x1, baseY + h - 0.35, baseY + h - 0.1, bz - 0.1, bz + 0.1, color, phase);
      for (let sx = x0 + 0.3; sx <= x1 - 0.25; sx += slat) block(sx - 0.06, sx + 0.06, baseY + h - 0.1, baseY + h + 0.1, z0, z1, color, phase);
    },
    // planter: rim with contained soil and low planting; h is the rim height
    bed(x0, x1, z0, z1, baseY, h = 0.55, { rim = 'frame', shrubs = false } = {}) {
      block(x0, x1, baseY, baseY + h, z0, z1, rim, C);
      block(x0 + 0.15, x1 - 0.15, baseY + h, baseY + h + 0.08, z0 + 0.15, z1 - 0.15, 'planter', C);
      if (shrubs) {
        const n = Math.max(1, Math.round(Math.max(x1 - x0, z1 - z0) / 1.1));
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n;
          const x = x1 - x0 > z1 - z0 ? x0 + (x1 - x0) * f : (x0 + x1) / 2;
          const z = x1 - x0 > z1 - z0 ? (z0 + z1) / 2 : z0 + (z1 - z0) * f;
          add('cone', x, baseY + h + 0.5, z, 1.2 + (k % 3) * 0.15, 1.0 + (k % 2) * 0.3, 1.2 + (k % 3) * 0.15, k % 2 ? 'shrub' : 'shrubDark', C);
        }
      }
    },
    umbrella(x, z, baseY = 0, size = 3.0) {
      column(x, z, baseY, 2.5, 0.05, 'metal', C);
      add('cone', x, baseY + 2.75, z, size, 0.55, size, 'canvas', C);
    },
    // sun lounger 2.0 × 0.72 m with a raised back; axis 'x' or 'z', head toward sign
    lounger(x, z, baseY, axis, sign) {
      if (axis === 'x') {
        block(x - 1.0, x + 1.0, baseY, baseY + 0.36, z - 0.36, z + 0.36, 'cushion', C);
        block(x + sign * 0.75 - 0.25, x + sign * 0.75 + 0.25, baseY + 0.36, baseY + 0.78, z - 0.36, z + 0.36, 'cushion', C);
      } else {
        block(x - 0.36, x + 0.36, baseY, baseY + 0.36, z - 1.0, z + 1.0, 'cushion', C);
        block(x - 0.36, x + 0.36, baseY + 0.36, baseY + 0.78, z + sign * 0.75 - 0.25, z + sign * 0.75 + 0.25, 'cushion', C);
      }
    },
    sideTable: (x, z, baseY) => column(x, z, baseY, 0.5, 0.24, 'frame', C),
    dining(x, z, baseY, chairs = 4) {
      column(x, z, baseY, 0.75, 0.55, 'frame', C);
      [[0.95, 0], [-0.95, 0], [0, 0.95], [0, -0.95]].slice(0, chairs)
        .forEach(([dx, dz]) => block(x + dx - 0.22, x + dx + 0.22, baseY, baseY + 0.85, z + dz - 0.22, z + dz + 0.22, 'cushion', C));
    },
    // café table (0.7 m) with two chairs along an axis
    cafe(x, z, baseY = 0, axis = 'x', chairColor = 'metal') {
      column(x, z, baseY, 0.74, 0.35, 'frame', C);
      for (const s of [-1, 1]) {
        const cx = axis === 'x' ? x + s * 0.75 : x, cz = axis === 'x' ? z : z + s * 0.75;
        block(cx - 0.22, cx + 0.22, baseY, baseY + 0.85, cz - 0.22, cz + 0.22, chairColor, C);
      }
    },
    sofaGroup(x, z, baseY) {
      block(x - 1.6, x + 1.6, baseY, baseY + 0.7, z - 1.55, z - 0.75, 'cushion', C);
      block(x - 1.6, x - 0.8, baseY, baseY + 0.7, z - 0.75, z + 1.4, 'cushion', C);
      block(x - 0.2, x + 1.1, baseY, baseY + 0.4, z - 0.2, z + 0.9, 'frame', C);
    },
    cabana(x0, x1, z0, z1, baseY, curtainSide = 'w') {
      for (const [px, pz] of [[x0 + 0.12, z0 + 0.12], [x1 - 0.12, z0 + 0.12], [x0 + 0.12, z1 - 0.12], [x1 - 0.12, z1 - 0.12]]) column(px, pz, baseY, 2.6, 0.08, 'frame', C);
      block(x0, x1, baseY + 2.6, baseY + 2.85, z0, z1, 'frame', C);
      block(x0 + 0.35, x1 - 0.35, baseY, baseY + 0.45, z0 + 0.35, z1 - 0.35, 'cushion', C);
      if (curtainSide === 'w') block(x0 + 0.04, x0 + 0.14, baseY + 0.1, baseY + 2.6, z0 + 0.1, z1 - 0.1, 'canvas', C);
      else block(x0 + 0.1, x1 - 0.1, baseY + 0.1, baseY + 2.6, z1 - 0.14, z1 - 0.04, 'canvas', C);
    },
    bench(x, z, baseY, len, a, color = 'frame') { oriented(x, z, baseY, 0.45, len, 0.55, a, color); },
    // --- amenity furniture at any plan angle (a = direction the head / front faces) ---
    loungerAt(x, z, baseY, a) {
      const c = Math.cos(a), s = Math.sin(a);
      oriented(x, z, baseY, 0.34, 2.0, 0.72, a, 'cushion');
      oriented(x + c * 0.72, z + s * 0.72, baseY + 0.34, 0.42, 0.5, 0.72, a, 'cushion');
    },
    sideTableAt(x, z, baseY) { column(x, z, baseY, 0.45, 0.22, 'metal', C); },
    daybed(x, z, baseY, a) {
      oriented(x, z, baseY, 0.4, 2.2, 1.6, a, 'frame');
      oriented(x, z, baseY + 0.4, 0.14, 2.0, 1.4, a, 'cushion');
    },
    // oriented planter: rim + soil + low shrubs; returns the soil level
    planterAt(x, z, baseY, len, depth, a, h = 0.6, shrubs = true) {
      oriented(x, z, baseY, h, len, depth, a, 'frame');
      oriented(x, z, baseY + h, 0.06, len - 0.24, depth - 0.24, a, 'planter');
      if (shrubs) {
        const c = Math.cos(a), s = Math.sin(a);
        const n = Math.max(1, Math.round(len / 1.0));
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n - 0.5;
          const sz = 0.8 + (k % 3) * 0.2, sh = 0.7 + (k % 2) * 0.35;
          add('cone', x + c * u * len, baseY + h + sh / 2, z + s * u * len, sz, sh, sz, k % 2 ? 'shrub' : 'shrubDark', C);
        }
      }
      return baseY + h;
    },
    // low deck / path light (warm white head on a slim charcoal post)
    deckLight(x, z, baseY, h = 0.55) {
      column(x, z, baseY, h, 0.05, 'charcoal', C);
      add('cyl', x, baseY + h + 0.05, z, 0.16, 0.1, 0.16, 'lamp', C);
    },
    bollard: (x, z, baseY) => { column(x, z, baseY, 0.9, 0.09, 'metal', C); add('cyl', x, baseY + 0.95, z, 0.2, 0.1, 0.2, 'lamp', C); },
  };
  return kit;
}
