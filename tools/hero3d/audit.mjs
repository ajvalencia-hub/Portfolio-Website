// Hero model audit: geometric checks, program analysis, hero-camera visibility,
// supporting plan diagrams (SVG) and the validation register (Markdown).
//
//   node tools/hero3d/audit.mjs
//
// Everything here checks the conceptual model's own geometry. It does not
// establish structural adequacy, code, egress, accessibility or zoning compliance.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const hero = join(root, 'assets', 'hero3d');
const load = (p) => import(pathToFileURL(join(hero, p)).href);
const { buildSitePlan } = await load('site-plan.js');
const core = await load('plan/core.js');
const res = await load('plan/residential.js');
const office = await load('plan/office.js');
const hotel = await load('plan/hotel.js');
const park = await load('plan/park.js');
const ped = await load('plan/pedestrian.js');
const street = await load('plan/streetscape.js');
const { analyseSite, ASSUMPTIONS } = await load('plan/program.js');
const planting = await load('plan/planting.js');
const mus = await load('plan/museum.js');
const grounds = await load('plan/grounds.js');
const traffic = await load('plan/traffic.js');
const { coplanarFaces } = await import(pathToFileURL(join(here, 'coplanar.mjs')).href);
const rendering = {};
const { insidePlan, offsetPlan, polygonArea, inRect, rectOverlap, PODIUM_TOP, DECK_Y } = core;

const TIERS = [
  { name: 'desktop', cityRings: 2, neighbors: 'all', treeDensity: 1, cars: 16, crosswalks: true },
  { name: 'mobile', cityRings: 1, neighbors: 'adjacent', treeDensity: 0.5, cars: 6, crosswalks: false },
];

const checks = [];   // { area, name, pass, detail }
const check = (area, name, pass, detail = '') => checks.push({ area, name, pass: !!pass, detail });
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const rectOf = (b) => [b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2];
const partRect = (q) => {
  const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0);
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [q.x + (u * q.sx / 2) * c + (v * q.sz / 2) * s, q.z - (u * q.sx / 2) * s + (v * q.sz / 2) * c]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};
const corners = (r) => [[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]];
const partCorners = (q) => {
  const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [q.x + (u * q.sx / 2) * c + (v * q.sz / 2) * s, q.z - (u * q.sx / 2) * s + (v * q.sz / 2) * c]);
};

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const configSrc = readFileSync(join(hero, 'config.js'), 'utf8');
const hex = (key) => (configSrc.match(new RegExp(`\\b${key}: '(#[0-9a-f]{6})'`)) || [])[1];
const chroma = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return Math.max(r, g, b) - Math.min(r, g, b); };
const WHITE_KEYS = ['concrete', 'stucco', 'podium', 'stone', 'terrazzo', 'glass', 'frame', 'slab', 'screen', 'metal', 'charcoal', 'void', 'canvas', 'cushion', 'paving', 'deck', 'walk', 'coping', 'drive'];
for (const k of WHITE_KEYS) check('Palette', `${k} is a neutral white/grey`, hex(k) && chroma(hex(k)) < 0.035, hex(k));
check('Palette', 'no bronze/copper/gold/sandy materials defined', !/(bronze|copper|gold|sandy|beige)\w*\s*:/i.test(configSrc));

let desktopPlan = null, desktopAnalysis = null, mobilePlan = null;

for (const tier of TIERS) {
  const p = buildSitePlan(tier);
  const a = analyseSite(p);
  const T = `[${tier.name}]`;
  if (tier.name === 'desktop') { desktopPlan = p; desktopAnalysis = a; } else mobilePlan = p;
  const byName = Object.fromEntries(p.boxes.map((b) => [b.name, b]));
  const cv = Object.fromEntries(p.curved.map((c) => [c.name, c]));
  const cTop = p.meta.curveTop;
  const cBase = (n) => (cv[n].parent ? cTop[cv[n].parent] : cv[n].y0);
  const topOf = (n) => { const b = byName[n]; return (b.parent ? topOf(b.parent) : b.y0) + b.h; };

  // --- model integrity -------------------------------------------------------
  const badParents = p.boxes.filter((b, i) => b.parent && !(p.index[b.parent] < i)).length
    + p.curved.filter((c, i) => c.parent && !(p.curved.findIndex((x) => x.name === c.parent) < i)).length;
  check('Model', `${T} parents exist and precede children`, badParents === 0, `${badParents} bad`);
  const late = p.curved.filter((c) => c.phase !== 'context' && c.start + c.dur > 0.5 + 1e-6).map((c) => c.name);
  check('Model', `${T} all masses finish rising before the materialise phase`, late.length === 0, late.join(', '));
  const vc = p.curved.filter((c) => (c.slabs && c.slabs.floors.some((f) => f.outer.length !== f.inner.length)) || (c.type === 'ring' && c.inner.length !== c.pts.length)).map((c) => c.name);
  check('Model', `${T} slab and ring vertex counts match`, vc.length === 0, vc.join(', '));
  const woodOutside = p.parts.filter((q) => String(q.color).startsWith('wood') && !(q.x > 20 && q.x < 76 && q.z > 12 && q.z < 54)).length;
  check('Palette', `${T} timber accents only on the office`, woodOutside === 0, `${woodOutside} outside`);

  // --- towers ------------------------------------------------------------------
  for (const s of a.structure.towers) {
    const t = p.meta.towers.find((x) => x.id === s.id);
    check('Towers', `${T} ${s.id}: columns continuous and inside every floorplate; cores inside every floor and the upper penthouse; nothing in drive aisles`, s.issues.length === 0, s.issues.slice(0, 4).join('; '));
    check('Towers', `${T} ${s.id}: slab cantilever beyond column line ≤ ${s.limit} m`, s.maxCantilever <= s.limit + 0.01, `${s.maxCantilever} m`);
    check('Towers', `${T} ${s.id}: structure turns ${s.plateTwistPerFloor}° per floor (${s.plateTwist}° over the tower) and the glass line still leans ≤ ${s.leanLimit} m floor to floor`, Math.abs(s.plateTwistPerFloor) >= 1 && s.maxLeanStep <= s.leanLimit + 0.001, `${s.maxLeanStep} m`);
    check('Towers', `${T} ${s.id}: perimeter columns turn with their floorplate and incline ≤ ${s.tiltLimit} m per floor`, s.maxColumnTilt <= s.tiltLimit + 0.001, `${s.maxColumnTilt} m per floor (${s.columnTiltDeg}° off vertical)`);
    check('Towers', `${T} ${s.id}: every balcony floor is split into units by floor-to-soffit (${s.balcony.dividerH} m) privacy dividers, each standing outside the glass line and inside the ribbon edge`, s.balcony.floorsDivided === s.floors - 1 && s.balcony.strayDividers === 0, `${s.balcony.floorsDivided}/${s.floors - 1} floors, ${s.balcony.unitsPerFloor} units per floor, ${s.balcony.strayDividers} off the balcony`);
    check('Towers', `${T} ${s.id}: each divider lands on a window mullion (every ${s.balcony.dividerBays}th, ${s.balcony.mullion} m bays) where it meets the glass`, s.balcony.mullionOffset <= 0.02, `worst ${Math.round(s.balcony.mullionOffset * 1000)} mm off the mullion line`);
    check('Towers', `${T} ${s.id}: minimum balcony depth ≥ 0.9 m`, s.minBalconyDepth >= 0.89, `${s.minBalconyDepth} m`);
    const suite = s.penthouse, M = t.penthouse;
    const own = p.curved.filter((c) => c.name.startsWith(`${s.id}.`) && c.name !== `${s.id}.body`);
    check('Penthouses', `${T} ${s.id}: ${M.concept}`, s.penthouse.issues.length === 0, s.penthouse.issues.join('; '));
    check('Penthouses', `${T} ${s.id}: core inside every enclosed level (private elevator arrival) and mechanical plant concealed in a louvred court`,
      M.enclosures.every((e) => t.core.every(([x, z]) => insidePlan(x, z, e.poly) || e.name.startsWith('Double'))) && M.mech.poly.every(([x, z]) => insidePlan(x, z, offsetPlan(M.mech.footprint, 0.25))) && own.some((c) => c.kind === 'screen'));
    const pools = M.basins.filter((b) => b.kind === 'pool'), spas = M.basins.filter((b) => b.kind === 'spa');
    check('Penthouses', `${T} ${s.id}: private pool and a separate spa, basins below the terrace surface`, pools.length === 1 && spas.length === 1 && !spas[0].integrated && pools[0].waterY < pools[0].deckY && own.some((c) => c.name === `${s.id}.pool.coping`), `${pools.length} pool, ${spas.length} spa`);
    check('Penthouses', `${T} ${s.id}: every terrace level has a ≥ 1.05 m glass guard; wraparound terraces ≥ 2.4 m deep, roof gardens ≥ 1.5 m`, own.filter((c) => c.glaze === core.GLAZE.guard).length >= M.levels.length && own.filter((c) => c.glaze === core.GLAZE.guard).every((g) => g.h >= 1.05) && M.levels.every((l) => l.minTerrace >= (l.wrap ? 2.4 : 1.5)), M.levels.map((l) => `${l.name} ${round(l.minTerrace, 2)} m`).join(', '));
    // terrace layout: every furniture / planter footprint inside its guard, off the glass walks,
    // clear of pools and spas and of every other group on the same level; canopies inside the deck
    const quadIn = (q, poly) => q.every(([x, z]) => insidePlan(x, z, poly));
    const quadOverlap = (A, B) => {
      const axes = [A, B].flatMap((Q) => [[Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]], [Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]]]);
      return axes.every(([ax, az]) => {
        const pr = (Q) => Q.map(([x, z]) => x * ax + z * az);
        const a = pr(A), b = pr(B), len = Math.hypot(ax, az);
        return Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)) > 0.05 * len;
      });
    };
    const radialGrow = (poly, d) => poly.map(([x, z]) => { const r = Math.hypot(x - t.cx, z - t.cz) || 1; return [x + ((x - t.cx) / r) * d, z + ((z - t.cz) / r) * d]; });
    const bad = [];
    for (const L of M.levels) {
      const items = M.layout.filter((o) => o.level === L.name);
      const inner = radialGrow(L.deck, -0.3);
      for (const o of items) {
        if (!quadIn(o.quad, o.layer === 'canopy' ? radialGrow(L.deck, -0.1) : inner)) bad.push(`${L.name} ${o.name} over the edge`);
        if (o.layer === 'floor' && o.name !== 'kitchen' && L.enclosures.some((e) => o.quad.some(([x, z]) => insidePlan(x, z, offsetPlan(e, 0.2))))) bad.push(`${L.name} ${o.name} on a glass walk`);
        if (o.layer === 'floor' && M.basins.filter((b) => Math.abs(b.deckY - L.D) < 0.1).some((b) => o.quad.some(([x, z]) => insidePlan(x, z, offsetPlan(b.outline, 0.45))))) bad.push(`${L.name} ${o.name} over water`);
      }
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i].layer === items[j].layer && items[i].quad !== items[j].quad && quadOverlap(items[i].quad, items[j].quad)) bad.push(`${L.name} ${items[i].name}/${items[j].name}`);
    }
    check('Penthouses', `${T} ${s.id}: terrace groups inside the guards, off the glass walks and pools, no clashes (${M.layout.filter((o) => o.layer === 'floor').length} footprints)`, bad.length === 0, bad.slice(0, 5).join('; '));
    const phTrees = p.trees.filter((q) => q.penthouse === s.id), phPalms = p.palms.filter((q) => q.penthouse && Math.hypot(q.x - t.cx, q.z - t.cz) < 20 && q.y > 50);
    check('Penthouses', `${T} ${s.id}: restrained rooftop planting — built-in planters, ≤ 3 sculptural small trees, no exposed palms`, phPalms.length === 0 && phTrees.length <= 3 && phTrees.every((q) => q.planterH >= 0.9 && q.r <= 1.3), `${phTrees.length} trees, ${phPalms.length} palms`);
    // animation: every penthouse mass hangs off the tower body; loose water and seating specs sit inside the tower plan
    const chain = (c) => { let n = c, k = 0; while (n && n.parent && k++ < 20) { if (n.parent === `${s.id}.body`) return true; n = cv[n.parent]; } return false; };
    const detached = own.filter((c) => !(chain(c) || (c.phase === 'context' && (c.pts || []).every(([x, z]) => Math.hypot(x - t.cx, z - t.cz) < 20)))).map((c) => c.name);
    check('Penthouses', `${T} ${s.id}: all penthouse elements attach to the tower group (no detached pieces during the build animation)`, detached.length === 0, detached.join(', '));
  }
  const h1 = p.meta.towers[0].penthouse.roofTopY, h2 = p.meta.towers[1].penthouse.roofTopY;
  check('Towers', `${T} towers keep contrasting heights`, h1 - h2 > 12, `${round(h1)} m / ${round(h2)} m`);

  // --- office ----------------------------------------------------------------
  check('Office', `${T} blocks: continuous column lines (no transfers), cantilevers ≤ 3.0 m, projections ≤ 2.4 m, core inside every block`, a.structure.office.issues.length === 0, a.structure.office.issues.join('; '));
  check('Office', `${T} office remains subordinate to tower 2 (crown ≥ 10 m below the tower 2 penthouse roof)`, office.OFFICE_BLOCK_TOPS.at(-1) + office.PARAPET + 3.2 < cTop['A.t2.ph'] - 10, `${round(office.OFFICE_BLOCK_TOPS.at(-1) + office.PARAPET + 3.2)} m vs ${round(cTop['A.t2.ph'])} m`);
  for (const t of office.OFFICE_TERRACES) {
    const host = t.host < 0 ? office.OFFICE_BASE_RECT : office.OFFICE_BLOCKS[t.host].rect;
    const above = office.OFFICE_BLOCKS[t.host + 1];
    const clear = !above || !rectOverlap(t.rect, [above.rect[0] - 0.5, above.rect[1] + 0.5, above.rect[2] - 0.5, above.rect[3] + 0.5], -0.05);
    const onRoof = t.rect[0] >= host[0] - 0.01 && t.rect[1] <= host[1] + 0.01 && t.rect[2] >= host[2] - 0.01 && t.rect[3] <= host[3] + 0.01;
    check('Office', `${T} ${t.name} lies on its roof and clear of the block above`, onRoof && clear);
  }
  const op = a.officePlanters;
  check('Office', `${T} planters sit on terraces with ${op.access} m maintenance access`, op.issues.length === 0, op.issues.slice(0, 3).join('; '));
  check('Office', `${T} hanging planting clear of entrances and limited to frame bands over glazing`, op.lowOverEntrance === 0 && op.longOverGlass === 0, `${op.lowOverEntrance} low over entrances, ${op.longOverGlass} long over glazing`);

  // --- resort pool + deck ----------------------------------------------------------
  const pool = p.meta.pool.outline;
  const xs = pool.map((q) => q[0]), zs = pool.map((q) => q[1]);
  const len = Math.max(...zs) - Math.min(...zs), wid = Math.max(...xs) - Math.min(...xs);
  const hpo = p.meta.hotelPool.outline, hp = [Math.min(...hpo.map((q) => q[0])), Math.max(...hpo.map((q) => q[0])), Math.min(...hpo.map((q) => q[1])), Math.max(...hpo.map((q) => q[1]))];
  const hotelEW = (hp[1] - hp[0]) > (hp[3] - hp[2]);
  check('Pool', `${T} pool long axis runs east–west (site x), matching the hotel pool, between the towers`, hotelEW && wid / len > 1.8 && Math.min(...zs) > -15 && Math.max(...zs) < 15, `${round(wid)} m long × ${round(len)} m wide`);
  check('Pool', `${T} pool is wide (≥ 9.5 m across the swimming area)`, len >= 9.5, `${round(len)} m`);
  const t1f = cv['A.t1.body'].floorPlans[0], t2f = cv['A.t2.body'].floorPlans[0];
  check('Pool', `${T} pool terrace clear of tower enclosures`, !res.POOL.terrace.some(([x, z]) => insidePlan(x, z, t1f) || insidePlan(x, z, t2f)) && !t1f.some(([x, z]) => insidePlan(x, z, res.POOL.terrace)) && !t2f.some(([x, z]) => insidePlan(x, z, res.POOL.terrace)));
  const rp = a.parking.residential.pool;
  check('Pool', `${T} basin soffit leaves ≥ ${rp.required} m car clearance on ${rp.levelBelow} (with ${res.POOL.mepAllowance} m services allowance)`, rp.clearOk, `${rp.clearHeight} m`);
  check('Pool', `${T} basin clear of tower columns, cores, ramp and stair cores`, rp.conflicts.length === 0, rp.conflicts.join(', '));
  const inWater = p.parts.filter((q) => q.color === 'cushion' && Math.abs(q.y - res.POOL.waterY) < 0.005);
  check('Pool', `${T} in-water loungers sit on the sun shelf`, inWater.length > 0 && inWater.every((q) => partCorners(q).every(([x, z]) => insidePlan(x, z, cv['A.poolShelf'].pts))), `${inWater.length}`);
  const deckRoutes = a.deck.routes;
  check('Deck', `${T} 1.5 m clear routes connect both tower lobbies, both podium stairs and every amenity zone`, deckRoutes.every((r) => r.reachable), deckRoutes.filter((r) => !r.reachable).map((r) => r.name).join(', '));
  check('Deck', `${T} planters have a 0.9 m maintenance strip on at least one side`, a.deck.plantersWithoutAccess === 0, `${a.deck.plantersWithoutAccess} of ${a.deck.planters} ${JSON.stringify(a.deck.plantersWithoutAccessAt)}`);
  const deckIn = offsetPlan(res.PODIUM_PLAN, -0.45);
  const deckParts = p.parts.filter((q) => q.y - q.sy / 2 >= PODIUM_TOP - 0.01 && q.y - q.sy / 2 < PODIUM_TOP + 3 && insidePlan(q.x, q.z, res.PODIUM_PLAN));
  const lowSlab = (id) => cv[`${id}.body`].slabs.floors[0].outer;
  const offDeck = deckParts.filter((q) => !partCorners(q).every(([x, z]) => insidePlan(x, z, deckIn))).length;
  const tallUnder = deckParts.filter((q) => q.y + q.sy / 2 > PODIUM_TOP + 3.2 - 0.36 - 0.05 && partCorners(q).some(([x, z]) => insidePlan(x, z, lowSlab('A.t1')) || insidePlan(x, z, lowSlab('A.t2')))).length;
  const inTower = deckParts.filter((q) => partCorners(q).some(([x, z]) => insidePlan(x, z, t1f) || insidePlan(x, z, t2f))).length;
  check('Deck', `${T} deck furniture and planters stay on the deck, outside towers, and low beneath balconies`, offDeck + tallUnder + inTower === 0, `${offDeck} off deck, ${tallUnder} tall under balconies, ${inTower} in towers`);
  const deckPalms = [...p.palms.filter((q) => q.deck && !q.penthouse), ...p.trees.filter((q) => q.deck && !q.penthouse)];
  const palmIssues = deckPalms.filter((q) => {
    const planter = p.parts.some((b) => b.color === 'frame' && b.shape === 'box' && Math.abs(b.y + b.sy / 2 - q.y) < 0.02 && inRect(q.x, q.z, partRect(b), -0.3));
    const reach = q.h ? q.r : q.r + 0.5;
    const underSlab = insidePlan(q.x, q.z, offsetPlan(lowSlab('A.t1'), reach)) || insidePlan(q.x, q.z, offsetPlan(lowSlab('A.t2'), reach));
    return !planter || underSlab || q.planterH < 0.9;
  });
  check('Deck', `${T} deck palms and trees stand in ≥ 0.9 m raised planters, clear of balcony overhangs`, palmIssues.length === 0, `${palmIssues.length} of ${deckPalms.length}`);
  const spaT2 = insidePlan(res.SPA.x, res.SPA.z, offsetPlan(lowSlab('A.t2'), res.SPA.r + res.SPA.coping));
  check('Deck', `${T} raised spa sits on the structural slab (no depression) and outside balcony overhangs`, res.SPA.raise + 0.0 >= res.SPA.depth - 0.5 && !spaT2);

  // --- pedestrian circulation (plan/pedestrian.js, analysed by plan/circulation.js) -------------
  const W = a.circulation;
  check('Circulation', `${T} every principal destination reachable from the public sidewalks along continuous routes (${W.reach.length} doors and destinations)`, W.reach.every((r) => r.reachable) && W.nodeIssues.length === 0, [...W.reach.filter((r) => !r.reachable).map((r) => r.name), ...W.nodeIssues].slice(0, 5).join('; '));
  check('Circulation', `${T} no dead-end paths: every route end meets a sidewalk, another route or a door`, W.deadEnds.length === 0, W.deadEnds.join('; '));
  check('Circulation', `${T} clear walking zones free of furniture, lights, bollards, planters and trunks (café seating stays in furnishing zones)`, W.blockers.length === 0 && W.trunkIssues.length === 0, [...W.blockers, ...W.trunkIssues].slice(0, 6).join('; '));
  check('Circulation', `${T} low tree canopies (underside < 2.4 m) do not reach over clear zones`, W.lowCanopies.length === 0, W.lowCanopies.join(' '));
  check('Circulation', `${T} entrances unobstructed by planting, each with ≥ 1.5 m turning space`, W.blockedEntrances.length === 0 && W.tightEntrances.length === 0, [...W.blockedEntrances, ...W.tightEntrances].join('; '));
  check('Circulation', `${T} no pedestrian route crosses a drive, garage, loading or dock area inside the site`, W.conflicts.length === 0, W.conflicts.join('; '));
  check('Circulation', `${T} every driveway crossing continues the sidewalk paving on a raised table with edge bands (${W.crossings.length} crossings)`, W.crossings.every((c) => c.continuousPaving && c.raisedTable && c.edgeBands === 2), W.crossings.filter((c) => !(c.continuousPaving && c.raisedTable && c.edgeBands === 2)).map((c) => c.name).join('; '));
  check('Circulation', `${T} driveway sight triangles clear of trees, poles, signs and furniture over 0.9 m`, W.sightIssues.length === 0, W.sightIssues.slice(0, 5).join('; '));
  check('Circulation', `${T} no public route enters the hotel pool court or a building`, W.privateIssues.length === 0 && W.hotelInside.length === 0, [...W.privateIssues, ...W.hotelInside].join('; '));
  check('Circulation', `${T} step-free network: no stairs; all walking surfaces within ${round(Math.max(...W.tops) - Math.min(...W.tops), 3)} m of each other (conceptual flush transitions)`, W.stepFree);
  check('Circulation', `${T} the walking network is one continuous surface: every route, forecourt and plaza paved at the same level (${W.paving.levels.join(' / ')} m)`, W.paving.levels.length === 1, W.paving.levels.join(' / '));
  check('Circulation', `${T} grass meets the paving: lawns and beds either run under a path edge or stand clear of it, never stopping short and leaving a bare sliver (budget 24 sample points)`, W.paving.grassGaps.length <= 24, `${W.paving.grassGaps.length} points, e.g. ${W.paving.grassGaps.slice(0, 3).join(' ')}`);
  check('Circulation', `${T} no paved surface overlaps another of a different material (nothing to shimmer, no lip to trip on): each route is cut on the edge of what it meets`, W.paving.overlaps.length === 0, W.paving.overlaps.slice(0, 4).join('; '));
  check('Circulation', `${T} clear widths: primary ≥ 4.5 m, secondary ≥ 1.8 m`, W.widths.every((w) => w.ok), W.widths.filter((w) => !w.ok).map((w) => `${w.name} ${w.clearWidth}`).join('; '));
  check('Circulation', `${T} lighting at every junction, door and driveway crossing (within 9 m / 16 m)`, W.darkNodes.length === 0 && W.darkCrossings.length === 0, [...W.darkNodes, ...W.darkCrossings].slice(0, 6).join('; '));

  // --- the two primary lines and the plaza that stands on their crossing ------------------
  const lineError = (id, axis, value, from) => {
    const r = ped.ROUTES.find((q) => q.id === id);
    const pts = ped.routeCentreline(r).filter(from);
    return { n: pts.length, worst: Math.max(...pts.map((q) => Math.abs(q[axis] - value))) };
  };
  const promLine = lineError('P1', 1, ped.PROMENADE_Z, (q) => q[0] >= -26);
  const spineLine = ['S1', 'S2'].map((id) => lineError(id, 0, ped.SPINE_X, () => true))
    .reduce((a, b) => ({ n: a.n + b.n, worst: Math.max(a.worst, b.worst) }));
  check('Circulation', `${T} the Central Promenade holds z = ${ped.PROMENADE_Z} dead straight from the podium portal to the east sidewalk (${promLine.n} samples)`,
    promLine.worst <= 0.001, `worst ${Math.round(promLine.worst * 1000)} mm off the line`);
  check('Circulation', `${T} the Spine holds x = ${ped.SPINE_X} dead straight from the north sidewalk to the south sidewalk (${spineLine.n} samples)`,
    spineLine.worst <= 0.001, `worst ${Math.round(spineLine.worst * 1000)} mm off the line`);
  check('Circulation', `${T} the fountain plaza stands on the crossing of the two lines, on the axis of the podium portal`,
    Math.abs(ped.FOUNTAIN_CENTRE[0] - ped.SPINE_X) < 1e-9 && Math.abs(ped.FOUNTAIN_CENTRE[1] - ped.PROMENADE_Z) < 1e-9,
    `(${ped.FOUNTAIN_CENTRE[0]}, ${ped.FOUNTAIN_CENTRE[1]})`);
  const widthAtCrossing = (id) => { const r = ped.ROUTES.find((q) => q.id === id); return typeof r.width === 'function' ? r.width(ped.FOUNTAIN_CENTRE[0], ped.FOUNTAIN_CENTRE[1]) : r.width; };
  check('Circulation', `${T} the promenade and the spine keep their clear widths through the park (promenade ${round(widthAtCrossing('P1'), 2)} m of 6.0 nominal, spine ${round(widthAtCrossing('S1'), 2)} m)`,
    widthAtCrossing('P1') >= 5.8 && widthAtCrossing('S1') >= 4.5 && widthAtCrossing('S2') >= 4.5);
  check('Circulation', `${T} each primary route passes the fountain basin with at least its own clear width left on the plaza ring either side`,
    W.ringPass.every((r) => r.have >= r.need - 0.001), W.ringPass.map((r) => `${r.id} needs ${r.need} has ${r.have}`).join('; '));
  // The park's open ground. There was a garden room west of the spine and one 22 × 18 m
  // flexible lawn east of it until the art museum was built on the lawn; the museum was then
  // grown out to the park's own boundary on its west, east and south sides, so both rooms are
  // the building. Two things are checked: that it really does reach those three edges, and
  // that the edges it must not take are still open — the plaza's walking ring and the planted
  // margin in front of it on the north, the office walk's paving on the east, and the gate
  // approach between the south face and the property line.
  const MUR = mus.MUSEUM_RECT;
  const bx = [Math.min(...park.LAWN_BOUNDARY.map((q) => q[0])), Math.max(...park.LAWN_BOUNDARY.map((q) => q[0])), Math.max(...park.LAWN_BOUNDARY.map((q) => q[1]))];
  // the east edge is the office coffee bar's terrace, not the office walk: the terrace sits on
  // the park's east margin, so the building stops on its edge and the seating survives
  const terrace = ped.FURNISHING.find((f) => f.id === 'F-OFFICE').rect;
  const atEdges = [MUR[0] - bx[0], terrace[0] - MUR[1], bx[2] - MUR[3]];
  check('Park', `${T} the museum reaches the park's edges: its west face is on the boundary (${round(atEdges[0], 2)} m), its south face on the park's frontage (${round(atEdges[2], 2)} m) and its east face on the edge of the office coffee bar's terrace (${round(atEdges[1], 2)} m), which holds that margin`,
    atEdges.every((g) => g >= 0 && g <= 0.35),
    `west ${round(atEdges[0], 2)}, east ${round(atEdges[1], 2)}, south ${round(atEdges[2], 2)}`);
  // and on the north it comes out to the plaza itself: the ground floor's face is an arc
  // concentric with the fountain, a plantable strip outside the paved ring, and the corners
  // either side of the spine are filled rather than cut off by a straight line
  const arcClear = mus.MUSEUM.arcR - ped.PLAZA_R;
  const concentric = [-15, -12, -8, -4, -1].map((x) => Math.hypot(x - ped.FOUNTAIN_CENTRE[0], mus.museumNorthAt(x) - ped.FOUNTAIN_CENTRE[1]));
  check('Park', `${T} the museum comes out to the plaza's round edge: the ground floor's north face is an arc ${round(arcClear, 1)} m outside the ${round(ped.PLAZA_R, 1)} m paved ring, concentric with the fountain to ${Math.round(Math.max(...concentric.map((r) => Math.abs(r - mus.MUSEUM.arcR))) * 1000)} mm, so both corners beside the spine are built`,
    arcClear >= 1.0 && arcClear <= 2.5 && Math.max(...concentric.map((r) => Math.abs(r - mus.MUSEUM.arcR))) < 0.01
    && mus.museumNorthAt(-16) < mus.MUSEUM.zb - 1.5 && mus.museumNorthAt(0) < mus.MUSEUM.zb - 1.5,
    `arc R ${round(mus.MUSEUM.arcR, 2)}, clear ${round(arcClear, 2)}`);
  // What it still may not take: the plaza's paved ring and the two mouths that meet it from the
  // east and west (their palm pairs stand in front of the apron's flanks), and the gate approach
  // between the south face and the property line.
  const mouthPalms = p.palms.filter((q) => q.y < 1.2 && q.x > -23 && q.x < 19 && q.z > 4 && q.z < 9);
  const mouthClear = mouthPalms.length ? Math.min(...mouthPalms.map((q) => mus.museumNorthAt(q.x) - q.z)) : 0;
  const gateGap = core.HZ - MUR[3];
  check('Park', `${T} the edges it may not take are still open: the plaza's ${round(ped.PLAZA_R, 1)} m paved ring, ${round(mouthClear, 1)} m in front of the apron for the palms marking the promenade's two plaza mouths, and ${round(gateGap, 1)} m of gate approach between the south face and the property line`,
    arcClear >= 1.0 && mouthPalms.length === 2 && mouthClear >= 2.6 && gateGap >= 4.0,
    `arc ${round(arcClear, 1)}, mouth palms ${mouthPalms.length} with ${round(mouthClear, 1)} m, gate ${round(gateGap, 1)}`);
  // nothing the park plants may end up inside the building: the shrub, tree and palm routines
  // all test `blocked`, but the beds and lawns they stand in are separate surfaces
  const bedsInside = cv['P.beds'].parts.filter((q) => q.pts.some(([x, z]) => mus.museumHolds(x, z, -0.3)));
  // measured at grade only: the museum's own roof garden and terrace beds are inside its
  // footprint by design, and they are checked separately in the Museum section
  const plantedInside = [...p.trees, ...p.palms, ...p.parts.filter((q) => q.shape === 'bush')]
    .filter((q) => (q.y ?? 0) < mus.MUSEUM.ground && mus.museumHolds(q.x, q.z));
  check('Park', `${T} the park's planting stops at the museum: no bed, shrub, tree or palm left standing inside the galleries when the building grew over their ground`,
    bedsInside.length === 0 && plantedInside.length === 0,
    `${bedsInside.length} beds, ${plantedInside.length} plants, e.g. ${plantedInside.slice(0, 3).map((q) => `(${round(q.x, 1)}, ${round(q.z, 1)})`).join(' ')}`);
  const parkWindow = (q) => q.x > -23 && q.x < 19 && q.z > -13 && q.z < 52;
  const canopies2 = p.trees.filter((t) => t.y < 1.2 && parkWindow(t));
  // The counts fell as the museum grew, and the bosque went with the garden room it stood in.
  // The park's south half is the building now, so what has to hold is the planting round what
  // is left: canopy trees in the two sector lawns above the promenade and in the wedge between
  // the plaza's east mouth and the apron's corner, a planted frontage on the museum's street
  // side like its neighbours', and palms still marking the plaza's mouths.
  const want = tier.name === 'mobile' ? [3, 10] : [4, 16];
  const wedge = canopies2.filter((t) => t.x > 2.9 && t.z > 4 && t.z < mus.MUSEUM.zn);
  const frontage = p.trees.filter((t) => t.y < 1.2 && t.x > -22 && t.x < 19 && t.z > mus.MUSEUM.z1 && t.z < core.HZ);
  check('Park', `${T} the park keeps its planting structure: ${canopies2.length} canopy trees round the plaza (target ${want[0]}–${want[1]} on ${tier.name}, down from 12–16 before the museum took park ground), ${wedge.length} in the wedge by the plaza's east mouth and ${frontage.length} street trees on the museum's south frontage`,
    canopies2.length >= want[0] && canopies2.length <= want[1] && wedge.length >= 1 && frontage.length >= 3,
    `${canopies2.length} trees, ${wedge.length} in the wedge, ${frontage.length} on the frontage, ${p.palms.filter((q) => q.y < 1.2 && parkWindow(q)).length} palms`);
  // --- no bare ground between the buildings --------------------------------------------------
  // The block's base paving lies under everything; wherever no lawn, route or building covers
  // it, it shows through as a bare grey patch. One sat in the hotel's south-west corner garden
  // beside the fountain, in the pocket between the hotel's west end and the paseo garden.
  // Every point in the gardens flanking the paseo must now be lawn, paving or building.
  // measured on the lawn outlines the renderer actually draws, which are pushed out under the
  // adjacent paving, not on the raw rectangles behind them
  const lawnPolys = ['G.lawns', 'P.lawns'].flatMap((n) => cv[n].parts.map((q) => q.pts));
  const onLawn = (x, z) => lawnPolys.some((pl) => insidePlan(x, z, pl));
  const CWall = hotel.COURT_WALL;
  const solidHere = (x, z) => [hotel.HOTEL.front, hotel.HOTEL.tower, hotel.HOTEL.rear, hotel.HOTEL.link]
    .some((pl) => insidePlan(x, z, pl))
    || (Math.abs(x - CWall.x) <= CWall.thick / 2 + 0.3 && z >= CWall.z0 - 0.3 && z <= CWall.z1 + 0.3);
  const bare = [];
  // the pocket itself: between the paseo walk and the hotel's west face, north of the court wall
  for (let x = -6; x <= 5.6; x += 0.4) for (let z = -20.4; z <= -11.8; z += 0.4) {
    if (onLawn(x, z) || solidHere(x, z) || ped.pavedAt(x, z)) continue;
    bare.push(`(${round(x, 1)}, ${round(z, 1)})`);
  }
  check('Ground', `${T} no bare base paving shows between the hotel's west end and the paseo gardens: every point is lawn, walk or building`,
    bare.length === 0, bare.slice(0, 4).join(' '));

  // --- the art museum over the spine ----------------------------------------------------------
  // A three-storey glass pavilion built astride the park's north–south walk: two volumes at
  // grade either side of it, the two gallery floors bridging across above. The walk keeps its
  // line, its width and its clear zone; the crossing has to stay open and high.
  // Not checked here: structure and the bridge transfer, fire separation and egress, glazing
  // support, environmental control and daylight on art — none of that is designed.
  const MU = mus.MUSEUM;
  const spineW = ped.ROUTES.find((r) => r.id === 'S1').width;
  const zoneW = [ped.SPINE_X - spineW / 2, ped.SPINE_X + spineW / 2];
  const storeys = [[0, MU.ground], [mus.MUSEUM_L2, MU.floor], [mus.MUSEUM_L3, MU.floor]];
  const tallestNeighbour = Math.min(office.OFFICE_BLOCK_TOPS.at(-1), hotel.HOTEL_FRONT_TOP);
  check('Museum', `${T} the museum is exactly three storeys: ${storeys.map(([, h]) => round(h, 1)).join(' + ')} m to a ${round(mus.MUSEUM_TOP, 1)} m parapet, below the ${round(tallestNeighbour, 1)} m of its nearest neighbours`,
    storeys.length === 3 && mus.MUSEUM_TOP < tallestNeighbour && !cv['X.l4'] && mus.MUSEUM_ROOF + MU.slab + MU.parapet === mus.MUSEUM_TOP,
    `${round(mus.MUSEUM_TOP, 2)} m`);
  // the ground splits either side of the walk; the upper floors span it
  const spans = (pl) => Math.min(...pl.map((q) => q[0])) <= zoneW[0] && Math.max(...pl.map((q) => q[0])) >= zoneW[1];
  const clearsZone = (pl) => Math.max(...pl.map((q) => q[0])) <= zoneW[0] || Math.min(...pl.map((q) => q[0])) >= zoneW[1];
  check('Museum', `${T} the walk runs between two ground volumes and under the bridge: the ${round(MU.gapE - MU.gapW, 1)} m passage holds the spine's ${round(spineW, 1)} m clear zone, and both gallery floors span it`,
    clearsZone(mus.MUSEUM_GROUND_W) && clearsZone(mus.MUSEUM_GROUND_E) && spans(cv['X.l2'].pts) && spans(cv['X.l3'].pts)
    && MU.gapW < zoneW[0] && MU.gapE > zoneW[1]);
  // nothing of the museum stands in the crossing below head height
  const inCrossing = (x, z) => x > zoneW[0] && x < zoneW[1] && z > MU.zn - 0.5 && z < MU.z1 + 0.5;
  const lowInWalk = p.parts.filter((q) => q.y - q.sy / 2 < 4.4 && partCorners(q).some(([x, z]) => inCrossing(x, z)) && q.color !== 'lamp');
  const boxInWalk = p.boxes.filter((b) => b.group !== 'L' && b.y0 < 4.4 && inCrossing(b.x, b.z));
  check('Museum', `${T} nothing stands in the crossing: no column, planter, wall, canopy or art below ${round(MU.ground, 1)} m anywhere in the spine's clear zone`,
    lowInWalk.length === 0 && boxInWalk.length === 0,
    `${lowInWalk.length} parts, ${boxInWalk.length} boxes`);
  // the passage is lit and shaded rather than a bare gap
  const soffitLights = p.parts.filter((q) => q.color === 'lamp' && Math.abs(q.y - MU.ground) < 0.2
    && q.x > MU.gapW && q.x < MU.gapE && q.z > MU.zb && q.z < MU.z1);
  check('Museum', `${T} the passage reads as a room to walk through: a shaded soffit with ${soffitLights.length} recessed light lines over the crossing`,
    soffitLights.length >= 1);
  // Every floor is floored. This is a plain requirement anywhere else in the model and never
  // worth checking, because the other envelopes are opaque; here the glass is see-through, so
  // a missing plate shows as the park's grass and the sky running on through the galleries.
  const plates = p.curved.filter((c) => /^X\.(floor|deck)/.test(c.name));
  const plateAt = (x, z, y) => plates.some((c) => c.y0 + c.h > y - 0.35 && c.y0 + c.h <= y + 0.01 && insidePlan(x, z, c.pts));
  let noFloor = 0, fSampled = 0;
  for (let x = MU.x0; x <= MU.x1; x += 0.6) {
    for (let z = MU.zn; z <= MU.z1; z += 0.6) {
      const fLevels = [
        [mus.MUSEUM_FOOTPRINTS.some((pl) => insidePlan(x, z, offsetPlan(pl, -0.8))), ped.WALK_TOP],
        [insidePlan(x, z, offsetPlan(mus.MUSEUM_L2_PLAN, -0.8)), mus.MUSEUM_L2],
        [insidePlan(x, z, offsetPlan(mus.MUSEUM_L3_PLAN, -0.8)), mus.MUSEUM_L3],
      ];
      for (const [on, y] of fLevels) {
        if (!on) continue;
        fSampled++;
        if (!plateAt(x, z, y)) noFloor++;
      }
    }
  }
  check('Museum', `${T} every floor is floored and every terrace decked: ${plates.length} plates cover all ${fSampled} sample points, the ground ones stone and flush with the walk outside at ${round(ped.WALK_TOP, 2)} m`,
    noFloor === 0 && plates.length >= 7, `${noFloor} of ${fSampled} points with nothing under them`);

  // --- the section: it steps down to the street and to the plaza -------------------------
  // Three storeys at the back, two, one, then the frontage garden. The apron is the plaza
  // step and it has to stay a single storey: it stands between the hero camera and the
  // fountain, and a ray from the fountain clears 5 m of apron but not 15 m of bar.
  const deckTops = [mus.MUSEUM_DECK1, mus.MUSEUM_DECK2, mus.MUSEUM_DECK3];
  // Everything the section does, it does toward the park: the third floor steps back from the
  // second, the second from the apron, and the apron is a single storey out to the plaza. The
  // street elevation is the opposite — flush at all three storeys, nothing stepped.
  const apronTop = Math.max(...p.curved.filter((c) => /^X\.deck1/.test(c.name)).map((c) => c.y0 + c.h));
  const southFaces = ['X.groundE', 'X.l2', 'X.l3'].map((n) => Math.max(...cv[n].pts.map((q) => q[1])));
  const flushSouth = Math.max(...southFaces) - Math.min(...southFaces);
  check('Museum', `${T} the section steps down to the park and is flush to the street: ${round(MU.z3n - MU.zb, 1)} m of terrace as the third floor steps back from the second, then the apron's single ${round(MU.ground, 1)} m storey out to the plaza, ${round(mus.MUSEUM_TOP - apronTop, 1)} m below the parapet — while the three south faces line up to ${Math.round(flushSouth * 1000)} mm`,
    MU.z3n - MU.zb >= 2.5 && apronTop < MU.ground + 0.6 && apronTop < mus.MUSEUM_TOP - 9
    && flushSouth < 0.02
    && !p.curved.some((c) => /^X\.(l2|l3)$/.test(c.name) && Math.min(...c.pts.map((q) => q[1])) < MU.zb),
    `park step ${round(MU.z3n - MU.zb, 1)} m, south faces within ${Math.round(flushSouth * 1000)} mm, apron ${round(apronTop, 2)} m`);

  // --- rounded corners --------------------------------------------------------------------
  // Every plan the museum draws is cornered on MUSEUM.corner. Measured rather than asserted:
  // walk each outline and check no vertex turns more than a sixth of a right angle at once.
  const worstTurn = (pl) => {
    let worst = 0;
    for (let i = 0; i < pl.length; i++) {
      const a = pl[(i - 1 + pl.length) % pl.length], b = pl[i], c = pl[(i + 1) % pl.length];
      const t0 = Math.atan2(b[1] - a[1], b[0] - a[0]), t1 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = Math.abs(t1 - t0); if (d > Math.PI) d = 2 * Math.PI - d;
      worst = Math.max(worst, d);
    }
    return worst;
  };
  const outlines = [mus.MUSEUM_PLAN, mus.MUSEUM_L2_PLAN, mus.MUSEUM_L3_PLAN, mus.MUSEUM_GROUND_W, mus.MUSEUM_GROUND_E];
  const sharpest = Math.max(...outlines.map(worstTurn));
  check('Museum', `${T} every corner is rounded on a ${round(MU.corner, 1)} m radius: across all ${outlines.length} outlines the sharpest turn between two segments is ${Math.round((sharpest * 180) / Math.PI)}°, never a square corner`,
    MU.corner >= 2.0 && sharpest < Math.PI / 5, `${Math.round((sharpest * 180) / Math.PI)}° sharpest`);

  // --- the vertical core: the circular stair and the lift ----------------------------------
  // The stair is one flight per storey, not an endless helix: each flight has to divide its own
  // storey into equal risers and arrive on a landing, and every floor the drum passes through
  // has to be cut open for it. The lift beside it has to serve the same four levels and stay
  // under the stair head. Treads are the short pieces, landings and thresholds the long ones.
  const stairStone = p.parts.filter((q) => q.color === 'stone' && q.shape === 'box' && q.sy < 0.12
    && Math.hypot(q.x - MU.stair.x, q.z - MU.stair.z) < MU.stair.r + 0.2);
  const treads = stairStone.filter((q) => q.sx < 1.3);
  const wantLandings = [ped.WALK_TOP, mus.MUSEUM_L2, mus.MUSEUM_L3, mus.MUSEUM_DECK3];
  const landingPads = stairStone.filter((q) => q.sx >= 1.3);
  const served = wantLandings.filter((y) => landingPads.some((l) => Math.abs(l.y - y) < 0.16));
  // and each flight has to arrive where its landing is: the top tread under a level must be
  // within a quarter turn of a landing pad at that level, or the helix has missed the floor
  const bearing = (q) => Math.atan2(q.z - MU.stair.z, q.x - MU.stair.x);
  const angTo = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const misses = wantLandings.slice(1).filter((y) => {
    const below = stairStone.filter((q) => q.sx < 1.3 && q.y < y - 0.05 && q.y > y - 0.45);
    const pads = landingPads.filter((q) => Math.abs(q.y - y) < 0.16);
    if (!below.length || !pads.length) return true;
    const top = below.reduce((a, b) => (a.y >= b.y ? a : b));
    return !pads.some((pad) => angTo(bearing(top), bearing(pad)) < 0.7);
  });
  const tY = treads.map((q) => q.y).sort((a, b) => a - b);
  const climb = tY.length ? tY.at(-1) - tY[0] : 0;
  // a gap bigger than a riser is only allowed where the stair crosses a floor and lands
  const gaps = tY.slice(1).map((y, i2) => [tY[i2], y - tY[i2]]);
  const badGaps = gaps.filter(([y0, g]) => g > 0.22 && !wantLandings.some((L) => y0 < L && y0 + g > L));
  const spinsAround = new Set(treads.map((q) => Math.round(((Math.atan2(q.z - MU.stair.z, q.x - MU.stair.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8)).size;
  // and it stands in the larger of the two wings, where a drum costs the least floor
  const wings = [['west', mus.MUSEUM_GROUND_W], ['east', mus.MUSEUM_GROUND_E]].map(([n, pl]) => ({ n, a: Math.abs(polygonArea(pl)), pl }));
  const bigger = wings[0].a >= wings[1].a ? wings[0] : wings[1];
  check('Museum', `${T} the circular stair is solved floor by floor: ${treads.length} treads through ${spinsAround} of 8 compass positions, landing on all ${served.length} of ${wantLandings.length} levels (${wantLandings.map((y) => round(y, 2)).join(', ')} m) with every flight arriving on its own landing, and no gap between treads bigger than a riser except where it lands, standing in the ${bigger.n} wing`,
    treads.length >= 60 && spinsAround === 8 && served.length === wantLandings.length && badGaps.length === 0
    && misses.length === 0
    && tY[0] <= ped.WALK_TOP + 0.3 && tY.at(-1) >= mus.MUSEUM_DECK3 - 0.4
    && insidePlan(MU.stair.x, MU.stair.z, bigger.pl),
    `${treads.length} treads, ${served.length} landings, ${badGaps.length} bad gaps, ${round(climb, 1)} m climb`);
  // the head is open: the glass above the roof is a curved wall with a doorway in it, not a
  // sealed cylinder with a door drawn on the inside
  const head = p.curved.find((c) => c.name === 'X.stairHead');
  const headAng = head ? head.pts.slice(0, head.pts.length / 2)
    .map((q) => ((Math.atan2(q[1] - MU.stair.z, q[0] - MU.stair.x) - MU.stair.land + Math.PI * 4) % (Math.PI * 2))) : [];
  const opening = head ? (Math.PI * 2 - (Math.max(...headAng) - Math.min(...headAng))) : 0;
  const clearDoor = 2 * MU.stair.r * Math.sin(opening / 2);
  // and the lift head is open the same way, on the same bearing, so you leave both by the same
  // side of the core. Both walls are also checked to wind the way the rest of the model does,
  // or the glass would be built facing inward and read inside-out.
  const liftHead = p.curved.find((c) => c.name === 'X.liftHead');
  const signed = (pl) => pl.reduce((t2, [x, z], i2) => { const [nx, nz] = pl[(i2 + 1) % pl.length]; return t2 + x * nz - nx * z; }, 0) / 2;
  const bearingOfGap = (c, cx, cz) => {
    const a2 = c.pts.slice(0, c.pts.length / 2).map((q) => Math.atan2(q[1] - cz, q[0] - cx));
    return ((a2[0] + a2.at(-1)) / 2 + Math.PI * 3) % (Math.PI * 2);
  };
  const headsAgree = head && liftHead
    && Math.abs(bearingOfGap(head, MU.stair.x, MU.stair.z) - bearingOfGap(liftHead, MU.lift.x, MU.lift.z)) < 0.12;
  check('Museum', `${T} both heads are ways out, not lids: the stair's is a curved glass wall with a ${Math.round((opening * 180) / Math.PI)}° doorway — ${round(clearDoor, 2)} m clear — and the lift's is walled on three sides with the fourth open, both facing ${Math.round((bearingOfGap(head, MU.stair.x, MU.stair.z) * 180) / Math.PI)}° and capped by plates lapped past their shafts`,
    !!head && clearDoor > 1.5 && opening < 1.4 && !!liftHead && headsAgree
    && signed(head.pts) > 0 && signed(liftHead.pts) > 0
    && ['X.stairCap', 'X.liftCap'].every((n) => p.curved.some((c) => c.name === n && Math.abs(c.y0 + c.h - mus.MUSEUM_CORE_TOP) < 0.01)),
    `${round(clearDoor, 2)} m stair opening, heads agree ${!!headsAgree}`);

  // the floors are actually cut where the core passes through them
  const cored = p.curved.filter((c) => /^X\.(floorE|deck1E|floor2|deck2|deck3)$/.test(c.name));
  const holed = cored.filter((c) => (c.holes || []).length > 0);
  const stairHoled = cored.filter((c) => (c.holes || []).some((h) => h.some(([x, z]) => Math.hypot(x - MU.stair.x, z - MU.stair.z) < MU.stair.r + 0.1)));
  check('Museum', `${T} the core passes through openings, not through slab: ${holed.length} of the ${cored.length} plates it crosses are cut, ${stairHoled.length} of them for the stair drum and the rest for the lift shaft`,
    holed.length === cored.length && stairHoled.length === cored.length);
  // the lift: a shaft beside the drum, serving every level, and no taller than the stair head
  const shaftParts = p.curved.filter((c) => /^X\.lift/.test(c.name));
  const shaft = shaftParts.find((c) => c.name === 'X.lift');
  const shaftTop = shaftParts.length ? Math.max(...shaftParts.map((c) => c.y0 + c.h)) : 0;
  const liftDoors = p.parts.filter((q) => q.color === 'charcoal' && Math.abs(q.x - MU.lift.x) < MU.lift.w
    && Math.abs(q.z - MU.lift.z) < MU.lift.d && q.sy > 1.5);
  const liftServes = wantLandings.filter((y) => liftDoors.some((q) => Math.abs(q.y - q.sy / 2 - y) < 0.2));
  const apart = Math.hypot(MU.lift.x - MU.stair.x, MU.lift.z - MU.stair.z) - MU.stair.r - Math.max(MU.lift.w, MU.lift.d) / 2;
  check('Museum', `${T} a lift stands beside the drum and serves the same four levels: ${liftServes.length} sets of landing doors, ${round(apart, 2)} m clear of the stair, both heads open to the west and topping out together at ${round(mus.MUSEUM_CORE_TOP, 2)} m, ${round(mus.MUSEUM_CORE_TOP - mus.MUSEUM_DECK3, 1)} m above the roof garden`,
    !!shaft && liftServes.length === wantLandings.length && apart > 0.15 && apart < 3.5
    && Math.abs(shaftTop - mus.MUSEUM_CORE_TOP) < 0.01
    && Math.abs(Math.max(...p.curved.filter((c) => /^X\.stair/.test(c.name)).map((c) => c.y0 + c.h)) - mus.MUSEUM_CORE_TOP) < 0.01
    && insidePlan(MU.lift.x, MU.lift.z, mus.MUSEUM_GROUND_E),
    `${liftServes.length} levels, ${round(apart, 2)} m apart, top ${round(shaftTop, 2)}`);

  // --- the roof garden ---------------------------------------------------------------------
  const onRoof = (q) => Math.abs(q.y - mus.MUSEUM_DECK3) < 4.0 && q.y > mus.MUSEUM_DECK3 - 0.2
    && q.x > MU.x0 && q.x < MU.x1 && q.z > MU.z3n && q.z < MU.z1;
  // foliage is not all one shape any more: the grasses and the coontie are cones
  const roofShrubs = p.parts.filter((q) => ['bush', 'cone'].includes(q.shape) && q.color !== 'canvas' && onRoof(q));
  const roofBeds = p.parts.filter((q) => q.color === 'planter' && onRoof(q));
  const roofPalms = p.palms.filter((q) => q.y > mus.MUSEUM_DECK3 - 0.2 && q.y < mus.MUSEUM_DECK3 + 1);
  // The loop itself: one continuous run of paving round the garden, wide enough to walk, with
  // nothing planted in it. Measured off the paving slabs the garden actually emits — their ends
  // have to meet, and no soil may stand within half the clear width of any of their centres.
  // the loop's own slabs: laid across the walk's width, so they are the ones whose short side is
  // the clear width. The sculpture clearings are paved too, and are not part of this.
  const walk = p.parts.filter((q) => q.color === 'stone' && q.shape === 'box'
    && Math.abs(q.y - (mus.MUSEUM_DECK3 + 0.045)) < 0.02 && q.sz > 1.7 && q.sz < 2.3 && q.sx > 1.0);
  const soilRounds = p.parts.filter((q) => q.color === 'planter' && q.shape === 'cyl' && Math.abs(q.y - (mus.MUSEUM_DECK3 + 0.16)) < 0.1);
  const walkW = walk.length ? Math.min(...walk.map((q) => q.sz)) : 0;
  // is a point inside one of the loop's slabs? measured along and across the slab's own axis
  const inWalk = (x, z, shrink = 0) => walk.some((w) => {
    const a2 = -(w.rot || 0), ux = Math.cos(a2), uz = Math.sin(a2);
    const dx = x - w.x, dz = z - w.z;
    return Math.abs(dx * ux + dz * uz) < w.sx / 2 - shrink && Math.abs(-dx * uz + dz * ux) < w.sz / 2 - shrink;
  });
  const blocked2 = soilRounds.filter((b) => inWalk(b.x, b.z) || walk.some((w) => Math.hypot(b.x - w.x, b.z - w.z) < b.sx / 2 + 0.2 && inWalk(b.x, b.z, -b.sx / 2)));
  // the run is continuous if every slab meets another at each end
  const lonely = walk.filter((q) => walk.filter((o) => o !== q && Math.hypot(o.x - q.x, o.z - q.z) < q.sx * 0.65 + 2.4).length < 2);
  check('Museum', `${T} the garden has one continuous walking loop: ${walk.length} paving slabs ${round(walkW, 2)} m wide running unbroken from the core round the garden and back, with no bed standing in any of them`,
    walk.length >= (tier.name === 'mobile' ? 14 : 22) && walkW >= 1.8 && blocked2.length === 0 && lonely.length === 0,
    `${walk.length} slabs, ${round(walkW, 2)} m wide, ${blocked2.length} blocked, ${lonely.length} orphaned`);

  // Six sculptures, each on its own base, each different from the others. Counted by the plinths
  // they stand on and the materials above them, so a repeated primitive would not pass for a set.
  const plinths = p.parts.filter((q) => q.shape === 'box' && ['stone', 'charcoal'].includes(q.color)
    && Math.abs(q.y - q.sy / 2 - (mus.MUSEUM_DECK3 + 0.07)) < 0.02 && q.sx > 1.5 && q.sz > 1.5);
  const artPieces = plinths.map((q) => p.parts.filter((o) => Math.abs(o.x - q.x) < q.sx / 2 + 1.4 && Math.abs(o.z - q.z) < q.sz / 2 + 1.4
    && o.y > q.y + q.sy / 2 && o.y < q.y + 4.5 && ['frame', 'metal', 'stone', 'charcoal'].includes(o.color)));
  const artKinds = new Set(artPieces.flat().map((o) => `${o.shape}|${o.color}`));
  check('Museum', `${T} the garden carries ${plinths.length} sculptures, each on its own base and each made of different stuff: ${artKinds.size} shape-and-material combinations across ${artPieces.flat().length} pieces, none of them standing in the walk`,
    plinths.length >= 5 && plinths.length <= 7 && artKinds.size >= 5
    && artPieces.every((set) => set.length > 0)
    && !plinths.some((q) => inWalk(q.x, q.z)),
    `${plinths.length} plinths, ${artKinds.size} kinds`);

  // How much of the garden is actually planted. The brief for this roof is a planted ground with
  // paths cut through it rather than paving with beds on it, so the soil is measured against the
  // usable garden area — inside the parapet's maintenance margin, less the two cascade pools,
  // the reflecting pool and the core. Sampled on a 0.4 m grid over the real footprints.
  const gx0 = MU.x0 + 1.0, gx1 = MU.x1 - 1.0, gz0 = MU.z3n + 0.9, gz1 = MU.z1 - 1.1;
  const soil = p.parts.filter((q) => q.color === 'planter' && q.shape === 'cyl' && Math.abs(q.y - (mus.MUSEUM_DECK3 + 0.16)) < 0.1);
  const roofPools = mus.museumPools().filter(([, , , , y]) => Math.abs(y - mus.MUSEUM_DECK3) < 0.01);
  let usable = 0, green = 0;
  for (let x = gx0; x <= gx1; x += 0.4) {
    for (let z = gz0; z <= gz1; z += 0.4) {
      if (roofPools.some(([a2, b2, c2, d2]) => x > a2 && x < b2 && z > c2 && z < d2)) continue;
      if (Math.hypot(x - MU.stair.x, z - MU.stair.z) < MU.stair.r + 0.6) continue;
      if (Math.abs(x - MU.lift.x) < MU.lift.w / 2 + 0.6 && Math.abs(z - MU.lift.z) < MU.lift.d / 2 + 0.6) continue;
      usable++;
      if (soil.some((q) => Math.hypot(q.x - x, q.z - z) < q.sx / 2)) green++;
    }
  }
  const cover = usable ? green / usable : 0;
  check('Museum', `${T} the roof reads as planted ground with paths cut through it: ${Math.round(cover * 100)} % of the ${Math.round(usable * 0.16)} m² of usable garden is soil, the rest the walking loop, the sculpture clearings, the seats and the water`,
    cover >= 0.5 && cover <= 0.72, `${Math.round(cover * 100)} % planted`);

  check('Museum', `${T} the roof is a garden: ${roofBeds.length} beds carrying ${roofShrubs.length} shrubs and ${roofPalms.length} palms over ${Math.round(Math.abs(polygonArea(mus.MUSEUM_L3_PLAN)))} m² of deck, with the stair head and the cascade pool kept clear of it`,
    roofBeds.length >= (tier.name === 'mobile' ? 8 : 16) && roofShrubs.length >= (tier.name === 'mobile' ? 40 : 140)
    && roofPalms.length >= 1
    && !roofShrubs.some((q) => Math.hypot(q.x - MU.stair.x, q.z - MU.stair.z) < MU.stair.r),
    `${roofBeds.length} beds, ${roofShrubs.length} shrubs, ${roofPalms.length} palms`);

  // --- the two cascades ---------------------------------------------------------------------
  // One on each wing, both on the park elevation: a pool on every level the section steps down
  // to, a sheet linking each pair, from the roof to a basin at grade. Each is checked against
  // the wing it belongs to, so neither can drift onto the wrong one — and the street elevation
  // is checked to carry no water at all, because that face is meant to be flush and dry.
  const wantPools = [mus.MUSEUM_DECK3, mus.MUSEUM_DECK2, mus.MUSEUM_DECK1, 0.4];
  const fallWings = [['west', mus.MUSEUM_GROUND_W, MU.fallW.x], ['east', mus.MUSEUM_GROUND_E, MU.fallE.x]];
  // still water is a merged prism set per level, drawn to a rounded outline; each declared pool
  // has to have a surface at its own level and a bottom under it
  const waterSpecs = p.curved.filter((c) => /^X\.water/.test(c.name));
  const stillWater = waterSpecs.flatMap((c) => c.parts.map((part) => {
    const xs = part.pts.map((q) => q[0]), zs = part.pts.map((q) => q[1]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, y0: c.y0, h: c.h, pts: part.pts };
  }));
  const beds = p.parts.filter((q) => q.color === 'basinBed');
  const falls = fallWings.map(([side, pl, cx]) => {
    const near = (q) => Math.abs(q.x - cx) < MU.fallE.w;
    const pools = stillWater.filter(near).map((b) => ({ y: b.y0 + b.h }))
      .concat(p.parts.filter((q) => q.color === 'basin' && near(q)).map((q) => ({ y: q.y })))
      .sort((a, b) => b.y - a.y);
    const sheets = p.parts.filter((q) => q.color === 'basinFall' && q.sy > 1.0 && near(q))
      .map((q) => ({ top: q.y + q.sy / 2, bot: q.y - q.sy / 2 })).sort((a, b) => b.top - a.top);
    const onDeck = wantPools.map((y) => pools.some((q) => Math.abs(q.y - y) < 0.35));
    const linked = sheets.length === 3 && sheets.every((sh, i) => Math.abs(sh.top - wantPools[i]) < 0.4 && Math.abs(sh.bot - wantPools[i + 1]) < 0.55);
    const low = pools.length ? Math.min(...pools.map((q) => q.y)) : 99;
    // a floor lies under each water surface: a pale bottom piece inside its outline, just under it
    const bedded = stillWater.filter(near).every((b) => beds.some((q) => insidePlan(q.x, q.z, b.pts) && Math.abs(q.y - (b.y0 - 0.05)) < 0.2));
    return {
      side, pools, sheets, low, levels: onDeck.filter(Boolean).length,
      area: Math.abs(polygonArea(pl)),
      ok: onDeck.every(Boolean) && linked && low < 0.6 && bedded && insidePlan(cx, MU.zb + 2, pl),
    };
  });
  // water on the street elevation, which there must be none of — the garden's own reflecting
  // pool is up on the roof, so anything at deck level is not what this is looking for
  const streetWater = [...p.parts.filter((q) => ['basin', 'basinFall'].includes(q.color)), ...stillWater.map((b) => ({ ...b, y: b.y0 }))]
    .filter((q) => q.z > MU.zb + 12 && q.x > MU.x0 && q.x < MU.x1 && q.y < mus.MUSEUM_DECK3 - 0.5);
  check('Museum', `${T} a cascade comes down each wing on the park face, every basin with a bottom under its water, and none of it on the street face: ${falls.map((r) => `${r.side} wing (${Math.round(r.area)} m²) ${r.levels}/${wantPools.length} levels, ${r.sheets.length} falls of ${r.sheets.map((q) => round(q.top - q.bot, 1)).join('/')} m ending at ${round(r.low, 2)} m`).join('; ')}; ${streetWater.length} pieces of water on the street half`,
    falls.every((r) => r.ok) && streetWater.length === 0,
    `${falls.map((r) => `${r.side}: ${r.pools.length} pools, ${r.sheets.length} falls`).join('; ')}; street ${streetWater.length}`);
  // and the street frontage carries planting the whole way along, with no bay cut out of it
  const frontageRun = grounds.GROUND_LAWNS.filter(([n]) => /museumSouth/.test(n));
  const frontageWidth = frontageRun.reduce((t, [, x0, x1]) => t + (x1 - x0), 0);
  check('Museum', `${T} the street frontage runs unbroken: ${frontageRun.length} strip of planting ${round(frontageWidth, 1)} m along the ${round(MU.x1 - MU.x0, 1)} m face, with no bay opened in it for water`,
    frontageRun.length === 1 && frontageWidth >= (MU.x1 - MU.x0) - 0.1,
    `${frontageRun.length} strips, ${round(frontageWidth, 1)} m`);

  // --- the receiving basins at the foot of the cascades ---------------------------------------
  // Each fall lands in a basin whose water can actually be seen: a pool like the others, with
  // its water below an open rim (not buried inside a solid block), drawn to the edge it sits
  // against, standing clear of every walk, the plaza's paving and the glass, with the falling
  // sheet dropping inside the water and the east basin, under the larger fall, the larger.
  const basinsM = mus.museumMoatBasins();
  const moatW = p.curved.find((c) => c.name === 'X.waterMoat'), moatR = p.curved.find((c) => c.name === 'X.copingMoat'), moatT = p.curved.find((c) => c.name === 'X.tileMoat');
  const groundGlass = ['X.groundW', 'X.groundE'].map((n) => offsetPlan(p.curved.find((c) => c.name === n).pts, 0.15));
  const basinRep = basinsM.map((b) => {
    const rim = b.outline(0);
    const blocked = rim.filter(([x, z]) => ped.onRoute(x, z) || ped.pavedAt(x, z) || Math.hypot(x - ped.FOUNTAIN_CENTRE[0], z - ped.FOUNTAIN_CENTRE[1]) < ped.PLAZA_R + 0.25
      || groundGlass.some((g) => insidePlan(x, z, g))).length;
    const sheet = p.parts.find((q) => q.color === 'basinFall' && q.sy > 1.0 && q.y < 3 && insidePlan(q.x, q.z, b.outline(-1)));
    // The open water's width all along it, read off the water's own outline: on a 4 cm grid,
    // each point inside takes its distance to the edge; beside each point of the outline, the
    // largest such distance within 0.7 m is half the local width. The widest is the largest of
    // those, and a channel of one width keeps the narrowest within 10 % of it.
    const [wx0, wx1, wz0, wz1] = [Math.min(...b.water.map((q) => q[0])), Math.max(...b.water.map((q) => q[0])), Math.min(...b.water.map((q) => q[1])), Math.max(...b.water.map((q) => q[1]))];
    const edgeDist = (x, z) => Math.min(...b.water.map((a, i) => { const c = b.water[(i + 1) % b.water.length], ex = c[0] - a[0], ez = c[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t); }));
    const cells = new Map();
    for (let x = wx0; x <= wx1; x += 0.04) for (let z = wz0; z <= wz1; z += 0.04) {
      if (!insidePlan(x, z, b.water)) continue;
      const key = `${Math.floor(x / 0.7)},${Math.floor(z / 0.7)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push([x, z, edgeDist(x, z)]);
    }
    const localW = b.water.map(([x, z]) => {
      let m = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of cells.get(`${Math.floor(x / 0.7) + i},${Math.floor(z / 0.7) + j}`) || []) if (Math.hypot(q[0] - x, q[1] - z) < 0.7) m = Math.max(m, q[2]);
      return 2 * m;
    });
    const inR = Math.max(...localW) / 2, meanW = Math.min(...localW);
    // and only on the park face: every rim point lies off a stretch of glass that faces north
    const g = p.curved.find((c) => c.name === (b.WB.x < 0 ? 'X.groundW' : 'X.groundE')).pts;
    const faceN = (x, z) => {
      let best = Infinity, nz = 0;
      g.forEach((a, i) => {
        const c = g[(i + 1) % g.length], ex = c[0] - a[0], ez = c[1] - a[1], L2 = ex * ex + ez * ez || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)), d = Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
        if (d < best) { best = d; const l = Math.sqrt(L2); const n1 = [ez / l, -ex / l]; nz = insidePlan(a[0] + ex * t + n1[0] * 0.05, a[1] + ez * t + n1[1] * 0.05, g) ? -n1[1] : n1[1]; }
      });
      return nz;
    };
    const offFace = rim.filter(([x, z]) => faceN(x, z) > -0.6).length;
    return { x: b.WB.x, area: Math.abs(polygonArea(b.water)), width: inR * 2, meanW, offFace, blocked, lands: !!sheet && insidePlan(sheet.x, sheet.z, b.water) && sheet.y - sheet.sy / 2 <= moatW.y0 + moatW.h + 0.01 };
  });
  const openWater = moatW && moatR && moatT && moatW.kind === 'pool' && moatW.glaze === core.GLAZE.water
    && moatW.y0 + moatW.h < moatR.y0 + moatR.h - 0.1 && moatW.y0 + moatW.h < moatT.y0 + moatT.h
    && !p.parts.some((q) => q.shape === 'box' && q.color === 'coping' && q.y - q.sy / 2 < 0.3 && basinsM.some((b) => insidePlan(q.x, q.z, b.water)));
  const eastW = basinRep.find((r) => r.x === MU.fallE.x), westW = basinRep.find((r) => r.x === MU.fallW.x);
  check('Museum', `${T} each cascade ends in a basin of open water: ${basinRep.map((r) => `${r.x < 0 ? 'west' : 'east'} ${round(r.area, 1)} m² of water ${round(r.width, 2)} m wide at its widest and ${round(r.meanW, 2)} m at its narrowest, ${r.offFace} rim points off the park face, ${r.blocked} on a walk, the plaza or the glass, fall ${r.lands ? 'lands in the water' : 'misses'}`).join('; ')}; water ${round((moatR?.y0 + moatR?.h) - (moatW?.y0 + moatW?.h), 2)} m below an open rim`,
    openWater && basinRep.every((r) => r.blocked === 0 && r.lands && r.offFace === 0 && r.meanW >= r.width * 0.9)
    && Math.abs(eastW.width - westW.width) < 0.05 && eastW.area > westW.area,
    basinRep.map((r) => `${r.x}: ${r.blocked} blocked, lands ${r.lands}`).join('; ') + `; open ${openWater}`);

  // --- the condo podium's screen ----------------------------------------------------------------
  // The wave screen wraps the podium without a gap: no break where a signage panel once stood
  // and nowhere the bare wall behind it shows through.
  const screenSpec = p.curved.find((c) => c.name === 'A.garageScreen');
  const screenBreaks = screenSpec?.waves?.breaks ?? [];
  check('Towers', `${T} the condo podium's wave screen runs unbroken all the way round: ${screenBreaks.length} gaps in it`,
    !!screenSpec && screenBreaks.length === 0, screenBreaks.map((b) => `(${round(b.x, 1)}, ${round(b.z, 1)}) ${b.width} m`).join(', '));

  // --- the museum in the build animation ------------------------------------------------------
  // It takes part in the construction drawing like every other building: its ground wings are
  // drawn in the site plan and its gallery floors dashed above them, its main volumes rise as
  // wireframes, and no parcel line is drawn through it.
  const risers = ['X.groundW', 'X.groundE', 'X.l2', 'X.l3', 'X.stair', 'X.lift'].map((n) => p.curved.find((c) => c.name === n));
  const samePts = (a, b) => a.length === b.length && a.every((q, i) => Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) < 1e-6);
  const drawn = (pts, layer) => p.paths.some((q) => q.layer === layer && samePts(q.pts, pts));
  const outlines2 = [drawn(mus.MUSEUM_GROUND_W, core.LAYER.footprint), drawn(mus.MUSEUM_GROUND_E, core.LAYER.footprint),
    drawn(mus.MUSEUM_L2_PLAN, core.LAYER.tower), drawn(mus.MUSEUM_L3_PLAN, core.LAYER.tower)];
  const through = p.paths.filter((q) => q.layer === core.LAYER.parcel).filter((q) => q.pts.some((a, i) => {
    const b = q.pts[i + 1];
    if (!b) return false;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (mus.MUSEUM_FOOTPRINTS.some((pl) => insidePlan(x, z, pl))) return true;
    }
    return false;
  }));
  check('Museum', `${T} the museum takes part in the build animation: ${risers.filter((c) => c?.wire !== false).length} of ${risers.length} main volumes rise as construction wireframes, ${outlines2.filter(Boolean).length} of 4 outlines drawn in the site plan (two ground wings solid, two gallery floors dashed), ${through.length} parcel lines through it`,
    risers.every((c) => c && c.wire !== false && c.floorH > 3) && outlines2.every(Boolean) && through.length === 0,
    `wire ${risers.map((c) => `${c?.name}:${c?.wire}`).join(', ')}; outlines ${outlines2.join(',')}; through ${through.length}`);

  // --- the curtain wall -----------------------------------------------------------------------
  // Seamless, floor-to-ceiling glass: every museum glass volume on the wide pane module, and the
  // glaze drawing each pane the full storey height with only a flush joint between panes — no
  // spandrel band, transom, fin or bay-to-bay tint.
  const museumGlass = p.curved.filter((c) => /^X\./.test(c.name) && c.glaze === core.GLAZE.museum);
  const glazeSrc = readFileSync(join(hero, 'layers', 'facade-glsl.js'), 'utf8');
  const museumBranch = glazeSrc.slice(glazeSrc.indexOf('if (glaze > 21.5 && glaze < 22.5)'), glazeSrc.indexOf('if (glaze > 20.5 && glaze < 21.5)')).replace(/\/\/.*$/gm, '');
  const fullHeight = /band\(y, botY \+ 0\.015, topY - 0\.015, aaY\)/.test(museumBranch) && !/tran|fin|tint =|0\.26|0\.34/.test(museumBranch);
  check('Museum', `${T} the curtain wall is seamless floor-to-ceiling glass: ${museumGlass.length} glass volumes on a ${round(mus.MUSEUM_PANE, 2)} m pane, each pane the full storey height with a flush joint and no spandrel, transom, fin or tint variation`,
    museumGlass.length >= 5 && museumGlass.every((c) => c.module[0] === mus.MUSEUM_PANE) && mus.MUSEUM_PANE >= 3.0 && fullHeight,
    `${museumGlass.map((c) => `${c.name}:${c.module[0]}`).join(', ')}; full height ${fullHeight}`);

  // Flush floor edges: every floor plate, slab band and the roof parapet stops at the glass —
  // no vertex of any of them more than 30 mm outside the glass of the storey it belongs to —
  // so the elevation reads as uninterrupted glass, not glass between projecting white ledges.
  const glassOf = (n) => p.curved.find((c) => c.name === n)?.pts ?? [];
  const edgeSets = [
    ['X.floorW', glassOf('X.groundW')], ['X.deck1W', glassOf('X.groundW')],
    ['X.floorE', glassOf('X.groundE')], ['X.deck1E', glassOf('X.groundE')],
    ['X.floor2', glassOf('X.l2')], ['X.deck2', glassOf('X.l2')], ['X.deck3', glassOf('X.l3')],
  ].map(([n, g]) => [n, glassOf(n), g]);
  const l2c = p.curved.find((c) => c.name === 'X.l2'), l3c = p.curved.find((c) => c.name === 'X.l3');
  edgeSets.push(['X.l2 band', l2c?.slabs?.floors?.[0]?.outer ?? [], l2c?.pts ?? []], ['X.l3 band', l3c?.slabs?.floors?.[0]?.outer ?? [], l3c?.pts ?? []],
    ['X.parapet', p.curved.find((c) => c.name === 'X.parapet')?.pts ?? [], l3c?.pts ?? []]);
  const plateProud = edgeSets.map(([n, pts, g]) => {
    const lim = offsetPlan(g, 0.03);
    return [n, pts.length, pts.filter(([x, z]) => !insidePlan(x, z, lim)).length];
  });
  check('Museum', `${T} the floor plates stop flush with the glass: ${plateProud.length} plates, slab bands and the parapet, ${plateProud.reduce((t, r) => t + r[2], 0)} vertices standing more than 30 mm proud of the glass (the edge ${round(mus.PLATE_EDGE, 3)} m in from the plan line and the glass 0.3 m, so 15 mm proud on the straight and 21 mm across a rounded corner)`,
    plateProud.every(([, n, bad]) => n > 0 && bad === 0) && mus.PLATE_EDGE < 0.3 - 0.012,
    plateProud.filter(([, n, bad]) => !n || bad).map(([nm, n, bad]) => `${nm} ${bad}/${n}`).join('; '));

  // --- the two lower roofs ------------------------------------------------------------------
  // The apron and the park terrace are grassed edge to edge and planted, with no railing on the
  // terrace. Measured against the plates themselves: the turf may not pass the edge of the plate
  // it lies on, every plant's full spread has to land on that plate and off the water, and what
  // the lawn leaves bare has to be only the pools, the weirs and the spouts.
  const plateOf = (name) => p.curved.find((c) => c.name === name)?.pts ?? [];
  // the storey above is where its own glass stands (the slab band at its foot is flush with it)
  const lowerPlates = [[mus.MUSEUM_DECK1, [plateOf('X.deck1W'), plateOf('X.deck1E')], MU.zb, plateOf('X.l2')], [mus.MUSEUM_DECK2, [plateOf('X.deck2')], MU.z3n, plateOf('X.l3')]];
  const onPlate = (plates, x, z) => plates.some((pl) => insidePlan(x, z, pl));
  const lawnSpecs = p.curved.filter((c) => /^X\.lawn/.test(c.name));
  const lows = mus.museumLowerRoofs();
  const roofRep = lowerPlates.map(([deck, plates, face, above], i) => {
    const lv = lows[i];
    const lawn = lawnSpecs.find((c) => Math.abs(c.y0 + 0.045 - deck) < 0.01);
    const parts = lawn ? lawn.parts : [];
    const overhang = parts.flatMap((q) => q.pts).filter(([x, z]) => !onPlate(plates, x, z)).length;
    // the free roof: on the plate with 0.2 m to spare, in front of the storey above (clear of its
    // slab band), and off every pool, weir and spout
    let free = 0, grassed = 0;
    for (let x = MU.x0 - 0.2; x <= MU.x1 + 0.2; x += 0.25) {
      for (let z = 9; z < face - 0.35; z += 0.25) {
        if (![[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].every(([u, v]) => onPlate(plates, x + u, z + v))) continue;
        if (lv.keeps.some((k) => x > k[0] - 0.1 && x < k[1] + 0.1 && z > k[2] - 0.1 && z < k[3] + 0.1)) continue;
        // the rounded corner of the storey above
        if ([MU.x0 + 2.15, MU.x1 - 2.15].some((cx) => (x < MU.x0 + 2.15 || x > MU.x1 - 2.15) && Math.hypot(x - cx, z - (face + 2.15)) < 2.6 && z > face - 0.35)) continue;
        free++;
        if (parts.some((q) => insidePlan(x, z, q.pts))) grassed++;
      }
    }
    const plants = p.parts.filter((q) => ['bush', 'cone'].includes(q.shape) && q.x > MU.x0 - 1 && q.x < MU.x1 + 1 && q.z < face + 0.5
      && Math.abs(q.y - q.sy / 2 - (deck + 0.04)) < 0.03);
    const water = p.curved.filter((c) => /^X\.water\d/.test(c.name) && Math.abs(c.y0 + c.h - (deck - 0.12)) < 0.01).flatMap((c) => c.parts.map((q) => q.pts));
    const pools = lv.pools;
    const loose = plants.filter((q) => {
      const r = Math.max(q.sx, q.sz) / 2;
      return Array.from({ length: 8 }, (_, k) => [q.x + Math.cos(k * Math.PI / 4) * r, q.z + Math.sin(k * Math.PI / 4) * r])
        .some(([x, z]) => !onPlate(plates, x, z) || insidePlan(x, z, above) || water.some((pl) => insidePlan(x, z, pl)));
    });
    const railing = p.parts.filter((q) => q.color === 'guardGlass' && q.x > MU.x0 - 1 && q.x < MU.x1 + 1 && q.z > MU.zn - 1 && q.z < MU.z1 && Math.abs(q.y - q.sy / 2 - deck) < 0.3);
    return { deck, parts: parts.length, overhang, cover: free ? grassed / free : 0, plants: plants.length, loose: loose.length, railing: railing.length, keeps: lv.keeps.length, nPools: pools.length };
  });
  check('Museum', `${T} the apron and the park terrace are grassed and planted edge to edge with no railing: ${roofRep.map((r) => `${round(r.deck, 2)} m roof ${Math.round(r.cover * 100)} % of its free area in lawn (${r.parts} pieces, ${r.overhang} vertices past the plate), ${r.plants} plants, ${r.loose} reaching past the roof or over water, ${r.railing} railing panels`).join('; ')}`,
    roofRep.every((r) => r.cover >= 0.97 && r.overhang === 0 && r.plants >= (tier.name === 'mobile' ? 12 : 25) && r.loose === 0 && r.railing === 0 && r.keeps === r.nPools + 4),
    roofRep.map((r) => `${round(r.deck, 2)}: ${Math.round(r.cover * 100)} %, ${r.overhang} over, ${r.loose} loose, ${r.railing} rail, ${r.keeps} keeps`).join('; '));

  // The museum's water is the model's pool water: the same palette entry, the same glaze, the
  // same tile band and coping as plan/pools.js builds for the resort, hotel and penthouse pools,
  // and the moving water in the same blue family (the pool blue, or the lighter shallow-water blue
  // the other pools use for their shelves, which reads as water on the move). The glaze itself is checked to carry no
  // view-dependent term on water, so no pool changes colour as the camera moves round it.
  const museumWaterSpecs = p.curved.filter((c) => /^X\.water/.test(c.name));
  const tiled = [mus.MUSEUM_DECK1, mus.MUSEUM_DECK2, mus.MUSEUM_DECK3].every((d) => p.curved.some((c) => /^X\.tile/.test(c.name) && c.kind === 'poolTile' && Math.abs(c.y0 + c.h - (d - 0.03)) < 0.01)
    && p.curved.some((c) => /^X\.coping/.test(c.name) && c.kind === 'coping' && Math.abs(c.y0 + c.h - (d + 0.08)) < 0.01));
  const glslSrc = readFileSync(join(hero, 'layers', 'facade-glsl.js'), 'utf8');
  const flatWater = /float sheen = glass;/.test(glslSrc) && /if \(water > 0\.5\) \{ material\.specularColor = vec3\(0\.0\); material\.specularF90 = 0\.0; \}/.test(glslSrc)
    && /radiance \*= [^;]*\(1\.0 - water\);/.test(glslSrc);
  const otherPool = p.curved.find((c) => c.kind === 'pool' && !/^X\./.test(c.name));
  check('Museum', `${T} the museum's water is the same as every other pool's: ${museumWaterSpecs.length} surfaces all on the '${otherPool?.kind}' blue and the water glaze like ${otherPool?.name}, water 120 mm under the deck inside a tile band and coping at every level, moving water in the pools' own blues (${hex('basinFall')}, the ${hex('basinFall') === hex('shelf') ? 'shelf' : 'pool'} blue), and a water glaze that is lit the same from every angle`,
    museumWaterSpecs.length >= 4 && museumWaterSpecs.every((c) => c.kind === otherPool?.kind && c.glaze === otherPool?.glaze)
    && museumWaterSpecs.filter((c) => c.name !== 'X.waterMoat').every((c) => [mus.MUSEUM_DECK1, mus.MUSEUM_DECK2, mus.MUSEUM_DECK3].some((d) => Math.abs(c.y0 + c.h - (d - 0.12)) < 0.01))
    && tiled && [hex('pool'), hex('shelf')].includes(hex('basinFall')) && !p.parts.some((q) => q.color === 'basin') && flatWater,
    `${museumWaterSpecs.map((c) => `${c.name}:${c.kind}`).join(', ')}; tiled ${tiled}; flat ${flatWater}`);

  // --- shrubs off the paving -----------------------------------------------------------------
  // Every shrub at grade inside the block keeps its whole spread (90 % of its radius, the
  // crown's taper) off the walks and sidewalks, off the café terraces, and out from under
  // the café umbrellas; and no raised planting bed runs onto a café terrace. The street planters
  // on the public sidewalk outside the block are meant to stand in the paving and are not counted.
  const cafesZ = ped.FURNISHING.filter((f) => f.kind === 'cafe');
  const inCafe = (x, z) => cafesZ.some((f) => x > f.rect[0] && x < f.rect[1] && z > f.rect[2] && z < f.rect[3]);
  const umbrellasZ = (p.meta.poles || []).filter((q) => q.umbrella);
  const groundShrubs = p.parts.filter((q) => ['bush', 'cone'].includes(q.shape) && q.y - q.sy / 2 < 0.6 && Math.abs(q.x) < core.HX && Math.abs(q.z) < core.HZ);
  const onPaving = groundShrubs.filter((q) => {
    const rx = q.sx / 2 * 0.9, rz = q.sz / 2 * 0.9;   // the crown's own footprint, an ellipse
    return [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * rx, Math.sin(k * Math.PI / 4) * rz])]
      .some(([u, v]) => ped.pavedAt(q.x + u, q.z + v) || ped.onRoute(q.x + u, q.z + v) || inCafe(q.x + u, q.z + v))
      || umbrellasZ.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < Math.max(rx, rz) + m.r);
  });
  const bedsOnCafe = (p.curved.find((c) => c.name === 'P.beds')?.parts ?? []).filter((b) => b.pts.some(([x, z]) => inCafe(x, z)));
  // nor over a driveway: the hotel's arrival drive is edged by a planted island, not a hedge on the asphalt
  const drives = p.boxes.filter((b) => b.kind === 'drive').map((b) => [b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2]);
  const onDrive = groundShrubs.filter((q) => {
    const rx = q.sx / 2 * 0.9, rz = q.sz / 2 * 0.9;
    return drives.some((d) => q.x + rx > d[0] && q.x - rx < d[1] && q.z + rz > d[2] && q.z - rz < d[3]);
  });
  // and every shrub stands wholly in planting — a lawn, a bed or a planter's soil — never on the
  // block's paving, over a bed's edge or into a wall
  const greenZ = p.curved.filter((c) => ['lawn', 'bed'].includes(c.kind) && c.y0 < 0.6 && !/^X\./.test(c.name)).flatMap((c) => (c.type === 'prisms' ? c.parts.map((q) => q.pts) : [c.pts]));
  const soilZ = p.parts.filter((q) => q.shape === 'box' && q.color === 'planter' && q.y < 1.2);
  const onGreenZ = (x, z) => greenZ.some((pl) => insidePlan(x, z, pl)) || soilZ.some((b) => Math.abs(b.x - x) <= b.sx / 2 + 0.02 && Math.abs(b.z - z) <= b.sz / 2 + 0.02);
  const offGreen = groundShrubs.filter((q) => {
    const rx = q.sx / 2 * 0.9, rz = q.sz / 2 * 0.9;   // the crown's own footprint, an ellipse
    return [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4) * rx, Math.sin(k * Math.PI / 4) * rz])]
      .some(([u, v]) => !onGreenZ(q.x + u, q.z + v));
  });
  check('Landscape', `${T} no shrub at grade stands on a walk, a sidewalk or a café terrace, or under a café umbrella: ${onPaving.length} of ${groundShrubs.length} shrubs overlap, ${onDrive.length} stand over a driveway (${drives.length} checked), ${bedsOnCafe.length} planting beds run onto a terrace; ${groundShrubs.length - offGreen.length} of ${groundShrubs.length} stand wholly in a lawn, bed or planter`,
    onPaving.length === 0 && onDrive.length === 0 && drives.length > 0 && bedsOnCafe.length === 0 && offGreen.length === 0,
    [...onPaving, ...onDrive, ...offGreen].slice(0, 6).map((q) => `${q.color} (${round(q.x, 1)}, ${round(q.z, 1)})`).join('; '));

  // --- the park's edge against the hotel -----------------------------------------------------
  // The Deco tower stands 2.4 m proud of the wing, so a lawn boundary set 1 m off the wing's
  // face ran the sector lawns and their 0.34 m beds under the tower and across the guest
  // entrance forecourt. The boundary now follows the tower's curved corner and steps back for
  // the forecourt. Grass still runs under the path edges, which is deliberate: the paving sits
  // 80 mm higher, so the lawn is hidden and no bare sliver shows where the two meet.
  const parkGreen = ['P.lawns', 'P.beds'].map((n) => cv[n].parts.map((q) => q.pts));
  const coveredBy = (polys, x, z) => polys.some((pl) => insidePlan(x, z, pl));
  const hotelCourt = ped.ENTRANCES.find((e) => e.id === 'E-HOTEL').poly;
  const hotelSolid = [hotel.HOTEL.tower, hotel.HOTEL.front];
  let underHotel = 0, bedsOnCourt = 0;
  for (let x = 4; x <= 26; x += 0.2) for (let z = -12; z <= 2; z += 0.2) {
    const lawn = coveredBy(parkGreen[0], x, z), bed = coveredBy(parkGreen[1], x, z);
    if ((lawn || bed) && hotelSolid.some((pl) => insidePlan(x, z, pl))) underHotel++;
    if (insidePlan(x, z, hotelCourt)) { if (bed) bedsOnCourt++; }
  }
  check('Park', `${T} the park's planting stops at the hotel: no lawn or bed under the tower or the wing, and nothing standing on the guest entrance forecourt`,
    underHotel === 0 && bedsOnCourt === 0,
    `${underHotel} under the hotel, ${bedsOnCourt} beds on the forecourt`);

  const mouths = park.PLAZA_LINKS.map((l) => l.route);
  check('Circulation', `${T} the plaza is entered from exactly four directions, each of them a primary route mouth (${mouths.join(', ')})`,
    park.PLAZA_LINKS.length === 4 && mouths.every((id) => ped.ROUTES.find((r) => r.id === id)?.type === 'primary'));

  // --- park structures --------------------------------------------------------------------
  // The market hall and the promenade pavilion were removed when the art museum was grown over
  // their ground, and the paseo colonnade was then removed too, so its lawn could be planted as
  // a garden: nothing of the old park structures (group M) is left in the plan, and no column
  // or roof stands on the paseo lawn.
  const PASEO_R = grounds.GROUND_LAWNS.find(([n]) => n === 'G.paseoW').slice(1);
  const inPaseoR = (x, z) => x > PASEO_R[0] && x < PASEO_R[1] && z > PASEO_R[2] && z < PASEO_R[3];
  const mLeft = [...p.boxes.filter((b) => b.name.startsWith('M.')), ...p.curved.filter((c) => c.name.startsWith('M.'))].map((b) => b.name);
  const lightPoles = (p.meta.poles || []).filter((q) => !q.umbrella && !q.bench && !q.bike);
  const paseoBuilt = p.parts.filter((q) => inPaseoR(q.x, q.z) && ['frame', 'lamp'].includes(q.color) && q.y > 1.5
    && !lightPoles.some((l) => Math.hypot(l.x - q.x, l.z - q.z) < 0.6));   // the walks' own lights stay
  check('Pavilions', `${T} the park structures are gone — the market hall, the promenade pavilion and the paseo colonnade: ${mLeft.length} of their volumes and ${paseoBuilt.length} columns or roof pieces left on the paseo lawn`,
    mLeft.length === 0 && paseoBuilt.length === 0, `${mLeft.join(', ')}; ${paseoBuilt.length} pieces`);

  // The paseo garden: the lawn the colonnade stood on is planted densely. Measured on a 0.25 m
  // grid over the lawn as laid: the share of it under a tree canopy, a palm crown or a shrub.
  {
    const lawnPts = p.curved.find((c) => c.name === 'G.lawns').parts.find((q) => q.owner === 'G.paseoW').pts;
    const cans = [...p.trees.map(planting.canopyOf), ...p.palms.map((t) => ({ x: t.x, z: t.z, r: t.r }))];
    const shr = p.parts.filter((q) => ['bush', 'cone'].includes(q.shape) && q.y < 3 && inPaseoR(q.x, q.z));
    let n = 0, c = 0;
    for (let x = PASEO_R[0]; x <= PASEO_R[1]; x += 0.25) for (let z = PASEO_R[2]; z <= PASEO_R[3]; z += 0.25) {
      if (!insidePlan(x, z, lawnPts)) continue;
      n++;
      if (cans.some((k) => Math.hypot(k.x - x, k.z - z) < k.r) || shr.some((q) => ((q.x - x) / (q.sx / 2)) ** 2 + ((q.z - z) / (q.sz / 2)) ** 2 < 1)) c++;
    }
    const cover = n ? c / n : 0;
    const pTrees = p.trees.filter((t) => inPaseoR(t.x, t.z)).length, pPalms = p.palms.filter((t) => inPaseoR(t.x, t.z)).length;
    check('Landscape', `${T} the paseo is a dense garden: ${Math.round(cover * 100)} % of its lawn under a canopy, a palm crown or a shrub (24.7 % desktop / 19.4 % mobile before), with ${pTrees} trees, ${pPalms} palms and ${shr.length} shrubs`,
      cover >= (tier.name === 'mobile' ? 0.42 : 0.55) && pTrees >= (tier.name === 'mobile' ? 8 : 14), `${Math.round(cover * 100)} %`);
  }

  // --- the hotel's west end and the plaza -------------------------------------------------
  const gapTo = (poly) => Math.min(...poly.map(([x, z]) => Math.hypot(x - ped.FOUNTAIN_CENTRE[0], z - ped.FOUNTAIN_CENTRE[1]))) - ped.PLAZA_R;
  const wallGap = Math.min(gapTo(hotel.HOTEL.front), gapTo(hotel.HOTEL.tower));
  const eaveGap = Math.min(gapTo(offsetPlan(hotel.HOTEL.front, 1.8)), gapTo(offsetPlan(hotel.HOTEL.tower, 1.8)), gapTo(cv['B.canopy'].pts));
  check('Hotel', `${T} the plaza wing, the tower and the entrance marquee keep ≥ 2 m clear of the fountain plaza and do not oversail the paving`,
    wallGap >= 2.0 && eaveGap > 0, `wall ${round(wallGap, 2)} m, eave ${round(eaveGap, 2)} m`);

  // --- the Deco tower on the corner nearest the park ---------------------------------------
  const volumes = { tower: hotel.HOTEL.tower, front: hotel.HOTEL.front, rear: hotel.HOTEL.rear, link: hotel.HOTEL.link };
  const nearest = Object.entries(volumes).map(([k, pl]) => [k, gapTo(pl)]).sort((a, b) => a[1] - b[1])[0][0];
  const heights = { tower: hotel.HOTEL_TOWER_TOP, front: hotel.HOTEL_FRONT_TOP, rear: hotel.HOTEL_WING_TOP, link: hotel.HOTEL_WING_TOP };
  check('Hotel', `${T} the Deco tower stands on the corner nearest the fountain and is the hotel's tallest volume (${round(heights.tower, 1)} m over the wing's ${round(heights.front, 1)} m)`,
    nearest === 'tower' && heights.tower > Math.max(heights.front, heights.rear, heights.link), `nearest volume: ${nearest}`);
  // no two hotel facades may share a plane: the tower is set in from the wing on the faces
  // they have in common and stands proud of it on the plaza
  const bb = (pl) => { const xs = pl.map((q) => q[0]), zs = pl.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; };
  const tb = bb(hotel.HOTEL.tower), fb = bb(hotel.HOTEL.front);
  check('Hotel', `${T} the tower shares no facade plane with the wing: set in ${round(tb[0] - fb[0], 2)} m on the west and ${round(tb[2] - fb[2], 2)} m on the north, and ${round(tb[3] - fb[3], 2)} m proud on the plaza`,
    tb[0] - fb[0] >= 0.25 && tb[2] - fb[2] >= 0.25 && tb[3] - fb[3] >= 1.0);
  // the guest entrance, its marquee and its forecourt belong to the tower, not the wing
  const door = ped.NODES.hotelMain.at;
  const forecourt = ped.ENTRANCES.find((e) => e.id === 'E-HOTEL').poly;
  const underTower = door[0] > tb[0] && door[0] < tb[1] && Math.abs(door[1] - tb[3]) < 0.3;
  check('Hotel', `${T} the guest entrance and its forecourt sit at the tower's base on the plaza face, with vehicle arrival still on the east court`,
    underTower && forecourt.every(([x]) => x > tb[0] && x < tb[1] + 1) && ped.NODES.hotelArrival.at[0] > 60,
    `door (${round(door[0])}, ${round(door[1])})`);
  // rooftop pieces must stand behind the facade they sit on, not oversail it
  const roofTops = [['B.lounge', cv['B.lounge'].pts], ['B.loungeRoof', cv['B.loungeRoof'].pts], ['L.hroof', corners(rectOf(byName['L.hroof']))]];
  const oversail = roofTops.filter(([, pts]) => Math.max(...pts.map((q) => q[1])) > fb[3] - 0.3).map(([n]) => n);
  check('Hotel', `${T} the rooftop lounge, its roof and the terrace paving stand behind the wing's plaza facade`, oversail.length === 0, oversail.join(' '));

  // --- one guest route from both front doors ------------------------------------------------
  // The old assertion only proved that room rectangles touched along a line; it happened to
  // run through the dining rooms and straight across the tower's solid lift core, and it
  // claimed a 50 m sightline nothing in the model supports. It is replaced by a route test:
  // an explicit passage from each entrance to the reception desk and the lift door, wide
  // enough, inside guest rooms the whole way, and clear of the core and the seating.
  const rooms = Object.fromEntries(hotel.HOTEL_GROUND.map((r) => [r.name, r.rect]));
  const GR = hotel.GUEST_ROUTE, half = GR.width / 2;
  const guestRooms = hotel.HOTEL_GROUND.filter((r) => r.zone !== 'service' && !r.outdoor).map((r) => r.rect);
  const liftCore = rooms['Guest elevators (tower)'], dining = hotel.DINING_BAND;
  const svcRects = hotel.HOTEL_GROUND.filter((r) => r.zone === 'service').map((r) => r.rect);
  const samples = (line) => {
    const out = [];
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
      for (let k = 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    return out;
  };
  // offsets taken perpendicular to the direction of travel: a passage needs clear width
  // beside it, not a halo of clearance past its ends
  const routeBand = (line) => {
    const out = [];
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      const n = Math.max(1, Math.ceil(len / 0.4));
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        out.push([x, z], [x + nx * half, z + nz * half], [x - nx * half, z - nz * half]);
      }
    }
    return out;
  };
  const routeIssues = [];
  for (const [name, line] of [['park entrance', GR.fromPark], ['east arrival court', GR.fromCourt]]) {
    const pts = routeBand(line);
    if (pts.some(([x, z]) => inRect(x, z, liftCore, -0.05))) routeIssues.push(`${name}: crosses the lift core`);
    if (pts.some(([x, z]) => inRect(x, z, dining, -0.05))) routeIssues.push(`${name}: crosses the seating band`);
    if (pts.some(([x, z]) => svcRects.some((r) => inRect(x, z, r, -0.05)))) routeIssues.push(`${name}: enters a service room`);
    if (!samples(line).every(([x, z]) => guestRooms.some((r) => inRect(x, z, r, 0.4)) || inRect(x, z, rooms['Porte-cochère'], 0.4))) routeIssues.push(`${name}: leaves guest space`);
    const end = line[line.length - 1];
    if (Math.hypot(end[0] - hotel.RECEPTION[0], end[1] - hotel.RECEPTION[1]) > 0.1) routeIssues.push(`${name}: does not end at reception`);
  }
  const liftReach = Math.min(...samples(GR.fromPark).concat(samples(GR.fromCourt)).map(([x, z]) => Math.hypot(x - hotel.LIFT_DOOR[0], z - hotel.LIFT_DOOR[1])));
  check('Hotel', `${T} both front doors reach the same reception desk and lift door on a ${GR.width} m clear passage, clear of the lift core, the seating band and every service room`,
    routeIssues.length === 0 && GR.width >= 2.4 && GR.width <= 3.0 && liftReach <= half + 0.6, routeIssues.slice(0, 3).join('; ') || `lift door ${round(liftReach, 2)} m off the passage`);
  // the seating has to fit in what is left
  const seatDepth = dining[3] - dining[2];
  check('Hotel', `${T} indoor seating fits between the passage and the glazing (${round(seatDepth, 1)} m deep, ${round(dining[1] - dining[0], 0)} m long) without occupying the route`,
    seatDepth >= 2.4 && !routeBand(GR.fromCourt).some(([x, z]) => inRect(x, z, dining, -0.05)));

  // --- facade set out on the room bay, not beside it ------------------------------------------
  const towerLines = hotel.bayLines(hotel.HOTEL.tower, hotel.TOWER_FACE.z, hotel.TOWER_FACE.x0, hotel.TOWER_FACE.x1);
  const wingLines = hotel.bayLines(hotel.HOTEL.front, -7.6, hotel.WING_BAY.x0, hotel.WING_BAY.x1);
  const facadePiers = p.parts.filter((q) => q.color === 'stucco' && q.shape === 'box' && q.sz < 0.45 && q.sy > 3 && q.z < -4.8 && q.z > -8.2 && q.x > 10 && q.x < 53);
  const offLine = facadePiers.filter((q) => Math.min(...[...towerLines, ...wingLines].map((x) => Math.abs(q.x - x))) > 0.6);
  check('Hotel', `${T} every modelled pier and fin stands on a real window line: the shader's ${hotel.FACADE_BAY} m bay and the plan's room module are now the same number (${towerLines.length} tower lines, ${wingLines.length} wing lines, ${facadePiers.length} elements)`,
    offLine.length === 0 && towerLines.length >= 2 && wingLines.length >= 5, offLine.slice(0, 4).map((q) => round(q.x, 2)).join(' '));

  // --- the crown --------------------------------------------------------------------------
  // The former check enforced a single broad cap at 44-46 m, which is what flattened the
  // tower. It is replaced by checks on the stepped composition: the stages stack in order on
  // one another, each footprint is plainly smaller than the one below, and none of them is
  // an occupied floor.
  const stages = ['B.shoulder', 'B.crown1', 'B.crown2', 'B.lantern'];
  const areas = stages.map((n) => Math.abs(polygonArea(cv[n].pts)));
  const tops = stages.map((n) => cTop[n]);
  const parents = stages.map((n) => cv[n].parent);
  const crownTop = cTop['B.lantern'] + hotel.CROWN.lantern.cap;
  const shrinking = areas.every((a, i) => i === 0 || a < areas[i - 1] - 4);
  const stacked = parents[0] === 'B.tower' && parents.slice(1).every((pn, i) => pn === stages[i]);
  const rising = tops.every((t, i) => i === 0 || t > tops[i - 1]);
  check('Hotel', `${T} the tower carries a stepped crown: shoulders then ${stages.length - 1} progressively smaller stages to ${round(crownTop, 1)} m (was one 45.0 m screened cap over a 40.2 m roof), each stage ${areas.map((a) => Math.round(a)).join(' → ')} m²`,
    crownTop >= 47 && crownTop <= 49 && shrinking && stacked && rising && !cv['B.spire'] && !cv['B.crown'],
    `${round(crownTop, 1)} m, shrinking ${shrinking}, stacked ${stacked}`);
  check('Hotel', `${T} the crown is architecture, not extra floors: no stage is an occupied storey, and the plant is concealed in the louvred first stage`,
    stages.every((n) => cTop[n] - (cv[n].parent ? cTop[cv[n].parent] : 0) < 3.0) && cv['B.crown1'].glaze === core.GLAZE.screen);

  // --- the pool court's wall on the paseo ---------------------------------------------------
  // The open side of the U is now closed by a garden wall. The checks are on what that has to
  // do to be acceptable: close the court end to end, hide the pool, stay a single leaf of
  // masonry rather than the service bar coming back, and never present a bare face to either
  // side. What it is NOT checked for: construction, footings, lateral support and barrier
  // compliance are not designed here.
  const CW = hotel.COURT_WALL;
  const ct = CW.thick / 2;
  const svcGone = ['B.svcLink', 'B.svcSpur'].filter((n) => byName[n]);
  const wallParts = p.parts.filter((q) => Math.abs(q.x - CW.x) < 1.4 && q.z > CW.z0 - 0.5 && q.z < CW.z1 + 0.5);
  const cmasonry = wallParts.filter((q) => q.color === 'stucco');
  check('Hotel', `${T} the west service bar has not come back: the wall is one ${round(CW.thick, 2)} m leaf of masonry with nothing occupied above or behind it`,
    svcGone.length === 0 && !hotel.SERVICE_LINK && CW.thick <= 0.6 && cmasonry.every((q) => q.y + q.sy / 2 <= CW.h + 0.5),
    svcGone.join(' '));
  // closed end to end: every 0.25 m of the run is backed by masonry (the gate by its lintel),
  // and each return laps into the wing face it dies against
  const wz = [];
  for (let z = CW.z0 + 0.1; z <= CW.z1 - 0.1; z += 0.25) wz.push(z);
  const unbacked = wz.filter((z) => !cmasonry.some((q) => q.z - q.sz / 2 <= z && q.z + q.sz / 2 >= z && q.y + q.sy / 2 >= 4.0));
  // inline: the wall stands in the same plane as the two wing ends, and nothing belonging to
  // the court — deck, planting bed, cabana — stands proud of it on the public side
  const westFace = (pl) => Math.min(...pl.map((q) => q[0]));
  const inline = Math.abs(westFace(hotel.HOTEL.front) - CW.x) < 0.01 && Math.abs(westFace(hotel.HOTEL.rear) - CW.x) < 0.01;
  const lapped = CW.z1 >= -19.5 && CW.z0 <= -39.5;
  const spanOf = (q) => q.sx ?? q.w ?? 0;
  const courtStuff = [...p.parts, ...p.boxes].filter((q) => q.z > CW.z0 && q.z < CW.z1 && q.x - spanOf(q) / 2 > CW.x + ct - 0.01);
  const proud = courtStuff.filter((q) => q.x - spanOf(q) / 2 < CW.x - ct - 0.01);
  check('Hotel', `${T} the wall closes the open side of the U inline with it: ${round(CW.z1 - CW.z0, 1)} m in the same plane as both wing ends (x = ${round(CW.x, 1)}), lapped into each corner, with no break but the ${round(CW.gate[1] - CW.gate[0], 1)} m gate`,
    unbacked.length === 0 && inline && lapped,
    `${unbacked.length} unbacked samples, inline ${inline}`);
  check('Hotel', `${T} nothing of the pool court stands proud of that plane: the deck now stops on x = ${round(hotel.HOTEL_POOL.court[0], 1)} with the wings`,
    proud.length === 0 && Math.abs(hotel.HOTEL_POOL.court[0] - CW.x) < 0.01,
    proud.slice(0, 4).map((q) => `${q.name || q.shape} at ${round(q.x, 2)}`).join(' '));
  // sight line from the paseo: eye 1.6 m at the spine, over the coping, to the near deck edge
  const wallTop = Math.max(...wallParts.filter((q) => q.color === 'stone').map((q) => q.y + q.sy / 2));
  const eyeX = -8, eyeY = 1.6, poolX = Math.min(...hotel.HOTEL_POOL.outline.map((q) => q[0]));
  const visibleAt = eyeY + ((wallTop - eyeY) / (CW.x - eyeX)) * (poolX - eyeX) - hotel.HOTEL_POOL.deckY;
  check('Hotel', `${T} it hides the pool: coping at ${round(wallTop, 2)} m, so from the paseo nothing below ${round(visibleAt, 1)} m above the deck is on view at the pool's near edge`,
    wallTop >= 4.8 && visibleAt >= 5.0, `top ${round(wallTop, 2)} m, ${round(visibleAt, 1)} m`);
  // both faces planted, and a mask standing in front of the paseo face
  const vineX = [-1, 1].map((d) => CW.x + d * (ct + hotel.COURT_VINES.depth / 2));
  const cvines = vineX.map((fx) => p.parts.filter((q) => q.shape === 'bush' && Math.abs(q.x - fx) < 0.03 && q.z > CW.z0 - 0.5 && q.z < CW.z1 + 0.5));
  const reachesCoping = cvines.flat().length > 0 && cvines.flat().every((q) => q.y + q.sy / 2 >= CW.h);
  const inBand = (q) => q.x > -5.6 && q.x < CW.x - ct - 0.05 && q.z > CW.z0 - 0.6 && q.z < CW.z1 + 0.6;
  const cmask = [...p.trees, ...p.palms].filter(inBand);
  const cbank = p.parts.filter((q) => q.shape === 'bush' && inBand(q) && Math.abs(q.x - vineX[0]) > 0.1);
  const cbankTop = cbank.length ? Math.max(...cbank.map((q) => q.y + q.sy / 2)) : 0;
  check('Hotel', `${T} neither side sees bare masonry: vines hang from the coping down both faces (${cvines[1].length} court side, ${cvines[0].length} paseo side)`,
    cvines.every((v) => v.length >= 8) && reachesCoping, `${cvines.map((v) => v.length).join(' / ')}`);
  check('Hotel', `${T} the paseo face is masked by planting standing in front of it: ${cmask.length} trees and palms and ${cbank.length} shrubs to ${round(cbankTop, 1)} m, in the ${round(CW.x - ct - 0.05 - -5.6, 1)} m strip between the walk and the wall and separate from the vines on the face itself`,
    cmask.length >= 6 && cbank.length >= 12 && cbankTop >= 2.4, `${cmask.length} trees/palms, ${cbank.length} shrubs`);
  check('Hotel', `${T} the wall stays off the public walk and within the two wings' own faces`,
    !wallParts.some((q) => ped.onRoute(q.x, q.z, 0.25)) && CW.z1 <= -19.0 && CW.z0 >= -40.5, `z ${CW.z0} to ${CW.z1}`);

  // --- service doors sit on a facade line ----------------------------------------------
  const hotelPlans = [hotel.HOTEL.front, hotel.HOTEL.tower, hotel.HOTEL.rear, hotel.HOTEL.link];
  const liftCoreRect = hotel.HOTEL_GROUND.find((r) => r.core === 'guest' && r.name.includes('tower')).rect;
  const facades = [offsetPlan(res.PODIUM_PLAN, -core.ARCADE), ...hotelPlans, mus.MUSEUM_GROUND_W, mus.MUSEUM_GROUND_E,
    core.rect(liftCoreRect[0], liftCoreRect[2], liftCoreRect[1], liftCoreRect[3]),
    ...['C.baseE', 'C.baseW', 'C.lobby'].map((n) => core.rect(...[rectOf(byName[n])].map((r) => [r[0], r[2], r[1], r[3]])[0]))];
  const distToEdges = (x, z, poly) => { let best = Infinity; for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]; const ex = bx - ax, ez = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1))); best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return best; };
  const floatingDoors = p.parts.filter((q) => q.color === 'void' && !partCorners(q).every(([x, z]) => facades.some((f) => distToEdges(x, z, f) < 0.45))).map((q) => `(${round(q.x)}, ${round(q.z)})`);
  check('Ground', `${T} service and garage doors sit on a facade (no floating door panels)`, floatingDoors.length === 0, floatingDoors.join(' '));

  // --- ground: planting, cars, umbrellas clear of buildings -------------------------------
  const inBuilding = (x, z, pad) => insidePlan(x, z, offsetPlan(res.PODIUM_PLAN, pad)) || hotelPlans.some((pl) => insidePlan(x, z, offsetPlan(pl, pad)))
    || ['B.poolbar', 'C.baseE', 'C.baseW', 'C.lobby'].some((n) => inRect(x, z, rectOf(byName[n]), pad))
    || mus.MUSEUM_FOOTPRINTS.some((pl) => insidePlan(x, z, offsetPlan(pl, pad)));
  const groundPlanting = [...p.trees, ...p.palms.filter((q) => !q.deck)];
  const badPlanting = groundPlanting.filter((t) => t.y === 0 && inBuilding(t.x, t.z, 0.8)).length;
  check('Ground', `${T} ground planting clear of buildings`, badPlanting === 0, `${badPlanting}`);
  check('Ground', `${T} no trees on tower or hotel roofs`, [...p.trees, ...p.palms].every((t) => t.y < 1.2 || t.deck), [...p.trees, ...p.palms].filter((t) => !(t.y < 1.2 || t.deck)).map((t) => `(${round(t.x)}, ${round(t.y)}, ${round(t.z)})`).join(' '));
  const badCars = p.cars.filter((c) => inBuilding(c.x, c.z, 0.5)).length;
  check('Ground', `${T} cars clear of buildings`, badCars === 0, `${badCars}`);

  // --- street traffic: the travelling cars circulate on the street ring's two lane loops ----
  // Each loop is the curb's rounded rectangle pushed out into the carriageway, so it holds the
  // street round the corners; the two run opposite ways and never cross, and every car in a
  // loop moves at one speed, so the spacing checked here is the spacing it keeps.
  const tl = traffic.TRAFFIC_LANES, loops = Object.values(tl), STREET_W = 2 * core.HALF_ROAD;
  const movers = p.cars.filter((c) => c.lane).map((c) => {
    const L = tl[c.lane], pr = traffic.laneProject(L, c.x, c.z), ps = traffic.lanePose(L, pr.s);
    return { L, along: ((pr.s * L.dir) % L.length + L.length) % L.length, off: pr.off, turn: Math.abs(Math.atan2(Math.sin(ps.rot - c.rot), Math.cos(ps.rot - c.rot))) };
  });
  const loopGap = Math.min(...loops.map((L) => {
    const ss = movers.filter((o) => o.L === L).map((o) => o.along).sort((a, b) => a - b);
    return ss.length < 2 ? Infinity : Math.min(...ss.map((s, i) => (i ? s - ss[i - 1] : s + L.length - ss[ss.length - 1])));
  }));
  const parkedOff = Math.min(...p.cars.filter((c) => c.parked).map((c) => Math.min(...loops.map((L) => traffic.laneProject(L, c.x, c.z).off))));
  check('Traffic', `${T} ${movers.length} travelling cars circulate on two closed lane loops round the block (${loops.map((L) => `${round(L.length)} m`).join(' / ')}) inside the ${STREET_W} m carriageway, in opposite directions and never crossing: each starts on its loop facing along it, cars in a loop stay ≥ ${round(loopGap, 1)} m apart, parked cars stand ≥ ${round(parkedOff, 1)} m off both loops`,
    movers.length === tier.cars && movers.every((o) => o.off < 0.05 && o.turn < 0.02)
    && loops.every((L) => L.offset >= 1.4 && L.offset <= STREET_W - 1.4) && tl.inner.dir === -tl.outer.dir && tl.outer.offset - tl.inner.offset >= 3.3
    && loopGap >= 9 && parkedOff >= 2.5,
    `worst ${round(Math.max(...movers.map((o) => o.off)), 3)} m off a loop, ${round(Math.max(...movers.map((o) => o.turn)) * 180 / Math.PI, 1)}° off its heading`);
  const walkRing = p.curved.find((c) => c.name === 'S.sidewalk');
  const cornerStray = p.boxes.filter((b) => b.name.startsWith('S.verge') || b.name.startsWith('S.apron'))
    .filter((b) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([u, v]) => !insidePlan(b.x + (u * b.w) / 2, b.z + (v * b.d) / 2, walkRing.pts)));
  check('Ground', `${T} tree lawns and driveway aprons stay behind the ${street.CURB_R} m curb returns`, cornerStray.length === 0, cornerStray.map((b) => b.name).join(' '));

  // --- entrance doors ---------------------------------------------------------------------
  // Every principal pedestrian entrance is a built door — a recessed opening with a white
  // lining, a glazed transom over a bar, and glazed leaves with stiles, rails and handles —
  // rather than a dark panel painted on the storefront. The galleria lobby door is the one
  // exception: the passage is modelled as rooms, with no wall to hang a door on.
  // Not checked here: leaf swing, clear widths, hardware and accessible approach.
  const doorNodes = Object.entries(ped.NODES).filter(([k, n]) => (n.kind === 'door' && k !== 't2LobbyGalleria')
    || (n.kind === 'junction' && /east portal/i.test(n.name)));   // the galleria's park-facing portal is an entrance too
  // a portal's doors stand one arcade depth behind its node on the podium edge
  const reach = (n, r) => (n.kind === 'junction' ? r + 1.8 : r);
  const nearDoor = (n, color, r) => p.parts.filter((q) => q.color === color && q.y - q.sy / 2 < 4.6 && Math.hypot(q.x - n.at[0], q.z - n.at[1]) < reach(n, r));
  // stiles and rails may be silver or bronze; what is not allowed is a dark *panel*, so a
  // charcoal piece counts as framing only while it stays slim in plan
  const darkPanel = (n) => nearDoor(n, 'charcoal', 3.0).filter((q) => Math.min(q.sx, q.sz) > 0.3 && q.sy > 1.0).length > 0;
  const undoored = doorNodes.filter(([, n]) => nearDoor(n, 'guardGlass', 3.6).length < 3
    || nearDoor(n, 'frame', 3.6).length < 2
    || nearDoor(n, 'metal', 3.6).length + nearDoor(n, 'charcoal', 3.6).length < 4
    || nearDoor(n, 'void', 3.0).length > 0 || darkPanel(n));
  const leaves = p.parts.filter((q) => q.color === 'guardGlass' && q.y - q.sy / 2 < 0.4 && q.sy > 1.6 && q.sy < 3.0);
  check('Entrances', `${T} every principal entrance is glazed throughout — screen, leaves and transom — with no dark panel: ${doorNodes.length} entrances, ${leaves.length} glass leaves in metal or bronze stiles and rails`,
    undoored.length === 0 && leaves.length >= 20, undoored.map(([k]) => k).join(' '));
  // the assembly is all but flush, so nothing of it stands in the way on the walk
  const doorParts = doorNodes.flatMap(([, n]) => p.parts.filter((q) => Math.hypot(q.x - n.at[0], q.z - n.at[1]) < reach(n, 3.6) && q.y - q.sy / 2 < 4.6
    && ['guardGlass', 'metal', 'charcoal', 'stone', 'lamp'].includes(q.color)));
  check('Entrances', `${T} the leaves, transoms, thresholds and linings stay in the plane of the facade`,
    doorParts.length > 0 && W.blockers.length === 0);

  // --- rendering stability: no overlapping visible surfaces sharing a plane ---------------
  const cop = coplanarFaces(p, { insidePlan });
  const risky = cop.filter((f) => !f.sameColour);
  check('Rendering', `${T} no coplanar overlapping visible surfaces (z-fighting) among masses, curved volumes, slabs and parts (tolerance 12 mm)`, risky.length === 0, risky.slice(0, 4).map((f) => `${f.a.name} / ${f.b.name} at ${f.at}`).join('; '));
  rendering[tier.name] = { coplanarRisk: risky.length, coplanarSameMaterial: cop.length - risky.length, parts: p.parts.length, boxes: p.boxes.length, curved: p.curved.length, trees: p.trees.length, palms: p.palms.length, cars: p.cars.length,
    partBuckets: new Set(p.parts.map((q) => `${q.shape}|${q.phase}`)).size };

  // --- planting: canopies clear of buildings, each other, palm crowns, light heads, umbrellas -
  const canopies = p.trees.filter((t) => t.y < 1.2).map((t) => ({ t, k: planting.canopyOf(t) }));
  const footprints = [
    { poly: offsetPlan(res.PODIUM_PLAN, -core.ARCADE), y0: 0, y1: 5 }, { poly: res.PODIUM_PLAN, y0: 5, y1: 12 },
    ...hotelPlans.map((pl) => ({ poly: pl, y0: 0, y1: 40 })),
    ...['B.poolbar', 'C.baseE', 'C.baseW', 'C.lobby'].map((n) => ({ poly: core.rect(...(([x0, x1, z0, z1]) => [x0, z0, x1, z1])(rectOf(byName[n]))), y0: 0, y1: 15 })),
    ...mus.MUSEUM_FOOTPRINTS.map((pl) => ({ poly: pl, y0: 0, y1: mus.MUSEUM_TOP })),
  ];
  const ring = (k, f = 0.92) => [[k.x, k.z], ...Array.from({ length: 12 }, (_, i) => [k.x + Math.cos(i * Math.PI / 6) * k.r * f, k.z + Math.sin(i * Math.PI / 6) * k.r * f])];
  const hitsBuilding = canopies.filter(({ k }) => footprints.some((b) => b.y1 > k.y0 && b.y0 < k.y1 && ring(k).some(([x, z]) => insidePlan(x, z, b.poly))));
  const treePairs = [];
  canopies.forEach((a, i) => canopies.slice(i + 1).forEach((b) => { if (Math.hypot(a.k.x - b.k.x, a.k.z - b.k.z) < (a.k.r + b.k.r) * 0.85 && a.k.y1 > b.k.y0 && b.k.y1 > a.k.y0) treePairs.push([a.t, b.t]); }));
  const crowns = p.palms.filter((q) => q.y < 1.2).map((q) => ({ x: q.x, z: q.z, r: q.r * 0.8, y0: q.y + q.h - 1.2 }));
  const palmHits = canopies.filter(({ k }) => crowns.some((c) => Math.hypot(c.x - k.x, c.z - k.z) < c.r + k.r * 0.8 && k.y1 > c.y0 && Math.hypot(c.x - k.x, c.z - k.z) > 0.3));
  const heads = p.parts.filter((q) => q.color === 'lamp' && q.y > 3);
  const lightHits = canopies.filter(({ k }) => heads.some((q) => Math.hypot(q.x - k.x, q.z - k.z) < k.r + 0.3 && q.y > k.y0 - 0.3 && q.y < k.y1));
  const shades = p.parts.filter((q) => q.shape === 'cone' && q.color === 'canvas' && q.y < 4);
  const umbrellaHits = canopies.filter(({ k }) => shades.some((q) => Math.hypot(q.x - k.x, q.z - k.z) < k.r + q.sx / 2 && q.y + q.sy / 2 > k.y0));
  check('Planting', `${T} ground-level tree canopies clear of building volumes`, hitsBuilding.length === 0, hitsBuilding.slice(0, 4).map(({ t }) => `(${round(t.x)}, ${round(t.z)})`).join(' '));
  check('Planting', `${T} tree canopies do not intersect each other (≤ 15 % overlap) or palm crowns`, treePairs.length === 0 && palmHits.length === 0, `${treePairs.length} tree pairs, ${palmHits.length} palm crowns`);
  check('Planting', `${T} tree canopies clear of street and pedestrian light heads and café umbrellas`, lightHits.length === 0 && umbrellaHits.length === 0, `${lightHits.length} light heads, ${umbrellaHits.length} umbrellas`);
  const kinds = [...new Set(p.trees.map((t) => planting.treeKind(t)))];
  // the window is the park block from the promenade's north sector down to the south property
  // line: the museum took the middle of it, so the planting that is left is the sector lawns,
  // the wedge by the plaza's east mouth and the museum's own street frontage
  const parkTreesAll = p.trees.filter((t) => t.x > -22 && t.x < 19 && t.z > -13 && t.z < core.HZ);
  check('Planting', `${T} park planting mixes species and sizes (≥ 3 tree forms, flowering accents, palms of varied height)`, kinds.length >= 3 && parkTreesAll.some((t) => t.flower) && new Set(p.palms.filter((q) => q.y < 1.2 && q.x > -22 && q.x < 19 && q.z > -13 && q.z < core.HZ).map((q) => Math.round(q.h))).size >= 3, `${kinds.join(', ')}; ${parkTreesAll.length} park trees`);
}

// ---------------------------------------------------------------------------
// Visibility from the hero cameras (ray-marched against boxes and prisms)
// ---------------------------------------------------------------------------
function visibility(p, cam) {
  const byName = Object.fromEntries(p.boxes.map((b) => [b.name, b]));
  const topOf = (n) => { const b = byName[n]; return (b.parent ? topOf(b.parent) : b.y0) + b.h; };
  const cTop = p.meta.curveTop;
  const cv = Object.fromEntries(p.curved.map((c) => [c.name, c]));
  const cBase = (n) => (cv[n].parent ? cTop[cv[n].parent] : cv[n].y0);
  const occBoxes = p.boxes.filter((b) => b.group !== 'L').map((b) => { const y0 = b.parent ? topOf(b.parent) : b.y0; return { r: rectOf(b), y0, y1: y0 + b.h }; });
  // flat ground and water surfaces (type 'prisms') carry their outlines in `parts` and occlude
  // nothing worth counting, so they sit this out
  const occPrisms = p.curved.filter((c) => c.type !== 'ring' && c.type !== 'prisms' && c.phase !== 'context').map((c) => {
    const pts = c.pts; const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    return { pts, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], y0: cBase(c.name), y1: cTop[c.name] };
  });
  // balcony ribbons occlude too: approximate each tower's slab envelope as a prism
  for (const t of p.meta.towers) {
    const body = cv[t.body];
    const env = body.slabs.floors[Math.floor(body.slabs.floors.length / 2)].outer;
    const xs = env.map((q) => q[0]), zs = env.map((q) => q[1]);
    occPrisms.push({ pts: env, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], y0: PODIUM_TOP + 3.2, y1: PODIUM_TOP + t.floors * 3.2 });
  }
  const visible = ([x, y, z]) => {
    const d = [cam[0] - x, cam[1] - y, cam[2] - z];
    const L = Math.hypot(...d);
    for (let s = 0.6; s < L; s += 0.5) {
      const qx = x + d[0] * s / L, qy = y + d[1] * s / L, qz = z + d[2] * s / L;
      if (qy > 100) return true;
      for (const o of occBoxes) if (qy > o.y0 && qy < o.y1 && qx > o.r[0] && qx < o.r[1] && qz > o.r[2] && qz < o.r[3]) return false;
      for (const o of occPrisms) if (qy > o.y0 && qy < o.y1 && qx > o.bb[0] && qx < o.bb[1] && qz > o.bb[2] && qz < o.bb[3] && insidePlan(qx, qz, o.pts)) return false;
    }
    return true;
  };
  const sampleIn = (poly, y, step = 1.5) => {
    const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]);
    const out = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) for (let z = Math.min(...zs); z <= Math.max(...zs); z += step) if (insidePlan(x, z, poly)) out.push([x, y, z]);
    return out;
  };
  const frac = (pts) => (pts.length ? pts.filter(visible).length / pts.length : 0);
  return {
    'resort pool water': frac(sampleIn(p.meta.pool.outline, res.POOL.waterY + 0.05, 1.0)),
    'pool terrace + loungers': frac(sampleIn(res.POOL.terrace, res.POOL.terraceY + 0.4)),
    'wellness terrace + spa': frac(sampleIn(core.rect(-73, 36, -36, 47), DECK_Y + 0.6)),
    'dining + lounge (between towers)': frac(sampleIn(core.rect(-47, -13.5, -38, 13.5), DECK_Y + 0.6)),
    'park fountain': frac(sampleIn(core.circlePlan(park.FOUNTAIN.x, park.FOUNTAIN.z, park.FOUNTAIN.basin, 24), 0.5, 1.0)),
    'hotel park entrance': frac(sampleIn(core.rect(10.5, -5.4, 21.5, -2.4), 2.2, 1.0)),
    // sampled just over the parapet: the building's own roof is what the hero view reads
    'park art museum': frac(sampleIn(core.rect(mus.MUSEUM_RECT[0], mus.MUSEUM_RECT[2], mus.MUSEUM_RECT[1], mus.MUSEUM_RECT[3]), mus.MUSEUM_TOP + 0.15, 1.5)),
  };
}
const DEG = Math.PI / 180;
const camAt = ({ az, el, dist, tx, ty, tz }) => [tx + dist * Math.cos(el * DEG) * Math.sin(az * DEG), ty + dist * Math.sin(el * DEG), tz + dist * Math.cos(el * DEG) * Math.cos(az * DEG)];
const rigSrc = readFileSync(join(hero, 'camera-rig.js'), 'utf8');
// Load: every module the hero imports at run time is preloaded from the page head (in the
// hero's own modes only), so the browser fetches the graph in parallel instead of discovering
// it one import at a time; and the import map sits ahead of every module, or it would be
// ignored. The graph is walked from boot.js; QA-only modules (?heroPlan) are left out.
{
  const htmlSrc = readFileSync(join(hero, '..', '..', 'home.html'), 'utf8');
  const QA_ONLY = new Set(['layers/qa-overlay.js']);
  const graph = new Set();
  const walk = (rel) => {
    if (graph.has(rel) || QA_ONLY.has(rel)) return;
    graph.add(rel);
    const src = readFileSync(join(hero, ...rel.split('/')), 'utf8');
    for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|^import\s*)['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      const parts = [...rel.split('/').slice(0, -1), ...m[1].split('/')];
      const out = [];
      for (const q of parts) { if (q === '.' ) continue; if (q === '..') out.pop(); else out.push(q); }
      walk(out.join('/'));
    }
  };
  walk('boot.js');
  const listed = new Set(((htmlSrc.match(/HERO3D_MODULES = \[([^\]]*)\]/) || [])[1] || '').split(',').map((q) => q.trim().replace(/'/g, '')).filter(Boolean));
  const missing = [...graph].filter((m) => !listed.has(m)), extra = [...listed].filter((m) => !graph.has(m));
  const mapAt = htmlSrc.indexOf('<script type="importmap">'), firstModule = htmlSrc.indexOf('<script type="module"'), preAt = htmlSrc.indexOf('modulepreload');
  const threePre = /pre\('https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.module\.min\.js', true\)/.test(htmlSrc);
  check('Load', `the hero's ${graph.size} run-time modules and three.js are preloaded from the page head in parallel (${listed.size} listed, ${missing.length} missing, ${extra.length} extra), only when the 3D hero runs, with the import map ahead of every module`,
    missing.length === 0 && extra.length === 0 && threePre && mapAt > 0 && mapAt < preAt && mapAt < firstModule && /if \(mode !== 'fallback'\)/.test(htmlSrc),
    `missing ${missing.join(', ')}; extra ${extra.join(', ')}; map ${mapAt} pre ${preAt} module ${firstModule}`);
}
// The model keeps its full colour to the end of the scroll: nothing eases the hero canvas's
// opacity down as it hands off to the page, and the road paint does not dim with it.
{
  const sceneSrc = readFileSync(join(hero, 'hero-scene.js'), 'utf8');
  const lineSrc = readFileSync(join(hero, 'layers', 'linework.js'), 'utf8');
  const fades = [/canvasHost\.style\.opacity\s*=/.test(sceneSrc) && 'canvas opacity', /PHASES\.handoff/.test(lineSrc) && 'linework handoff dimming'].filter(Boolean);
  check('Rendering', `the model keeps its full colour however far the page is scrolled: nothing fades the canvas or its linework on the way out (${fades.length ? fades.join(', ') : 'no fades'})`,
    fades.length === 0, fades.join(', '));
}
const key = (s) => {
  const m = rigSrc.match(new RegExp(`\\{ s: ${s.toFixed(2)}, az: (-?[\\d.]+), el: (-?[\\d.]+), dist: (-?[\\d.]+), tx: (-?[\\d.]+),\\s*ty: (-?[\\d.]+),\\s*tz: (-?[\\d.]+) \\}`));
  return m ? { az: +m[1], el: +m[2], dist: +m[3], tx: +m[4], ty: +m[5], tz: +m[6] } : null;
};
const k92 = key(0.92), k80 = key(0.80);
if (process.env.HERO_CAM) { const [az, el] = process.env.HERO_CAM.split(',').map(Number); Object.assign(k92, { az, el }); }
const desktopCam = camAt(k92);
const mobileCam = camAt({ ...k92, az: k80.az + (k92.az - k80.az) * 0.55, el: k80.el + (k92.el - k80.el) * 0.55, dist: k92.dist * 2.6 });
const vis = { desktop: visibility(desktopPlan, desktopCam), mobile: visibility(mobilePlan, mobileCam) };
check('Visibility', 'desktop hero view shows ≥ 60% of the resort pool', vis.desktop['resort pool water'] >= 0.6, `${Math.round(vis.desktop['resort pool water'] * 100)}%`);
check('Visibility', 'desktop hero view shows ≥ 50% of at least one substantial amenity area', Math.max(vis.desktop['pool terrace + loungers'], vis.desktop['wellness terrace + spa']) >= 0.5);
check('Visibility', 'mobile hero view shows ≥ 60% of the resort pool', vis.mobile['resort pool water'] >= 0.6, `${Math.round(vis.mobile['resort pool water'] * 100)}%`);
for (const t of ['desktop', 'mobile']) {
  check('Visibility', `${t} hero view shows the fountain, the hotel's park entrance and the art museum`,
    vis[t]['park fountain'] >= 0.5 && vis[t]['hotel park entrance'] >= 0.3 && vis[t]['park art museum'] >= 0.5,
    `fountain ${Math.round(vis[t]['park fountain'] * 100)}%, entrance ${Math.round(vis[t]['hotel park entrance'] * 100)}%, museum ${Math.round(vis[t]['park art museum'] * 100)}%`);
}

// ---------------------------------------------------------------------------
// SVG plan diagrams
// ---------------------------------------------------------------------------
const plansDir = join(here, 'plans');
if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
function svg(name, bounds, draw, title) {
  const [x0, x1, z0, z1] = bounds;
  const S = 9, pad = 30;
  const W = (x1 - x0) * S + pad * 2, Hh = (z1 - z0) * S + pad * 2 + 40;
  const X = (x) => round((x - x0) * S + pad, 1), Z = (z) => round((z - z0) * S + pad + 40, 1);
  const out = [];
  const g = {
    poly: (pts, st) => out.push(`<polygon points="${pts.map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" ${st}/>`),
    rect: (r, st) => out.push(`<rect x="${X(r[0])}" y="${Z(r[2])}" width="${round((r[1] - r[0]) * S, 1)}" height="${round((r[3] - r[2]) * S, 1)}" ${st}/>`),
    circle: (x, z, r, st) => out.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="${round(r * S, 1)}" ${st}/>`),
    line: (a, b, st) => out.push(`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" ${st}/>`),
    text: (x, z, s, size = 10, st = '') => out.push(`<text x="${X(x)}" y="${Z(z)}" font-size="${size}" font-family="Helvetica, Arial" ${st}>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`),
  };
  draw(g);
  writeFileSync(join(plansDir, name), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}"><rect width="100%" height="100%" fill="#fbfaf7"/><text x="${pad}" y="22" font-size="14" font-family="Helvetica, Arial" font-weight="bold">${title}</text>${out.join('')}<text x="${pad}" y="38" font-size="10" font-family="Helvetica, Arial" fill="#777">north ↑ · 1 m = ${S} px · conceptual, not to be used for construction</text></svg>`);
}
const P = desktopPlan, A = desktopAnalysis;
const rpk = A.parking.residential;

// circulation map: the pedestrian hierarchy, destinations, service and vehicle points, and the
// paths removed or relocated from the previous layout (grey dashes)
function out2(g, pts, col, w, dash) {
  for (let i = 1; i < pts.length; i++) g.line(pts[i - 1], pts[i], `stroke="${col}" stroke-width="${round(w, 1)}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}`);
}
svg('circulation-map.svg', [-92, 96, -68, 76], (g) => {
  const W = A.circulation;
  g.rect([-97.5, 97.5, -72.8, 72.8], 'fill="#d9dadb" stroke="none"');
  g.rect([-84.2, 84.2, -59.5, 59.5], 'fill="#ecebe7" stroke="#9a9a96"');
  g.rect([-80, 80, -55.25, 55.25], 'fill="#f7f6f2" stroke="#666" stroke-width="0.8"');
  for (const b of P.boxes.filter((q) => q.name.startsWith('G.') || q.name.startsWith('S.verge'))) g.rect(rectOf(b), 'fill="#cfe3b8" stroke="none"');
  for (const c of P.curved.filter((q) => q.name === 'P.lawns' || q.name === 'P.beds')) for (const q of c.parts) g.poly(q.pts, 'fill="#cfe3b8" stroke="none"');
  g.poly(res.PODIUM_PLAN, 'fill="#e9e6f2" stroke="#555" stroke-width="1.1"');
  g.poly(offsetPlan(res.PODIUM_PLAN, -core.ARCADE), 'fill="#f1eff6" stroke="#8e5bd6" stroke-dasharray="4 2" stroke-width="0.7"');
  g.text(-70, -6, 'RESIDENTIAL PODIUM', 10, 'font-weight="bold" fill="#554"');
  g.text(-70, -3.4, 'retail + lobbies at grade, parking above,', 8, 'fill="#665"');
  g.text(-70, -1.4, 'residents amenity deck at +11.9 m (private)', 8, 'fill="#665"');
  for (const pl of [hotel.HOTEL.front, hotel.HOTEL.tower, hotel.HOTEL.rear, hotel.HOTEL.link]) g.poly(pl, 'fill="#e6e8ec" stroke="#555" stroke-width="1.1"');
  g.rect([1.8, 53.4, -39, -20], 'fill="#d6ecf2" stroke="#3a8fb0" stroke-dasharray="3 2"');
  g.text(8, -29, 'HOTEL POOL COURT — guests only (controlled door from the lobby)', 8, 'fill="#276"');
  for (const n of ['C.baseE', 'C.baseW', 'C.lobby']) g.rect(rectOf(P.boxes[P.index[n]]), 'fill="#ece8e0" stroke="#555" stroke-width="1.1"');
  g.text(40, 30, 'OFFICE', 10, 'font-weight="bold" fill="#554"');
  g.text(12, -12, 'HOTEL', 10, 'font-weight="bold" fill="#554"');
  for (const t of P.meta.towers) { g.poly(t.core, 'fill="#666" stroke="none"'); g.text(t.cx - 4, t.cz + 0.6, 'tower lifts', 7, 'fill="#fff"'); }
  for (const c of res.PODIUM_PARKING.cores) g.rect(c.rect, 'fill="#888"');
  g.text(-40, 1.2, 'stair + lift to amenity deck', 7);
  g.text(-73, -22.2, 'stair', 7);
  const F0 = ped.FOUNTAIN_CENTRE;
  for (const r of [[-26, -21.5, -55.3, 55.3], [20.5, 80, 7.8, 10.2], [-13.5, -9, -55.3, -2], [18, 38, -2, 8], [-21.8, -16.4, 9.6, 24.8], [40, 56, 1.6, 7.6]]) g.rect(r, 'fill="none" stroke="#999" stroke-width="1" stroke-dasharray="3 3"');
  // the three park structures
  mus.MUSEUM_FOOTPRINTS.forEach((pl) => g.poly(pl, 'fill="#e6e8ec" stroke="#555" stroke-width="1.1"'));
  g.poly(mus.MUSEUM_PLAN, 'fill="none" stroke="#8e5bd6" stroke-dasharray="4 2" stroke-width="0.7"');
  for (const c of ped.CROSSINGS) {
    const [a0, a1] = c.span;
    const r = c.side === 'n' ? [a0, a1, -59.5, -55.25] : c.side === 's' ? [a0, a1, 55.25, 59.5] : c.side === 'e' ? [80, 84.2, a0, a1] : [-84.2, -80, a0, a1];
    g.rect(r, 'fill="#f2c200" stroke="#9a7400" stroke-width="0.8"');
    const lx = c.side === 'e' ? 85 : (a0 + a1) / 2 - 7, lz = c.side === 'n' ? -61.5 - (c.id === 'VX2' ? 2.6 : 0) : c.side === 'e' ? (a0 + a1) / 2 + 0.5 : 62;
    g.text(lx, lz, `${c.id} ${c.name}`, 7, 'fill="#7a5c00"');
  }
  for (const z of ped.sightZones()) g.rect(z.rect, 'fill="none" stroke="#c89a00" stroke-width="0.6" stroke-dasharray="2 1.5"');
  g.rect([73, 79.5, -42, -10], 'fill="#c9cccc" stroke="#777"'); g.text(73.4, -26, 'valet', 7);
  for (const r of ped.ROUTES) {
    const c = ped.routeCentreline(r);
    const col = r.id === 'P1' ? '#f47321' : r.type === 'primary' ? '#c0392b' : '#6b4bd6';
    const w = (r.type === 'primary' ? 4.5 : r.id === 'ARC' ? 2.6 : 2.2) * 9 * 0.32;
    out2(g, c, col, w, r.id === 'ARC' ? '5 3' : '');
  }
  g.circle(F0[0], F0[1], 11.0, 'fill="none" stroke="#1f8fd6" stroke-width="10"');
  g.circle(F0[0], F0[1], 8.2, 'fill="#9fd8de" stroke="#39a"');
  for (const e of ped.ENTRANCES) g.poly(e.poly, 'fill="#12a36b" fill-opacity="0.35" stroke="#12a36b"');
  for (const n of Object.values(ped.NODES)) {
    if (n.kind === 'door') g.circle(n.at[0], n.at[1], 0.9, 'fill="#12a36b" stroke="#fff"');
    if (n.kind === 'sidewalk') g.circle(n.at[0], n.at[1], 0.9, 'fill="#1f1d18"');
  }
  const L = (x, z, t, col = '#1f1d18', size = 8) => g.text(x, z, t, size, `fill="${col}" font-weight="bold"`);
  L(20, 3.9, 'CENTRAL PROMENADE (6 m)', '#f47321', 9); L(-60, 12.4, 'GALLERIA (4.5 m public passage)', '#f47321', 8);
  L(-5.6, -32, 'SPINE', '#c0392b', 9); L(-6.4, 51, 'SPINE / park gate', '#c0392b', 8); L(-21.6, 8.0, 'FOUNTAIN LOOP', '#1f8fd6', 8);
  L(-33, 36, 'ARCADE', '#8e5bd6', 7); L(-2.0, 33.0, 'ART MUSEUM', '#554', 8); L(-22.6, -30, 'paseo garden', '#554', 7);
  L(-8.0, 47.0, 'spine under the museum', '#6b4bd6', 7);
  L(21.8, 25, 'office walk', '#6b4bd6', 7); L(72.3, -8, 'garden walk', '#6b4bd6', 7); L(-24, -45.8, 'paseo cross walk', '#6b4bd6', 7); L(-24, -17.4, 'paseo cross walk', '#6b4bd6', 7);
  L(-90.5, -28, 'T1 LOBBY', '#12a36b', 7); L(-54, 47.6, 'T2 LOBBY', '#12a36b', 7); L(-57, 21.6, 'T2 galleria door', '#12a36b', 6);
  L(22, -3.6, 'HOTEL ENTRANCE', '#12a36b', 7); L(12.4, -9.2, 'restaurant', '#12a36b', 6); L(41, -5.1, 'lobby bar + café', '#12a36b', 6); L(60.5, -30, 'GUEST ARRIVAL', '#12a36b', 7);
  L(24.8, 51.3, 'OFFICE LOBBY', '#12a36b', 7); L(22.6, 38.8, 'park door', '#12a36b', 6);
  L(-62, -49.4, 'garage in/out', '#333', 6); L(-41, -49.4, 'loading', '#333', 6); L(50, -49.6, 'hotel dock / refuse / staff', '#333', 6); L(66, 22, 'car lifts', '#333', 6); L(66, 45, 'loading', '#333', 6);
  L(-12, -64.4, 'NORTH SIDEWALK', '#555', 8); L(-12, 67, 'SOUTH SIDEWALK', '#555', 8); L(-91.5, 2, 'WEST', '#555', 8); L(86.5, 2, 'EAST', '#555', 8);
  const lg = [['#f47321', 'primary: Central Promenade'], ['#c0392b', 'primary: north–south Spine'], ['#1f8fd6', 'fountain loop'], ['#6b4bd6', 'secondary links (arcade dashed = covered)'], ['#12a36b', 'entrance zones and doors'], ['#f2c200', 'driveway crossing (continuous raised sidewalk)'], ['#c89a00', 'sight triangles (kept clear above 0.9 m)'], ['#999', 'paths removed or relocated by earlier revisions']];
  lg.forEach(([c, t], k) => { const x = -90 + (k % 4) * 46, z = 69 + Math.floor(k / 4) * 3; g.rect([x, x + 2.5, z - 1.4, z + 0.2], `fill="${c}"`); g.text(x + 3.2, z, t, 8); });
  g.text(-90, 75.4, `Connectivity: ${W.reach.filter((r) => r.reachable).length}/${W.reach.length} destinations reachable · dead ends ${W.deadEnds.length} · clear-zone obstructions ${W.blockers.length} · vehicle conflicts ${W.conflicts.length} · step-free in the model (conceptual, not an accessibility review)`, 8, 'fill="#333"');
}, 'Pedestrian circulation map — hierarchy, destinations, crossings (conceptual)');

svg('residential-parking-L3.svg', [-80, -20, -54, 52], (g) => {
  g.poly(res.PODIUM_PLAN, 'fill="#f1efe9" stroke="#333" stroke-width="1.2"');
  g.poly(offsetPlan(res.PODIUM_PLAN, -(0.6 + res.PODIUM_PARKING.linerDepth)), 'fill="none" stroke="#bbb" stroke-dasharray="4 3"');
  for (const a of res.PODIUM_PARKING.aisles) g.rect(a.rect, 'fill="#e3e6ea" stroke="#9aa"');
  g.rect(res.PODIUM_PARKING.ramp.rect, 'fill="#d8d0f0" stroke="#86a"');
  g.text(-46.2, 0, 'ramp 30 m runs', 9);
  for (const r of rpk.levels[1].stalls) g.rect(r, 'fill="#cfe6cf" stroke="#6a6" stroke-width="0.5"');
  for (const t of P.meta.towers) { g.poly(t.core, 'fill="#999" stroke="#333"'); t.columns.forEach(([x, z]) => g.rect([x - 0.3, x + 0.3, z - 0.3, z + 0.3], 'fill="#c33"')); g.poly(t.columns, 'fill="none" stroke="#c33" stroke-dasharray="3 2"'); }
  rpk.podiumColumns.forEach(([x, z]) => g.rect([x - 0.3, x + 0.3, z - 0.3, z + 0.3], 'fill="#555"'));
  for (const c of res.PODIUM_PARKING.cores) g.rect(c.rect, 'fill="#777"');
  g.poly(offsetPlan(P.meta.pool.outline, 0.35), 'fill="none" stroke="#2a8" stroke-width="1.5" stroke-dasharray="6 3"');
  g.text(-78, 50, `P-L3 (floor 8.2 m): ${rpk.levels[1].count} stalls · pool basin soffit ${rpk.pool.basinSoffitY} m, clear ${rpk.pool.clearHeight} m (dashed green)`, 10);
}, 'Residential podium parking — level P-L3 (P-L2 identical layout)');

svg('podium-amenity-deck.svg', [-80, -20, -54, 52], (g) => {
  g.poly(res.PODIUM_PLAN, 'fill="#eceee9" stroke="#333" stroke-width="1.2"');
  g.poly(res.POOL.terrace, 'fill="#dfe2dd" stroke="#888"');
  g.poly(offsetPlan(P.meta.pool.outline, 0.5), 'fill="#f7f7f4" stroke="#999"');
  g.poly(P.meta.pool.outline, 'fill="#9fd8de" stroke="#39a"');
  for (const t of P.meta.towers) g.poly(P.curved.find((c) => c.name === t.body).floorPlans[0], 'fill="#c9ced3" stroke="#555"');
  g.circle(res.SPA.x, res.SPA.z, res.SPA.r, 'fill="#9fd8de" stroke="#39a"');
  for (const q of P.parts.filter((q) => q.y > PODIUM_TOP && q.y < PODIUM_TOP + 4 && insidePlan(q.x, q.z, res.PODIUM_PLAN) && q.shape === 'box' && q.sy > 0.2)) {
    const r = partRect(q);
    g.rect(r, `fill="${q.color === 'frame' ? '#fff' : q.color === 'planter' ? '#7b5' : '#ddd'}" stroke="#aaa" stroke-width="0.4"`);
  }
  for (const pm of P.palms.filter((q) => q.deck && q.x < -20)) g.circle(pm.x, pm.z, 0.9, 'fill="#5a3" stroke="none"');
  g.text(-78, 50, `Routes (1.5 m clear): ${A.deck.routes.filter((r) => r.reachable).length}/${A.deck.routes.length} connected · planters ${A.deck.planters}`, 10);
}, 'Podium amenity level — resort pool, dining, lounge, wellness terrace');

svg('hotel-ground-boh.svg', [-6, 82, -56, 6], (g) => {
  for (const pl of [hotel.HOTEL.rear, hotel.HOTEL.link, hotel.HOTEL.front, hotel.HOTEL.tower]) g.poly(pl, 'fill="#f3f2ee" stroke="#333" stroke-width="1.2"');
  const fill = { service: '#f5d9c8', guest: '#d4e6f5', public: '#e2f0d6' };
  for (const r of hotel.HOTEL_GROUND) {
    g.rect(r.rect, `fill="${fill[r.zone]}" fill-opacity="${r.outdoor ? 0.45 : 0.9}" stroke="#666" stroke-width="0.6"`);
    const w = r.rect[1] - r.rect[0];
    g.text(r.rect[0] + 0.4, (r.rect[2] + r.rect[3]) / 2 + 0.4, r.name, w < 8 ? 6 : 8);
  }
  for (const [a, b] of hotel.HOTEL_DOORS) {
    const ra = hotel.HOTEL_GROUND.find((r) => r.name === a).rect, rb = hotel.HOTEL_GROUND.find((r) => r.name === b).rect;
    const x = (Math.max(ra[0], rb[0]) + Math.min(ra[1], rb[1])) / 2, z = (Math.max(ra[2], rb[2]) + Math.min(ra[3], rb[3])) / 2;
    g.circle(x, z, 0.6, 'fill="#c30"');
  }
  g.text(-4, 4, 'orange = service · blue = guest · green = public · red dots = declared service ↔ guest doors', 10);
}, 'Hotel ground floor — conceptual back-of-house plan');

svg('office-parking-P1.svg', [18, 78, 10, 54], (g) => {
  g.rect(office.OFFICE_BASE_RECT, 'fill="#f1efe9" stroke="#333" stroke-width="1.2"');
  for (const b of office.OFFICE_BLOCKS) g.rect(b.rect, 'fill="none" stroke="#8a5a38" stroke-dasharray="5 3"');
  for (const x of office.OFFICE_GRID.x) g.line([x, 12], [x, 52], 'stroke="#ddd" stroke-width="0.6"');
  for (const z of office.OFFICE_GRID.z) g.line([20, z], [76, z], 'stroke="#ddd" stroke-width="0.6"');
  for (const a of office.OFFICE_PARKING.aisles) g.rect(a.rect, 'fill="#e3e6ea" stroke="#9aa"');
  g.rect(office.OFFICE_PARKING.lifts.rect, 'fill="#d8d0f0" stroke="#86a"');
  for (const r of A.parking.office.levels[0].stalls) g.rect(r, 'fill="#cfe6cf" stroke="#6a6" stroke-width="0.5"');
  A.structure.office.columns.forEach(([x, z]) => g.rect([x - 0.3, x + 0.3, z - 0.3, z + 0.3], 'fill="#555"'));
  g.rect(office.OFFICE_CORE, 'fill="#999"');
  g.text(20, 53, `P1: ${A.parking.office.levels[0].count} stalls · 2 car lifts · dashed = blocks above (b1, b2, b3)`, 10);
}, 'Office parking P1 and structural grid (P2 identical)');

svg('tower-structure.svg', [-80, -24, -54, 50], (g) => {
  g.poly(res.PODIUM_PLAN, 'fill="none" stroke="#bbb"');
  for (const t of P.meta.towers) {
    const body = P.curved.find((c) => c.name === t.body);
    body.slabs.floors.forEach((f, i) => { if (i % 3 === 0) g.poly(f.outer, 'fill="none" stroke="#9cc" stroke-width="0.4"'); });
    g.poly(body.floorPlans[0], 'fill="none" stroke="#333" stroke-width="1"');
    g.poly(body.floorPlans.at(-1), 'fill="none" stroke="#333" stroke-width="0.6" stroke-dasharray="4 2"');
    const top = (t.columnRings ?? [t.columns]).at(-1);
    g.poly(t.columns, 'fill="none" stroke="#c33" stroke-dasharray="3 2"');
    g.poly(top, 'fill="none" stroke="#e88" stroke-dasharray="3 2"');
    // each column's travel from the base ring to the top ring as the structure turns
    t.columns.forEach(([x, z], k) => { g.line([x, z], top[k], 'stroke="#e88" stroke-width="0.4"'); g.rect([x - 0.3, x + 0.3, z - 0.3, z + 0.3], 'fill="#c33"'); });
    top.forEach(([x, z]) => g.rect([x - 0.25, x + 0.25, z - 0.25, z + 0.25], 'fill="none" stroke="#e88"'));
    g.poly(t.core, 'fill="#999"');
    for (const tr of t.transfers) { g.poly(tr.inner, 'fill="none" stroke="#e80" stroke-width="1.5"'); }
  }
  g.text(-78, 48, 'black = floorplate at the base (dashed = at the top, turned) · red = column ring at the base, pink = at the top, with each column’s inclined travel · blue = balcony edges (every 3rd floor) · orange = upper-penthouse transfer line', 9);
}, 'Residential towers — cores, columns, balcony cantilevers, declared transfer');

// ---------------------------------------------------------------------------
// Validation register
// ---------------------------------------------------------------------------
const tests = existsSync(join(here, 'test-log.json')) ? JSON.parse(readFileSync(join(here, 'test-log.json'), 'utf8')) : null;
const pass = checks.filter((c) => c.pass).length;
const prog = A.program;
const demand = (() => {
  const d = ASSUMPTIONS.demand;
  const units = prog.residentialUnits, keys = prog.hotel.totalKeys, off = prog.office.nra / 100, ret = prog.retail.total / 100;
  return {
    residential: [units * d.residentialPerUnit[0], units * d.residentialPerUnit[1]],
    hotel: [keys * d.hotelPerKey[0], keys * d.hotelPerKey[1]],
    office: [off * d.officePer100m2[0], off * d.officePer100m2[1]],
    retail: [ret * d.retailPer100m2[0], ret * d.retailPer100m2[1]],
  };
})();
const rng2 = (r) => `${Math.round(r[0])}–${Math.round(r[1])}`;
const md = [];
md.push('# Hero development model — validation register', '');
md.push(`Generated by \`node tools/hero3d/audit.mjs\` from the model source (\`assets/hero3d/\`). ${pass}/${checks.length} geometric checks pass.`, '');
md.push('> **Scope.** This register separates (1) geometry verified by script against the model, (2) conceptual assumptions, (3) matters that need professional engineering, code or zoning review, and (4) tests performed and not performed. A passing geometric check means the modelled shapes satisfy the stated rule. It does **not** mean the design is structurally adequate, code-compliant, accessible or permitted.', '');

md.push('## 1. Verified geometry (scripted checks)', '');
const areas = [...new Set(checks.map((c) => c.area))];
for (const ar of areas) {
  const list = checks.filter((c) => c.area === ar);
  md.push(`**${ar}** — ${list.filter((c) => c.pass).length}/${list.length}`, '');
  for (const c of list) md.push(`- ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  md.push('');
}
md.push('### Visibility from the hero cameras (ray-marched fractions of sample points)', '', '| Area | Desktop (1440 × 900) | Mobile (375 × 812) |', '|---|---|---|');
for (const k of Object.keys(vis.desktop)) md.push(`| ${k} | ${Math.round(vis.desktop[k] * 100)}% | ${Math.round(vis.mobile[k] * 100)}% |`);
md.push('');

md.push('### Structure measurements (geometric)', '', '| Tower | Floors | Columns | Max column spacing | Max slab cantilever (limit) | Max core → column span | Glass lean per floor | Long perimeter spans |', '|---|---|---|---|---|---|---|---|');
for (const s of A.structure.towers) md.push(`| ${s.id === 'A.t1' ? 'Tower 1' : 'Tower 2'} | ${s.floors} + 2 PH | ${s.columns} × ${s.columnSize} m, ground → ${s.columnTopY} m | ${s.maxColumnSpacing} m | ${s.maxCantilever} m (${s.limit} m) | ${s.maxCoreToColumnSpan} m | ${s.maxLeanStep} m | ${s.longSpans.map((l) => `${l.span} m (${l.reason})`).join('; ') || '—'} |`);
md.push('', '| Office block | Footprint (m) | Column lines | Max edge cantilever | Projection past block below | Transfer required |', '|---|---|---|---|---|---|');
for (const b of A.structure.office.blocks) md.push(`| ${b.name} | ${round(b.rect[1] - b.rect[0])} × ${round(b.rect[3] - b.rect[2])} | ${b.columnLines} | ${b.maxCantilever} m | ${b.projection == null ? '— (first block)' : `${b.projection} m`} | ${b.continuous ? 'no' : 'yes'} |`);
md.push('', '**Declared transfer zones**', '');
for (const s of A.structure.towers) for (const tr of s.transfers) md.push(`- ${tr.name}: at +${round(tr.y)} m, ≈ ${tr.area} m² between the core and the column ring; conceptual structural zone ${tr.allowance} m deep. ${tr.note}.`);
for (const s of A.structure.towers) md.push(`- ${s.id} penthouse (${s.penthouse.type}): ${s.penthouse.concept}; main terrace +${s.penthouse.deckY} m, roof +${s.penthouse.roofTopY} m; terraces ${s.penthouse.levels.map((l) => `${l.name} +${l.deckY} m (min ${l.minTerrace} m)`).join(', ')}; basins: ${s.penthouse.basins.map((b) => `${b.name} (${b.kind}, ${b.level}, depth ${b.depth} m, soffit +${b.soffitY} m ≥ zone base +${b.zoneBaseY} m, support: ${b.support}; column-ring allowance ${b.inRing ? 'yes' : 'NO'}, clear of enclosures ${b.clearGlass ? 'yes' : 'NO'}, core ${b.clearCore ? 'yes' : 'NO'}, not over double-height room ${b.notOverDoubleHeight ? 'yes' : 'NO'}, over enclosed floor ${b.supported ? 'yes' : 'NO'})`).join('; ')}.`);
md.push('- Office: none required by the geometry (every block uses column lines of the block below). The 2.4–3.0 m edge cantilevers still need design.', '');

md.push('### Parking — modelled capacity (stalls generated along modelled aisles; rejected where columns, cores, ramp, liner units, cross aisles or level edges intervene)', '', '| Garage | Level | Valid stalls | Rejected candidates |', '|---|---|---|---|');
for (const l of rpk.levels) md.push(`| Residential podium | ${l.name} (floor ${l.floor} m) | ${l.count} | ${Object.entries(l.rejected).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
for (const l of A.parking.office.levels) md.push(`| Office base | ${l.name} (floor ${l.floor} m) | ${l.count} | ${Object.entries(l.rejected).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
md.push(`| **Total** | | **${rpk.total + A.parking.office.total}** | |`, '');
md.push(`- Residential circulation: aisle graph connected to the ramp (${rpk.aisleIssues.length ? rpk.aisleIssues.join('; ') : 'no obstructions or disconnected aisles'}); ground approach portal → ramp ${rpk.groundIssues.length ? rpk.groundIssues.join('; ') : 'connected'}.`);
md.push(`- Ramp: stacked switchback, ${rpk.ramps.map((r) => `${r.from} → ${r.to} ${r.rise} m over ${r.runLength} m (${r.slope}%)`).join('; ')}; headroom between stacked runs ≈ ${rpk.rampHeadroom} m (floor-to-floor minus slab). Transition slopes, vertical curves and van clearance not designed.`);
md.push(`- Office: two car lifts; aisles connected to the lifts (${A.parking.office.aisleIssues.length ? A.parking.office.aisleIssues.join('; ') : 'no obstructions'}). Lift cycle time and queuing not analysed.`);
md.push('', '**Estimated demand (planning ratios below are assumptions, not code minimums)**', '', '| Use | Program basis | Ratio range | Estimated stalls |', '|---|---|---|---|');
md.push(`| Residential | ${prog.residentialUnits} units | ${ASSUMPTIONS.demand.residentialPerUnit.join('–')} per unit | ${rng2(demand.residential)} |`);
md.push(`| Hotel | ${prog.hotel.totalKeys} keys | ${ASSUMPTIONS.demand.hotelPerKey.join('–')} per key (valet) | ${rng2(demand.hotel)} |`);
md.push(`| Office | ${prog.office.nra} m² NRA | ${ASSUMPTIONS.demand.officePer100m2.join('–')} per 100 m² | ${rng2(demand.office)} |`);
md.push(`| Retail / F&B | ${prog.retail.total} m² | ${ASSUMPTIONS.demand.retailPer100m2.join('–')} per 100 m² | ${rng2(demand.retail)} |`);
const dsum = [0, 1].map((i) => Object.values(demand).reduce((a, r) => a + r[i], 0));
md.push(`| **All uses (no sharing)** | | | **${rng2(dsum)}** vs **${rpk.total + A.parking.office.total}** modelled |`, '');
md.push('Modelled capacity is well below the estimated demand range. The model does not resolve parking supply; see section 3.', '');

md.push('### Program, cores and elevators (conceptual allocations)', '', '| Building | Floors | Area / count basis | Estimate |', '|---|---|---|---|');
for (const t of prog.towers) md.push(`| ${t.id === 'A.t1' ? 'Tower 1' : 'Tower 2'} | ${t.floors} + ${t.penthouseLevels}-level penthouse (${t.id === 'A.t1' ? 'duplex, crown transfer zone' : 'full floor + roof garden room on a 1.6 m plinth'}), over a 3-level podium | typical plate ${t.typicalFloorplate} m², GFA ≈ ${t.gfa} m² | ${t.units} units |`);
md.push(`| Hotel | ${Object.entries(prog.hotel.floors).map(([k, v]) => `${k} ${v}`).join(', ')} | GFA ≈ ${prog.hotel.gfa} m² | ${prog.hotel.totalKeys} keys (${Object.entries(prog.hotel.keys).map(([k, v]) => `${k} ${v}`).join(', ')}) |`);
md.push(`| Office | base 3 (incl. 2 parking) + 3 blocks × 3 (crown block enlarged to ${round((office.OFFICE_BLOCKS[2].rect[1] - office.OFFICE_BLOCKS[2].rect[0]), 1)} × ${round((office.OFFICE_BLOCKS[2].rect[3] - office.OFFICE_BLOCKS[2].rect[2]), 1)} m) | GFA ≈ ${prog.office.gfa} m² | NRA ≈ ${prog.office.nra} m² |`);
md.push(`| Retail / F&B | ground floors | podium ${prog.retail.podium} + hotel ${prog.retail.hotelFnb} + office ${prog.retail.office} m² | ≈ ${prog.retail.total} m² |`, '');
md.push('| Core | Stairs | Passenger lifts | Service lifts | Area | Geometric continuity |', '|---|---|---|---|---|---|');
for (const c of A.cores) md.push(`| ${c.building} — ${c.name} | ${c.stairs} | ${c.passenger} | ${c.service} | ${c.area} m² | ${c.continuous} |`);
md.push('', 'Stair and lift counts are allocations that fit the modelled core areas. No egress width, travel distance, fire separation or lift traffic analysis was done.', '');

md.push('### Hotel back of house (conceptual ground-floor plan)', '');
md.push(`- Service graph from receiving: ${A.hotel.serviceReach.map((x) => `${x.reachable ? '✅' : '❌'} ${x.name}`).join(' · ')}`);
md.push(`- Guest graph from the porte-cochère: ${A.hotel.guestReach.map((x) => `${x.reachable ? '✅' : '❌'} ${x.name}`).join(' · ')}`);
md.push(`- Declared service ↔ guest/public doors: ${A.hotel.interfaces.join('; ')}. Service rooms reachable from receiving without those doors: ${A.hotel.serviceToGuestWithoutDoor.length ? A.hotel.serviceToGuestWithoutDoor.join(', ') : 'no guest rooms'}.`);
md.push('- Upper floors (assumed, not modelled): linen/pantry rooms at the service core on every floor; room service via the two service lifts.', '');

md.push('## 2. Conceptual assumptions', '', '| Topic | Assumption used in the model |', '|---|---|');
md.push(`| Site | Hypothetical 160 × 110.5 m block with a procedurally generated city context. Not an actual parcel. |`);
md.push(`| Towers | One occupied floorplate per tower, and the structure turns with it: plate and perimeter column ring rotate ${A.structure.towers.map((s) => `${s.plateTwistPerFloor}°`).join(' / ')} per floor (${A.structure.towers.map((s) => `${s.plateTwist}°`).join(' / ')} over the tower) about a vertical core, so the glass line leans ≤ ${res.TOWERS[0].perimeter} m floor to floor and each column inclines ≤ ${A.structure.towers[0].tiltLimit} m per floor (${A.structure.towers.map((s) => `${s.columnTiltDeg}°`).join(' / ')} off vertical). Continuous central core; ${A.structure.towers.map((s) => s.columns).join(' / ')} perimeter columns of ${A.structure.towers[0].columnSize} m, landing square on the podium column lines at the base and continuing to the lower-penthouse roof. Flat-plate floors with balcony slab cantilevers ≤ 3.5 m beyond that floor's column line, each ribbon edged with a ${res.BALCONY_GUARD.h} m frameless see-through glass balustrade (solid shoe and top rail) and split into ${A.structure.towers.map((s) => s.balcony.unitsPerFloor).join(' / ')} units per floor by floor-to-soffit privacy dividers set on every ${A.structure.towers[0].balcony.dividerBays}th window mullion. Balcony and terrace edges are rounded where the cantilever and depth limits crease them. |`);
md.push('| Penthouses | Two separate generators (plan/penthouse-tall.js, plan/penthouse-short.js) read the top floorplate, column ring, core and ribbon rotation without changing the typical floors. Tower 1 "Sky Villa" duplex: PH1 principal floor (4.5 m level, recessed curved glass just outside the column line, wraparound terrace continuing the ribbons, bedroom terrace screened by planters); 1.7 m crown slab (structure, basins, drainage, pool plant allowance) overhanging the PH1 terrace; PH2 glass pavilion wrapped around the private elevator foyer, a double-height (≈ 10.4 m) living room facing south-west, a crescent infinity-edge pool over the enclosed PH1 floor inside the column line plus a 0.45 m edge-beam allowance, a separate raised spa, dining and summer kitchen under a thin canopy blade on slim posts, a sunken conversation lounge, a louvred mechanical court, built-in planters and two small sculptural trees. Tower 2 "Garden Pavilion": full-floor residence (4.6 m) on a 1.6 m plinth, glass recessed up to 6 m on the south-west for a broad asymmetrical terrace, curvilinear plunge pool inside the column ring, separate raised spa on the column line (edge-beam allowance), dining, summer kitchen and shaded lounge under a white roof overhang, planted windbreaks and a small tree on the private north-east terrace, a roof garden room over the core (private elevator arrival) with a louvred mechanical court under its roof and a planted roof terrace. Furniture and planters are placed by a clearance search (inside guards, off glass walks, clear of pools and each other). Miami precedent principles used (no recognisable feature copied): full-floor / duplex living, recessed floor-to-ceiling glass, private elevator arrival, tall principal rooms, wraparound terraces, private pool and separate spa, shaded outdoor dining and summer kitchen, integrated planting, concealed plant, a roof form that completes the tower. |');
md.push('| Residential garage screen | Parametric wave fins (8 desktop / 6 mobile) wrapping the podium at the two parking levels, 0.45–1.0 m deep, ≈ 80 % open for natural ventilation (assumed, not calculated); the wave runs unbroken all the way round the podium — past the lobbies, over the galleria portals and in front of the garage stair cores, which take their light and air through the open screen — with no gap where a signage panel once stood; warm recessed light strips under two fins. Behind the fins the podium reads as one material the whole way round (shadowed deck openings between white slab edges) — the occupied liner units on the street and plaza faces stay in the program and sit behind the screen. |');
md.push('| Office garage façade | North (lane) and east (street) faces: white piers on the office grid, charcoal deck-edge spandrels, bays of perforated metal, breeze block, folded charcoal fins, timber slat panels and planted green-wall bays; panels 0.3 m proud of the deck edge; ≥ 50 % open assumed; car-lift and loading entrances kept clear. Original composition — no murals, logos or copied buildings. |');
md.push('| Hotel pool court | Enclosed on all sides by the hotel and its service link (no pool fence at grade). Pool 26 × 6.6 m, 1.4 m deep with steps and sun shelf, 0.25 m paved deck, guest walks from the lobby and the lobby wing, cabanas, dining beside the pool bar, contained palms. BOH rooms and routes unchanged. |');
md.push('| Hotel entrance garden | Lawns with layered shrub beds (flowering accents), two shade trees, a flowering tree and palm clusters fill the open ground east of the plaza entrance, south and north of the lobby wing and beside the east street; a garden walk with low path lights links the lane to the arrival court; benches face the lawn. Tree canopies checked against building volumes (scripted). |');
md.push('| Vehicle entrances | Residential garage portal (entry / exit island, card readers, barrier arms, striped clearance gantry, white frame, soffit light, blank signage plaque, wheel guards, bollards, warning beacons, trench drain) and loading door under the arcade; office car-lift entrance (two framed bays with a central pier, lift-status lights, island, readers, arms, gantry) and loading dock; hotel valet arrival (lit entry / exit pylons with blank panels, trench drains, valet podium, key kiosk, bollards, luggage cart). Representational only: no swept paths, sight lines, queuing or gate operation modelled. |');
md.push('| Park sculpture | Original abstract sculpture replacing the fountain jets: 13 thin white plates in the rounded-triangle plan of tower 1, turned 13° each so the stack twists like the towers and swells like the garage wave screen, on a slender core over a stone plinth with warm uplights, in a calm reflecting pool. No structural, wind or public-art review. |');
md.push('| Rendering stability | No coplanar overlapping visible surfaces (scripted scan); roof bands are parapets 0.45 m above the office roofs, hotel cornices and penthouse roof fascias rise 0.3 m above their roofs; paving joints are drawn in the surface shader. Once the model is built (S 0.70–0.80) the construction drawing clears completely: survey grid, site-plan linework (streets, property, parcel, footprints, landscape outlines), curved-volume wireframes, floor-plate / mullion lines and ground-slab outlines; only road paint on the model’s own streets and the building edge lines remain. Polygon offset is used only for the massing edge-line pass (toward the camera) and the curved-volume fills (away from the camera) so the drawn CAD lines win their exact depth ties. Camera clipping range follows the orbit distance; single shadow light fitted to the model bounds, 2048 map on desktop, bias −0.00025 / normal bias 0.09. |');
md.push('| Office | Column grid set out from the parking module (lines listed in `plan/office.js`); slab-edge cantilevers 0.6 m typical, 2.4–3.0 m at offsets; 4.2 m floor-to-floor; 3 passenger + 1 service lifts. Crown block uses only column lines of the block below; its mechanical enclosure is a louvred white volume on the roof, with the crown terrace on the south and west. |');
md.push(`| Office planting | Planter rim ${office.PLANTER.rim} m, soil ${office.PLANTER.soil} m, drainage layer ${office.PLANTER.drainage} m, ${office.PLANTER.access} m maintenance strip; drip irrigation and planter drains to roof drainage assumed; hanging planting long only over parking screens, ≤ 0.6 m over frame bands above glazing. |`);
md.push(`| Resort pool | Swim depth ${res.POOL.swimDepth} m, sun shelf ${res.POOL.shelfDepth} m, basin slab + waterproofing ${res.POOL.basinSlab} m, raised terrace +${res.POOL.terraceRaise} m over a ${core.DECK_BUILDUP} m deck build-up; basin soffit at ${round(res.POOL.basinSoffitY, 2)} m, ${res.POOL.mepAllowance} m services allowance; basin carried by the podium column grid below. |`);
md.push(`| Spa | Raised spa, water ≈ ${res.SPA.depth} m deep with its floor on the structural top (no depressed slab). |`);
md.push(`| Parking | Stalls ${2.6} × ${5.4} m, two-way aisles 6.8 m, slab 0.3 m, 2.1 m car clearance; residential ramp stacked switchback; office served by two car lifts. |`);
md.push(`| Program | Residential efficiency ${ASSUMPTIONS.residentialEfficiency}, average unit ${Object.values(ASSUMPTIONS.unitNSA).join(' / ')} m² NSA, 2 penthouse units per tower; hotel room bay ${ASSUMPTIONS.hotelRoomBay} m; office efficiency ${ASSUMPTIONS.officeEfficiency}; retail liner ${ASSUMPTIONS.retailLinerDepth} m. |`);
md.push(`| Pedestrian circulation | One configuration (plan/pedestrian.js): route centrelines, type, width, surface, elevation, connected nodes, destinations, lighting spacing, furnishing zones and landscape setbacks; geometry is generated from the centrelines and merged by surface. Two straight primary lines crossing at the fountain plaza: the Central Promenade (6 m; 4.5 m through the ground-floor galleria in the podium) dead straight on z = 1.0 from the podium portal to the east sidewalk, aimed at the middle of the podium east face so it arrives under the gap in the parking screen — the galleria turns north inside the podium to clear the parking ramp and leaves on its original line to the west sidewalk — and the north–south Spine (4.5 m) dead straight on x = -8 from the north sidewalk through the plaza to the park gate on the south sidewalk. The plaza therefore IS the crossing rather than a place reached from it: a ${ped.PLAZA_R} m disc with a ${round(ped.PLAZA_R - park.FOUNTAIN.basin - park.FOUNTAIN.coping, 1)} m clear ring round the basin, entered from exactly four directions (promenade west and east, spine north and south). Secondary (2.2–3.6 m): podium arcade (covered, 2.1 m clear between storefronts and columns), office walk, hotel frontages, hotel garden walk, two paseo cross walks. Entrance zones at every principal door. Café seating only in furnishing zones beside frontages. Surfaces are flat within 75 mm (step-free in the model). |`);
md.push(`| Park | Public, unfenced, on the condo entrance axis: the fountain plaza stands on the promenade directly in front of the podium portal, so the sculpture closes the view straight out of the galleria. Four mouths only (promenade west and east, spine north and south). The hardscape was then rebalanced so the park reads as a park rather than a large plaza — the paved circle came in from 14.2 to ${ped.PLAZA_R} m (${Math.round(Math.PI * 14.2 ** 2)} → ${Math.round(Math.PI * ped.PLAZA_R ** 2)} m², −21 %) and the basin and coping from 8.2 to ${round(park.FOUNTAIN.basin + park.FOUNTAIN.coping, 1)} m (${Math.round(Math.PI * 8.2 ** 2)} → ${Math.round(Math.PI * (park.FOUNTAIN.basin + park.FOUNTAIN.coping) ** 2)} m², −33 %), leaving a ${round(ped.PLAZA_R - park.FOUNTAIN.basin - park.FOUNTAIN.coping, 1)} m walking ring that still clears the promenade's own width either side of the water. The green was organised as three rooms: a shaded garden room west of the spine (a bosque over a bench line), one open 22 × 18 m flexible lawn east of it, and the market terrace on its south edge. The art museum was then built on the lawn, grown over the market hall and the promenade pavilion, taken out to the park's own boundary on its west, east and south sides, and finally carried north to the plaza itself: its ground floor's face is an arc ${round(mus.MUSEUM.arcR - ped.PLAZA_R, 1)} m outside the paved ring, concentric with the fountain, so the two corners either side of the spine are built and the plaza reads as a round room with glass wrapped round its south half. The park's whole south half is therefore the building, and what is left green is the plaza with its four sector lawns, the two wedges between the promenade's plaza mouths and the museum's north corners, and the museum's own planted street frontage. Only one storey comes out to the plaza — the three-storey bar stays behind z = ${round(mus.MUSEUM.zb, 1)} — because the hero camera stands south-west of the park with the museum between it and the fountain: over a ${round(mus.MUSEUM_DECK1, 1)} m apron, with the third floor stepped back again above it, the fountain reads 97 % desktop / 85 % mobile and the hotel's park entrance 77 %, where behind a ${round(mus.MUSEUM_TOP, 1)} m wall on the same arc they measure 0 % and 2 %. Lawns run out to a boundary that follows what really bounds the open ground; paving and buildings sit over the grass, so the lawns stop at the block edge rather than at every path. Private areas (residential deck, hotel pool court) are not on any public route. |`);
md.push(`| Park planting | Shade is designed, not scattered. It used to be a bosque of two staggered rows in the garden room plus groups at the plaza mouths; the museum stands on all of that ground now, so what is planted is the ring round it — the sector lawns above the promenade, the wedge between the plaza's east mouth and the apron's north-east corner (a broad canopy and a flowering accent), and the museum's south frontage strip, which carries the same street trees and two rows of shrubs as the condo podium's and the office's frontages either side of it. Palms are axial and entrance markers only, never the primary shade: pairs flank the promenade's two plaza mouths and the spine's north mouth, and the south mouth of the museum's passage. Two pairs went to the building — the park gate's, when it reached the south frontage (the passage's south pair marks the gate instead), and the plaza's south mouth, where the apron now stands 1.4 m off the paved ring and that mouth is marked by the lit 9 m passage portal itself. Counts are checked per tier (4–16 desktop, 3–10 mobile, with planting in the wedge and at least three street trees on the frontage; the floors came down from 12–16 as the museum took park ground). Species, soil volume, irrigation, establishment and maintenance are not designed. |`);
md.push(`| Park structures (M) | The park once had three single-storey structures holding its edges: a market hall with a garden café on the south-east corner, an open promenade pavilion on the east wedge, and the paseo colonnade. The art museum was then built across the park's open ground and grown over the ground the first two stood on, so both were removed rather than left standing against it — a café and a shade shelter either side of a three-storey building read as leftovers, and the museum needed their footprints. Their walks, doors, forecourt, terrace seating and bike stands went with them, and the café is gone from the park; the nearest remaining ones are the hotel's café and the office coffee bar. The colonnade stayed for a time, as a free-standing covered walk west of the spine on the paseo, and was then removed as well so the lawn it stood on could be planted: the paseo is now a dense tropical garden — a canopy of broad shade trees in staggered ranks, two poinciana-like trees with a high canopy beside the spine, small flowering trees in the gaps, palm clusters of varied height round the first four palms, and a shrub and grass understory, with one lawn clearing and the spine-edge benches kept open; measured over the lawn, the share under a canopy, a palm crown or a shrub rose from 25 % to over 60 % on desktop. No park structure now remains. Massing only: no structure, envelope, servicing, occupancy or code compliance is designed or verified. |`);
md.push(`| Street traffic | Once built, the travelling cars circulate round the block at ${traffic.TRAFFIC_SPEED} m/s on the street ring's two lane loops (inner ${traffic.TRAFFIC_LANES.inner.offset} m and outer ${traffic.TRAFFIC_LANES.outer.offset} m off the curb, opposite directions, never crossing); parked and arrival cars stay put. It is the scene's only ambient motion: drawn at 30 fps while the hero is on screen (full display rate only while scrolling, dragging or building), stopped off screen and in hidden tabs, absent for reduced motion and frozen QA states, and switched off with ?heroTraffic=off. Travelling cars cast no shadow-map shadow (the map is drawn once for the settled model) and carry a soft contact shadow instead. |`);
md.push('| Water movement | Shader ripples advance only on frames already rendering (the traffic\'s 30 fps frames while the hero is on screen; nothing extra is drawn for them); jets are static geometry. |', '');

md.push('## 3. Unresolved — requires professional review or missing inputs', '', '| Matter | Status in the model | Missing input / review needed |', '|---|---|---|');
md.push('| Zoning, FAR, height, setbacks, open space, parking minimums | **Undetermined.** The site is hypothetical, so no zoning compliance is claimed. | A real parcel (folio / address) and jurisdiction, then verification against the current code from authoritative sources (e.g. Miami 21 or the City of Miami Beach Land Development Regulations, if in those cities). |');
md.push(`| Tower structure | Geometry is coherent: continuous core and columns, ≤ 3.5 m cantilevers, no tower-floor transfers. Long perimeter spans of ${A.structure.towers.flatMap((s) => s.longSpans.map((l) => `${l.span} m`)).join(', ')} where the ring crosses garage aisles. | Structural engineer: lateral system (core walls/outriggers), flat-plate/PT design, balcony cantilevers and thermal breaks, edge beams at long spans, column sizes, foundations, wind/hurricane loads, drift. |`);
md.push('| Garage façades | Openness and ventilation assumed from the geometry, not calculated. | Mechanical / code review of natural ventilation openness, fire separation to liner units, screen attachment and wind loads, lighting design (glare, spill, dark-sky), maintenance access to planted bays. |');
md.push('| Office cantilevers | 2.4–3.0 m slab-edge cantilevers at offsets; no transfers. | Structural design (PT/steel), deflection and façade tolerance; soffit fire rating of timber. |');
md.push(`| Resort pool basin | Soffit ${round(res.POOL.basinSoffitY, 2)} m leaves ${rpk.pool.clearHeight} m clear over P-L3 aisles/stalls with a ${res.POOL.mepAllowance} m allowance; ${rpk.pool.supportingColumns} podium columns under/near the basin. | Pool engineer and structural engineer: water/soil loads, basin slab depth, drainage falls, balance tank and plant room location, waterproofing, and beam depths over P-L3. Health-department pool rules. |`);
md.push(`| Block south frontage | The condo podium, the art museum and the office all now carry the same planted strip on the block's south street: a ${round(3.2, 1)} m lawn on the same lines (z 51–54.2), two rows of shrubs along it and street trees at z 52.6. The museum's was added when the building reached that frontage — its street side had been the park's bare frontage paving, which read as a glass wall standing on asphalt. The park gate walk crosses the strip on the spine, the palms flanking the passage's south mouth stand in it, and it runs unbroken the whole width of the building: the museum's cascades come down its park elevation, not this one, so nothing is cut out of the planting for water. | Landscape architect: species, soil volume, irrigation, street-tree standards and utility clearances; municipal street-tree and frontage requirements. |`);
md.push('| Planting loads | Planter depths modelled; loads not computed. | Saturated soil and tree loads, drainage and irrigation design, wind uplift on palms, landscape architect species selection. |');
md.push(`| Parking supply and circulation | ${rpk.total + A.parking.office.total} modelled stalls vs ${rng2(dsum)} estimated demand; ramps and lifts geometric only. | Parking/traffic consultant: shared-parking study, valet/off-site options, ramp transitions and sight lines, car-lift capacity and queuing, accessible and van stalls, EV and bicycle requirements. |`);
md.push(`| Park art museum | A three-storey glass building astride the park's north–south spine, terraced toward the park and flush to the street: two glazed volumes at grade either side of the walk, the two gallery floors bridging across above them on an expressed white plate. ${round(mus.MUSEUM.x1 - mus.MUSEUM.x0, 1)} m wide and ${round(mus.MUSEUM.z1 - mus.MUSEUM.zb, 1)} m deep at the ground floor, to a ${round(mus.MUSEUM_TOP, 1)} m parapet. Every plan corner is rounded on a ${round(mus.MUSEUM.corner, 1)} m radius, and the shoulders where the apron's arc meets its flanks are blended over ${round(1.2, 1)} m, so no outline on the building turns more than 23° at a vertex. ${Math.round(Math.abs(polygonArea(mus.MUSEUM_GROUND_W)) + Math.abs(polygonArea(mus.MUSEUM_GROUND_E)))} m² at grade, ${Math.round(Math.abs(polygonArea(mus.MUSEUM_L2_PLAN)))} m² on the second floor and ${Math.round(Math.abs(polygonArea(mus.MUSEUM_L3_PLAN)))} m² on the third, ${Math.round(Math.abs(polygonArea(mus.MUSEUM_GROUND_W)) + Math.abs(polygonArea(mus.MUSEUM_GROUND_E)) + Math.abs(polygonArea(mus.MUSEUM_L2_PLAN)) + Math.abs(polygonArea(mus.MUSEUM_L3_PLAN)))} m² in all. The walk keeps its line, its width and its clear zone and runs through a ${round(mus.MUSEUM.gapE - mus.MUSEUM.gapW, 1)} m passage with ${round(mus.MUSEUM.ground, 1)} m of head height, a shaded soffit and recessed light lines; slim columns carrying the bridge stand outside the clear zone, and nothing — column, planter, wall, canopy or art — stands in it. Seamless floor-to-ceiling glass, floor plates stopping flush with it, warm gallery light and display walls on a loose 8 m grid inside, a light stone forecourt off the passage and low planting at the south mouth. It is the model's one see-through envelope: a glaze of its own (GLAZE.museum) draws full-height panes on a ${round(mus.MUSEUM_PANE, 1)} m module meeting at flush silicone joints, and the material carries alpha, so you look through the galleries rather than at a reflective skin — which is also why all three floors carry a plate (stone at grade, flush with the walk outside; slab above): in an opaque building a missing floor shows nothing, here it shows the park's grass running on under the galleries, and the plates are checked point by point. The section is the building, and everything it does, it does toward the park. The third floor steps back ${round(mus.MUSEUM.z3n - mus.MUSEUM.zb, 1)} m from the second, leaving a planted terrace, open along its edge; below that the single-storey apron carries the ground floor a further ${round(mus.MUSEUM.zb - mus.museumNorthAt(-8), 1)} m north on the spine and ${round(mus.MUSEUM.zb - mus.MUSEUM.zn, 1)} m on the flanks, out to the plaza. The street elevation is the opposite: flush at all three storeys, its faces lined up to under 20 mm, with nothing stepped and no water on it — it meets the frontage garden as a plain wall of glass. Two cascades come down the park face, one on each wing either side of the passage, both of them looking at the fountain: a pool on the roof garden spills through a spout in the parapet at ${round(mus.MUSEUM_DECK3, 2)} m, falls to a pool on the terrace at ${round(mus.MUSEUM_DECK2, 2)} m, spills again onto the apron's roof at ${round(mus.MUSEUM_DECK1, 2)} m, and falls a third time into a basin at grade in the band between the apron's edge and the park's own ground — three falls of about 4.5 m apiece, every one of them landing in the pool beneath it. On the west wing that last edge is the arc, so its pool, spout, sheet and basin are set on the arc's tangent; on the east wing the edge is the straight cap, so they sit on the building's own grid. A circular stair winds up inside a glazed drum from the ground floor to a head on the roof at ${round(mus.MUSEUM_TOP, 2)} m, level with the parapet: 77 treads on a ${round(mus.MUSEUM.stair.rise, 2)} m rise, ${mus.MUSEUM.stair.perTurn} to a turn, standing in the east wing because it is the larger of the two and a ${round(mus.MUSEUM.stair.r * 2, 1)} m drum costs it the least floor. The roof it lands on is a garden — beds of shrubs and small palms on a loose grid over ${Math.round(Math.abs(polygonArea(mus.MUSEUM_L3_PLAN)))} m², a slatted pergola with benches, and both cascades' source pools — and the park terrace below it is planted the same way. The way in is the passage: one glazed entrance into each wing, facing each other across the walk and set back from its clear width, each with a canopy blade and a light line over it. The building grew three times before that: first over the market hall and the promenade pavilion, then out to the park's own boundary — west to the line the paseo's south end sets, south to the park's frontage strip, and east as far as the office coffee bar's terrace, which sits on that margin and stops it 2.1 m short of the office walk — and finally north to the plaza. That last move is the curved one: the ground floor's north face is an arc concentric with the fountain, ${round(mus.MUSEUM.arcR - ped.PLAZA_R, 1)} m outside the ${round(ped.PLAZA_R, 1)} m paved ring, held at z = ${round(mus.MUSEUM.zn, 1)} on the two flanks where it would otherwise run past the promenade's plaza mouths and take the palms marking them. What comes out to the plaza is one storey under a plate at ${round(mus.MUSEUM_DECK1, 2)} m, with the three-storey bar behind z = ${round(mus.MUSEUM.zb, 1)}, and that is a measured decision rather than a preference: the hero camera stands south-west of the park with the museum between it and the plaza, so a ray from the fountain clears the apron but not the bar. Over the apron, and with the third floor stepped back from the plaza as well, the fountain reads 97 % desktop / 85 % mobile from the hero camera — better than the 82 % the park had before the museum was built — and the hotel's park entrance 77 %; with the bar itself brought out to the same arc they measure 0 % and 2 %. What the growth cost the park is the whole of its 22 × 18 m flexible lawn, the garden room and its bosque, the park gate's palm pair and the plaza's south-mouth pair; the canopy count round the plaza came down from 12 to 4, and the museum's street frontage is planted like its neighbours' to make up some of it. The detail was then worked up without moving anything. The curtain wall was later made seamless: each pane runs the full height of its storey from floor plate to floor plate, with no sill or head spandrel, transom or fin, on a ${round(mus.MUSEUM_PANE, 1)} m module (twice the earlier 1.55 m bay), meeting the next at a flush 24 mm silicone joint drawn half-toned and fading out with distance, all panes one tint — so between the white floor plates each elevation reads as a single sheet of glass. The plates were then pulled back to the glass: every floor plate, slab band and the roof parapet now stops ${round((0.3 - mus.PLATE_EDGE) * 1000)} mm proud of the glass line instead of projecting 0.55 m past it, so the floors read as thin lines at the face of the glass rather than as ledges; the column rows and their edge beams moved just inside the glass so nothing breaks the face, the apron's two pools moved back onto the pulled-in plate, and the spouts, falls and moat stayed where they were, so each spout now cantilevers past the flush edge. The receiving moats were then rebuilt, because the water in them sat inside a solid stone block and could not be seen, the west one was a straight bar laid across a curved edge that ran under the glass at its ends and up to the plaza's paving, and both trailed a one-sided stub of channel: each cascade now ends in a single basin of open water built like the pools above it — a pale rim ${round(0.2 * 1000)} mm wide standing 0.35 m off the lawn, a dark waterline tile band, the water 120 mm below the rim — on the west wing a band concentric with the fountain that follows the apron's curve, stopped short where the wing's rounded corner by the passage swings out ahead of it, and on the east wing a rounded-end basin along the straight cap, both 0.2 m in front of the glass and clear of every walk and the plaza's paving, the east one the larger under the larger fall; the spout lips were shortened to the flush edge and each sheet drops into the middle of its basin, breaking on the surface. The basins were then made to wrap the building's park face: each is a channel of water of one constant width, the same on both wings (1.2 m with a 0.2 m rim, about 0.64 m of open water, which is what the west wing's curve allows between its glass and the plaza's paving), following its wing's glass at a constant 0.2 m wherever the building faces the park — along the north face, and round each corner only as far as the wall still faces within 45° of north, so it never runs down a side of the building — stopping, with a rounded end, wherever it would meet the passage walk, the plaza's paving or any other walk or paving; its sides are offset along normals smoothed over the glass line, so the width holds within a centimetre through the shoulder where the arc meets the flank. The bridge's column rows were started south of each wing's rounded corner at the same time, since the channel showed the first column in each outer row standing outside the glass in the curve of the corner. The falling sheets are now a thinner sheet in the lighter shallow-water blue the other pools use for their shelves, with pale aerated strips down both edges, landing in a churned patch sized to each basin's water; a low planted margin of groundcover and grasses sits on the lawn round their open sides; and the basins count as blocked ground, so the walks' lights shift clear of the water and no tree trunk stands at its edge. The bridge is expressed — every column has a spread base and a head bracket, a white edge beam ties each row at the underside of the second floor, and white transfer ribs cross the passage on the column grid, coming down to the clear height and no further: measured by ray from the walk itself, the lowest ceiling over its full width is exactly ${round(mus.MUSEUM.ground, 2)} m, with ${round(mus.MUSEUM.ground + 0.1, 2)} m between the ribs. The passage is coffered and lit: a dark soffit field set 100 mm up inside the slab, a light line straddling the face of each coffer, and a low wash along both walls. Both entrances carry dark bronze stiles and rails against the white lining, a light stone threshold band standing 16 mm proud of the paving, a deeper canopy blade with its light line recessed under the front, and a warm line of lobby light on the wall inside. The galleries read as galleries: display walls of two heights, each washed from above and hung with two or three dark panels in different proportions, plinths carrying pale abstract pieces, a low bench opposite. The roof garden is laid out rather than scattered — a walk along the north parapet with a bench line facing the fountain, four planted bands running the building's length, palms punctuating the second, a pergola and benches at the centre. The water detail was slimmed to 140 mm rims standing 70 mm proud, with the still pools in the pool tone and the falling sheets 90 mm thick in the paler one. Low tropical planting drifts along the west face and round the apron's curved edge, stopping at knee height so the transparent ground floor still reads as transparent. A second pass then worked the museum up as a museum rather than as a massing study, without moving anything, and a third deepened it: the roof carries a planted ground of nine islands and drifts along the parapets rather than a few beds in paving, the two cascades were widened again to ${round(mus.MUSEUM.fallE.w, 1)} m on the east wing and ${round(mus.MUSEUM.fallW.w, 1)} m on the west with pools ${round(4.6, 1)} m deep to match, the receiving channels were rebuilt as one constant-width rill per wing with a single wider basin under the falling water, a stone rim and a darker floor showing under the surface, and the stair head was raised to meet the lift so both top out together at ${round(mus.MUSEUM_CORE_TOP, 2)} m. The head itself was then opened: below the roof the stair is a glazed tube, above it a curved glass wall with a 48° doorway cut out of it on the landing bearing — 1.9 m of clear opening between bronze jambs, with a stone threshold running out onto the garden's paving, a light line under the head and a white plate lapped past the drum for a roof. It is a way out rather than a lid with a door drawn on the inside of it. The lift was then built the same way and turned to match: its landing doors face west at every level, the side the stair's doorway faces, and above the roof its head is walled on three sides with the fourth left open under its own plate. Both heads top out together, both open the same way, and the two arrivals share one strip of stone floor. The roof is a sculpture garden: a light stone field with darker joints setting out a walking loop from the stair and lift arrival past a sculpture court to the north overlook, four planted islands drawn as overlapping rounds so their edges curve like the building, a pale concrete seat let into each island's rim, one principal work on a low plinth with room around it and two smaller pieces apart from it, small palms set in the islands' lee so the view out stays open, and a white fin canopy with benches under it. The two cascades are parameterised end to end — one width on MUSEUM.fallW / fallE drives the pool, the lip, the sheet, the apron rill and the moat together — so the east wing, the larger of the two, carries a ${round(mus.MUSEUM.fallE.w, 1)} m run against ${round(mus.MUSEUM.fallW.w, 1)} m on the west, wider at every drop rather than a broad pool feeding a narrow spout. The parapet is notched at both bays, its outer path dipping to meet its own inner face so the water leaves over an open lip. Each cascade now lands in a shallow receiving channel that follows the building's edge — the arc on the west, the straight cap on the east — narrow along its length and widening under the falling water, in two separate runs that never cross the passage, never touch a threshold, and keep their distance from both the glass above and the plaza's paving in front. The galleries are laid out as rooms: walls set at alternating depths with a sightline between them, an open bay for sculpture, benches, artwork of three different hangs in white frames standing proud of the wall, plinths with pale abstract pieces, and track lighting with three heads over each wall instead of a glowing strip; the ground floor takes the arrival, with a reception desk and an orientation wall facing each passage door. The vertical core was rebuilt: one flight per storey, each dividing its own storey into equal risers and turning ${round(mus.MUSEUM.stair.turns, 2)} of a revolution so it arrives on its landing, wedge-read treads on a stepped stringer, a rail at every step, landings in real openings cut through every plate and glass cap the drum crosses, and door frames at each level. A lift stands beside it inside the same wing, serving all four levels on guide rails with landing doors and a threshold at each, all of them facing the same way as the stair's, its overrun capped level with the stair head so the core stays one object. A fourth pass turned the roof from a deck with beds on it into a garden. The ground is planted and the paving is cut through it: one continuous ${round(1.9, 1)} m loop from the stair and lift arrival, round past a sculpture court, a reflecting pool and the north overlook and back, with five paved clearings opening off it. Soil is laid as rounds that each take the largest radius still clear of whatever they meet, so the beds run up to the paving and the parapet margin and stop dead there with a curved, uneven edge — measured on a 0.4 m grid, 58 % of the usable garden is planted, against a brief of 55–65 %. The planting is four South Florida natives drawn with different silhouettes rather than one green ball repeated: muhly grass as fine cones at the path edges with the odd plume, coontie as a squat rosette, cocoplum as the dense broad-leaf body of the beds, bay cedar as a low mound, a few taller specimens set back from the walk, and five sabal palms in raised planters. Every position is hashed from its own coordinates, so the garden is identical on every load. Six sculptures stand in it — a folded plane in the principal clearing, a turning ribbon in brushed steel, a pierced stone monolith, a balanced composition on charcoal, and two smaller pieces to come across in the planting — each on its own base, each a different shape and material, none of them in the walk, each with a low uplight. The water was then rebuilt to be the model's own pool water rather than a museum variant of it: every still surface — both cascades at all three levels, the reflecting pool and the moat at grade — is the same 'pool' blue on the same water glaze as the resort, hotel and penthouse pools, set 120 mm under its deck inside a dark waterline tile band and a pale coping standing 80 mm proud, exactly as plan/pools.js builds them, and the weirs, sheets and splash are in the same blue. The water glaze was made view-independent for every pool in the model at the same time: no specular term, direct or reflected, on water — only the palette colour, the ambient light and the moving ripple — so a pool no longer washes out toward the sky at a low angle or deepens seen from above. Every pool is a rounded rectangle on a 0.92 m corner, let into its plate through a rounded opening cut in the slab so the rim laps over the cut. The apron and the park terrace are then grassed edge to edge: lawn over everything that is not a pool, a weir or a spout, stopping 150 mm inside the edge of its plate and 300 mm short of the storey above, following that storey's rounded corners and wrapping each pool's rounded coping, with a rank of shrubs along the glass, a low rank of grasses along the terrace's open edge, drifts of shrubs and grasses across the turf and a ring round each rill on the apron; every plant is placed only where its whole spread lands on the lawn, and nothing trails over any edge. The terrace's glass railing was removed — so the terrace is shown with no guard at a 4.7 m drop, which is a visual decision and not a code-compliant edge. The shade pavilion that stood on the roof was taken out; its seat stays. Assumed and not designed: soil depth and build-up, drainage, irrigation, root barriers and waterproofing, wind exposure at 14 m, and the roof's loading with wet soil and standing water; the species are chosen as Miami-Dade natives for their habit, and nothing here is a planting schedule. Conceptual massing only: structure and the two-storey bridge transfer, stability, fire separation and egress, glazing support, thermal and solar performance, accessibility, and gallery environmental control and daylight on art are not designed or verified. Nor is anything the water, the gardens or the core need — tank and pump sizing, filtration and water treatment, wind carry and splash control off three 4.5 m falls, the acoustics of them beside a gallery, waterproofing and root barriers under the roof garden, both terraces and the moat, soil depth, drainage, irrigation, the added dead and live load of wet soil and standing water on a spanning structure, moat cleaning and overflow, stair geometry to code (going, headroom at the landings, handrail continuity, guarding, the opening edges), lift shaft dimensions, pit and overrun, machine space, door clearances and fire-fighting or evacuation duty, the two openings cut through every floor plate and what they do to the diaphragm, roof-garden maintenance access and fall protection, and the conservation requirements of hanging real work behind a fully glazed wall — the artwork here is placed for how the building reads, not to a daylight or security standard. |`);
md.push('| Building entrances | Every principal pedestrian entrance is a built door rather than a dark panel painted on the storefront, and glazed throughout: a glass screen fills the opening, glass leaves in slim metal stiles and rails with vertical pull handles stand in front of it, and the transom over them is glass too. A white lining frames it all but flush, on a stone threshold, with a light line in the head reveal. Fourteen entrances carry one (two hotel restaurant fronts, the hotel guest entrance and bell desk, both office lobby doors, both tower lobbies, both podium stair doors, the galleria portal facing the park, and two into the art museum, one to each wing, facing each other across the passage, which is how that building is entered); the galleria lobby door is the exception, because the passage is modelled as rooms with no wall to hang a door on. Conceptual only: leaf swing, clear widths, hardware, thresholds and accessible approach are not designed, and no accessibility standard is claimed. |');
md.push(`| Hotel pool court wall | The court's west side was a 21 m opaque service bar dressed in piers and a cornice; decorating it never stopped it being a service shed on a public walk, so it was removed rather than restyled, and servicing was replanned down the arrival wing instead. The open side of the U is now closed by a garden wall standing in the plane of the two wing ends, x = ${round(hotel.COURT_WALL.x, 1)}: ${round(hotel.COURT_WALL.z1 - hotel.COURT_WALL.z0, 1)} m long at ${round(hotel.COURT_WALL.h + hotel.COURT_WALL.coping, 1)} m, one ${round(hotel.COURT_WALL.thick, 2)} m leaf with nothing above it, lapped into each wing's corner, with a single gate the hotel controls, so the west elevation runs unbroken from one wing to the other and nothing projects in front of them. The pool deck came back to the same line, giving up ${round((6.0 - 1.8) * (hotel.HOTEL_POOL.court[3] - hotel.HOTEL_POOL.court[2]) * -1)} m² of court; that ground is now lawn on the public side of the wall and carries the planting. Vines are trained over the coping and hang down both faces, and on the paseo side a grove of trees, palms and shrubs stands in front of the wall, so what the walk reads is planting rather than masonry. This is a deliberate reversal of the earlier planted-edge scheme, which kept the garden's upper space open to view: the pool is now screened outright. Conceptual only: wall construction, footings, lateral support, barrier height, gate hardware, opening sizes and climbability are not designed or verified, and no pool-barrier standard is claimed. |`);
md.push(`| Hotel arrival and frontage | Two front doors, one route. The park-facing marquee under the tower is the civic pedestrian entrance and the east porte-cochère is the vehicular one; both reach the same reception desk at (${hotel.RECEPTION[0]}, ${hotel.RECEPTION[1]}) and the same lift door on a declared ${hotel.GUEST_ROUTE.width} m clear passage that turns south of the tower core and then runs up its west side. The route is tested as a route — sampled along its centreline and both edges against the lift core, the indoor seating band and every service room — rather than as a row of touching rectangles, which is what the earlier assertion did; the "unbroken 50 m sightline" it implied was never supported by the geometry and the claim has been withdrawn. Indoor seating sits between the passage and the glazing (${round(hotel.DINING_BAND[3] - hotel.DINING_BAND[2], 1)} m deep over ${round(hotel.DINING_BAND[1] - hotel.DINING_BAND[0], 0)} m), which is also where the park view is. Back of house runs behind in its own band and touches the guest side only at the two declared kitchen doors. Conceptual clear-passage allowance only: no accessibility, egress or occupancy conclusion is claimed. |`);
md.push(`| Hotel facade | The guest-room facade shader ran on a 3.6 m bay while the plan's room module was 3.8 m, so no modelled pier ever stood on a window line. Both now come from ${hotel.FACADE_BAY} m, and the shader's phase constant is an exact multiple of it, so bay boundaries fall on perimeter run = 0. Piers and fins are placed by \`bayLines()\`, which walks the same perimeter coordinate the shader uses (\`across\` in layers/curves.js) instead of guessing world-x positions beside it. The tower takes a central emphasis — two reeded piers on bay lines running unbroken from the marquee through the crown, with quieter flanks outside them — and the wing stays horizontal: fins on the same lines but stopped well below the parapet, continuous eyebrows, and one crown band. |`);
md.push(`| Hotel U-plan | The court is formed by three wings around an open west side. Its two arms used to stop on different lines — the plaza wing at x = 6, the rear wing 8 m further west at x = -2 — so the U read as lopsided. The plaza wing cannot go west without meeting the fountain plaza, so the rear wing was brought back to x = 6 to match. Both arms now terminate on the same line. Cost: rear plate ${Math.round(Math.abs(core.polygonArea(hotel.HOTEL.rear)))} m² (808 m² before) over 6 floors, and the back-of-house rooms that sat west of the new face — main electrical, staff lockers, the BOH corridor's west end and the west service stair — were replanned inside it. |`);
md.push(`| Hotel massing | 7-storey plaza wing held back to z = -7.6 so the Central Promenade runs dead straight into the podium portal; its west end cut back to x = 6 to clear the fountain plaza. The Deco tower stands on the corner nearest the fountain, 12 occupied storeys to ${round(hotel.HOTEL_TOWER_TOP, 1)} m, set 0.4 m in from the wing's west face and 0.6 m from its north so no two facades share a plane, 2.4 m proud on the plaza, turning the corner on a 5 m streamlined drum. Above the last floor it gathers into a stepped crown — recessed shoulders, then two progressively smaller stages, then a compact lantern — reaching ${round(hotel.HOTEL_CROWN_TOP, 1)} m. That replaces a single broad screened cap at 45.0 m, which had flattened the silhouette, and before that a four-piece step/step/finial/spire stack at 52.4 m; the point is the taper, not the height. The plant is concealed in the louvred first stage; plant sizing, access and maintenance are not designed. The two reeded piers of the tower's central emphasis run unbroken from the marquee to the second stage, so the entrance composition and the crown are one idea. Wing plate ${Math.round(Math.abs(core.polygonArea(hotel.HOTEL.front)))} m² over 7 floors; tower plate ${Math.round(Math.abs(core.polygonArea(hotel.HOTEL.tower)))} m² over 12, of which the lower 7 sit inside the wing's envelope. |`);
md.push('| Egress, fire and life safety | Stair counts allocated in cores; pedestrian routes checked only for continuity, clear width and obstructions in the conceptual geometry; the new podium galleria is not assessed for smoke control, separation from parking or exit capacity. | Fire/life-safety and code consultant: occupant loads, exit widths and travel distances, galleria separation and smoke control, hose and fire-truck access, sprinkler and alarm, lift traffic. |');
md.push('| Elevators | Allocations only (see cores table). | Vertical transportation traffic analysis for each building. |');
md.push('| Accessibility | Every principal destination is connected by a step-free route in the model (walking surfaces within 75 mm, no stairs on any route), primary routes ≥ 4.5 m and secondary ≥ 1.8 m clear, entrance zones ≥ 1.5 m; driveway crossings are continuous raised sidewalk. Slopes, cross-falls, joints, detectable warnings, curb-ramp geometry, door hardware and pool access are not modelled. | Accessibility review (ADA 2010 Standards / Florida Accessibility Code): route slopes and cross-slopes, level transitions, curb ramps, detectable warnings at crossings, accessible parking and drop-off, pool lifts or sloped entries (resident, hotel and penthouse pools), penthouse terrace thresholds. |');
md.push('| Pedestrian / vehicle crossings | Seven driveway crossings modelled as continuous sidewalk paving on a raised table with contrasting edge bands; sight triangles 3 m either side kept clear of trees, poles and furniture over 0.9 m; hotel arrival drive split into separate entry and exit cuts. | Traffic engineer: sight-distance calculations, driveway widths and flares, gate and car-lift queuing, signage and warning devices, loading and refuse vehicle swept paths. |');
md.push('| Penthouse crown, pools and spas | Geometry only: Tower 1 pool over the enclosed PH1 floor within the column line plus a 0.45 m edge-beam allowance, never over the double-height room; Tower 2 pool inside the column ring on the plinth; spas raised; basin soffits within their structural zones. | Structural engineer: crown / plinth as transfer structures, edge beams, water and saturated-planter loads, canopy blade and posts, double-height room lateral support; pool engineer: infinity-edge trough, balance tank, plant space; waterproofing and drainage; wind on furniture, planters and small trees at height; guard loads. |');
md.push('| Hotel back of house | Ground-floor footprints and connections modelled; café supply via the lobby gallery off-hours is an operational assumption. | Hospitality operator / kitchen and laundry consultants: sizing, loading dock count, truck turning, waste volumes, upper-floor BOH. |', '');

md.push('## 4. Tests performed and not performed', '');
if (tests) {
  md.push(`Environment: ${tests.environment}`, '');
  md.push('| Test | Viewport / settings | Result |', '|---|---|---|');
  for (const t of tests.tests) md.push(`| ${t.name} | ${t.settings} | ${t.result} |`);
  md.push('');
  md.push('**Not performed**', '');
  for (const n of tests.notPerformed) md.push(`- ${n}`);
} else {
  md.push('No test log found (tools/hero3d/test-log.json).');
}
md.push('');
writeFileSync(join(here, 'validation-register.md'), md.join('\n'));

// console summary
const failed = checks.filter((c) => !c.pass);
console.log(`${pass}/${checks.length} checks pass`);
for (const c of failed) console.log(` ❌ [${c.area}] ${c.name} — ${c.detail}`);
console.log('visibility', JSON.stringify(vis));
console.log(`parking: residential ${rpk.total}, office ${A.parking.office.total}; demand ${rng2(dsum)}`);
console.log('wrote tools/hero3d/validation-register.md and tools/hero3d/plans/*.svg');
process.exitCode = failed.length ? 1 : 0;
