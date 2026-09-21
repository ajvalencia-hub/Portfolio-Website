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
const pav = await load('plan/pavilions.js');
const ped = await load('plan/pedestrian.js');
const street = await load('plan/streetscape.js');
const { analyseSite, ASSUMPTIONS } = await load('plan/program.js');
const planting = await load('plan/planting.js');
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
  // the flexible lawn: the largest rectangle inside the declared lawn that no trunk,
  // building, paved route or furnishing zone intrudes on
  const FL = park.FLEX_LAWN;
  const obstacles = [
    ...p.trees.filter((t) => t.y < 1.2).map((t) => [t.x, t.z]),
    ...p.palms.filter((t) => t.y < 1.2).map((t) => [t.x, t.z]),
  ].filter(([x, z]) => x > FL[0] && x < FL[1] && z > FL[2] && z < FL[3]);
  const lawnOpen = !obstacles.length
    && !ped.ROUTES.some((r) => ped.routeCentreline(r).some(([x, z]) => x > FL[0] && x < FL[1] && z > FL[2] && z < FL[3]))
    && ![pav.MARKET.plan, offsetPlan(pav.MARKET.plan, pav.MARKET.canopy.out), pav.PAVILION.roof, hotel.HOTEL.front]
      .some((pl) => pl.some(([x, z]) => x > FL[0] && x < FL[1] && z > FL[2] && z < FL[3]))
    && Math.hypot(Math.max(FL[0], Math.min(ped.FOUNTAIN_CENTRE[0], FL[1])) - ped.FOUNTAIN_CENTRE[0],
      Math.max(FL[2], Math.min(ped.FOUNTAIN_CENTRE[1], FL[3])) - ped.FOUNTAIN_CENTRE[1]) >= ped.PLAZA_R;
  check('Park', `${T} one flexible lawn measuring ${round(FL[1] - FL[0], 1)} × ${round(FL[3] - FL[2], 1)} m is clear of trunks, paths, furnishing zones and buildings (target ≈ 22 × 18 m)`,
    lawnOpen && FL[1] - FL[0] >= 18 && FL[3] - FL[2] >= 18, `${obstacles.length} obstructions`);
  const parkWindow = (q) => q.x > -23 && q.x < 19 && q.z > -13 && q.z < 52;
  const canopies2 = p.trees.filter((t) => t.y < 1.2 && parkWindow(t));
  const want = tier.name === 'mobile' ? [7, 10] : [12, 16];
  check('Park', `${T} the park carries ${canopies2.length} canopy trees (target ${want[0]}–${want[1]} on ${tier.name}), palms used only as axial and entrance markers`,
    canopies2.length >= want[0] && canopies2.length <= want[1] && p.palms.filter((q) => q.y < 1.2 && parkWindow(q)).length <= canopies2.length,
    `${canopies2.length} trees, ${p.palms.filter((q) => q.y < 1.2 && parkWindow(q)).length} palms`);
  const hallBB = [Math.min(...pav.MARKET.plan.map((q) => q[0])), Math.max(...pav.MARKET.plan.map((q) => q[0])), Math.min(...pav.MARKET.plan.map((q) => q[1])), Math.max(...pav.MARKET.plan.map((q) => q[1]))];
  const blocksAxis = (hallBB[2] < ped.PROMENADE_Z + 3.5 && hallBB[3] > ped.PROMENADE_Z - 3.5) || (hallBB[0] < ped.SPINE_X + 2.6 && hallBB[1] > ped.SPINE_X - 2.6);
  check('Park', `${T} the market hall (${Math.round(Math.abs(polygonArea(pav.MARKET.plan)))} m²) holds the park's south-east edge and blocks neither primary axis`,
    !blocksAxis && hallBB[0] >= 0 && hallBB[3] <= 50.6, `x ${round(hallBB[0], 1)}–${round(hallBB[1], 1)}, z ${round(hallBB[2], 1)}–${round(hallBB[3], 1)}`);

  const mouths = park.PLAZA_LINKS.map((l) => l.route);
  check('Circulation', `${T} the plaza is entered from exactly four directions, each of them a primary route mouth (${mouths.join(', ')})`,
    park.PLAZA_LINKS.length === 4 && mouths.every((id) => ped.ROUTES.find((r) => r.id === id)?.type === 'primary'));

  // --- park structures (plan/pavilions.js) -----------------------------------------------
  const hallPts = pav.MARKET.plan;
  const svcR = rectOf(byName['M.service']);
  const colR = rectOf(byName['M.colRoof']);
  const walls = [...hallPts];
  const onWalk = walls.filter(([x, z]) => ped.onRoute(x, z, 0.35));
  check('Pavilions', `${T} the garden café stands clear of every walking surface, forecourt and the plaza`, onWalk.length === 0, onWalk.map(([x, z]) => `(${round(x)}, ${round(z)})`).join(' '));
  const hPlans = [hotel.HOTEL.front, hotel.HOTEL.tower, hotel.HOTEL.rear, hotel.HOTEL.link];
  const otherBuilding = (x, z, pad) => insidePlan(x, z, offsetPlan(res.PODIUM_PLAN, pad)) || hPlans.some((pl) => insidePlan(x, z, offsetPlan(pl, pad)))
    || ['B.poolbar', 'C.baseE', 'C.baseW', 'C.lobby'].some((n) => inRect(x, z, rectOf(byName[n]), pad));
  const nearOther = [...hallPts, ...corners(colR)].filter(([x, z]) => otherBuilding(x, z, 1.0));
  check('Pavilions', `${T} the market hall, pavilion and colonnade keep ≥ 1 m from the podium, hotel and office volumes`, nearOther.length === 0, nearOther.map(([x, z]) => `(${round(x)}, ${round(z)})`).join(' '));
  const inPark = [...hallPts, ...pav.PAVILION.roof].every(([x, z]) => insidePlan(x, z, park.LAWN_BOUNDARY));
  check('Pavilions', `${T} the market hall (${Math.round(Math.abs(polygonArea(hallPts)))} m²) and the promenade pavilion stand inside the park's own ground`, inPark);
  // --- the garden café: height, two public doors, a service door that never crosses the park
  const capTop = cTop['M.parapet'];
  check('Pavilions', `${T} the garden café is one low storey: ${round(pav.MARKET.hallH, 1)} m enclosure under a ${round(capTop, 1)} m roof edge (was a 6.4 m hall under a 2.6 m clerestory reaching 9.0 m), with nothing occupying the roof`,
    capTop >= 4.8 && capTop <= 5.2 && pav.MARKET.hallH >= 3.8 && pav.MARKET.hallH <= 4.2 && !cv['M.clerestory'], `${round(capTop, 1)} m`);
  const doorsOn = (x0, x1, z0, z1) => p.parts.filter((q) => q.color === 'void' && q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1);
  const custDoors = doorsOn(-1, 16.6, 34, 47), svcDoors = doorsOn(-1, 16.6, 48.5, 51);
  const svcClearOfPark = svcDoors.every((q) => q.z > 48.5) && svcR[2] >= 44 && svcR[1] <= 15.6;
  check('Pavilions', `${T} customers enter from the spine and the office walk (${custDoors.length} doors) while restocking and refuse use one discreet door on the south perimeter into a screened holding space — no service path crosses the lawn or the plaza`,
    custDoors.length >= 2 && svcDoors.length === 1 && svcClearOfPark, `${custDoors.length} public, ${svcDoors.length} service`);
  // with the café shut the park still works: public routes pass on three sides and none enters it
  const hallBox = pav.MARKET_RECT;
  const sides = { west: ped.ROUTES.some((r) => ped.routeCentreline(r).some(([x, z]) => x < hallBox[0] - 1 && x > hallBox[0] - 14 && z > hallBox[2] && z < hallBox[3])),
    east: ped.ROUTES.some((r) => ped.routeCentreline(r).some(([x, z]) => x > hallBox[1] + 1 && x < hallBox[1] + 12 && z > hallBox[2] && z < hallBox[3])),
    south: true };
  const through = ped.ROUTES.some((r) => ped.routeCentreline(r).some(([x, z]) => inRect(x, z, hallBox, -0.3)));
  check('Pavilions', `${T} the park stays usable when the café is shut: public routes pass on its west (spine), east (office walk) and south (sidewalk) sides and none runs through it`,
    sides.west && sides.east && !through, `west ${sides.west}, east ${sides.east}, through ${through}`);
  const canopyRing = offsetPlan(pav.MARKET.plan, pav.MARKET.canopy.out);
  const cols = p.parts.filter((q) => q.shape === 'cyl' && q.color === 'frame' && insidePlan(q.x, q.z, canopyRing) && q.y < 4);
  check('Pavilions', `${T} every canopy column stands under the canopy and clear of the walking surfaces (${cols.length} columns)`,
    cols.length > 0 && !cols.some((q) => ped.onRoute(q.x, q.z, 0.3)));

  const colInPaseo = corners(colR).every(([x, z]) => x > -25.6 && x < -10.6 && z > -51 && z < -11.6);
  check('Pavilions', `${T} the paseo colonnade stands in the paseo palm lawn, west of the spine`, colInPaseo, `[${colR.map((v) => round(v)).join(', ')}]`);
  const edgeGap = (x, z, poly) => { let best = Infinity; for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]; const ex = bx - ax, ez = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1))); best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return best; };
  const marketDoors = ['marketW', 'marketE'].map((k) => ped.NODES[k]);
  check('Pavilions', `${T} the market hall is entered from the spine and from the office walk, both doors on the hall's own facade`,
    marketDoors.every((n) => n && edgeGap(n.at[0], n.at[1], hallPts) < 0.8), marketDoors.map((n) => round(edgeGap(n.at[0], n.at[1], hallPts), 2)).join(', '));

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
  const facades = [offsetPlan(res.PODIUM_PLAN, -core.ARCADE), ...hotelPlans, pav.MARKET.plan,
    core.rect(liftCoreRect[0], liftCoreRect[2], liftCoreRect[1], liftCoreRect[3]),
    ...['C.baseE', 'C.baseW', 'C.lobby', 'M.service'].map((n) => core.rect(...[rectOf(byName[n])].map((r) => [r[0], r[2], r[1], r[3]])[0]))];
  const distToEdges = (x, z, poly) => { let best = Infinity; for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]; const ex = bx - ax, ez = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1))); best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return best; };
  const floatingDoors = p.parts.filter((q) => q.color === 'void' && !partCorners(q).every(([x, z]) => facades.some((f) => distToEdges(x, z, f) < 0.45))).map((q) => `(${round(q.x)}, ${round(q.z)})`);
  check('Ground', `${T} service and garage doors sit on a facade (no floating door panels)`, floatingDoors.length === 0, floatingDoors.join(' '));

  // --- ground: planting, cars, umbrellas clear of buildings -------------------------------
  const inBuilding = (x, z, pad) => insidePlan(x, z, offsetPlan(res.PODIUM_PLAN, pad)) || hotelPlans.some((pl) => insidePlan(x, z, offsetPlan(pl, pad)))
    || ['B.poolbar', 'C.baseE', 'C.baseW', 'C.lobby', 'M.service'].some((n) => inRect(x, z, rectOf(byName[n]), pad))
    || insidePlan(x, z, offsetPlan(pav.MARKET.plan, pad)) || insidePlan(x, z, offsetPlan(pav.PAVILION.roof, pad));
  const groundPlanting = [...p.trees, ...p.palms.filter((q) => !q.deck)];
  const badPlanting = groundPlanting.filter((t) => t.y === 0 && inBuilding(t.x, t.z, 0.8)).length;
  check('Ground', `${T} ground planting clear of buildings`, badPlanting === 0, `${badPlanting}`);
  check('Ground', `${T} no trees on tower or hotel roofs`, [...p.trees, ...p.palms].every((t) => t.y < 1.2 || t.deck), [...p.trees, ...p.palms].filter((t) => !(t.y < 1.2 || t.deck)).map((t) => `(${round(t.x)}, ${round(t.y)}, ${round(t.z)})`).join(' '));
  const badCars = p.cars.filter((c) => inBuilding(c.x, c.z, 0.5)).length;
  check('Ground', `${T} cars clear of buildings`, badCars === 0, `${badCars}`);
  const walkRing = p.curved.find((c) => c.name === 'S.sidewalk');
  const cornerStray = p.boxes.filter((b) => b.name.startsWith('S.verge') || b.name.startsWith('S.apron'))
    .filter((b) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([u, v]) => !insidePlan(b.x + (u * b.w) / 2, b.z + (v * b.d) / 2, walkRing.pts)));
  check('Ground', `${T} tree lawns and driveway aprons stay behind the ${street.CURB_R} m curb returns`, cornerStray.length === 0, cornerStray.map((b) => b.name).join(' '));

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
    { poly: pav.MARKET.plan, y0: 0, y1: 10 }, { poly: pav.PAVILION.roof, y0: 4.6, y1: 5.1 },
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
  const parkTreesAll = p.trees.filter((t) => t.x > -22 && t.x < 19 && t.z > 8 && t.z < 51);
  check('Planting', `${T} park planting mixes species and sizes (≥ 3 tree forms, flowering accents, palms of varied height)`, kinds.length >= 3 && parkTreesAll.some((t) => t.flower) && new Set(p.palms.filter((q) => q.y < 1.2 && q.x > -22 && q.x < 19 && q.z > 8 && q.z < 51).map((q) => Math.round(q.h))).size >= 3, `${kinds.join(', ')}; ${parkTreesAll.length} park trees`);
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
  const occPrisms = p.curved.filter((c) => c.type !== 'ring' && c.phase !== 'context').map((c) => {
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
    'park flexible lawn': frac(sampleIn(core.rect(park.FLEX_LAWN[0], park.FLEX_LAWN[2], park.FLEX_LAWN[1], park.FLEX_LAWN[3]), 0.3, 2.0)),
  };
}
const DEG = Math.PI / 180;
const camAt = ({ az, el, dist, tx, ty, tz }) => [tx + dist * Math.cos(el * DEG) * Math.sin(az * DEG), ty + dist * Math.sin(el * DEG), tz + dist * Math.cos(el * DEG) * Math.cos(az * DEG)];
const rigSrc = readFileSync(join(hero, 'camera-rig.js'), 'utf8');
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
  check('Visibility', `${t} hero view shows the fountain, the hotel's park entrance and the flexible lawn`,
    vis[t]['park fountain'] >= 0.5 && vis[t]['hotel park entrance'] >= 0.3 && vis[t]['park flexible lawn'] >= 0.5,
    `fountain ${Math.round(vis[t]['park fountain'] * 100)}%, entrance ${Math.round(vis[t]['hotel park entrance'] * 100)}%, lawn ${Math.round(vis[t]['park flexible lawn'] * 100)}%`);
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
  g.poly(pav.MARKET.plan, 'fill="#e6e8ec" stroke="#555" stroke-width="1.1"');
  g.poly(offsetPlan(pav.MARKET.plan, pav.MARKET.canopy.out), 'fill="none" stroke="#8e5bd6" stroke-dasharray="4 2" stroke-width="0.7"');
  g.poly(pav.PAVILION.roof, 'fill="#eceff2" stroke="#777" stroke-dasharray="4 2" stroke-width="0.9"');
  g.rect(rectOf(P.boxes[P.index['M.service']]), 'fill="#efe6e0" stroke="#555" stroke-width="0.9"');
  g.rect(rectOf(P.boxes[P.index['M.colRoof']]), 'fill="#eceff2" stroke="#777" stroke-dasharray="4 2" stroke-width="0.9"');
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
  L(-33, 36, 'ARCADE', '#8e5bd6', 7); L(1.0, 42.6, 'MARKET HALL', '#554', 8); L(10.9, 8.6, 'pavilion', '#554', 7); L(-22.6, -30, 'colonnade', '#554', 7);
  L(-9.0, 40.6, 'market walk', '#6b4bd6', 7); L(17.6, 39.4, 'market walk', '#6b4bd6', 7);
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
  for (const pm of P.palms.filter((q) => q.deck)) g.circle(pm.x, pm.z, 0.9, 'fill="#5a3" stroke="none"');
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
md.push('| Residential garage screen | Parametric wave fins (8 desktop / 6 mobile) wrapping the podium at the two parking levels, 0.45–1.0 m deep, ≈ 80 % open for natural ventilation (assumed, not calculated); the wave runs unbroken past the lobbies, with breaks only at the two garage stair cores; warm recessed light strips under two fins. Behind the fins the podium reads as one material the whole way round (shadowed deck openings between white slab edges) — the occupied liner units on the street and plaza faces stay in the program and sit behind the screen. |');
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
md.push(`| Pedestrian circulation | One configuration (plan/pedestrian.js): route centrelines, type, width, surface, elevation, connected nodes, destinations, lighting spacing, furnishing zones and landscape setbacks; geometry is generated from the centrelines and merged by surface. Two straight primary lines crossing at the fountain plaza: the Central Promenade (6 m; 4.5 m through the ground-floor galleria in the podium) dead straight on z = 1.0 from the podium portal to the east sidewalk, aimed at the middle of the podium east face so it arrives under the gap in the parking screen — the galleria turns north inside the podium to clear the parking ramp and leaves on its original line to the west sidewalk — and the north–south Spine (4.5 m) dead straight on x = -8 from the north sidewalk through the plaza to the park gate on the south sidewalk. The plaza therefore IS the crossing rather than a place reached from it: a ${ped.PLAZA_R} m disc with a ${round(ped.PLAZA_R - park.FOUNTAIN.basin - park.FOUNTAIN.coping, 1)} m clear ring round the basin, entered from exactly four directions (promenade west and east, spine north and south). Secondary (2.2–3.6 m): podium arcade (covered, 2.1 m clear between storefronts and columns), the two market hall walks, office walk, hotel frontages, hotel garden walk, two paseo cross walks. Entrance zones at every principal door. Café seating only in furnishing zones beside frontages. Surfaces are flat within 75 mm (step-free in the model). |`);
md.push(`| Park | Public, unfenced, on the condo entrance axis: the fountain plaza stands on the promenade directly in front of the podium portal, so the sculpture closes the view straight out of the galleria. Four mouths only (promenade west and east, spine north and south). The hardscape was then rebalanced so the park reads as a park rather than a large plaza — the paved circle came in from 14.2 to ${ped.PLAZA_R} m (${Math.round(Math.PI * 14.2 ** 2)} → ${Math.round(Math.PI * ped.PLAZA_R ** 2)} m², −21 %) and the basin and coping from 8.2 to ${round(park.FOUNTAIN.basin + park.FOUNTAIN.coping, 1)} m (${Math.round(Math.PI * 8.2 ** 2)} → ${Math.round(Math.PI * (park.FOUNTAIN.basin + park.FOUNTAIN.coping) ** 2)} m², −33 %), leaving a ${round(ped.PLAZA_R - park.FOUNTAIN.basin - park.FOUNTAIN.coping, 1)} m walking ring that still clears the promenade's own width either side of the water. The green is organised as three rooms: a shaded garden room west of the spine (a bosque over a bench line), one open flexible lawn of ${round(park.FLEX_LAWN[1] - park.FLEX_LAWN[0], 1)} × ${round(park.FLEX_LAWN[3] - park.FLEX_LAWN[2], 1)} m east of it, kept free of trunks, paths and furnishing zones, and the market terrace on its south edge. Lawns run out to a boundary that follows what really bounds the open ground; paving and buildings sit over the grass, so the lawns stop at the block edge rather than at every path. Private areas (residential deck, hotel pool court) are not on any public route. |`);
md.push(`| Park planting | Shade is designed, not scattered: broad-canopy trees are placed by hand in a bosque of two staggered rows in the garden room, a frame at the flexible lawn's corners and groups at the plaza mouths, with flowering accents and understory rounds. Palms are axial and entrance markers only — pairs flanking each of the four plaza mouths and the park gate, at set heights — and never the primary shade. Counts are checked per tier (12–16 desktop, 7–10 mobile). Species, soil volume, irrigation, establishment and maintenance are not designed. |`);
md.push(`| Park structures (M) | Three structures hold the park's edges, since a park whose edges are only grass reads as leftover space. Market hall: ${Math.round(Math.abs(core.polygonArea(pav.MARKET.plan)))} m² glazed volume ${pav.MARKET.hallH} m to the eaves under a ${pav.MARKET.clerestoryH} m louvred clerestory, with a ${pav.MARKET.canopy.out} m canopy over its doors and terrace seats. It was cut from 327 m² and moved off the middle of the southern lawn to the park's south-east corner, then lowered again: the 6.4 m hall and its 2.6 m clerestory (9.0 m in all) became one ${round(pav.MARKET.hallH, 1)} m storey under a ${round(pav.MARKET.hallH + pav.MARKET.parapetH, 1)} m planted roof edge, which keeps the lawn's horizon open and stops it competing with the hotel tower behind. Its rows of market counters became one café counter with a compact back of house on the south perimeter — a light-service café, not a restaurant kitchen; no cooking plant or exhaust is designed. It is entered from the spine on the west and the office walk on the east, so neither walk crosses the flexible lawn, and with it shut those two routes plus the south sidewalk still carry you round three of its sides. Promenade pavilion: an open public shade shelter at ${pav.PAVILION.y} m closing the east wedge; its kiosk was removed so all serving happens in the café. Paseo colonnade: free-standing covered walk west of the spine — the paseo is only ~15 m wide between the podium storefronts and the spine, so a liner building there would wall the storefronts off. Massing only: no structure, envelope, servicing, occupancy or code compliance is designed or verified. |`);
md.push('| Water movement | Shader ripples advance only on frames already rendering (render-on-demand preserved); jets are static geometry. |', '');

md.push('## 3. Unresolved — requires professional review or missing inputs', '', '| Matter | Status in the model | Missing input / review needed |', '|---|---|---|');
md.push('| Zoning, FAR, height, setbacks, open space, parking minimums | **Undetermined.** The site is hypothetical, so no zoning compliance is claimed. | A real parcel (folio / address) and jurisdiction, then verification against the current code from authoritative sources (e.g. Miami 21 or the City of Miami Beach Land Development Regulations, if in those cities). |');
md.push(`| Tower structure | Geometry is coherent: continuous core and columns, ≤ 3.5 m cantilevers, no tower-floor transfers. Long perimeter spans of ${A.structure.towers.flatMap((s) => s.longSpans.map((l) => `${l.span} m`)).join(', ')} where the ring crosses garage aisles. | Structural engineer: lateral system (core walls/outriggers), flat-plate/PT design, balcony cantilevers and thermal breaks, edge beams at long spans, column sizes, foundations, wind/hurricane loads, drift. |`);
md.push('| Garage façades | Openness and ventilation assumed from the geometry, not calculated. | Mechanical / code review of natural ventilation openness, fire separation to liner units, screen attachment and wind loads, lighting design (glare, spill, dark-sky), maintenance access to planted bays. |');
md.push('| Office cantilevers | 2.4–3.0 m slab-edge cantilevers at offsets; no transfers. | Structural design (PT/steel), deflection and façade tolerance; soffit fire rating of timber. |');
md.push(`| Resort pool basin | Soffit ${round(res.POOL.basinSoffitY, 2)} m leaves ${rpk.pool.clearHeight} m clear over P-L3 aisles/stalls with a ${res.POOL.mepAllowance} m allowance; ${rpk.pool.supportingColumns} podium columns under/near the basin. | Pool engineer and structural engineer: water/soil loads, basin slab depth, drainage falls, balance tank and plant room location, waterproofing, and beam depths over P-L3. Health-department pool rules. |`);
md.push('| Planting loads | Planter depths modelled; loads not computed. | Saturated soil and tree loads, drainage and irrigation design, wind uplift on palms, landscape architect species selection. |');
md.push(`| Parking supply and circulation | ${rpk.total + A.parking.office.total} modelled stalls vs ${rng2(dsum)} estimated demand; ramps and lifts geometric only. | Parking/traffic consultant: shared-parking study, valet/off-site options, ramp transitions and sight lines, car-lift capacity and queuing, accessible and van stalls, EV and bicycle requirements. |`);
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
