// Scroll wiring via GSAP ScrollTrigger (loaded lazily with the 3D scene).
//   track: hero top reaches the header → hero bottom reaches the viewport bottom
//          (the sticky stage's full dwell)
//   exit:  hero bottom travels from the viewport bottom to ~40% height
//          (the stage scrolls away as Selected Work takes over)
import { CDN } from './config.js';

// GSAP's minified builds are UMD; they must run as classic scripts (module
// strict mode rejects their global assignment).
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function createScroll(heroEl, onChange) {
  if (!window.gsap) await loadScript(CDN.gsap);
  if (!window.ScrollTrigger) await loadScript(CDN.scrollTrigger);
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const headerOffset = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 0;

  let p = 0;
  let q = 0;
  const emit = () => onChange(p, q);

  const track = ScrollTrigger.create({
    trigger: heroEl,
    start: () => `top top+=${headerOffset()}`,
    end: 'bottom bottom',
    invalidateOnRefresh: true,
    onUpdate: (st) => { p = st.progress; emit(); },
    onRefresh: (st) => { p = st.progress; emit(); },
  });
  const exit = ScrollTrigger.create({
    trigger: heroEl,
    start: 'bottom bottom',
    end: 'bottom 40%',
    invalidateOnRefresh: true,
    onUpdate: (st) => { q = st.progress; emit(); },
    onRefresh: (st) => { q = st.progress; emit(); },
  });
  emit();

  return {
    refresh: () => ScrollTrigger.refresh(),
    dispose() { track.kill(); exit.kill(); },
  };
}
