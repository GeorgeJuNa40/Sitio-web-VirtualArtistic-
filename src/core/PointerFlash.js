/**
 * Site-wide golden "destello": a single soft warm glow that trails the cursor
 * on the premium-white stage (warm gold reads where additive light would
 * vanish). No sparkles — just the faint halo. Lightweight canvas 2D; respects
 * reduced-motion and pauses when hidden.
 */
export class PointerFlash {
  constructor() {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'flash-layer';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '4',
      pointerEvents: 'none'
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pointer = { x: -1, y: -1, active: false };
    this.smooth = { x: 0, y: 0 };
    this._visible = true;

    this._resize = this._resize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onTouch = this._onTouch.bind(this);
    this._loop = this._loop.bind(this);

    this._resize();
    window.addEventListener('resize', this._resize);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('touchmove', this._onTouch, { passive: true });
    document.addEventListener('visibilitychange', () => {
      this._visible = document.visibilityState === 'visible';
    });
    requestAnimationFrame(this._loop);
  }

  _resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _onMove(e) {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (!this.pointer.active) {
      this.pointer.active = true;
      this.smooth.x = e.clientX;
      this.smooth.y = e.clientY;
    }
  }

  _onTouch(e) {
    if (!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    this._onMove({ clientX: t.clientX, clientY: t.clientY });
  }

  _loop() {
    if (this._destroyed) return;
    requestAnimationFrame(this._loop);
    if (!this._visible) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.pointer.active) return;

    // Warm glow trailing the cursor (lerp 0.14).
    this.smooth.x += (this.pointer.x - this.smooth.x) * 0.14;
    this.smooth.y += (this.pointer.y - this.smooth.y) * 0.14;
    const gx = this.smooth.x;
    const gy = this.smooth.y;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 90);
    glow.addColorStop(0, 'rgba(212, 160, 45, 0.12)');
    glow.addColorStop(0.6, 'rgba(212, 160, 45, 0.04)');
    glow.addColorStop(1, 'rgba(212, 160, 45, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(gx, gy, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  destroy() {
    this._destroyed = true;
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('touchmove', this._onTouch);
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
