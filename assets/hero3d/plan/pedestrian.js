// Pedestrian layout: the single source of truth for the development's circulation.
//
// A small hierarchy of purposeful routes replaces the earlier fragmented paving:
//   • primary   — the east–west Central Promenade (west sidewalk → podium galleria →
//                 park edge → hotel and office frontages → east sidewalk) and the
//                 north–south Spine (south sidewalk → fountain → promenade → paseo →
//                 north sidewalk)
//   • loop      — the fountain plaza: a continuous paved ring around the reflecting pool
//   • secondary — short connections from the primary routes to lobbies, storefronts,
//                 the covered podium arcade, the office walk and the hotel arrival court
//   • entry     — textured entrance zones at every principal door
// Vehicle crossings are listed separately (streetscape.js builds them as continuous
// sidewalk paving across each driveway).
//
// Each route: centreline control points (smoothed where noted), clear width, surface,
// top elevation, the nodes it joins, the destinations it serves, lighting spacing,
// furnishing zones and the landscape setback. Geometry is generated from these
// centrelines (ribbons with mitred offsets), merged by surface into a few meshes.
// Surfaces of different materials sit ≥ 15 mm apart in height so overlapping junctions
// can never share a plane; routes of the same surface may overlap (identical shading).
//
// Conceptual only: grades are flat within ±45 mm, so every route is step-free in the model;
// slopes, cross-falls, landings and detectable surfaces are not designed or verified.
import { GLAZE, HX, HZ, D2R, offsetPlan, arcSamples, insidePlan, roundedRectPlan, rect, partsKit } from './core.js';
import { fixtureKit, FIXTURE } from './fixtures.js';
import { PODIUM_PLAN } from './residential.js';

// ---------------------------------------------------------------------------
// Surfaces (top elevation above the 0 m site datum; block paving is 0.03, lawns 0.07)
// ---------------------------------------------------------------------------
export const SURFACE = {
  secondary: { kind: 'walk2', glaze: GLAZE.bond, module: [0.9, 0.45], top: 0.105, label: 'light running-bond pavers' },
  spine: { kind: 'spine', glaze: GLAZE.bond, module: [1.2, 0.4], top: 0.12, label: 'long-format linear pavers' },
  promenade: { kind: 'promenade', glaze: GLAZE.promenade, module: [1.2, 0.6], top: 0.135, label: 'large-format bond with transverse bands' },
  band: { kind: 'band', glaze: GLAZE.pavers, module: [0.45, 0.45], top: null, label: 'darker edge band' },
  plaza: { kind: 'terrazzo', glaze: GLAZE.rings, module: [1.6, 1.8], top: 0.15, label: 'concentric rings with radial joints' },
  entry: { kind: 'entry', glaze: GLAZE.pavers, module: [0.35, 0.35], top: 0.165, label: 'small textured setts' },
};
export const LAWN_TOP = 0.07;

// ---------------------------------------------------------------------------
// Key positions
// ---------------------------------------------------------------------------
export const FOUNTAIN_CENTRE = [0, 28];
export const PLAZA_R = 14.2;          // fountain plaza (loop) outer radius
export const LOOP_CLEAR = [8.2, 12.8]; // clear walking ring between the basin coping and the bench ring
export const GALLERIA = { z: 15.15, width: 4.5, x0: -76, x1: -26 };
export const PROMENADE_Z = 5.5;
const F = FOUNTAIN_CENTRE;
const onPlaza = (deg) => [F[0] + PLAZA_R * Math.cos(deg * D2R), F[1] + PLAZA_R * Math.sin(deg * D2R)];

// ---------------------------------------------------------------------------
// Nodes: sidewalk connections, doors, junctions and destinations
// ---------------------------------------------------------------------------
export const NODES = {
  // public sidewalks (property line)
  swGalleria: { at: [-HX, GALLERIA.z], kind: 'sidewalk', name: 'West sidewalk at the galleria' },
  swT1: { at: [-HX, -28], kind: 'sidewalk', name: 'West sidewalk at the Tower 1 lobby' },
  sePromenade: { at: [HX, PROMENADE_Z], kind: 'sidewalk', name: 'East sidewalk at the promenade' },
  ssGate: { at: [0, HZ], kind: 'sidewalk', name: 'South sidewalk at the park gate' },
  ssT2: { at: [-50, HZ], kind: 'sidewalk', name: 'South sidewalk at the Tower 2 lobby' },
  ssOfficeWalk: { at: [20.5, HZ], kind: 'sidewalk', name: 'South sidewalk at the office walk' },
  ssOffice: { at: [29.25, HZ], kind: 'sidewalk', name: 'South sidewalk at the office lobby' },
  snPaseo: { at: [-11.25, -HZ], kind: 'sidewalk', name: 'North sidewalk at the paseo' },
  // doors
  t1Lobby: { at: [-72.5, -28], kind: 'door', name: 'Tower 1 lobby (west entrance)', building: 'residential' },
  t2Lobby: { at: [-50, 45.6], kind: 'door', name: 'Tower 2 lobby (south entrance)', building: 'residential' },
  t2LobbyGalleria: { at: [-51.75, 17.4], kind: 'door', name: 'Tower 2 lobby (galleria entrance)', building: 'residential' },
  amenityLift: { at: [-29.5, 0.1], kind: 'door', name: 'Podium stair + lift to the amenity deck (residents)', building: 'residential' },
  nwStair: { at: [-72.5, -18.5], kind: 'door', name: 'Podium stair (north-west)', building: 'residential' },
  hotelMain: { at: [28, -2], kind: 'door', name: 'Hotel main entrance (lobby)', building: 'hotel' },
  hotelRestaurant: { at: [12, -4], kind: 'door', name: 'Hotel restaurant', building: 'hotel' },
  hotelCafe: { at: [45, -4], kind: 'door', name: 'Hotel lobby bar + café', building: 'hotel' },
  hotelArrival: { at: [66, -28], kind: 'door', name: 'Hotel guest arrival (bell desk)', building: 'hotel' },
  officeLobbyS: { at: [29.25, 47.5], kind: 'door', name: 'Office lobby (south entrance)', building: 'office' },
  officeLobbyW: { at: [24.5, 43], kind: 'door', name: 'Office lobby (park entrance)', building: 'office' },
  // junctions and destinations
  galleriaW: { at: [-76, GALLERIA.z], kind: 'junction', name: 'Galleria west portal' },
  galleriaE: { at: [-26, GALLERIA.z], kind: 'junction', name: 'Galleria east portal' },
  centralCrossing: { at: [0, PROMENADE_Z], kind: 'junction', name: 'Central crossing (promenade × spine)' },
  plazaN: { at: onPlaza(-90), kind: 'junction', name: 'Fountain plaza — north' },
  plazaS: { at: onPlaza(90), kind: 'junction', name: 'Fountain plaza — south' },
  plazaW: { at: onPlaza(180), kind: 'junction', name: 'Fountain plaza — west' },
  plazaNE: { at: onPlaza(-50), kind: 'junction', name: 'Fountain plaza — north-east' },
  plazaSE: { at: onPlaza(35), kind: 'junction', name: 'Fountain plaza — south-east' },
  fountain: { at: F, kind: 'destination', name: 'Central park and fountain' },
  retailEast: { at: [-27.75, 28], kind: 'destination', name: 'Podium retail frontage (east arcade)' },
  retailGalleria: { at: [-40, GALLERIA.z], kind: 'destination', name: 'Galleria shopfronts' },
  cafePodium: { at: [-23.9, 34], kind: 'destination', name: 'Podium café seating' },
  cafeHotel: { at: [45, 0.4], kind: 'destination', name: 'Hotel café terrace' },
  cafeRestaurant: { at: [12, 0.4], kind: 'destination', name: 'Hotel restaurant terrace' },
  cafeOffice: { at: [17.8, 32.5], kind: 'destination', name: 'Office coffee-bar seating' },
  paseoCrossN: { at: [-11.25, -44], kind: 'junction', name: 'Paseo cross walk (north)' },
  paseoCrossM: { at: [-11.25, -15.5], kind: 'junction', name: 'Paseo cross walk (middle)' },
  arcadeN: { at: [-27.75, -44], kind: 'junction', name: 'East arcade (north end)' },
  arcadeM: { at: [-27.75, -15.5], kind: 'junction', name: 'East arcade at the middle cross walk' },
  arcadeSW: { at: [-74.25, -31.5], kind: 'junction', name: 'West arcade at the Tower 1 forecourt' },
  gardenWalkN: { at: [71.3, -20], kind: 'junction', name: 'Hotel arrival court' },
  promHotelE: { at: [58.6, 3.4], kind: 'junction', name: 'Promenade at the hotel café frontage' },
  promGarden: { at: [71.3, 3.4], kind: 'junction', name: 'Promenade at the hotel garden walk' },
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const arcadeCentre = () => {
  // covered arcade: 3.5 m between the podium edge and the storefront line, from the east
  // face at the north cross walk, round the south face, to the Tower 1 forecourt on the west
  const s = arcSamples(offsetPlan(PODIUM_PLAN, -1.75), 1.0);
  const startI = s.reduce((best, q, i) => (q.nx > 0.9 && Math.abs(q.z + 44) < Math.abs(s[best].z + 44) && q.nx > 0.9 ? i : best), s.findIndex((q) => q.nx > 0.9));
  const out = [];
  for (let k = 0; k < s.length; k++) {
    const q = s[(startI + k) % s.length];
    out.push([q.x, q.z]);
    if (q.nx < -0.9 && q.z < -31.5) break;
  }
  return out;
};

export const ROUTES = [
  {
    id: 'P1', name: 'Central Promenade', type: 'primary', surface: 'promenade', edgeBand: 0.45, smooth: true,
    pts: [[-HX, GALLERIA.z], [-26, GALLERIA.z], [-21, GALLERIA.z], [-15.5, 12.6], [-10.5, 8.4], [-5.5, 5.9], [0, PROMENADE_Z], [6, PROMENADE_Z], [HX, PROMENADE_Z]],
    width: (x) => (x <= -22 ? GALLERIA.width : x >= -6 ? 6.0 : lerp(GALLERIA.width, 6.0, (x + 22) / 16)),
    nodes: ['swGalleria', 'galleriaW', 'retailGalleria', 't2LobbyGalleria', 'galleriaE', 'centralCrossing', 'promHotelE', 'promGarden', 'sePromenade'],
    destinations: ['Galleria shopfronts', 'Tower 2 lobby (galleria entrance)', 'Podium retail (east arcade)', 'Central park', 'Hotel restaurant, main entrance and café', 'Office walk', 'Hotel garden walk'],
    covered: [[-76, -26]], lights: { spacing: 16, sides: 'both', offset: 0.7, kind: 'ped', skip: [[-80, -20]] }, setback: 0.7,
  },
  {
    id: 'S1', name: 'Spine — park gate to the fountain', type: 'primary', surface: 'spine', edgeBand: 0.35,
    pts: [[0, HZ], onPlaza(90)], width: 4.5, nodes: ['ssGate', 'plazaS'],
    destinations: ['South sidewalk', 'Central park and fountain'], lights: { spacing: 9, sides: 'both', offset: 0.6, kind: 'ped' }, setback: 0.8,
  },
  {
    id: 'S2', name: 'Spine — fountain, central crossing, paseo to the north sidewalk', type: 'primary', surface: 'spine', edgeBand: 0.35, smooth: true,
    pts: [onPlaza(-90), [0, 9], [0, 3.6], [-2.6, -1.4], [-7.4, -5.4], [-11.25, -10.5], [-11.25, -20], [-11.25, -HZ]], width: 4.5,
    nodes: ['plazaN', 'centralCrossing', 'paseoCrossM', 'paseoCrossN', 'snPaseo'],
    destinations: ['Central park and fountain', 'Central Promenade', 'Paseo (podium retail and hotel garden)', 'North sidewalk'],
    lights: { spacing: 14, sides: 'both', offset: 0.6, kind: 'ped', skip: [[-1, 12]] }, setback: 0.8,
  },
  {
    id: 'C1', name: 'Plaza → podium retail arcade', type: 'secondary', surface: 'secondary', pts: [onPlaza(180), [-27.4, 28]], width: 3.0,
    nodes: ['plazaW', 'retailEast'], destinations: ['Podium retail frontage', 'Podium café seating', 'Galleria via the arcade'], lights: { spacing: 7, sides: 'left', offset: 0.5, kind: 'bollard' }, setback: 0.6,
  },
  {
    id: 'C2', name: 'Plaza → office lobby', type: 'secondary', surface: 'secondary', pts: [onPlaza(35), [20.2, 41.8]], width: 3.0,
    nodes: ['plazaSE', 'officeLobbyW'], destinations: ['Office lobby (park entrance)'], lights: { spacing: 6, sides: 'right', offset: 0.5, kind: 'bollard' }, setback: 0.6,
  },
  {
    id: 'C3', name: 'Plaza → hotel entrance', type: 'secondary', surface: 'secondary', pts: [onPlaza(-50), [16.2, 7.6]], width: 3.0,
    nodes: ['plazaNE', 'centralCrossing'], destinations: ['Central Promenade', 'Hotel main entrance'], lights: { spacing: 6, sides: 'left', offset: 0.5, kind: 'bollard' }, setback: 0.6,
  },
  {
    id: 'OW', name: 'Office walk', type: 'secondary', surface: 'secondary', pts: [[20.5, 8.2], [20.5, HZ]], width: 2.6,
    nodes: ['centralCrossing', 'officeLobbyW', 'ssOfficeWalk'], destinations: ['Office lobby (park entrance)', 'Office coffee-bar seating', 'South sidewalk'], lights: { spacing: 12, sides: 'left', offset: 0.5, kind: 'ped' }, setback: 0.5,
  },
  {
    id: 'HFW', name: 'Hotel frontage — restaurant', type: 'secondary', surface: 'secondary', pts: [[19.2, -1.3], [18.0, -2.8], [5, -2.8], [1.8, -2.1], [-0.4, -0.3], [-2.6, 2.8]], width: 2.2,
    nodes: ['hotelMain', 'hotelRestaurant', 'centralCrossing'], destinations: ['Hotel restaurant', 'Restaurant terrace'], lights: null, setback: 0,
  },
  {
    id: 'HFE', name: 'Hotel frontage — café', type: 'secondary', surface: 'secondary', pts: [[36.8, -1.3], [38.0, -2.8], [51, -2.8], [54.2, -2.1], [56.4, -0.3], [58.6, 2.8]], width: 2.2,
    nodes: ['hotelMain', 'hotelCafe', 'promHotelE'], destinations: ['Hotel lobby bar + café', 'Café terrace'], lights: null, setback: 0,
  },
  {
    id: 'GW', name: 'Hotel garden walk', type: 'secondary', surface: 'secondary', pts: [[71.3, -20], [71.3, 3.0]], width: 3.0,
    nodes: ['hotelArrival', 'gardenWalkN', 'promGarden'], destinations: ['Hotel guest arrival and porte-cochère'], lights: { spacing: 4.6, sides: 'right', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
  {
    id: 'ARC', name: 'Podium arcade (covered)', type: 'secondary', surface: 'secondary', pts: null, build: arcadeCentre, width: 3.5, covered: 'all',
    nodes: ['arcadeN', 'arcadeM', 'amenityLift', 'galleriaE', 'retailEast', 't2Lobby', 'galleriaW', 'nwStair', 'arcadeSW'],
    destinations: ['Podium retail storefronts', 'Tower 2 lobby', 'Tower 1 lobby', 'Amenity lift', 'Galleria portals'],
    clearNote: 'clear zone between storefront and arcade columns ≈ 2.1 m', lights: null, setback: 0,
  },
  {
    id: 'X0', name: 'Paseo cross walk (north)', type: 'secondary', surface: 'secondary', pts: [[-31.0, -44], [-10, -44]], width: 3.0,
    nodes: ['arcadeN', 'paseoCrossN'], destinations: ['Podium retail (north-east)', 'Paseo'], lights: { spacing: 8, sides: 'left', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
  {
    id: 'X1', name: 'Paseo cross walk (middle)', type: 'secondary', surface: 'secondary', pts: [[-28.6, -15.5], [-10, -15.5]], width: 3.0,
    nodes: ['arcadeM', 'paseoCrossM'], destinations: ['Amenity lift', 'Paseo'], lights: { spacing: 8, sides: 'right', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
];

// textured entrance zones (polygons) at every principal door
export const ENTRANCES = [
  { id: 'E-T1', name: 'Tower 1 lobby forecourt', node: 't1Lobby', poly: rect(-HX, -32.8, -72.7, -24.4), joins: ['swT1', 'arcadeSW'] },
  { id: 'E-T2', name: 'Tower 2 lobby forecourt', node: 't2Lobby', poly: rect(-54.2, 49.1, -45.8, HZ), joins: ['ssT2', 't2Lobby'] },
  { id: 'E-HOTEL', name: 'Hotel entrance forecourt (under the canopy)', node: 'hotelMain', poly: roundedRectPlan(19.4, -1.95, 36.6, 2.7, 0.5), joins: ['centralCrossing'] },
  { id: 'E-OFFS', name: 'Office lobby forecourt', node: 'officeLobbyS', poly: rect(24.5, 47.6, 33.5, HZ), joins: ['ssOffice'] },
  { id: 'E-OFFW', name: 'Office park entrance', node: 'officeLobbyW', poly: rect(21.7, 39.4, 24.45, 46.6), joins: ['officeLobbyW'] },
  { id: 'E-ARRIVAL', name: 'Hotel arrival court', node: 'hotelArrival', poly: rect(67.5, -36, 72.6, -19.9), joins: ['gardenWalkN'] },
  { id: 'E-GALW', name: 'Galleria west portal', node: 'galleriaW', poly: rect(-76.4, 13.0, -72.6, 17.3), joins: ['swGalleria'] },
  { id: 'E-GALE', name: 'Galleria east portal', node: 'galleriaE', poly: rect(-29.4, 13.0, -25.6, 17.3), joins: ['galleriaE'] },
];

// furnishing zones: café seating, benches, bicycle stands — beside, never on, the clear zones
export const FURNISHING = [
  { id: 'F-REST', kind: 'cafe', name: 'Restaurant terrace', rect: [4.6, 18.2, -1.5, 2.3], rows: [-0.45, 1.45], pitch: 3.0, umbrellas: 2.6 },
  { id: 'F-CAFE', kind: 'cafe', name: 'Hotel café terrace', rect: [38.4, 51.6, -1.5, 2.3], rows: [-0.45, 1.45], pitch: 3.0, umbrellas: 2.6 },
  { id: 'F-PODIUM', kind: 'cafe', name: 'Podium café', rect: [-25.6, -22.0, 18.6, 26.2], cols: [-24.6, -22.9], pitch: 2.6, axis: 'z', umbrellas: 2.6 },
  { id: 'F-PODIUM2', kind: 'cafe', name: 'Podium café (south)', rect: [-25.6, -22.0, 29.8, 38.0], cols: [-24.6, -22.9], pitch: 2.6, axis: 'z', umbrellas: 2.6 },
  { id: 'F-OFFICE', kind: 'cafe', name: 'Office coffee bar', rect: [16.6, 18.9, 27.8, 37.4], cols: [17.8], pitch: 2.7, axis: 'z', umbrellas: 2.4 },
  { id: 'F-PROM-S', kind: 'benches', name: 'Promenade benches (office planting strip)', along: 'x', line: 9.35, from: 24, to: 72, pitch: 10, facing: -1 },
  { id: 'F-PARK-N', kind: 'benches', name: 'Promenade benches (park edge)', along: 'x', line: 9.35, from: -1, to: 16, pitch: 8.5, facing: -1, skip: [[-3.5, 3.5], [13.8, 19]] },
  { id: 'F-BIKE-OFF', kind: 'bike', name: 'Bicycle stands (office walk)', at: [25.0, 10.6], count: 4, along: 'x' },
  { id: 'F-BIKE-GAL', kind: 'bike', name: 'Bicycle stands (galleria east)', at: [-23.5, 11.1], count: 4, along: 'x' },
  { id: 'F-BIKE-HOTEL', kind: 'bike', name: 'Bicycle stands (hotel entrance)', at: [53.8, 1.2], count: 3, along: 'x' },
  { id: 'F-BIKE-T2', kind: 'bike', name: 'Bicycle stands (tower 2 forecourt)', at: [-40.0, 52.6], count: 4, along: 'x' },
  { id: 'F-BIKE-T1', kind: 'bike', name: 'Bicycle stands (tower 1 forecourt)', at: [-78.3, -38.0], count: 4, along: 'z' },
  { id: 'F-BIKE-OFFS', kind: 'bike', name: 'Bicycle stands (office lobby)', at: [36.2, 52.6], count: 3, along: 'x' },
];

// pedestrian / vehicle conflict points (all on the perimeter sidewalks) — geometry in streetscape.js
export const CROSSINGS = [
  { id: 'VX1', name: 'Residential garage entrance', side: 'n', span: [-64.6, -58.2] },
  { id: 'VX2', name: 'Residential loading dock', side: 'n', span: [-39.9, -35.3] },
  { id: 'VX3', name: 'Hotel receiving and refuse', side: 'n', span: [49.4, 64.0] },
  { id: 'VX4', name: 'Hotel arrival drive — entry', side: 'e', span: [-42.0, -35.6] },
  { id: 'VX5', name: 'Hotel arrival drive — exit', side: 'e', span: [-16.4, -10.0] },
  { id: 'VX6', name: 'Office car lifts', side: 'e', span: [15.0, 28.0] },
  { id: 'VX7', name: 'Office loading dock', side: 'e', span: [41.5, 48.5] },
];
export const SIGHT_TRIANGLE = 3.0;   // clear distance along the sidewalk each side of a driveway

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
// centripetal Catmull–Rom through control points; collinear runs stay straight
function catmullRom(ctrl, step) {
  const out = [];
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const d = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
    const t0 = 0, t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const seg = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < seg; k++) {
      const t = t1 + ((t2 - t1) * k) / seg;
      const L = (a, b, ta, tb) => [0, 1].map((j) => ((tb - t) * a[j] + (t - ta) * b[j]) / (tb - ta));
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

export function routeCentreline(route) {
  if (route._centre) return route._centre;
  const ctrl = route.build ? route.build() : route.pts;
  route._centre = route.smooth ? catmullRom(ctrl, 0.8) : resample(ctrl, 1.5);
  return route._centre;
}

const widthAt = (route, p) => (typeof route.width === 'function' ? route.width(p[0], p[1]) : route.width);

// mitred offset of an open polyline; d > 0 to the left of travel
function offsetLine(pts, dFn) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const prev = i > 0 ? [p[0] - a[0], p[1] - a[1]] : [b[0] - p[0], b[1] - p[1]];
    const next = i < pts.length - 1 ? [b[0] - p[0], b[1] - p[1]] : prev;
    const n1 = norm([-prev[1], prev[0]]), n2 = norm([-next[1], next[0]]);
    let m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = Math.max(0.5, m[0] * n2[0] + m[1] * n2[1]);
    const d = dFn(p, i) / cos;
    return [p[0] + m[0] * d, p[1] + m[1] * d];
  });
}
const norm = ([x, z]) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

// polygon between two offsets (d0 < d1) along the centreline
function band(pts, d0Fn, d1Fn) {
  const a = offsetLine(pts, d0Fn), b = offsetLine(pts, d1Fn);
  return [...b, ...a.reverse()];
}

// all pedestrian surface polygons, grouped by surface, plus per-route clear polygons
export function pedestrianGeometry({ bands = true } = {}) {
  const groups = {};
  const push = (surface, poly, owner) => (groups[surface] ||= []).push({ pts: poly, owner });
  const clear = [];
  for (const r of ROUTES) {
    const c = routeCentreline(r);
    const hw = (p) => widthAt(r, p) / 2;
    if (r.edgeBand && bands) {
      const e = r.edgeBand;
      push(r.surface, band(c, (p) => -hw(p) + e, (p) => hw(p) - e), r.id);
      push(`${r.surface}Band`, band(c, (p) => hw(p) - e, (p) => hw(p)), r.id);
      push(`${r.surface}Band`, band(c, (p) => -hw(p), (p) => -hw(p) + e), r.id);
    } else {
      push(r.surface, band(c, (p) => -hw(p), (p) => hw(p)), r.id);
    }
    clear.push({ id: r.id, name: r.name, type: r.type, poly: band(c, (p) => -hw(p), (p) => hw(p)), centre: c, width: r.width });
  }
  for (const e of ENTRANCES) push('entry', e.poly, e.id);
  // café terraces are paved like the secondary walks (furniture sits beside the clear zones)
  for (const f of FURNISHING) if (f.kind === 'cafe') push('secondary', rect(f.rect[0], f.rect[2], f.rect[1], f.rect[3]), f.id);
  return { groups, clear };
}

// is (x, z) on any pedestrian clear zone (optionally grown by pad)?
let clearCache = null;
export function onRoute(x, z, pad = 0) {
  if (!clearCache) {
    clearCache = pedestrianGeometry().clear.map((c) => {
      const xs = c.poly.map((q) => q[0]), zs = c.poly.map((q) => q[1]);
      return { ...c, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] };
    });
    clearCache.push(...ENTRANCES.map((e) => ({ id: e.id, poly: e.poly, bb: [Math.min(...e.poly.map((q) => q[0])), Math.max(...e.poly.map((q) => q[0])), Math.min(...e.poly.map((q) => q[1])), Math.max(...e.poly.map((q) => q[1]))] })));
    clearCache.push({ id: 'PLAZA', circle: [F[0], F[1], PLAZA_R], bb: [F[0] - PLAZA_R, F[0] + PLAZA_R, F[1] - PLAZA_R, F[1] + PLAZA_R] });
  }
  return clearCache.some((c) => {
    if (x < c.bb[0] - pad || x > c.bb[1] + pad || z < c.bb[2] - pad || z > c.bb[3] + pad) return false;
    if (c.circle) return Math.hypot(x - c.circle[0], z - c.circle[1]) < c.circle[2] + pad;
    if (insidePlan(x, z, c.poly)) return true;
    return pad > 0 && distToPoly(x, z, c.poly) < pad;
  });
}
export function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return best;
}

// curved specs: one merged prism mesh per surface (arrives with the landscape)
export function pedestrianSpecs(tier = { name: 'desktop' }) {
  // mobile: edge bands merge into the route fields (two fewer draw calls)
  const { groups } = pedestrianGeometry({ bands: tier.name !== 'mobile' });
  const ctx = { parent: null, y0: 0, start: 0.656, dur: 0.01, wire: false, phase: 'context', type: 'prisms' };
  const out = [];
  for (const [key, polys] of Object.entries(groups)) {
    const base = key.endsWith('Band') ? key.slice(0, -4) : key;
    const S = SURFACE[base];
    const B = SURFACE.band;
    const isBand = key.endsWith('Band');
    out.push({
      ...ctx, name: `W.${key}`, kind: isBand ? B.kind : S.kind, glaze: isBand ? B.glaze : S.glaze, module: isBand ? B.module : S.module,
      h: S.top, parts: polys.map((p) => ({ pts: p.pts, owner: p.owner })),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lighting, seating, café sets and bicycle stands placed from the configuration.
// ctx: { blocked(x, z) → true inside buildings, pools or private areas }
// Returns { parts, poles } — poles are handed to the planting generators so canopies
// and light heads never meet.
// ---------------------------------------------------------------------------
export function furnishingRects() {
  return FURNISHING.filter((f) => f.rect).map((f) => ({ id: f.id, rect: f.rect }));
}
export const inFurnishing = (x, z, pad = 0) => FURNISHING.some((f) => f.rect && x > f.rect[0] - pad && x < f.rect[1] + pad && z > f.rect[2] - pad && z < f.rect[3] + pad);

// driveway sight triangles on the sidewalks (kept clear of poles, trees, signs, furniture)
// two zones flank each driveway: 3 m of sidewalk either side, from 2 m inside the
// property line to the curb (the driveway itself holds only its own entrance equipment)
export function sightZones() {
  return CROSSINGS.flatMap((c) => [[c.span[0] - SIGHT_TRIANGLE, c.span[0]], [c.span[1], c.span[1] + SIGHT_TRIANGLE]].map(([a0, a1], k) => {
    const id = `${c.id}${k ? 'b' : 'a'}`;
    if (c.side === 'n') return { id, crossing: c.id, rect: [a0, a1, -HZ - 4.6, -HZ + 2.0] };
    if (c.side === 's') return { id, crossing: c.id, rect: [a0, a1, HZ - 2.0, HZ + 4.6] };
    if (c.side === 'e') return { id, crossing: c.id, rect: [HX - 2.0, HX + 4.6, a0, a1] };
    return { id, crossing: c.id, rect: [-HX - 4.6, -HX + 2.0, a0, a1] };
  }));
}
export const inSight = (x, z) => sightZones().some((s) => x > s.rect[0] && x < s.rect[1] && z > s.rect[2] && z < s.rect[3]);

export function pedestrianParts(tier, ctx) {
  const out = [];
  const K = partsKit(out);
  const X = fixtureKit(K);
  const C = 'context';
  const full = tier.name !== 'mobile';
  const poles = [];
  const doors = Object.values(NODES).filter((n) => n.kind === 'door').map((n) => n.at);
  const nearDoor = (x, z) => doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 1.6);
  const okPole = (x, z, reach = 0.4) => !onRoute(x, z, 0.2) && !inFurnishing(x, z, 0.4) && !inSight(x, z) && !nearDoor(x, z) && !ctx.blocked(x, z, reach)
    && poles.every((p) => Math.hypot(p.x - x, p.z - z) > 2.5) && Math.abs(x) < HX - 0.3 && Math.abs(z) < HZ - 0.3;

  // --- route lights: staggered both sides (or one side), shifted along the route to stay clear
  for (const r of ROUTES) {
    if (!r.lights) continue;
    const L = r.lights;
    const c = routeCentreline(r);
    const cum = [0];
    for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const total = cum.at(-1);
    const pointAt = (s) => {
      let i = 1;
      while (i < c.length - 1 && cum[i] < s) i++;
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const [ax, az] = c[i - 1], [bx, bz] = c[i];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      return { x: ax + dx * t, z: az + dz * t, nx: -dz / l, nz: dx / l };
    };
    const spacing = full ? L.spacing : L.spacing * 2;
    const sides = L.sides === 'both' ? [1, -1] : L.sides === 'left' ? [1] : [-1];
    sides.forEach((side, k) => {
      for (let s = spacing * (0.5 + 0.5 * k); s < total - 1; s += spacing) {
        for (const shift of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
          const q = pointAt(Math.min(total - 0.5, Math.max(0.5, s + shift)));
          if (L.skip?.some(([x0, x1]) => q.x > x0 && q.x < x1)) break;
          const off = widthAt(r, [q.x, q.z]) / 2 + L.offset;
          const x = q.x + q.nx * off * side, z = q.z + q.nz * off * side;
          if (!okPole(x, z, L.kind === 'ped' ? 0.3 : 0.15)) continue;
          if (L.kind === 'ped') { X.pedLight(x, z, ctx.groundAt(x, z)); poles.push({ x, z, r: FIXTURE.ped.reach, top: FIXTURE.ped.h, route: r.id }); }
          else { X.bollard(x, z, ctx.groundAt(x, z)); poles.push({ x, z, r: 0.15, top: 1.0, route: r.id }); }
          break;
        }
      }
    });
  }
  // --- lanterns at the plaza (between bench groups), the galleria mouths and the entrances
  const extra = [
    ...[-70, -20, 10, 60, 120, 150, 215, 250].map((deg) => [F[0] + 13.55 * Math.cos(deg * D2R), F[1] + 13.55 * Math.sin(deg * D2R)]),
    [-80 + 0.6, 11.9], [-80 + 0.6, 18.4], [-21.4, 11.6], [-21.2, 19.2],
    [19.6, 3.3], [36.4, 3.3], [22.8, 48.8], [35.0, 48.8], [-55.2, 50.2], [-44.8, 50.2], [-78.8, -32.6], [-78.8, -23.4],
    [74.0, -19.0], [65.2, -19.6],
    [3.9, 2.0], [52.4, 2.0], [-24.8, -1.2], [-24.6, -17.8], [44.5, -53.6],
  ];
  for (const [x, z] of extra) {
    if (!okPole(x, z, 0.3)) continue;
    X.pedLight(x, z, ctx.groundAt(x, z));
    poles.push({ x, z, r: FIXTURE.ped.reach, top: FIXTURE.ped.h, route: 'node' });
  }

  // --- furnishing zones
  for (const f of FURNISHING) {
    if (f.kind === 'cafe') {
      const [x0, x1, z0, z1] = f.rect;
      const y = SURFACE.secondary.top;
      let n = 0;
      if (f.axis === 'z') {
        for (const cx of f.cols) {
          for (let z = z0 + 1.1; z <= z1 - 1.0; z += f.pitch) { if (full || n % 2 === 0) K.cafe(cx, z, y, 'z'); n++; }
        }
        for (let z = z0 + 2.4; z <= z1 - 1.6; z += f.pitch * 2) { K.umbrella((x0 + x1) / 2, z, y, f.umbrellas); poles.push({ x: (x0 + x1) / 2, z, r: f.umbrellas / 2, top: 3.1, umbrella: true }); }
      } else {
        for (const cz of f.rows) {
          for (let x = x0 + 1.1; x <= x1 - 1.0; x += f.pitch) { if (full || n % 2 === 0) K.cafe(x, cz, y, 'x'); n++; }
        }
        for (let x = x0 + 2.6; x <= x1 - 2.0; x += f.pitch * 2) { K.umbrella(x, (z0 + z1) / 2, y, f.umbrellas); poles.push({ x, z: (z0 + z1) / 2, r: f.umbrellas / 2, top: 3.1, umbrella: true }); }
      }
    } else if (f.kind === 'benches') {
      for (let a = f.from; a <= f.to; a += f.pitch) {
        if (f.skip?.some(([s0, s1]) => a > s0 && a < s1)) continue;
        const [x, z] = f.along === 'x' ? [a, f.line] : [f.line, a];
        if (poles.some((p) => Math.hypot(p.x - x, p.z - z) < 1.9) || onRoute(x, z, 0.35) || ctx.blocked(x, z, 0.5)) continue;
        K.bench(x, z, LAWN_TOP, 2.2, f.along === 'x' ? 0 : Math.PI / 2, 'frame');
        poles.push({ x, z, r: 1.1, top: 0.5, bench: true });
      }
    } else if (f.kind === 'bike') {
      const [x, z] = f.at;
      X.bikeHoops(x, z, ctx.groundAt(x, z), f.count, f.along === 'x' ? 0 : Math.PI / 2);
      poles.push({ x, z, r: f.count * 0.45, top: 0.9, bike: true });
    }
  }
  return { parts: out, poles };
}
