/**
 * Custom cursor on a 2D canvas: a small ink dot (fast) chasing a thin ring
 * (slow) — the lag between them reads as inertia — over a faint warm gold halo.
 * On interactive elements the ring grows and turns gold while the dot recedes.
 *
 * It has NO loop of its own: `frame()` is called from the app's single shared
 * rAF. Disabled entirely on touch / coarse-pointer devices and under
 * prefers-reduced-motion; there it never hides the native cursor.
 */
const INK = [23, 22, 15];
const GOLD = [184, 134, 11];
const lerp = (a, b, t) => a + (b - a) * t;

export class Cursor {
  constructor() {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.enabled = fine && !reduced;
    if (!this.enabled) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cursor-layer';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '6',
      pointerEvents: 'none'
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.pointer = { x: -100, y: -100, active: false };
    this.dot = { x: -100, y: -100 };
    this.ring = { x: -100, y: -100 };
    this.halo = { x: -100, y: -100 };
    this.hover = 0; // eased 0 -> 1 over interactive targets
    this._hoverTarget = false;
    this._visible = true;

    this._resize = this._resize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onOver = this._onOver.bind(this);

    this._resize();
    window.addEventListener('resize', this._resize);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerover', this._onOver, { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => {
      this._visible = document.visibilityState === 'visible';
    });

    document.documentElement.classList.add('has-cursor');
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
      this.dot.x = this.ring.x = this.halo.x = e.clientX;
      this.dot.y = this.ring.y = this.halo.y = e.clientY;
    }
  }

  _onOver(e) {
    const el = e.target;
    this._hoverTarget = !!(el && el.closest && el.closest('a, button, [data-cursor], input, textarea, select, label'));
  }

  // Called from the shared rAF loop.
  frame() {
    if (!this.enabled || !this._visible) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.pointer.active) return;

    // Two speeds → inertia. Halo trails slowest.
    this.dot.x = lerp(this.dot.x, this.pointer.x, 0.18);
    this.dot.y = lerp(this.dot.y, this.pointer.y, 0.18);
    this.ring.x = lerp(this.ring.x, this.pointer.x, 0.09);
    this.ring.y = lerp(this.ring.y, this.pointer.y, 0.09);
    this.halo.x = lerp(this.halo.x, this.pointer.x, 0.14);
    this.halo.y = lerp(this.halo.y, this.pointer.y, 0.14);
    this.hover = lerp(this.hover, this._hoverTarget ? 1 : 0, 0.12);

    // Faint warm halo, behind everything.
    const hg = ctx.createRadialGradient(this.halo.x, this.halo.y, 0, this.halo.x, this.halo.y, 90);
    hg.addColorStop(0, 'rgba(212, 160, 45, 0.10)');
    hg.addColorStop(0.6, 'rgba(212, 160, 45, 0.035)');
    hg.addColorStop(1, 'rgba(212, 160, 45, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(this.halo.x, this.halo.y, 90, 0, Math.PI * 2);
    ctx.fill();

    // Ring: 16px radius → 28px on hover; ink → gold.
    const radius = lerp(16, 28, this.hover);
    const r = Math.round(lerp(INK[0], GOLD[0], this.hover));
    const g = Math.round(lerp(INK[1], GOLD[1], this.hover));
    const b = Math.round(lerp(INK[2], GOLD[2], this.hover));
    const ringAlpha = lerp(0.3, 0.9, this.hover);
    ctx.beginPath();
    ctx.arc(this.ring.x, this.ring.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${ringAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dot: 3px radius, recedes to 0 on hover.
    const dotR = lerp(3, 0, this.hover);
    if (dotR > 0.15) {
      ctx.beginPath();
      ctx.arc(this.dot.x, this.dot.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${INK[0]}, ${INK[1]}, ${INK[2]}, 0.9)`;
      ctx.fill();
    }
  }

  destroy() {
    if (!this.enabled) return;
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerover', this._onOver, { capture: true });
    document.documentElement.classList.remove('has-cursor');
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
