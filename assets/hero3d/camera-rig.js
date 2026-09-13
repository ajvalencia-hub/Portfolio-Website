// Camera rig: keyframed orbit around the site driven by S (C1-continuous
// Hermite spline), a lens shift that composes the model beside the HTML
// typography, a few degrees of damped pointer parallax, and click-and-hold
// drag to rotate the model (the drag offset rides on top of the scroll camera).
import { lerp, clamp01 } from './sequence.js';

const DEG = Math.PI / 180;

// az: 0 = looking north from the south; negative = camera to the south-west.
const KEYS = [
  { s: 0.00, az: -40, el: 62, dist: 600, tx: 0,   ty: 0,  tz: 6 },   // elevated model-table view
  { s: 0.30, az: -36, el: 56, dist: 540, tx: 0,   ty: 0,  tz: 6 },
  { s: 0.50, az: -31, el: 43, dist: 500, tx: 0,   ty: 10, tz: 2 },
  { s: 0.80, az: -32, el: 32, dist: 430, tx: 0,   ty: 18, tz: -6 },
  { s: 0.92, az: -31, el: 34, dist: 440, tx: 0,   ty: 22, tz: -10 },  // hero composition (turned west so the pool between the towers reads)
  { s: 1.00, az: -22, el: 25, dist: 390, tx: -12, ty: 26, tz: -8 },  // lean in toward the masses
];
const PROPS = ['az', 'el', 'dist', 'tx', 'ty', 'tz'];

function sample(s, travel) {
  const n = KEYS.length;
  let i = 0;
  while (i < n - 2 && s > KEYS[i + 1].s) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const h = b.s - a.s;
  const t = clamp01((s - a.s) / h);
  const t2 = t * t, t3 = t2 * t;
  const out = {};
  for (const k of PROPS) {
    const prev = KEYS[Math.max(0, i - 1)], next = KEYS[Math.min(n - 1, i + 2)];
    const m0 = ((b[k] - prev[k]) / (b.s - prev.s || 1)) * h;
    const m1 = ((next[k] - a[k]) / (next.s - a.s || 1)) * h;
    out[k] = (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
  }
  if (travel < 1) { // mobile: same story, shorter camera travel
    const mid = KEYS[3];
    out.az = lerp(mid.az, out.az, travel);
    out.el = lerp(mid.el, out.el, travel);
  }
  return out;
}

export function createCameraRig(camera, tier, { reduced, dragTarget = null }) {
  const viewport = { w: 1, h: 1 };
  const pointer = { x: 0, y: 0, cx: 0, cy: 0 };
  const parallax = tier.parallax && !reduced && matchMedia('(pointer: fine)').matches;
  let azimuth = 0;
  // QA switch: ?heroCam=az,el,dist,tx,ty,tz overrides the keyframed camera (close inspection)
  const qaCam = new URLSearchParams(location.search).get('heroCam')?.split(',').map(Number);

  const onMove = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    rig.onChange?.();
  };
  if (parallax) window.addEventListener('pointermove', onMove, { passive: true });

  // ---- drag to rotate --------------------------------------------------------
  // Horizontal drag orbits the model; vertical drag (mouse/pen only — touch keeps
  // vertical swipes for page scrolling) tilts within limits that keep the camera
  // above the ground and below straight-down. Releasing coasts briefly, then holds.
  const drag = { active: false, id: null, x: 0, y: 0, az: 0, el: 0, cAz: 0, cEl: 0, vAz: 0, vEl: 0, t: 0 };
  const AZ_PER_PX = 0.28;
  const EL_PER_PX = 0.16;
  const interactive = 'a, button, input, textarea, select, label, .hero-copy';

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest(interactive)) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.vAz = drag.vEl = 0;
    drag.t = performance.now();
    drag.touch = e.pointerType === 'touch';
    try { dragTarget.setPointerCapture?.(e.pointerId); } catch { /* pointer already released */ }
    dragTarget.classList.add('is-dragging');
    if (!drag.touch) e.preventDefault(); // no text selection while rotating
  };
  const onDragMove = (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const now = performance.now();
    const dx = e.clientX - drag.x;
    const dy = drag.touch ? 0 : e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.az -= dx * AZ_PER_PX;
    drag.el += dy * EL_PER_PX;
    const dtMs = Math.max(8, now - drag.t);
    drag.vAz = (-dx * AZ_PER_PX) / dtMs * 1000;
    drag.vEl = (dy * EL_PER_PX) / dtMs * 1000;
    drag.t = now;
    rig.onChange?.();
  };
  const onUp = (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.active = false;
    dragTarget.classList.remove('is-dragging');
    // a short coast in the release direction, unless the pointer had stopped
    if (performance.now() - drag.t < 80) { drag.az += drag.vAz * 0.18; drag.el += drag.vEl * 0.18; }
    rig.onChange?.();
  };
  if (dragTarget) {
    dragTarget.addEventListener('pointerdown', onDown);
    dragTarget.addEventListener('pointermove', onDragMove);
    dragTarget.addEventListener('pointerup', onUp);
    dragTarget.addEventListener('pointercancel', onUp);
    dragTarget.classList.add('is-rotatable');
  }

  function layout() {
    const { w, h } = viewport;
    const aspect = w / h;
    const wide = w >= 900 && aspect >= 1.05;
    // keep the development readable on narrow screens by stepping back
    const fit = wide ? Math.max(1, 1.55 / aspect) : Math.min(2.6, 1.25 / Math.max(aspect, 0.35));
    return { aspect, fit, shiftX: wide ? 0.31 : 0, shiftY: wide ? 0.20 : -0.33 };   // lift the model clear of the canvas's bottom fade
  }

  const rig = {
    onChange: null,
    get azimuth() { return azimuth; },
    setViewport(w, h) { viewport.w = w; viewport.h = h; },
    // returns true while the parallax is still settling
    update(dt, S) {
      const L = layout();
      const k = sample(S, tier.cameraTravel);
      if (qaCam?.length === 6 && qaCam.every(Number.isFinite)) PROPS.forEach((key, i) => { k[key] = qaCam[i]; });
      let settling = false;
      if (parallax) {
        const damp = 1 - Math.exp(-dt / 0.45);
        pointer.cx += (pointer.x - pointer.cx) * damp;
        pointer.cy += (pointer.y - pointer.cy) * damp;
        settling = Math.abs(pointer.x - pointer.cx) > 0.001 || Math.abs(pointer.y - pointer.cy) > 0.001;
      }
      // drag offsets ease toward their targets so rotation feels weighted
      const dragDamp = 1 - Math.exp(-dt / (drag.active ? 0.08 : 0.22));
      drag.cAz += (drag.az - drag.cAz) * dragDamp;
      const elTarget = Math.min(78 - k.el, Math.max(6 - k.el, drag.el)); // stay between 6° and 78°
      drag.el = elTarget;
      drag.cEl += (elTarget - drag.cEl) * dragDamp;
      if (Math.abs(drag.az - drag.cAz) > 0.01 || Math.abs(elTarget - drag.cEl) > 0.01) settling = true;

      const azDeg = k.az + pointer.cx * 2.2 + drag.cAz;
      const az = azDeg * DEG;
      const el = (k.el - pointer.cy * 1.3 + drag.cEl) * DEG;
      const dist = k.dist * L.fit;
      camera.position.set(
        k.tx + dist * Math.cos(el) * Math.sin(az),
        k.ty + dist * Math.sin(el),
        k.tz + dist * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(k.tx, k.ty, k.tz);
      camera.aspect = L.aspect;
      camera.updateProjectionMatrix();
      // lens shift: move the image without changing perspective
      camera.projectionMatrix.elements[8] = -L.shiftX;
      camera.projectionMatrix.elements[9] = -L.shiftY;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      azimuth = (azDeg % 360 + 360) % 360;
      return settling;
    },
    dispose() {
      if (parallax) window.removeEventListener('pointermove', onMove);
      if (dragTarget) {
        dragTarget.removeEventListener('pointerdown', onDown);
        dragTarget.removeEventListener('pointermove', onDragMove);
        dragTarget.removeEventListener('pointerup', onUp);
        dragTarget.removeEventListener('pointercancel', onUp);
        dragTarget.classList.remove('is-rotatable', 'is-dragging');
      }
    },
  };
  return rig;
}
