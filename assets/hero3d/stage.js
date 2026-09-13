// Renderer, scene, camera and lights, plus a render-on-demand loop that only
// runs while something is changing and pauses when the tab is hidden or the
// hero is off-screen. Includes a one-step adaptive quality downgrade.
import * as THREE from 'three';

export function createStage(host, tier, { onFrame, onResize }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: tier.antialias,
    alpha: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: !tier.force,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  if (tier.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // geometry-driven; see markShadowsDirty
  }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 10, 4000);

  // Studio lighting for a white physical model: broad sky fill + one soft key.
  const hemi = new THREE.HemisphereLight(0xfffaf2, 0xc9c0ae, 1.35);
  const sun = new THREE.DirectionalLight(0xfff3e3, 2.1);
  sun.position.set(-230, 320, 150);
  if (tier.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
    Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 50, far: 900 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 4;
  }
  scene.add(hemi, sun, sun.target);

  const size = { w: 1, h: 1 };
  let raf = 0;
  let last = 0;
  let inView = true;
  let disposed = false;
  let degraded = false;
  let slowFrames = 0;
  let sampled = 0;

  function active() { return !disposed && inView && !document.hidden; }

  function invalidate() {
    if (!raf && active()) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    const continuing = onFrame(dt, now);
    renderer.render(scene, camera);
    if (last && !degraded && sampled < 90) {
      sampled++;
      if (dt > 1 / 30) slowFrames++;
      if (sampled >= 45 && slowFrames / sampled > 0.6) degrade();
    }
    if (continuing) { last = now; invalidate(); } else { last = 0; }
  }

  function degrade() {
    degraded = true;
    renderer.setPixelRatio(1);
    resize();
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    host.dataset.quality = 'reduced';
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if (w === size.w && h === size.h && !degraded) { invalidate(); return; }
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    onResize?.(w, h);
    invalidate();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) invalidate();
  }, { rootMargin: '120px 0px' });
  io.observe(host);
  const onVisibility = () => { if (!document.hidden) { last = 0; invalidate(); } };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); host.dispatchEvent(new CustomEvent('hero3d:lost', { bubbles: true })); });

  resize();

  return {
    THREE, renderer, scene, camera, sun, size, invalidate,
    get degraded() { return degraded; },
    markShadowsDirty() { if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true; },
    compile() { renderer.compile(scene, camera); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
      canvas.remove();
    },
  };
}
