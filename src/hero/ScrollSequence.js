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
    this.loaded = 0;
    this._ready = false;
    this._revealed = false;
    this._visible = true;
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
    // Phones get a portrait, padded frame set (smaller, contained mark with
    // white margins) so it fills the screen with no visible "box"; desktop gets
    // the wide set.
    const mobile =
      window.matchMedia('(max-width: 760px)').matches ||
      window.innerHeight > window.innerWidth;

    if (mobile && Array.isArray(window.__SEQ_M__) && window.__SEQ_M__.length) {
      this.count = window.__SEQ_M__.length;
      return window.__SEQ_M__;
    }
    if (!mobile && Array.isArray(window.__SEQ__) && window.__SEQ__.length) {
      this.count = window.__SEQ__.length;
      return window.__SEQ__;
    }
    if (Array.isArray(window.__SEQ__) && window.__SEQ__.length) {
      this.count = window.__SEQ__.length;
      return window.__SEQ__;
    }
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    const folder = mobile ? 'seq-m' : 'seq';
    const urls = [];
    for (let i = 0; i < this.count; i++) {
      urls.push(`${base}${folder}/f_${String(i).padStart(3, '0')}.webp`);
    }
    return urls;
  }

  _load() {
    const urls = this._urls();
    this.count = urls.length;
    urls.forEach((src, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        this.loaded++;
        this.onLoadProgress(this.loaded / this.count);
        // Reveal as soon as the first frame is ready; keep loading the rest.
        if (i === 0 && !this._ready) {
          this._ready = true;
          this._draw();
        }
        if (this.loaded >= this.count && !this._revealed) {
          this._revealed = true;
          this.canvas.style.opacity = '1';
          this.onReady();
        }
      };
      img.src = src;
      this.frames[i] = img;
    });
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
    this.progress = Math.min(Math.max(p, 0), 1);
  }

  _draw() {
    const idx = Math.min(
      this.count - 1,
      Math.max(0, Math.round(this.display * (this.count - 1)))
    );
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
