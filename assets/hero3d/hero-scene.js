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
  stage.scene.add(grid.object, lines.object, massing.object, curves.object, parts.object, landscape.object);

  // QA switch: ?heroPlan=structure|parking|boh|all overlays the conceptual plan data
  const qaMode = new URLSearchParams(location.search).get('heroPlan');
  if (qaMode) {
    const { createQaOverlay } = await import('./layers/qa-overlay.js');
    stage.scene.add(createQaOverlay(plan, qaMode));
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
