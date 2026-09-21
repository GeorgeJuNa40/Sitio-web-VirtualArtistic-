/**
 * Scroll-linked marquee. One horizontal strip of repeated text that drifts
 * continuously and slowly as a base, and whose speed + direction are modulated
 * by scroll velocity (scrolling down accelerates it, scrolling up reverses it).
 *
 * Moved only with translate3d on duplicated content — never left/margin. It is
 * textural (aria-hidden) and revealed during the hero's exit. No loop of its
 * own: `frame()` runs on the app's shared rAF. Inert under reduced motion.
 */
export class Marquee {
  constructor(el) {
    this.el = el;
    this.enabled = !!el && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.enabled) return;

    this.track = el.querySelector('.marquee__track');
    this.offset = 0;
    this.half = 0;
    this.vel = 0;
    this.base = 26; // px/s continuous drift (leftward)
    this._opacity = 0;

    this._measure = this._measure.bind(this);
    this._measure();
    window.addEventListener('resize', this._measure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(this._measure).catch(() => {});
    }
  }

  _measure() {
    if (!this.track) return;
    // Content is repeated an even number of times; wrapping by half the track
    // keeps the loop seamless as long as the viewport is narrower than a half.
    this.half = this.track.scrollWidth / 2 || 0;
  }

  // dt in ms; velocity is Lenis' signed scroll velocity; progress is the hero
  // scroll progress (0..1) that reveals the strip as the text clears.
  frame(dt, velocity, progress) {
    if (!this.enabled) return;

    // Reveal as the hero text finishes exiting (~28%), fade back near the end.
    let target = 0;
    if (progress > 0.28) target = Math.min(1, (progress - 0.28) / 0.12);
    if (progress > 0.9) target = Math.max(0, (1 - progress) / 0.1);
    this._opacity += (target - this._opacity) * 0.1;
    this.el.style.opacity = this._opacity.toFixed(3);
    if (this._opacity < 0.002) return; // nothing visible → skip the transform work

    if (!this.half) this._measure();

    const dtSec = Math.min(Math.max(dt, 0), 50) / 1000;
    this.vel += ((velocity || 0) - this.vel) * 0.1; // smooth the velocity signal

    // Base drifts left; downward scroll (vel > 0) adds leftward speed, upward
    // scroll (vel < 0) pushes it back the other way.
    this.offset -= this.base * dtSec;
    this.offset -= this.vel * 0.9;

    if (this.half > 0) {
      while (this.offset <= -this.half) this.offset += this.half;
      while (this.offset > 0) this.offset -= this.half;
    }
    this.track.style.transform = `translate3d(${this.offset.toFixed(2)}px, 0, 0)`;
  }

  destroy() {
    if (!this.enabled) return;
    window.removeEventListener('resize', this._measure);
  }
}
