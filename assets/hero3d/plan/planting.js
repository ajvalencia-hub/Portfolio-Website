// Planting system shared by the plan modules, the landscape layer and the audit.
// Tree forms are described at unit canopy radius r (the landscape layer scales them):
//   spread  — broad shade tree (live oak / gumbo limbo)
//   upright — rounded street tree
//   broad   — flat umbrella canopy on a taller clear trunk (poinciana-like; can flower)
//   round   — compact understory tree (silver buttonwood / crape-myrtle-like; can flower)
// extent: horizontal canopy reach · bottom / top: canopy underside and crown height
export const TREE_FORMS = {
  spread: { trunk: 1.05, extent: 1.05, bottom: 0.7, top: 1.9 },
  upright: { trunk: 1.25, extent: 0.8, bottom: 1.0, top: 2.5 },
  broad: { trunk: 1.55, extent: 1.3, bottom: 1.35, top: 2.25 },
  round: { trunk: 0.9, extent: 0.85, bottom: 0.55, top: 2.1 },
};

export const treeKind = (t) => t.kind || (t.lush ? 'spread' : 'upright');

// canopy of a tree in world terms: centre, reach, underside and top heights
export function canopyOf(t) {
  const f = TREE_FORMS[treeKind(t)];
  return { x: t.x, z: t.z, r: t.r * f.extent, y0: t.y + t.r * f.bottom, y1: t.y + t.r * f.top * 1.1 };
}

// Greedy placement with controlled randomisation: a candidate is accepted (possibly at a
// reduced size) only if its canopy clears accepted canopies, vertical obstacles (poles,
// umbrellas: { x, z, r, top }) and footprints (polygons, via `blocked(x, z, reach)`).
export function placeTrees(candidates, { existing = [], poles = [], blocked = () => false, gap = 0.3, minScale = 0.7 }) {
  const accepted = [];
  const all = () => [...existing, ...accepted];
  for (const c of candidates) {
    for (let s = 1; s >= minScale - 1e-6; s -= 0.1) {
      const t = { ...c, r: c.r * s };
      const k = canopyOf(t);
      const clashTree = all().some((o) => {
        const q = canopyOf(o);
        return Math.hypot(q.x - k.x, q.z - k.z) < q.r + k.r + gap && q.y1 > k.y0 && k.y1 > q.y0;
      });
      const clashPole = poles.some((p) => Math.hypot(p.x - k.x, p.z - k.z) < k.r + p.r + gap && p.top > k.y0);
      if (!clashTree && !clashPole && !blocked(k.x, k.z, k.r)) { accepted.push(t); break; }
    }
  }
  return accepted;
}
