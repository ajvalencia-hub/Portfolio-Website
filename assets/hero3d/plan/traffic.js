// Street traffic: the two travel lanes of the street ring round the development block,
// as closed loops. Pure data in metres (x = east, z = south) — no three.js here.
//   inner — 4.5 m off the block's curb: south on the east street, west on the south street,
//           north on the west street, east on the north street (driving on the right)
//   outer — 8.5 m off, the other way round
// Each lane is a rounded rectangle on the curb returns' centres, so the cars follow the
// carriageway round the corners, and the two lanes never cross: no signals, no conflicts.
// Cars in one lane all travel at the same speed, so the spacing they are placed with holds.
import { HX, HZ, WALK, HALF_ROAD } from './core.js';
import { CURB_R } from './streetscape.js';

export const TRAFFIC_SPEED = 8;        // m/s (≈ 18 mph)
export const LANE_HALF = 2.0;          // lane centre either side of the street centreline

// Segments in the direction of increasing angle φ about each corner centre, from the middle
// of the east side. Travelling that way the heading at φ is (−sin φ, cos φ).
function loop(offset, dir) {
  const a = HX + WALK + offset, b = HZ + WALK + offset, r = CURB_R + offset;
  const cx = a - r, cz = b - r, q = (r * Math.PI) / 2;
  const segs = [
    { line: [a, 0], phi: 0, len: cz },
    { arc: [cx, cz], phi: 0, len: q },
    { line: [cx, b], phi: Math.PI / 2, len: 2 * cx },
    { arc: [-cx, cz], phi: Math.PI / 2, len: q },
    { line: [-a, cz], phi: Math.PI, len: 2 * cz },
    { arc: [-cx, -cz], phi: Math.PI, len: q },
    { line: [-cx, -b], phi: 1.5 * Math.PI, len: 2 * cx },
    { arc: [cx, -cz], phi: 1.5 * Math.PI, len: q },
    { line: [a, -cz], phi: 2 * Math.PI, len: cz },
  ];
  return { offset, r, dir, segs, length: segs.reduce((n, s) => n + s.len, 0) };
}

export const TRAFFIC_LANES = {
  inner: loop(HALF_ROAD - LANE_HALF, 1),
  outer: loop(HALF_ROAD + LANE_HALF, -1),
};

// Position and heading at distance s travelled along a lane. rot turns a car's +x front
// toward the heading (the convention of the parked and placed cars).
export function lanePose(lane, s) {
  let u = (((lane.dir > 0 ? s : -s) % lane.length) + lane.length) % lane.length;
  for (const seg of lane.segs) {
    if (u > seg.len && seg !== lane.segs[lane.segs.length - 1]) { u -= seg.len; continue; }
    let x, z, phi;
    if (seg.line) {
      phi = seg.phi;
      x = seg.line[0] - Math.sin(phi) * u;
      z = seg.line[1] + Math.cos(phi) * u;
    } else {
      phi = seg.phi + u / lane.r;
      x = seg.arc[0] + lane.r * Math.cos(phi);
      z = seg.arc[1] + lane.r * Math.sin(phi);
    }
    return { x, z, rot: -phi - (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) };
  }
  return null;
}

// Distance along a lane (in its own direction of travel) of the lane point nearest (x, z),
// and how far off the lane (x, z) lies.
export function laneProject(lane, x, z) {
  let best = { s: 0, off: Infinity };
  let at = 0;
  for (const seg of lane.segs) {
    let u, off;
    if (seg.line) {
      const dx = -Math.sin(seg.phi), dz = Math.cos(seg.phi);
      u = Math.min(seg.len, Math.max(0, (x - seg.line[0]) * dx + (z - seg.line[1]) * dz));
      off = Math.hypot(x - (seg.line[0] + dx * u), z - (seg.line[1] + dz * u));
    } else {
      let d = Math.atan2(z - seg.arc[1], x - seg.arc[0]) - seg.phi;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const t = Math.min(Math.PI / 2, Math.max(0, d));
      u = t * lane.r;
      off = Math.hypot(x - (seg.arc[0] + lane.r * Math.cos(seg.phi + t)), z - (seg.arc[1] + lane.r * Math.sin(seg.phi + t)));
    }
    if (off < best.off) best = { s: (at + u) * lane.dir, off };
    at += seg.len;
  }
  return best;
}
