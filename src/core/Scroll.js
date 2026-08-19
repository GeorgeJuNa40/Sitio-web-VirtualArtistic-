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
    const h = this.hero.offsetHeight || window.innerHeight;
    // 0 at top of hero, 1 once scrolled one hero-height down.
    const p = Math.min(Math.max(window.scrollY / h, 0), 1);
    this.progress = p;
    this.onProgress(p);
    this._applyFade(p);
  }

  _applyFade(p) {
    const n = this.fadeEls.length;
    if (!n) return;
    // Staggered windows: earlier elements finish fading before later ones start.
    // Total travel compressed into the first ~85% of the hero exit.
    this.fadeEls.forEach((el, i) => {
      const start = (i / n) * 0.55;
      const end = start + 0.4;
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
