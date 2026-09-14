import { gsap } from 'gsap';

/**
 * Numeric preloader. The counter tracks the REAL decode progress of the hero's
 * opening frames (reported by ScrollSequence) and settles to 100 the moment the
 * scene signals it is ready to reveal; then the panel fades. No spinner, no
 * logo animation — the wait should feel deliberate, not technical.
 */
export class Preloader {
  constructor() {
    this.el = document.getElementById('preloader');
    this.countEl = document.getElementById('preloader-count');
    this.value = 0; // highest real percentage reported so far
    this._display = 0; // eased value actually painted
    this._sceneReady = false;
    this._finished = false;
    this._onDone = null;
  }

  start(onDone) {
    this._onDone = onDone;
    if (!this.el || !this.countEl) {
      // Preloader markup missing — never block the experience.
      if (onDone) onDone();
      return;
    }
    this._render(0);
  }

  // Real load progress (0..1) of the frames gating the reveal. Held below 100
  // until the scene is actually ready, so the counter never lies.
  setProgress(p) {
    if (!this.countEl || this._finished) return;
    const target = Math.min(99, Math.round(Math.max(0, Math.min(1, p)) * 100));
    if (target <= this.value) return; // monotonic — never step backwards
    this.value = target;
    gsap.to(this, {
      _display: target,
      duration: 0.3,
      ease: 'power1.out',
      onUpdate: () => this._render(this._display)
    });
  }

  setSceneReady() {
    this._sceneReady = true;
    if (!this.el || !this.countEl) {
      if (this._onDone) this._onDone();
      return;
    }
    this.value = 100;
    gsap.to(this, {
      _display: 100,
      duration: 0.35,
      ease: 'power2.out',
      onUpdate: () => this._render(this._display),
      onComplete: () => this._exit()
    });
  }

  _render(v) {
    this.countEl.textContent = String(Math.floor(v)).padStart(2, '0');
  }

  _exit() {
    if (this._finished) return;
    this._finished = true;
    this.el.classList.add('is-hidden');
    gsap.to(this.el, {
      opacity: 0,
      duration: 1.1,
      ease: 'power2.inOut',
      onComplete: () => {
        this.el.style.display = 'none';
        if (this._onDone) this._onDone();
      }
    });
  }
}
