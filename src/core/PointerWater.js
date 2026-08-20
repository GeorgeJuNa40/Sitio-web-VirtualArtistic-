/**
 * Site-wide "water" pointer effect: a fixed, full-viewport 2D-canvas overlay
 * that trails the cursor with a soft liquid glow and spawns expanding ripple
 * rings as it moves. Independent of the hero WebGL scene, so it lives across
 * every section (and still works when the hero falls back to text-only).
 *
 * Pure canvas 2D, a handful of shapes per frame — negligible cost. Respects
 * prefers-reduced-motion and pauses when the tab is hidden.
 */
export class PointerWater {
  constructor() {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) return;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'water-layer';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '3',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0.9'
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ripples = [];
    this.pointer = { x: -1, y: -1, active: false };
    this.smooth = { x: 0, y: 0 };
    this.last = { x: 0, y: 0, t: 0 };
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  _spawn(x, y, speed) {
    // Rings scale gently with pointer speed; capped so fast flicks stay calm.
    const strength = Math.min(1, speed * 0.02);
    this.ripples.push({
      x,
      y,
      born: performance.now(),
      life: 900 + strength * 700,
      maxR: 34 + strength * 90
    });
    if (this.ripples.length > 60) this.ripples.shift();
  }

  _onMove(e) {
    const now = performance.now();
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    const dt = Math.max(now - this.last.t, 1);
    const speed = Math.sqrt(dx * dx + dy * dy) / dt * 16;

    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (!this.pointer.active) {
      this.pointer.active = true;
      this.smooth.x = e.clientX;
      this.smooth.y = e.clientY;
    }

    // Throttle ripple spawning by distance so a still cursor doesn't stack them.
    const moved = Math.hypot(e.clientX - this.last.x, e.clientY - this.last.y);
    if (moved > 14) {
      this._spawn(e.clientX, e.clientY, speed);
      this.last.x = e.clientX;
      this.last.y = e.clientY;
    }
    this.last.t = now;
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

    const now = performance.now();

    // Soft liquid glow trailing the cursor with inertia (the "water" body).
    this.smooth.x += (this.pointer.x - this.smooth.x) * 0.12;
    this.smooth.y += (this.pointer.y - this.smooth.y) * 0.12;
    const gx = this.smooth.x;
    const gy = this.smooth.y;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 70);
    glow.addColorStop(0, 'rgba(150, 190, 225, 0.14)');
    glow.addColorStop(0.5, 'rgba(120, 160, 205, 0.05)');
    glow.addColorStop(1, 'rgba(120, 160, 205, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(gx, gy, 70, 0, Math.PI * 2);
    ctx.fill();

    // Expanding ripple rings — thin, doubled, fading like water surface waves.
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const t = (now - r.born) / r.life;
      if (t >= 1) {
        this.ripples.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 2);
      const radius = 6 + ease * r.maxR;
      const alpha = (1 - t) * (1 - t) * 0.32;

      ctx.strokeStyle = `rgba(180, 205, 235, ${alpha})`;
      ctx.lineWidth = 1.5 * (1 - t) + 0.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner echo ring for a more liquid, layered ripple.
      ctx.strokeStyle = `rgba(210, 225, 245, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
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
