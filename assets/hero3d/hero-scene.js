// Composition root for the hero massing study. Wires the plan, layers, camera
// rig, sequence clock and scroll driver together. Imported lazily by boot.js;
// nothing here touches navigation, copy or project data.
import { readPalette, PHASES } from './config.js';
import { buildSitePlan } from './site-plan.js';
import { Sequence, window01, smootherstep } from './sequence.js';
import { createStage } from './stage.js';
import { createSkyEnvironment } from './layers/environment.js';
import { createGrid } from './layers/grid.js';
import { createLinework } from './layers/linework.js';
import { createMassing } from './layers/massing.js';
import { createParts } from './layers/parts.js';
import { createCurves } from './layers/curves.js';
import { WATER_TIME } from './layers/facade-glsl.js';
import { createLandscape } from './layers/landscape.js';
import { createCameraRig } from './camera-rig.js';
import { createScroll } from './scroll.js';

// Points bounding everything visible at rest: the street ring at grade and the top
// outline of every mass (used to fit the model on narrow screens).
function modelBounds(plan) {
  const pts = [[-97.5, 0, -72.8], [97.5, 0, -72.8], [97.5, 0, 72.8], [-97.5, 0, 72.8]];
  const addOutline = (outline, y) => {
    if (!outline?.length) return;
    const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    pts.push([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
  };
  for (const c of plan.curved) {
    const top = plan.meta.curveTop[c.name];
    if (top > 2) addOutline(c.pts || c.floorPlans?.[c.floorPlans.length - 1], top);
  }
  const tops = [];
  plan.boxes.forEach((b, i) => {
    tops[i] = (b.parentIndex >= 0 ? tops[b.parentIndex] : b.y0) + b.h;
    if (tops[i] > 2) addOutline([[b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z + b.d / 2]], tops[i]);
  });
  return pts;
}

export async function createHero({ heroEl, canvasHost, tier, reduced, frozenS }) {
  const palette = readPalette();
  const plan = buildSitePlan(tier);
  const sequence = new Sequence({ reduced, frozen: frozenS });

  const grid = createGrid(palette);
  const lines = createLinework(plan.paths, palette);
  const massing = createMassing(plan, palette, tier);
  const parts = createParts(plan, palette, tier);
  const curves = createCurves(plan, palette, tier);
  const landscape = createLandscape(plan, palette, tier);

  let rig = null;
  let lastS = -1;

  const stage = createStage(canvasHost, tier, {
    onResize: (w, h) => rig?.setViewport(w, h),
    onFrame(dt, now) {
      let busy = sequence.update(dt, now);
      const S = sequence.S;
      if (S !== lastS) {
        grid.update(S);
        lines.update(S);
        massing.update(S);
        parts.update(S);
        curves.update(S);
        landscape.update(S);
        stage.markShadowsDirty();
        applyExit(S);
        lastS = S;
      }
      busy = rig.update(dt, S) || busy;
      if (!reduced) WATER_TIME.value = now / 1000;   // no extra frames: only frames already rendering
      return busy;
    },
  });

  const environment = createSkyEnvironment(stage.renderer, palette);
  stage.scene.environment = environment.texture;

  rig = createCameraRig(stage.camera, tier, { reduced, dragTarget: canvasHost.parentElement });
  rig.setViewport(stage.size.w, stage.size.h);
  rig.onChange = stage.invalidate;
  rig.setBounds(modelBounds(plan));

  // Narrow layouts stack the copy above the model: measure where the copy ends so the
  // rig can fit the model below it, and start the canvas's top fade just above that line.
  const copyEl = heroEl.querySelector('.hero-copy');
  const measureCopy = () => {
    const host = canvasHost.getBoundingClientRect();
    if (!copyEl || host.height < 1) return;
    const bottom = copyEl.getBoundingClientRect().bottom - host.top + 20;   // 20 px breathing room
    const fraction = Math.min(0.8, Math.max(0, bottom / host.height));
    canvasHost.style.setProperty('--hero-copy-end', `${(fraction * 100).toFixed(1)}%`);
    rig.setSafeTop(fraction);
  };
  measureCopy();
  if (copyEl) new ResizeObserver(measureCopy).observe(copyEl);
  new ResizeObserver(measureCopy).observe(canvasHost);
  document.fonts?.ready.then(measureCopy);
  stage.scene.add(grid.object, lines.object, massing.object, curves.object, parts.object, landscape.object);

  // QA switch: ?heroPlan=structure|parking|boh|all overlays the conceptual plan data
  const qaMode = new URLSearchParams(location.search).get('heroPlan');
  if (qaMode) {
    const { createQaOverlay } = await import('./layers/qa-overlay.js');
    stage.scene.add(createQaOverlay(plan, qaMode));
    // review view only: let the plan read edge to edge (copy hidden, canvas fade removed)
    if (qaMode === 'circulation') {
      if (copyEl) copyEl.style.visibility = 'hidden';
      canvasHost.style.maskImage = canvasHost.style.webkitMaskImage = 'none';
    }
  }

  // The stage leaves with the page; the canvas eases back slightly so the
  // Selected Work section becomes dominant rather than colliding with the model.
  function applyExit(S) {
    const fade = smootherstep(window01(S, [PHASES.handoff[0] + 0.04, 1]));
    canvasHost.style.opacity = (1 - 0.35 * fade).toFixed(3);
  }

  // Warm up shaders before the intro clock starts so the drawing never hitches.
  // Compile first: layers hide not-yet-visible meshes on update, and compile skips hidden objects.
  rig.update(1 / 60, sequence.S);
  stage.compile();
  massing.update(0); parts.update(0); curves.update(0); landscape.update(0); lines.update(0); grid.update(0);
  lastS = -1;   // force the next frame to re-apply the sequence (a frame may already have run)
  heroEl.classList.add('is-3d-ready');
  sequence.start(performance.now());
  stage.invalidate();

  // QA switch: ?heroStats=1 exposes render statistics (frames rendered, draw calls,
  // triangles, CPU time per frame) for performance and idle-stability checks
  if (new URLSearchParams(location.search).has('heroStats')) {
    window.__hero3dStats = () => ({
      frames: stage.stats.frames, cpuMs: +stage.stats.cpuMs.toFixed(2), maxCpuMs: +stage.stats.maxCpuMs.toFixed(2),
      calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles,
      programs: stage.renderer.info.programs?.length, geometries: stage.renderer.info.memory.geometries,
      S: +sequence.S.toFixed(4), degraded: stage.degraded, tier: tier.name, dpr: stage.renderer.getPixelRatio(),
      near: +stage.camera.near.toFixed(1), far: +stage.camera.far.toFixed(1),
    });
    window.__hero3dRig = rig;
    window.__hero3dStage = stage;
  }

  let scroll = null;
  if (!reduced && frozenS == null) {
    scroll = await createScroll(heroEl, (p, q) => {
      sequence.setScroll(p, q);
      stage.invalidate();
    });
  }

  return {
    dispose() {
      scroll?.dispose();
      rig.dispose();
      environment.dispose();
      stage.dispose();
    },
  };
}
