/**
 * Scroll-scrubbed image sequence. Preloads the logo-animation frames and draws
 * the one matching scroll progress onto a 2D canvas (Apple-style scrubbing) —
 * smooth and codec-independent, unlike seeking an H.264 <video>. A subtle
 * cursor / gyro parallax keeps it alive at rest.
 */
export class ScrollSequence {
  constructor({ canvas, pointer, frameCount = 100, onReady, onProgress } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pointer = pointer;
    this.count = frameCount;
    this.onReady = onReady || (() => {});
    this.onLoadProgress = onProgress || (() => {});

    this.progress = 0;
    this.display = 0; // smoothed progress → cinematic, not 1:1 jumpy
    this.frames = [];
    this.ready = []; // per-frame decoded flag → nearest-loaded fallback
    this.loaded = 0;
    // Reveal the stage as soon as the opening beats are decoded; the rest stream
    // in behind the fold. onReady fires here, not at 100 frames, so the hero
    // appears fast and the preloader can clear early.
    this.revealAt = Math.min(15, this.count);
    this._ready = false;
    this._revealed = false;
    this._visible = true;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    document.addEventListener('visibilitychange', () => {
      this._visible = document.visibilityState === 'visible';
    });

    this._resize();
    this._load();
  }

  _urls() {
    if (typeof window !== 'undefined' && Array.isArray(window.__SEQ__) && window.__SEQ__.length) {
      this.count = window.__SEQ__.length;
      return window.__SEQ__;
    }
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    // NOTE (vertical sequence — pending export): on portrait viewports a
    // dedicated `public/seq-portrait/` set would compose better than cropping
    // the landscape frames. That folder does NOT exist yet, so we do not point
    // at it (loading missing frames would blank the canvas). When the vertical
    // frames are exported (same `f_###.webp` naming), switch the folder here by
    // viewport aspect ratio — NOT user agent:
    //
    //   const dir = (window.innerHeight >= window.innerWidth) ? 'seq-portrait' : 'seq';
    //
    // Until then, portrait uses the landscape frames full-bleed (cover), which
    // already fills the screen without a visible box.
    const dir = 'seq';
    const urls = [];
    for (let i = 0; i < this.count; i++) {
      urls.push(`${base}${dir}/f_${String(i).padStart(3, '0')}.webp`);
    }
    return urls;
  }

  _load() {
    const urls = this._urls();
    this.count = urls.length;
    this.revealAt = Math.min(this.revealAt, this.count);
    urls.forEach((src, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        this.loaded++;
        this.ready[i] = !!(img.complete && img.naturalWidth);
        // Preloader counter reflects REAL decode progress of the opening frames
        // (the ones gating the reveal), not a simulated timer.
        this.onLoadProgress(Math.min(this.loaded / this.revealAt, 1));
        // Draw as soon as the very first frame is decodable.
        if (!this._ready && this.ready[i]) {
          this._ready = true;
          this._draw();
        }
        // Reveal + hand off once the opening beats are in; the other frames keep
        // streaming in the background. If the user scrolls past a not-yet-loaded
        // frame, _draw() falls back to the nearest decoded one.
        if (this.loaded >= this.revealAt && !this._revealed) {
          this._revealed = true;
          this.canvas.style.opacity = '1';
          this.onReady();
        }
      };
      img.src = src;
      this.frames[i] = img;
    });
  }

  // Nearest decoded frame to `idx` — lets the scrub stay live while the tail of
  // the sequence is still streaming in.
  _nearestLoaded(idx) {
    if (this.ready[idx]) return idx;
    for (let r = 1; r < this.count; r++) {
      if (idx - r >= 0 && this.ready[idx - r]) return idx - r;
      if (idx + r < this.count && this.ready[idx + r]) return idx + r;
    }
    return -1;
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
  }

  setProgress(p) {
    // Reduced motion: no scroll scrub — hold a single representative frame.
    if (this.reduced) return;
    this.progress = Math.min(Math.max(p, 0), 1);
  }

  _draw() {
    const target = Math.min(
      this.count - 1,
      Math.max(0, Math.round(this.display * (this.count - 1)))
    );
    // Fall back to the nearest decoded frame if the exact one is still loading.
    const idx = this._nearestLoaded(target);
    if (idx < 0) return;
    const img = this.frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const portrait = this._portrait();

    // Cover the whole viewport in both orientations — the animation is full
    // bleed, so there is never a letterboxed band or visible "box". On portrait
    // the tall crop reads as a full-screen vertical composition.
    const over = 1.04;
    const scale = Math.max(cw / iw, ch / ih) * over;
    const dw = iw * scale;
    const dh = ih * scale;

    let px = 0;
    let py = 0;
    if (this.pointer) {
      this.pointer.update();
      px = this.pointer.mouse.x * (dw - cw) * 0.1;
      py = -this.pointer.mouse.y * (dh - ch) * 0.1;
    }
    // Right bias clears the headline column on landscape; portrait stays centred.
    const biasX = portrait ? 0 : cw * 0.08;
    const dx = (cw - dw) / 2 + biasX + px;
    const dy = (ch - dh) / 2 + py;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _portrait() {
    return this.h >= this.w;
  }

  // Called from the shared rAF loop.
  frame() {
    if (!this._ready || !this._visible) return;
    // Reduced motion: pin one representative, fully-assembled frame (the end of
    // the reassembly) and draw it — no scrub, fully legible. Redrawing keeps it
    // correct if that final frame is still streaming in at reveal time.
    if (this.reduced) {
      this.display = 1;
      this._draw();
      return;
    }
    // Ease the drawn progress toward the scroll target — the cinematic feel.
    const d = this.progress - this.display;
    this.display += d * (Math.abs(d) > 0.0005 ? 0.09 : 1);
    this._draw();
  }

  destroy() {
    window.removeEventListener('resize', this._resize);
    this.frames = [];
  }
}
