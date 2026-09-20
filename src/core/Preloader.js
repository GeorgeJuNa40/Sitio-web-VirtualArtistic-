import { gsap } from 'gsap';

/**
 * Numeric preloader. A counter climbs deliberately from 00 to 100, then the
 * panel fades — the wait reads as intent, not as a technical spinner. The climb
 * is paced over a fixed window so it is always visible as a count-up (even when
 * the frames are cached/inlined and decode instantly); it holds at 99 until the
 * scene reports ready, so it never shows 100 before the hero can actually
 * appear.
 */
export class Preloader {
  constructor() {
    this.el = document.getElementById('preloader');
    this.countEl = document.getElementById('preloader-count');
    this.value = 0;
    this._sceneReady = false;
    this._paceDone = false;
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

    // Deliberate count-up. Held at 99 until the scene is ready so 100 never
    // lies; snaps to 100 and exits once both the climb and the scene are done.
    const state = { v: 0 };
    this._tween = gsap.to(state, {
      v: 100,
      duration: 2.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        const cap = this._sceneReady ? 100 : 99;
        this.value = Math.min(cap, Math.floor(state.v));
        this._render(this.value);
      },
      onComplete: () => {
        this._paceDone = true;
        this._maybeFinish();
      }
    });
  }

  // The progressive loader still reports real frame progress, but the visible
  // counter is time-paced for a clean count-up, so this is intentionally inert.
  setProgress() {}

  setSceneReady() {
    this._sceneReady = true;
    this._maybeFinish();
  }

  _maybeFinish() {
    if (this._finished) return;
    if (!this._paceDone || !this._sceneReady) return;
    this._finished = true;
    this.value = 100;
    this._render(100);
    this._exit();
  }

  _render(v) {
    this.countEl.textContent = String(v).padStart(2, '0');
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
