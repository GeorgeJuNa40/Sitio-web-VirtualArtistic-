/**
 * Site-wide golden "destello" that follows the cursor: a soft warm glow trailing
 * the pointer plus brief star-glints that flash and fade as it moves. Tuned for
 * the premium-white stage (warm gold reads where additive light would vanish).
 * Lightweight canvas 2D; respects reduced-motion and pauses when hidden.
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
    this.sparks = [];
    this.pointer = { x: -1, y: -1, active: false };
    this.smooth = { x: 0, y: 0 };
    this.last = { x: 0, y: 0 };
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

  _spawn(x, y, speed) {
    const n = 1 + (Math.random() < Math.min(speed * 0.04, 0.8) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 26,
        born: performance.now(),
        life: 380 + Math.random() * 420,
        size: 7 + Math.random() * 12,
        rot: Math.random() * Math.PI
      });
    }
    if (this.sparks.length > 70) this.sparks.splice(0, this.sparks.length - 70);
  }

  _onMove(e) {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (!this.pointer.active) {
      this.pointer.active = true;
      this.smooth.x = e.clientX;
      this.smooth.y = e.clientY;
      this.last.x = e.clientX;
      this.last.y = e.clientY;
    }
    const moved = Math.hypot(e.clientX - this.last.x, e.clientY - this.last.y);
    if (moved > 12) {
      this._spawn(e.clientX, e.clientY, moved);
      this.last.x = e.clientX;
      this.last.y = e.clientY;
    }
  }

  _onTouch(e) {
    if (!e.touches || !e.touches.length) return;
    const t = e.touches[0];
    this._onMove({ clientX: t.clientX, clientY: t.clientY });
  }

  _star(x, y, r, a, rot) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Soft warm core.
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255, 224, 150, ${a})`);
    g.addColorStop(0.5, `rgba(214, 160, 40, ${a * 0.35})`);
    g.addColorStop(1, 'rgba(214, 160, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Four-point glint.
    ctx.strokeStyle = `rgba(198, 138, 20, ${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 1.5, 0);
    ctx.lineTo(r * 1.5, 0);
    ctx.moveTo(0, -r * 1.5);
    ctx.lineTo(0, r * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  _loop() {
    if (this._destroyed) return;
    requestAnimationFrame(this._loop);
    if (!this._visible) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.pointer.active) return;

    const now = performance.now();

    // Warm glow trailing the cursor.
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

    // Star-glint sparkles.
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      const t = (now - s.born) / s.life;
      if (t >= 1) {
        this.sparks.splice(i, 1);
        continue;
      }
      // Quick flash in, slow fade out.
      const a = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      const r = s.size * (0.6 + t * 0.8);
      this._star(s.x, s.y, r, Math.max(a, 0) * 0.9, s.rot + t * 0.6);
    }
  }

  destroy() {
    this._destroyed = true;
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('touchmove', this._onTouch);
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
