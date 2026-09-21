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
// the nodes it joins, the destinations it serves, lighting spacing, furnishing zones and
// the landscape setback. Geometry is generated from these centrelines (ribbons with mitred
// offsets), merged by surface into a few meshes.
//
// The whole network is ONE surface at ONE level (WALK_TOP), flush with the public sidewalk.
// Routes are laid in order of how much traffic they carry, and each one is cut where it runs
// into a surface already laid, finishing on that surface's own edge. So no two paved
// polygons overlap and nothing steps over anything else — a walk meeting the promenade ends
// on the promenade's edge, and one meeting the fountain plaza ends on its arc.
// Where a walk joins a busier route it opens out over its last few metres (`flare`), because
// a mouth no wider than the walk itself is where people turning in and out form a queue.
//
// Conceptual only: the model is flat, so every route is step-free in it; grades, cross-falls,
// landings, detectable surfaces and capacity are not designed or verified.
import { GLAZE, HX, HZ, D2R, offsetPlan, arcSamples, insidePlan, roundedRectPlan, circlePlan, rect, partsKit } from './core.js';
import { fixtureKit, FIXTURE } from './fixtures.js';
import { PODIUM_PLAN } from './residential.js';

// ---------------------------------------------------------------------------
// Surfaces (top elevation above the 0 m site datum; block paving is 0.03, lawns 0.07)
// ---------------------------------------------------------------------------
// Every walking surface sits at ONE level, flush with the sidewalk: the network is a single
// continuous plane, so no route steps up over another and no edge shows a lip. Surfaces of
// different materials are never allowed to overlap (see `trimmed` below) — each route is cut
// where it meets a higher-ranked surface and finishes on that surface's own edge.
export const WALK_TOP = 0.15;
export const SURFACE = {
  secondary: { kind: 'walk2', glaze: GLAZE.bond, module: [0.9, 0.45], top: WALK_TOP, label: 'light running-bond pavers' },
  spine: { kind: 'spine', glaze: GLAZE.bond, module: [1.2, 0.4], top: WALK_TOP, label: 'long-format linear pavers' },
  promenade: { kind: 'promenade', glaze: GLAZE.promenade, module: [1.2, 0.6], top: WALK_TOP, label: 'large-format bond with transverse bands' },
  band: { kind: 'band', glaze: GLAZE.pavers, module: [0.45, 0.45], top: null, label: 'darker edge band' },
  plaza: { kind: 'terrazzo', glaze: GLAZE.rings, module: [1.6, 1.8], top: WALK_TOP, label: 'concentric rings with radial joints' },
  entry: { kind: 'entry', glaze: GLAZE.pavers, module: [0.35, 0.35], top: WALK_TOP, label: 'small textured setts' },
};
export const LAWN_TOP = 0.07;

// ---------------------------------------------------------------------------
// Key positions
// ---------------------------------------------------------------------------
// The fountain plaza sits on the promenade, directly in front of the condo portal: the
// promenade runs through it east–west and the spine through it north–south, so the plaza
// IS the central crossing rather than a place reached from it.
export const FOUNTAIN_CENTRE = [-8, 1];
// The paved circle was pulled in from 14.2 m so the green, not the hardscape, holds the
// middle of the park; the ring still passes the promenade's own clear width either side of
// the basin (checked in the audit).
export const PLAZA_R = 12.6;          // fountain plaza (loop) outer radius
export const LOOP_CLEAR = [6.7, 11.2]; // clear walking ring between the basin coping and the bench ring
export const SPINE_X = -8;            // the north–south spine holds this line dead straight
// The public passage through the podium. It enters on the east face on the promenade's axis,
// in the middle of the tower base under the gap in the parking screen, then turns inside the
// podium to clear the parking ramp and runs out to the west sidewalk on its original line.
export const PROMENADE_Z = 1.0;   // the promenade holds this line dead straight
export const GALLERIA = { z: 15.15, zEast: PROMENADE_Z, turnX: -35.25, width: 4.5, x0: -76, x1: -26 };
const F = FOUNTAIN_CENTRE;
const onPlaza = (deg) => [F[0] + PLAZA_R * Math.cos(deg * D2R), F[1] + PLAZA_R * Math.sin(deg * D2R)];
// a route meeting the plaza runs 1.8 m onto it, so its end is cut on the plaza's own edge
const intoPlaza = (deg, d = 1.8) => [F[0] + (PLAZA_R - d) * Math.cos(deg * D2R), F[1] + (PLAZA_R - d) * Math.sin(deg * D2R)];

// ---------------------------------------------------------------------------
// Nodes: sidewalk connections, doors, junctions and destinations
// ---------------------------------------------------------------------------
export const NODES = {
  // public sidewalks (property line)
  swGalleria: { at: [-HX, GALLERIA.z], kind: 'sidewalk', name: 'West sidewalk at the galleria' },
  swT1: { at: [-HX, -28], kind: 'sidewalk', name: 'West sidewalk at the Tower 1 lobby' },
  sePromenade: { at: [HX, PROMENADE_Z], kind: 'sidewalk', name: 'East sidewalk at the promenade' },
  ssGate: { at: [SPINE_X, HZ], kind: 'sidewalk', name: 'South sidewalk at the park gate' },
  ssT2: { at: [-50, HZ], kind: 'sidewalk', name: 'South sidewalk at the Tower 2 lobby' },
  ssOfficeWalk: { at: [20.2, HZ], kind: 'sidewalk', name: 'South sidewalk at the office walk' },
  ssOffice: { at: [29.25, HZ], kind: 'sidewalk', name: 'South sidewalk at the office lobby' },
  snPaseo: { at: [SPINE_X, -HZ], kind: 'sidewalk', name: 'North sidewalk at the paseo' },
  // doors
  t1Lobby: { at: [-72.5, -28], kind: 'door', name: 'Tower 1 lobby (west entrance)', building: 'residential' },
  t2Lobby: { at: [-50, 45.6], kind: 'door', name: 'Tower 2 lobby (south entrance)', building: 'residential' },
  t2LobbyGalleria: { at: [-51.75, 17.4], kind: 'door', name: 'Tower 2 lobby (galleria entrance)', building: 'residential' },
  amenityLift: { at: [-29.5, 6.8], kind: 'door', name: 'Podium stair + lift to the amenity deck (residents)', building: 'residential' },
  nwStair: { at: [-72.5, -18.5], kind: 'door', name: 'Podium stair (north-west)', building: 'residential' },
  hotelMain: { at: [14, -5.25], kind: 'door', name: 'Hotel main entrance (tower lobby)', building: 'hotel' },
  hotelRestaurant: { at: [31, -7.65], kind: 'door', name: 'Hotel restaurant', building: 'hotel' },
  hotelCafe: { at: [45, -7.65], kind: 'door', name: 'Hotel lobby bar + café', building: 'hotel' },
  hotelArrival: { at: [66, -28], kind: 'door', name: 'Hotel guest arrival (bell desk)', building: 'hotel' },
  officeLobbyS: { at: [29.25, 47.5], kind: 'door', name: 'Office lobby (south entrance)', building: 'office' },
  officeLobbyW: { at: [24.5, 43], kind: 'door', name: 'Office lobby (park entrance)', building: 'office' },
  // junctions and destinations
  galleriaW: { at: [-76, GALLERIA.z], kind: 'junction', name: 'Galleria west portal' },
  galleriaE: { at: [-26, GALLERIA.zEast], kind: 'junction', name: 'Galleria east portal (on the promenade axis)' },
  plazaN: { at: onPlaza(-90), kind: 'junction', name: 'Fountain plaza — north (spine to the paseo)' },
  plazaS: { at: onPlaza(90), kind: 'junction', name: 'Fountain plaza — south (spine to the park gate)' },
  plazaW: { at: onPlaza(180), kind: 'junction', name: 'Fountain plaza — west (promenade to the condo portal)' },
  plazaE: { at: onPlaza(0), kind: 'junction', name: 'Fountain plaza — east (promenade to the hotel and office)' },
  fountain: { at: F, kind: 'destination', name: 'Central park, fountain and plaza (promenade × spine)' },
  promMarket: { at: [8, PROMENADE_Z], kind: 'junction', name: 'Promenade at the hotel entrance' },
  promOfficeWalk: { at: [20.2, PROMENADE_Z], kind: 'junction', name: 'Promenade at the office walk' },
  marketW: { at: [-0.4, 42], kind: 'door', name: 'Market hall (spine entrance)', building: 'market' },
  marketE: { at: [16.0, 41], kind: 'door', name: 'Market hall (office walk entrance)', building: 'market' },
  spineMarket: { at: [SPINE_X, 42], kind: 'junction', name: 'Spine at the market hall walk' },
  owMarket: { at: [20.2, 41], kind: 'junction', name: 'Office walk at the market hall' },
  retailEast: { at: [-27.75, 28], kind: 'destination', name: 'Podium retail frontage (east arcade)' },
  retailGalleria: { at: [-40, GALLERIA.z], kind: 'destination', name: 'Galleria shopfronts' },
  cafePodium: { at: [-23.9, 34], kind: 'destination', name: 'Podium café seating' },
  cafeHotel: { at: [45, -3.6], kind: 'destination', name: 'Hotel café terrace' },
  cafeRestaurant: { at: [12, -3.6], kind: 'destination', name: 'Hotel restaurant terrace' },
  cafeOffice: { at: [17.8, 32.5], kind: 'destination', name: 'Office coffee-bar seating' },
  pavilion: { at: [14.5, 8.3], kind: 'destination', name: 'Promenade pavilion (shade and kiosk)' },
  paseoCrossN: { at: [SPINE_X, -44], kind: 'junction', name: 'Paseo cross walk (north)' },
  paseoCrossM: { at: [SPINE_X, -15.5], kind: 'junction', name: 'Paseo cross walk (middle)' },
  arcadeN: { at: [-27.75, -44], kind: 'junction', name: 'East arcade (north end)' },
  arcadeM: { at: [-27.75, -15.5], kind: 'junction', name: 'East arcade at the middle cross walk' },
  arcadeSW: { at: [-74.25, -31.5], kind: 'junction', name: 'West arcade at the Tower 1 forecourt' },
  gardenWalkN: { at: [71.05, -20], kind: 'junction', name: 'Hotel arrival court' },
  promHotelE: { at: [58.6, PROMENADE_Z], kind: 'junction', name: 'Promenade at the hotel café frontage' },
  promGarden: { at: [71.05, PROMENADE_Z], kind: 'junction', name: 'Promenade at the hotel garden walk' },
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const arcadeCentre = () => {
  // covered arcade: 3.5 m between the podium edge and the storefront line, from the east
  // face at the north cross walk, round the south face, to the Tower 1 forecourt on the west
  const s = arcSamples(offsetPlan(PODIUM_PLAN, -1.75), 1.0);
  let startI = s.reduce((best, q, i) => (q.nx > 0.9 && Math.abs(q.z + 44) < Math.abs(s[best].z + 44) && q.nx > 0.9 ? i : best), s.findIndex((q) => q.nx > 0.9));
  // run the arcade a few metres further round the corner so the north cross walk lands on it
  // instead of ending a metre short, in the open
  startI = (startI - 4 + s.length) % s.length;
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
    id: 'P1', name: 'Central Promenade', type: 'primary', surface: 'promenade', rank: 1, edgeBand: 0.45, smooth: true,
    pts: [[-HX, GALLERIA.z], [-48, GALLERIA.z], [-38.6, GALLERIA.z], [GALLERIA.turnX, 12.2], [GALLERIA.turnX, 5.0], [-31.5, PROMENADE_Z], [-26, PROMENADE_Z], [-14, PROMENADE_Z], [0, PROMENADE_Z], [20, PROMENADE_Z], [50, PROMENADE_Z], [HX, PROMENADE_Z]],
    width: (x) => (x <= -22 ? GALLERIA.width : x >= -6 ? 6.0 : lerp(GALLERIA.width, 6.0, (x + 22) / 16)),
    nodes: ['swGalleria', 'galleriaW', 'retailGalleria', 't2LobbyGalleria', 'galleriaE', 'plazaW', 'fountain', 'plazaE', 'promMarket', 'hotelRestaurant', 'promOfficeWalk', 'promHotelE', 'promGarden', 'sePromenade'],
    destinations: ['Galleria shopfronts', 'Tower 2 lobby (galleria entrance)', 'Podium retail (east arcade)', 'Central park and fountain plaza', 'Market hall', 'Hotel restaurant, main entrance and café', 'Office walk', 'Hotel garden walk'],
    covered: [[-76, -26]], lights: { spacing: 16, sides: 'both', offset: 0.7, kind: 'ped', skip: [[-80, -20]] }, setback: 0.7,
  },
  {
    // one straight spine, from the south sidewalk through the plaza to the north sidewalk,
    // crossing the promenade at the fountain
    id: 'S1', name: 'Spine — park gate to the fountain plaza', type: 'primary', surface: 'spine', rank: 2, edgeBand: 0.35, flare: [0, 6],
    pts: [[SPINE_X, HZ], intoPlaza(90)], width: 4.5, nodes: ['ssGate', 'spineMarket', 'marketW', 'plazaS', 'fountain'],
    destinations: ['South sidewalk', 'Market hall (spine entrance)', 'Central park and fountain'], lights: { spacing: 9, sides: 'both', offset: 0.6, kind: 'ped' }, setback: 0.8,
  },
  {
    id: 'S2', name: 'Spine — fountain plaza, paseo, north sidewalk', type: 'primary', surface: 'spine', rank: 2, edgeBand: 0.35, flare: [6, 0],
    pts: [intoPlaza(-90), [SPINE_X, -HZ]], width: 4.5,
    nodes: ['fountain', 'plazaN', 'paseoCrossM', 'paseoCrossN', 'snPaseo'],
    destinations: ['Central park and fountain', 'Central Promenade', 'Paseo (podium retail and hotel garden)', 'North sidewalk'],
    lights: { spacing: 14, sides: 'both', offset: 0.6, kind: 'ped' }, setback: 0.8,
  },
  {
    // the hall sits on the park's south-east corner, so it is reached from the spine on one
    // side and the office walk on the other — neither walk crosses the flexible lawn
    id: 'MW', name: 'Spine → market hall (west door)', type: 'secondary', surface: 'secondary', rank: 4, pts: [[-9.4, 42], [-1.6, 42]], width: 3.0, flare: [4, 0],
    nodes: ['spineMarket', 'marketW'], destinations: ['Market hall (spine entrance)'], lights: { spacing: 6, sides: 'left', offset: 0.5, kind: 'bollard' }, setback: 0.6,
  },
  {
    id: 'ME', name: 'Office walk → market hall (east door)', type: 'secondary', surface: 'secondary', rank: 4, pts: [[19.6, 41], [17.0, 41]], width: 3.0, flare: [4, 0],
    nodes: ['owMarket', 'marketE'], destinations: ['Market hall (office walk entrance)'], lights: { spacing: 6, sides: 'right', offset: 0.5, kind: 'bollard' }, setback: 0.6,
  },
  {
    id: 'OW', name: 'Office walk', type: 'secondary', surface: 'secondary', rank: 4, pts: [[20.2, 0.4], [20.2, HZ]], width: 2.8, flare: [5, 3],
    nodes: ['promOfficeWalk', 'owMarket', 'officeLobbyW', 'ssOfficeWalk'], destinations: ['Office lobby (park entrance)', 'Office coffee-bar seating', 'South sidewalk'], lights: { spacing: 12, sides: 'left', offset: 0.5, kind: 'ped' }, setback: 0.5,
  },
  {
    // one frontage walk now that the entrance is at the west corner: out of the marquee
    // forecourt and east along the wing, past the restaurant and café terraces
    id: 'HF', name: 'Hotel plaza frontage', type: 'secondary', surface: 'secondary', rank: 4,
    pts: [[20.6, -2.8], [25.6, -4.9], [29.2, -6.1], [36, -6.1], [52, -6.1], [55.4, -5.0], [58.6, PROMENADE_Z]], width: 2.2, flare: [0, 4],
    nodes: ['hotelMain', 'hotelRestaurant', 'hotelCafe', 'promHotelE'], destinations: ['Hotel restaurant', 'Hotel lobby bar + café', 'Plaza terraces'], lights: null, setback: 0,
  },
  {
    id: 'GW', name: 'Hotel garden walk', type: 'secondary', surface: 'secondary', rank: 4, pts: [[71.05, -21.2], [71.05, 3.6]], width: 3.0, flare: [0, 5],
    nodes: ['hotelArrival', 'gardenWalkN', 'promGarden'], destinations: ['Hotel guest arrival and porte-cochère'], lights: { spacing: 4.6, sides: 'left', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
  {
    id: 'ARC', name: 'Podium arcade (covered)', type: 'secondary', surface: 'secondary', rank: 3, pts: null, build: arcadeCentre, width: 3.5, covered: 'all',
    nodes: ['arcadeN', 'arcadeM', 'amenityLift', 'galleriaE', 'retailEast', 't2Lobby', 'galleriaW', 'nwStair', 'arcadeSW'],
    destinations: ['Podium retail storefronts', 'Tower 2 lobby', 'Tower 1 lobby', 'Amenity lift', 'Galleria portals'],
    clearNote: 'clear zone between storefront and arcade columns ≈ 2.1 m', lights: null, setback: 0,
  },
  {
    id: 'X0', name: 'Paseo cross walk (north, round the podium corner to the arcade)', type: 'secondary', surface: 'secondary', rank: 4, smooth: true, pts: [[-32.6, -47.2], [-30.4, -44.6], [-25.0, -44], [-6.9, -44]], width: 3.0, flare: [0, 4],
    nodes: ['arcadeN', 'paseoCrossN'], destinations: ['Podium retail (north-east)', 'Paseo'], lights: { spacing: 8, sides: 'left', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
  {
    id: 'X1', name: 'Paseo cross walk (middle)', type: 'secondary', surface: 'secondary', rank: 4, pts: [[-28.4, -15.5], [-6.9, -15.5]], width: 3.0, flare: [0, 4],
    nodes: ['arcadeM', 'paseoCrossM'], destinations: ['Amenity lift', 'Paseo'], lights: { spacing: 8, sides: 'right', offset: 0.45, kind: 'bollard' }, setback: 0.5,
  },
];

// textured entrance zones (polygons) at every principal door
export const ENTRANCES = [
  { id: 'E-T1', name: 'Tower 1 lobby forecourt', node: 't1Lobby', poly: rect(-HX, -32.8, -72.7, -24.4), joins: ['swT1', 'arcadeSW'] },
  { id: 'E-T2', name: 'Tower 2 lobby forecourt', node: 't2Lobby', poly: rect(-54.2, 49.1, -45.8, HZ), joins: ['ssT2', 't2Lobby'] },
  { id: 'E-HOTEL', name: 'Hotel entrance forecourt (under the marquee)', node: 'hotelMain', poly: roundedRectPlan(11.0, -5.2, 22.0, -2.1, 0.5), joins: ['promMarket'] },   // at the tower's base, between it and the promenade
  { id: 'E-OFFS', name: 'Office lobby forecourt', node: 'officeLobbyS', poly: rect(24.5, 47.6, 33.5, HZ), joins: ['ssOffice'] },
  { id: 'E-OFFW', name: 'Office park entrance', node: 'officeLobbyW', poly: rect(21.6, 39.4, 24.45, 47.6), joins: ['officeLobbyW', 'officeLobbyS'] },   // meets the office walk and the south forecourt edge to edge
  { id: 'E-ARRIVAL', name: 'Hotel arrival court', node: 'hotelArrival', poly: rect(67.5, -36, 72.6, -19.9), joins: ['gardenWalkN'] },
  { id: 'E-GALW', name: 'Galleria west portal', node: 'galleriaW', poly: rect(-76.4, 12.7, -72.6, 17.6), joins: ['swGalleria'] },
  { id: 'E-GALE', name: 'Galleria east portal', node: 'galleriaE', poly: rect(-29.4, -1.45, -25.6, 3.45), joins: ['galleriaE'] },
  { id: 'E-MARKET', name: 'Market hall forecourt (spine side)', node: 'marketW', poly: roundedRectPlan(-3.2, 38.8, -0.6, 45.2, 0.5), joins: ['spineMarket'] },
];

// furnishing zones: café seating, benches, bicycle stands — beside, never on, the clear zones
export const FURNISHING = [
  { id: 'F-REST', kind: 'cafe', name: 'Restaurant terrace', rect: [29.2, 37.4, -5.2, -2.4], rows: [-4.5, -3.1], pitch: 3.0, umbrellas: 2.6 },
  { id: 'F-CAFE', kind: 'cafe', name: 'Hotel café terrace', rect: [38.4, 51.6, -5.2, -2.4], rows: [-4.5, -3.1], pitch: 3.0, umbrellas: 2.6 },
  { id: 'F-PODIUM', kind: 'cafe', name: 'Podium café', rect: [-25.6, -22.0, 18.6, 26.2], cols: [-24.6, -22.9], pitch: 2.6, axis: 'z', umbrellas: 2.6 },
  { id: 'F-PODIUM2', kind: 'cafe', name: 'Podium café (south)', rect: [-25.6, -22.0, 29.8, 38.0], cols: [-24.6, -22.9], pitch: 2.6, axis: 'z', umbrellas: 2.6 },
  { id: 'F-OFFICE', kind: 'cafe', name: 'Office coffee bar', rect: [16.6, 18.9, 21.0, 30.4], cols: [17.8], pitch: 2.7, axis: 'z', umbrellas: 2.4 },
  { id: 'F-MARKET', kind: 'cafe', name: 'Market hall terrace (under the veranda)', rect: [1.0, 14.6, 30.6, 33.6], rows: [31.4, 32.8], pitch: 3.0, umbrellas: 0 },
  { id: 'F-PROM-S', kind: 'benches', name: 'Promenade benches (office planting strip)', along: 'x', line: 9.35, from: 24, to: 72, pitch: 10, facing: -1 },
  { id: 'F-PARK-W', kind: 'benches', name: 'Garden room benches (west lawn, facing the spine)', along: 'z', line: -11.6, from: 18, to: 48, pitch: 7.5, facing: 1 },
  { id: 'F-PARK-E', kind: 'benches', name: 'Flexible lawn benches (east edge of the spine)', along: 'z', line: -4.2, from: 19, to: 45, pitch: 8.5, facing: -1 },
  { id: 'F-PARK-S', kind: 'benches', name: 'Flexible lawn benches (market terrace edge)', along: 'x', line: 29.4, from: 1, to: 15, pitch: 6.5, facing: -1 },
  { id: 'F-BIKE-OFF', kind: 'bike', name: 'Bicycle stands (office walk)', at: [25.0, 10.6], count: 4, along: 'x' },
  { id: 'F-BIKE-GAL', kind: 'bike', name: 'Bicycle stands (galleria east)', at: [-23.5, -5.2], count: 4, along: 'x' },
  { id: 'F-BIKE-MKT', kind: 'bike', name: 'Bicycle stands (market hall, spine side)', at: [-4.0, 36.2], count: 4, along: 'x' },
  { id: 'F-BIKE-HOTEL', kind: 'bike', name: 'Bicycle stands (hotel entrance)', at: [53.8, -3.4], count: 3, along: 'x' },
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
  const s = [0];
  for (let i = 1; i < route._centre.length; i++) s.push(s[i - 1] + Math.hypot(route._centre[i][0] - route._centre[i - 1][0], route._centre[i][1] - route._centre[i - 1][1]));
  route._s = s;
  route._len = s[s.length - 1];
  return route._centre;
}

// A walk that meets a busier route opens out over its last few metres. People turning into
// or out of a junction slow down and fan across it, and a mouth the same width as the walk
// is where a queue forms — so `flare: [start, end]` gives those metres extra width.
const FLARE = 0.34;                   // fraction of extra width at the mouth itself
const widthAt = (route, p, i) => {
  const base = typeof route.width === 'function' ? route.width(p[0], p[1]) : route.width;
  if (!route.flare || i == null || !route._s) return base;
  const [fs, fe] = Array.isArray(route.flare) ? route.flare : [route.flare, route.flare];
  const open = (d, len) => (len > 0 && d < len ? (1 - d / len) ** 2 : 0);
  return base * (1 + FLARE * Math.max(open(route._s[i], fs), open(route._len - route._s[i], fe)));
};

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

// ---------------------------------------------------------------------------
// Butt joints: a route is cut where it runs into a surface that outranks it, and its end
// follows that surface's own boundary — so the two meet on a shared line with no overlap
// to shimmer and no sliver of lawn showing through. Ranks: junctions and door thresholds
// first, then the promenade, the spine, the arcade and the secondary walks.
// ---------------------------------------------------------------------------
const bboxOf = (pts) => {
  const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};
const inArea = (x, z, a) => x >= a.bb[0] && x <= a.bb[1] && z >= a.bb[2] && z <= a.bb[3] && insidePlan(x, z, a.pts);
const claimed = (x, z, areas) => areas.some((a) => inArea(x, z, a));

// where segment p→q first crosses a polygon's boundary: { t, edge, pt }
function crossEdge(p, q, poly) {
  let best = null;
  const dx = q[0] - p[0], dz = q[1] - p[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - p[0]) * ez - (a[1] - p[1]) * ex) / den;
    const u = ((a[0] - p[0]) * dz - (a[1] - p[1]) * dx) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
    if (!best || t < best.t) best = { t, edge: i, pt: [p[0] + dx * t, p[1] + dz * t] };
  }
  return best;
}

// first crossing of a polyline (walked from index `from` toward `dir`) into a polygon
function firstCrossing(line, from, dir, poly) {
  for (let i = from; i >= 0 && i < line.length - 1; i += dir) {
    const hit = crossEdge(line[dir > 0 ? i : i], line[dir > 0 ? i + 1 : i + 1], poly);
    if (hit) return { i: dir > 0 ? i : i + 1, ...hit };
  }
  return null;
}

// the boundary of `poly` from point p0 (on edge e0) to p1 (on edge e1), the short way round
function boundaryPath(poly, e0, p0, e1, p1) {
  const n = poly.length;
  const walk = (dir) => {
    const out = [];
    let len = 0, prev = p0;
    let i = e0;
    for (let k = 0; k <= n; k++) {
      if (i === e1 && !(k === 0 && dir < 0 && e0 === e1)) { len += Math.hypot(p1[0] - prev[0], p1[1] - prev[1]); return { out, len }; }
      const v = poly[dir > 0 ? (i + 1) % n : i];
      out.push(v);
      len += Math.hypot(v[0] - prev[0], v[1] - prev[1]);
      prev = v;
      i = dir > 0 ? (i + 1) % n : (i - 1 + n) % n;
    }
    return { out, len: Infinity };
  };
  const a = walk(1), b = walk(-1);
  return (a.len <= b.len ? a : b).out;
}

// Where a polyline first crosses a polygon's boundary, walking from `from` toward `to`.
// Returns the index of the last segment before the crossing, and the crossing point.
function sideHit(line, from, to, poly) {
  const dir = to > from ? 1 : -1;
  for (let i = from; dir > 0 ? i < to : i > to; i += dir) {
    const hit = crossEdge(line[i], line[i + dir], poly);
    if (hit) return { i, pt: hit.pt, edge: hit.edge };
  }
  return null;
}

// Trim one ribbon against the surfaces that outrank it. The centreline is sampled; the
// stretches running inside a claimed surface are dropped, and each cut end is closed along
// that surface's own boundary. Both edges are cut where they cross it — a ribbon meeting a
// junction at an angle reaches it with one corner first, and cutting on the centreline
// alone would leave that corner lying over the other surface.
function trimmed(centre, loFn, hiFn, areas) {
  const left = offsetLine(centre, loFn), right = offsetLine(centre, hiFn);
  const inside = centre.map(([x, z]) => areas.find((a) => inArea(x, z, a)) ?? null);
  const runs = [];
  let start = null;
  for (let i = 0; i < centre.length; i++) {
    if (!inside[i] && start === null) start = i;
    if ((inside[i] || i === centre.length - 1) && start !== null) {
      const end = inside[i] ? i - 1 : i;
      if (end > start) runs.push({ a: start, b: end, before: start > 0 ? inside[start - 1] : null, after: inside[i] ? inside[i] : null });
      start = null;
    }
  }
  const out = [];
  for (const r of runs) {
    // widen the window by a sample or two so both edges reach into the claimed surface
    const a0 = r.before ? Math.max(0, r.a - 3) : r.a;
    const b0 = r.after ? Math.min(centre.length - 1, r.b + 3) : r.b;
    const L = right.slice(a0, b0 + 1), R = left.slice(a0, b0 + 1);
    // search outward from the middle of the free stretch, so each end finds its own edge.
    // A surface narrower than the ribbon can only catch one edge; the other simply stops at
    // the last free cross-section, which leaves a joint rather than an overlap.
    const mid = Math.min(L.length - 1, Math.max(0, Math.round((r.a + r.b) / 2) - a0));
    const startIdx = r.a - a0, endIdx = r.b - a0;
    let l0 = startIdx, l1 = endIdx, r0 = startIdx, r1 = endIdx;
    let capA = null, capB = null;
    if (r.after) {
      capB = { hL: sideHit(L, mid, L.length - 1, r.after.pts), hR: sideHit(R, mid, R.length - 1, r.after.pts) };
      if (capB.hL) l1 = capB.hL.i;
      if (capB.hR) r1 = capB.hR.i;
    }
    if (r.before) {
      capA = { hL: sideHit(L, mid, 0, r.before.pts), hR: sideHit(R, mid, 0, r.before.pts) };
      if (capA.hL) l0 = capA.hL.i + 1;
      if (capA.hR) r0 = capA.hR.i + 1;
    }
    if (l1 <= l0 || r1 <= r0) continue;
    const poly = [];
    if (capA?.hL) poly.push(capA.hL.pt);
    if (capA?.hL && capA.hR) poly.push(...boundaryPath(r.before.pts, capA.hL.edge, capA.hL.pt, capA.hR.edge, capA.hR.pt));
    if (capA?.hR) poly.push(capA.hR.pt);
    poly.push(...R.slice(r0, r1 + 1));
    if (capB?.hR) poly.push(capB.hR.pt);
    if (capB?.hR && capB.hL) poly.push(...boundaryPath(r.after.pts, capB.hR.edge, capB.hR.pt, capB.hL.edge, capB.hL.pt));
    if (capB?.hL) poly.push(capB.hL.pt);
    poly.push(...L.slice(l0, l1 + 1).reverse());
    if (poly.length > 3) out.push(poly);
  }
  return out;
}

// all pedestrian surface polygons, grouped by surface, plus per-route clear polygons
export function pedestrianGeometry({ bands = true } = {}) {
  const groups = {};
  const push = (surface, poly, owner) => (groups[surface] ||= []).push({ pts: poly, owner });
  const clear = [];
  // surfaces already laid, in the order they take precedence
  const areas = [];
  const claim = (pts, id) => areas.push({ pts, bb: bboxOf(pts), id });

  // 1. the fountain plaza (drawn by plan/park.js) and the lit door thresholds come first:
  //    a route arriving at either of them finishes on its edge
  claim(circlePlan(F[0], F[1], PLAZA_R, 72), 'PLAZA');
  for (const e of ENTRANCES) { push('entry', e.poly, e.id); claim(e.poly, e.id); }

  // 2. routes, widest and busiest first, each trimmed to what is already laid
  for (const r of [...ROUTES].sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))) {
    const c = routeCentreline(r);
    const hw = (p, i) => widthAt(r, p, i) / 2;
    const full = band(c, (p) => -hw(p), (p) => hw(p));
    clear.push({ id: r.id, name: r.name, type: r.type, poly: full, centre: c, width: r.width });
    const e = r.edgeBand && bands ? r.edgeBand : 0;
    if (e) {
      for (const poly of trimmed(c, (p) => -hw(p) + e, (p) => hw(p) - e, areas)) push(r.surface, poly, r.id);
      for (const poly of trimmed(c, (p) => hw(p) - e, (p) => hw(p), areas)) push(`${r.surface}Band`, poly, r.id);
      for (const poly of trimmed(c, (p) => -hw(p), (p) => -hw(p) + e, areas)) push(`${r.surface}Band`, poly, r.id);
    } else {
      for (const poly of trimmed(c, (p) => -hw(p), (p) => hw(p), areas)) push(r.surface, poly, r.id);
    }
    claim(full, r.id);
  }
  // 3. café terraces are paved like the secondary walks (furniture sits beside the clear zones)
  for (const f of FURNISHING) if (f.kind === 'cafe') push('secondary', rect(f.rect[0], f.rect[2], f.rect[1], f.rect[3]), f.id);
  return { groups, clear };
}

// Is (x, z) on a drawn walking surface? Used by the landscape: the walks sit 80 mm above the
// lawns, so grass can run under them and finish exactly on the path's edge instead of stopping
// short and leaving a sliver of bare paving between the two.
let pavedCache = null;
export function pavedAt(x, z) {
  if (Math.abs(x) > HX || Math.abs(z) > HZ) return true;          // the public sidewalk
  if (Math.hypot(x - F[0], z - F[1]) <= PLAZA_R) return true;      // the fountain plaza
  if (!pavedCache) {
    pavedCache = [];
    for (const list of Object.values(pedestrianGeometry().groups)) for (const q of list) pavedCache.push({ pts: q.pts, bb: bboxOf(q.pts) });
  }
  return pavedCache.some((q) => x >= q.bb[0] && x <= q.bb[1] && z >= q.bb[2] && z <= q.bb[3] && insidePlan(x, z, q.pts));
}

// Push a landscape outline out until it runs under the paving beside it. The walks sit
// 80 mm above the lawns and hide what passes beneath, so grass tucked under a path edge meets
// it exactly; grass that stops short leaves a sliver of bare paving, which is what reads as a
// ragged edge from above. A stretch facing open ground or a building finds no paving within
// `reach` and stays where it is, so grass never spills onto the plaza.
export function tuckToPaving(pts, { reach = 2.0, under = 0.4, step = 0.05, spacing = 0.6 } = {}) {
  const line = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let k = 0; k < n; k++) line.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  let area = 0;
  for (let i = 0; i < line.length; i++) { const a = line[i], b = line[(i + 1) % line.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sign = area > 0 ? 1 : -1;
  const nrm = line.map((p, i) => {
    const a = line[(i - 1 + line.length) % line.length], b = line[(i + 1) % line.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [(dz / l) * sign, (-dx / l) * sign];
  });
  const push = line.map(([x, z], i) => {
    let d = 0;
    while (d <= reach && !pavedAt(x + nrm[i][0] * d, z + nrm[i][1] * d)) d += step;
    return d > reach ? 0 : d + under;
  });
  const soft = push.map((_, i) => (push[(i - 1 + push.length) % push.length] + push[i] + push[(i + 1) % push.length]) / 3);
  return line.map(([x, z], i) => [x + nrm[i][0] * soft[i], z + nrm[i][1] * soft[i]]);
}

// The half-corridor a route needs where it meets the fountain plaza: its widest half-width
// within `reach` of the plaza edge (the mouth is flared), less TUCK_UNDER so the grass runs
// beneath the paving and the two meet on the path's own edge.
export const TUCK_UNDER = 0.35;
export function plazaCorridor(routeId, reach = 16) {
  const r = ROUTES.find((q) => q.id === routeId);
  if (!r) return 2.1;
  const c = routeCentreline(r);
  let w = Infinity;
  c.forEach((p, i) => { if (Math.hypot(p[0] - F[0], p[1] - F[1]) < PLAZA_R + reach) w = Math.min(w, widthAt(r, p, i) / 2); });
  return Math.max(0.5, (isFinite(w) ? w : 1.5) - TUCK_UNDER);
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
      return { x: ax + dx * t, z: az + dz * t, nx: -dz / l, nz: dx / l, i: i - 1 };
    };
    const spacing = full ? L.spacing : L.spacing * 2;
    const sides = L.sides === 'both' ? [1, -1] : L.sides === 'left' ? [1] : [-1];
    sides.forEach((side, k) => {
      for (let s = spacing * (0.5 + 0.5 * k); s < total - 1; s += spacing) {
        for (const shift of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
          const q = pointAt(Math.min(total - 0.5, Math.max(0.5, s + shift)));
          if (L.skip?.some(([x0, x1]) => q.x > x0 && q.x < x1)) break;
          const off = widthAt(r, [q.x, q.z], q.i) / 2 + L.offset;
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
    ...[45, 135, 225, 315].map((deg) => [F[0] + 13.2 * Math.cos(deg * D2R), F[1] + 13.2 * Math.sin(deg * D2R)]),   // between the palm pairs that flank each mouth
    [-80 + 0.6, 11.9], [-80 + 0.6, 18.4], [-21.4, -3.4], [-21.2, 2.6],
    [19.6, -2.6], [36.4, -2.6], [22.8, 48.8], [35.0, 48.8], [-55.2, 50.2], [-44.8, 50.2], [-78.8, -32.6], [-78.8, -23.4],
    [74.0, -19.0], [65.2, -19.6],
    [26.6, -2.4], [52.4, -2.4], [-24.8, -1.6], [-24.8, 6.6], [-24.6, -17.8], [44.5, -53.6],
    [-4.0, 38.2], [-4.0, 45.8], [17.6, 38.0], [17.6, 44.6],
    [-12.6, -15.2], [-3.4, -15.2], [-12.6, 17.2], [-3.4, 17.2],
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
