// Shared constants for the hero massing study: sequence windows, palette,
// CDN locations and device quality tiers. No three.js import — safe to load early.

// Sequence space S ∈ [0, 1]. "A development begins as data and lines,
// becomes mass and space, and ultimately becomes a place."
export const PHASES = {
  grid:        [0.00, 0.15], // site grid + construction guides
  site:        [0.15, 0.30], // parcels, setbacks, footprints
  extrude:     [0.30, 0.50], // masses rise
  materialize: [0.50, 0.65], // wireframe → architectural surfaces
  context:     [0.65, 0.80], // landscape, neighbours, cars, markings
  compose:     [0.80, 0.92], // camera settles into the hero composition
  handoff:     [0.92, 1.00], // hero scrolls away into Selected Work
};

// Construction drawing (survey grid, site-plan linework, wireframe ribs and floor lines)
// clears away once the development is fully built, leaving only the finished model.
export const BUILT = [0.70, 0.80];

export const INTRO_END = PHASES.site[1];    // autoplayed on load: the drawing is the loading state
export const TRACK_END = PHASES.compose[1]; // end of the sticky scroll track
export const INTRO_SECONDS = 3.6;

export const CDN = {
  gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js',
  scrollTrigger: 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js',
};

// Site tokens come from the page's CSS custom properties; model materials are
// derived from them so the scene stays inside the site's palette.
export function readPalette(root = document.documentElement) {
  const css = getComputedStyle(root);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: token('--ink', '#1f1d18'),
    paper: token('--paper', '#e7e1d4'),
    orange: token('--orange', '#f47321'),
    green: token('--green', '#5d7048'),
    // Featured development: clean whites with neutral greys — no warm metals or sandy stone.
    concrete: '#eeeeeb', // white architectural concrete
    stucco: '#f3f3f0',   // white stucco
    podium: '#e7e8e6',   // podium walls, a half-step greyer than the towers
    stone: '#e2e3e0',    // pale neutral stone: basins, copings, plinths
    terrazzo: '#e4e4e0', // pale terrazzo at the hotel entrance and forecourt
    glass: '#e6e7e5',    // frames and spandrels around glazing
    frame: '#f6f6f3',    // white frames, fins, canopies, pergolas
    slab: '#f7f7f4',     // balcony slabs and eyebrows
    screen: '#dcdedd',   // white louvre screens
    metal: '#a9adaf',    // silver posts, rails and poles
    charcoal: '#4c4f52', // restrained dark metal
    void: '#34383b',     // garage, loading and service openings
    canvas: '#f8f8f6',   // umbrellas, cabana curtains
    cushion: '#fbfbf9',  // loungers and outdoor furniture
    context: '#e9e4d9',  // neighbouring masses: pale "white context"
    paving: '#e6e7e4',   // terraces
    deck: '#d4d7d5',     // pool deck paving (light neutral grey)
    walk: '#f1f1ee',     // clear walking routes across the deck
    sidewalk: '#e0e1dd', // scored concrete sidewalks
    pathStone: '#d3d4cf',// paved walks between the buildings
    joint: '#b9bbb7',    // control joints in sidewalks and walks
    // pedestrian hierarchy (plan/pedestrian.js): restrained neutral paving tones
    promenade: '#d8d6d0', // central promenade field
    spine: '#dfddd7',    // north–south spine
    walk2: '#ebeae5',    // secondary paths, arcade and café terraces
    band: '#aeafab',     // edge bands and driveway crossing edges
    entry: '#c8c8c3',    // textured entrance zones
    guardGlass: '#c7d5db', // glass guard panels (light blue-grey)
    tactile: '#777b7d',   // detectable warning strips at curb ramps
    poolTile: '#3f8e9c',  // waterline tile band
    perforated: '#8e9396', // office garage perforated metal
    breeze: '#ecebe6',    // office garage breeze block
    greenWall: '#4d8f3a', // planted garage bays
    coping: '#f7f7f4',   // pool coping
    drive: '#bfc2c2',    // arrival drive and driveway aprons
    asphalt: '#9a9e9f',  // street surface around the block
    lawn: '#74b340',     // ground-level lawns (mature, slightly deeper green)
    planter: '#4f9a33',  // planters and planting beds
    pool: '#5ab6c2',     // pools and water features
    shelf: '#8fd2d8',    // shallow sun shelf and entry steps
    shelfDeep: '#74c6ce',
    spray: '#e6f4f6',    // fountain jets
    lamp: '#fff1d2',     // low garden lights
    // Office only: warm timber accents and planted terraces
    wood: '#8a5a38',     // louvres, pergolas, work tables
    woodLight: '#b3845a',// soffits beneath projecting volumes
    shrub: '#5aa144',
    shrubDark: '#3f8534',
    vine: '#3f8a3c',
    vineLight: '#62a94a',
    treeLush: ['#3f8f2c', '#56a83a', '#6dba45', '#2f7a26', '#80c451'],
    treeStreet: ['#6f9f4f', '#80ad5c', '#5f9346'],
    treeRound: ['#4e8f3c', '#679f47', '#3d7d33'],
    treeFlower: ['#cf6a3c', '#d98446', '#c25a36'],   // flowering canopy accents (poinciana-like)
    shrubFlower: '#c35a8f',  // bougainvillea-like accent shrubs
    shrubLight: '#9cc262',   // lighter contrasting foliage
    bed: '#5e6a3e',          // planting bed mulch / soil
    palm: '#5aa33a',
    trunk: '#a8977d',   // palm trunks
    bark: '#6f5f4d',    // shade and street tree trunks
    car: '#77716a',
    // car paint, mostly neutrals with a muted blue and red
    carPaint: ['#f2f2f0', '#d3d5d6', '#a9adb0', '#6e7276', '#3b3e42', '#1f2124', '#3d5568', '#7c3029', '#e9e7e1'],
  };
}

// Quality tiers. Mobile is a reduced experience, not a shrunken one.
export function detectTier({ force = false } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const narrow = matchMedia('(max-width: 820px)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const base = { force, reducedHud: false };
  if (coarse || narrow) {
    // phones: lower pixel density (1.25, or 1.0 on low-memory / low-core devices), no
    // shadows, lighter planting and furniture, coarser curves, settled wireframes dropped
    const low = (navigator.deviceMemory && navigator.deviceMemory <= 3) || cores <= 4;
    return {
      ...base, name: 'mobile', maxDpr: low ? 1.0 : 1.25, antialias: !low, shadows: false, dropSettledWire: true,
      cityRings: 1, neighbors: 'adjacent', treeDensity: 0.5, cars: 6,
      crosswalks: false, parallax: false, cameraTravel: 0.55, reducedHud: true,
    };
  }
  return {
    ...base, name: 'desktop', maxDpr: cores >= 8 ? 1.75 : 1.5, antialias: true,
    shadows: true, shadowMapSize: 2048, cityRings: 2, neighbors: 'all',
    treeDensity: 1, cars: 16, crosswalks: true, parallax: true, cameraTravel: 1,
  };
}
