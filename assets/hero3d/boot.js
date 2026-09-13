// Hero 3D entry point. Loaded as a module at the end of <body>; it never blocks
// the HTML, copy or navigation. The mode is decided synchronously in <head>
// (html[data-hero] = motion | reduced | fallback) so layout is final before
// first paint; this file only upgrades the stage, and restores the original
// image hero if anything fails.
//
// QA switches: ?hero3d=off (force fallback) · ?hero3d=force (skip device gating)
//              ?heroS=0.55 (freeze the sequence at a given point)
//              ?heroCam=az,el,dist,tx,ty,tz (override the camera for close inspection)
window.__hero3dBooted = true;

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const heroEl = document.querySelector('[data-hero3d]');

function fallback(reason) {
  if (root.dataset.hero === 'fallback') return;
  if (reason) console.warn('[hero3d] using image hero:', reason);
  root.dataset.hero = 'fallback';
  window.dispatchEvent(new Event('hero3d:fallback'));
}

function syncHeaderHeight() {
  const header = document.querySelector('header.top');
  if (!header) return;
  const set = () => root.style.setProperty('--hdr', `${header.offsetHeight}px`);
  set();
  new ResizeObserver(set).observe(header);
}

// Start after the page has painted and settled, without waiting on slow images.
function whenIdle(fn) {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 60));
  if (document.readyState === 'complete') go();
  else {
    let started = false;
    const once = () => { if (!started) { started = true; go(); } };
    window.addEventListener('load', once, { once: true });
    setTimeout(once, 1500);
  }
}

async function start() {
  const stageEl = heroEl.querySelector('.hero-stage');
  const canvasHost = heroEl.querySelector('.hero-canvas');
  try {
    const [{ createHero }, { detectTier }] = await Promise.all([
      import('./hero-scene.js'),
      import('./config.js'),
    ]);
    const tier = detectTier({ force: params.get('hero3d') === 'force' });
    const frozen = params.has('heroS') ? Math.min(1, Math.max(0, parseFloat(params.get('heroS')) || 0)) : null;
    // short landscape screens drop the sticky track (see CSS) → static composition
    const reduced = root.dataset.hero === 'reduced' || getComputedStyle(stageEl).position !== 'sticky';
    await createHero({ heroEl, canvasHost, tier, reduced, frozenS: frozen });
    heroEl.addEventListener('hero3d:lost', () => fallback('WebGL context lost'), { once: true });
  } catch (err) {
    fallback(err?.message || err);
  }
}

if (heroEl && (root.dataset.hero === 'motion' || root.dataset.hero === 'reduced')) {
  syncHeaderHeight();
  whenIdle(start);
}
