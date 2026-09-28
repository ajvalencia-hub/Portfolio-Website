// M — the paseo colonnade.
//
// This module used to hold three structures that held the park's edges: a market hall on
// the south-east corner, an open promenade pavilion on the east wedge, and this colonnade.
// The art museum was then built across the park's open ground and grown into the ground the
// other two stood on, so both have been removed rather than left standing against it — a
// single-storey café and a shade shelter either side of a three-storey building read as
// leftovers, and the museum needed their footprints.
//
// What remains is the colonnade, which is not next to the museum: it stands on the paseo,
// west of the spine and well north of the park, where the paseo is only ~15 m wide between
// the podium storefronts and the spine. A liner building there would wall the storefronts
// off, so a free-standing covered walk holds that edge instead.
//
// Massing only: no structure, envelope, servicing, occupancy or code compliance is designed
// or verified.
import { partsKit } from './core.js';
import { box } from './core.js';
import { onRoute, ENTRANCES, inFurnishing } from './pedestrian.js';
import { insidePlan } from './core.js';

// paseo colonnade: paired columns on a 3.2 m bay carrying a white roof slab
export const COLONNADE = { x0: -15.8, x1: -12.4, z0: -41.5, z1: -17.8, y: 3.8, thick: 0.45, bay: 3.2 };

// footprints that planting, furniture and cars must stay out of — the colonnade is an open
// walk, so nothing is reserved here
export const PAVILION_FOOTPRINTS = [];

export function pavilionMasses() {
  return [];
}

export function pavilionBoxes() {
  return [
    box('M.colRoof', COLONNADE.x0, COLONNADE.x1, COLONNADE.z0, COLONNADE.z1, COLONNADE.y, COLONNADE.thick, 'frame', 'M', [0.358, 0.026]),
  ];
}

export function pavilionParts() {
  const out = [];
  const K = partsKit(out);
  const { block, column } = K;
  const C = 'context';

  // a column may not stand on a walking surface or in an entrance forecourt
  const free = (x, z) => !onRoute(x, z, 0.4) && !inFurnishing(x, z, 0.3)
    && !ENTRANCES.some((e) => insidePlan(x, z, e.poly));

  // --- paseo colonnade: paired columns on each bay, with a light line under the slab -----
  const L = COLONNADE;
  for (let z = L.z0 + 0.6; z <= L.z1 - 0.6; z += L.bay) {
    for (const x of [L.x0 + 0.45, L.x1 - 0.45]) if (free(x, z)) column(x, z, 0, L.y, 0.14, 'frame');
  }
  block(L.x0 + 0.3, L.x1 - 0.3, L.y - 0.1, L.y - 0.06, L.z0 + 0.4, L.z1 - 0.4, 'lamp', C);
  return { parts: out };
}
