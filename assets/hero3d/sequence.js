// Sequence clock. Combines three inputs into one damped progress value S:
//   • intro  — the site drawing autoplays on load (0 → INTRO_END), acting as the loading state
//   • track  — scroll through the sticky hero drives INTRO_END → TRACK_END
//   • exit   — the hero leaving the viewport drives TRACK_END → 1 (hand-off to Selected Work)
import { INTRO_END, TRACK_END, INTRO_SECONDS } from './config.js';

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const window01 = (s, [a, b]) => clamp01((s - a) / (b - a));
export const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const lerp = (a, b, t) => a + (b - a) * t;

export class Sequence {
  constructor({ reduced = false, frozen = null, staticS = TRACK_END } = {}) {
    this.reduced = reduced;
    this.frozen = frozen;
    this.S = frozen ?? (reduced ? staticS : 0);
    this.staticS = staticS;
    this.p = 0;
    this.q = 0;
    this.t0 = null;
  }

  start(now) { this.t0 = now; }

  setScroll(p, q) { this.p = p; this.q = q; }

  // S-space value of the exit progress (0 until the hand-off begins)
  get exit() { return this.frozen != null ? clamp01((this.frozen - TRACK_END) / (1 - TRACK_END)) : this.q; }

  target(now) {
    if (this.frozen != null) return this.frozen;
    if (this.reduced) return this.staticS;
    const t = this.t0 == null ? 0 : clamp01((now - this.t0) / 1000 / INTRO_SECONDS);
    const intro = INTRO_END * easeInOutSine(t);
    const track = this.p > 0.0005 ? INTRO_END + (TRACK_END - INTRO_END) * this.p : 0;
    const exit = this.q > 0 ? TRACK_END + (1 - TRACK_END) * this.q : 0;
    return Math.max(intro, track, exit);
  }

  // Returns true while S is still moving (the caller keeps rendering).
  update(dt, now) {
    const goal = this.target(now);
    const gap = goal - this.S;
    if (Math.abs(gap) < 0.0004) {
      this.S = goal;
      const introRunning = !this.reduced && this.frozen == null && this.t0 != null && now - this.t0 < INTRO_SECONDS * 1000;
      return introRunning;
    }
    // Large jumps (e.g. page restored mid-scroll) fast-forward a little slower,
    // so the construction reads as a sequence rather than a snap.
    const tau = Math.abs(gap) > 0.2 ? 0.34 : 0.16;
    this.S += gap * (1 - Math.exp(-dt / tau));
    return true;
  }
}
