/**
 * Scroll-scrubbed image sequence. Preloads the logo-animation frames and draws
 * the one matching scroll progress onto a 2D canvas (Apple-style scrubbing) —
 * smooth and codec-independent, unlike seeking an H.264 <video>. A subtle
 * cursor / gyro parallax keeps it alive at rest.
 */
export class ScrollSequence {
  constructor({ canvas, pointer, frameCount = 84, onReady, onProgress } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pointer = pointer;
    this.count = frameCount;
    this.onReady = onReady || (() => {});
    this.onLoadProgress = onProgress || (() => {});

    this.progress = 0;
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
    if (typeof window !== 'undefined' && Array.isArray(window.__SEQ__) && window.__SEQ__.length) {
      this.count = window.__SEQ__.length;
      return window.__SEQ__;
    }
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    const urls = [];
    for (let i = 0; i < this.count; i++) {
      urls.push(`${base}seq/f_${String(i).padStart(3, '0')}.webp`);
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
      Math.max(0, Math.round(this.progress * (this.count - 1)))
    );
    const img = this.frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Cover-fit with a slight overscan so the parallax shift never shows edges.
    const over = 1.06;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * over;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    let px = 0;
    let py = 0;
    if (this.pointer) {
      this.pointer.update();
      px = this.pointer.mouse.x * (dw - cw) * 0.12;
      py = -this.pointer.mouse.y * (dh - ch) * 0.12;
    }
    const dx = (cw - dw) / 2 + px;
    const dy = (ch - dh) / 2 + py;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Called from the shared rAF loop.
  frame() {
    if (!this._ready || !this._visible) return;
    this._draw();
  }

  destroy() {
    window.removeEventListener('resize', this._resize);
    this.frames = [];
  }
}
