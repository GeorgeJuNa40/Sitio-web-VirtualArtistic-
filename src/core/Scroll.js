import Lenis from 'lenis';
import { gsap } from 'gsap';

/**
 * Smooth scroll (Lenis) + hero scroll progress + the staggered fade-out.
 *
 * uScrollProgress goes 0 -> 1 as the hero header leaves the viewport. The
 * text fades on a stagger — eyebrow/top first, CTA last — so the whole exit
 * reads as one choreography with the core's disintegration, not as independent
 * layers switching off.
 */
export class Scroll {
  constructor({ onProgress } = {}) {
    this.onProgress = onProgress || (() => {});
    this.progress = 0;
    this.hero = document.getElementById('hero');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !reduced,
      syncTouch: false
    });

    // Fade elements ordered by their data-hero-fade index.
    this.fadeEls = Array.from(document.querySelectorAll('[data-hero-fade]')).sort(
      (a, b) =>
        Number(a.dataset.heroFade) - Number(b.dataset.heroFade)
    );

    this._raf = this._raf.bind(this);
    this.lenis.on('scroll', () => this._update());
    this._update();
  }

  // Driven by the main loop so Lenis shares one rAF with the renderer.
  raf(time) {
    this.lenis.raf(time);
  }

  _raf(time) {
    this.lenis.raf(time);
    requestAnimationFrame(this._raf);
  }

  _update() {
    if (!this.hero) return;
    // Progress over the pinned hero's full scroll range (it is taller than the
    // viewport), so 0 = top and 1 = the moment the sticky panel releases. This
    // is what scrubs the animation frame sequence.
    const range = this.hero.offsetHeight - window.innerHeight || window.innerHeight;
    const p = Math.min(Math.max(window.scrollY / range, 0), 1);
    this.progress = p;
    this.onProgress(p);
    this._applyFade(p);
  }

  _applyFade(p) {
    const n = this.fadeEls.length;
    if (!n) return;
    // Text clears early (first ~30% of the scrub) so it is gone before the
    // animation's climax; staggered eyebrow-first, CTA-last.
    this.fadeEls.forEach((el, i) => {
      const start = (i / n) * 0.12;
      const end = start + 0.16;
      const local = gsap.utils.clamp(0, 1, (p - start) / (end - start));
      const eased = gsap.parseEase('power2.out')(local);
      el.style.opacity = String(1 - eased);
      el.style.transform = `translateY(${eased * -22}px)`;
    });
  }

  destroy() {
    this.lenis.destroy();
  }
}
