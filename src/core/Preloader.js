import { gsap } from 'gsap';

/**
 * Numeric preloader. A counter climbs to 100, then the panel fades slowly.
 * No spinner, no logo animation — the wait should feel cinematic, not technical.
 *
 * The count is not tied to real asset bytes (there are none to download — the
 * core is pure shader). It is paced to feel deliberate and resolves as soon as
 * the scene reports ready, whichever is later.
 */
export class Preloader {
  constructor() {
    this.el = document.getElementById('preloader');
    this.countEl = document.getElementById('preloader-count');
    this.value = 0;
    this._sceneReady = false;
    this._onDone = null;
  }

  start(onDone) {
    this._onDone = onDone;
    if (!this.el || !this.countEl) {
      // Preloader markup missing — never block the experience.
      if (onDone) onDone();
      return;
    }

    const state = { v: 0 };
    // Ease toward 100 over a deliberate window; snap to done when scene ready.
    this._tween = gsap.to(state, {
      v: 100,
      duration: 2.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.value = Math.floor(state.v);
        this.countEl.textContent = String(this.value).padStart(2, '0');
      },
      onComplete: () => this._maybeFinish()
    });
  }

  setSceneReady() {
    this._sceneReady = true;
    this._maybeFinish();
  }

  _maybeFinish() {
    if (this._finished) return;
    if (this.value < 100 || !this._sceneReady) return;
    this._finished = true;
    this._exit();
  }

  _exit() {
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
