/**
 * Numeric preloader. A counter climbs from 00 to 100 while the logo fills in
 * and a gold bar tracks the same value; then the panel fades. The climb is
 * driven by a fixed step per animation frame (not a time-based tween), so a
 * heavy decode that briefly stalls the main thread can only pause the count —
 * never fast-forward it — which keeps the 0→100 gesture visible even when every
 * asset is inlined and decodes in one burst. It holds at 99 until the scene
 * reports ready, so it never shows 100 before the hero can appear.
 */
export class Preloader {
  constructor() {
    this.el = document.getElementById('preloader');
    this.countEl = document.getElementById('preloader-count');
    this.value = 0;
    this._display = 0;
    this._sceneReady = false;
    this._finished = false;
    this._onDone = null;
    // ~100 units over ~2.2s at 60fps → a deliberate, always-visible count-up.
    this._step = 100 / (2.2 * 60);
  }

  start(onDone) {
    this._onDone = onDone;
    if (!this.el || !this.countEl) {
      // Preloader markup missing — never block the experience.
      if (onDone) onDone();
      return;
    }
    this._render(0);
    this._raf = this._raf.bind(this);
    requestAnimationFrame(this._raf);
  }

  _raf() {
    if (this._finished) return;
    const cap = this._sceneReady ? 100 : 99;
    this._display = Math.min(cap, this._display + this._step);
    this.value = Math.floor(this._display);
    this._render(this.value);
    if (this._display >= 100 && this._sceneReady) {
      this.value = 100;
      this._render(100);
      this._exit();
      return;
    }
    requestAnimationFrame(this._raf);
  }

  // The progressive loader still reports real frame progress, but the visible
  // counter is paced for a clean count-up, so this is intentionally inert.
  setProgress() {}

  setSceneReady() {
    this._sceneReady = true;
  }

  _render(v) {
    this.countEl.textContent = String(v).padStart(2, '0');
    // Drives the logo fill (clip-path) and the progress bar width.
    if (this.el) this.el.style.setProperty('--fillpct', v + '%');
  }

  _exit() {
    if (this._finished) return;
    this._finished = true;
    this.el.classList.add('is-hidden');
    // Small pause on a full mark, then fade — lets the completed logo register.
    setTimeout(() => {
      this.el.style.transition = 'opacity 1s ease';
      this.el.style.opacity = '0';
      const done = () => {
        this.el.style.display = 'none';
        if (this._onDone) this._onDone();
      };
      this.el.addEventListener('transitionend', done, { once: true });
      // Fallback in case the transition event is missed.
      setTimeout(done, 1200);
    }, 260);
  }
}
