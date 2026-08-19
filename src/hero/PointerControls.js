/**
 * Unifies the three input sources that drive the core:
 *   - desktop cursor (lerped, with velocity)
 *   - mobile gyroscope (DeviceOrientationEvent, iOS-permission aware)
 *   - autonomous drift fallback (when there is no pointer and no gyro grant)
 *
 * Exposes smoothed `mouse` (x,y in ~-1..1) and `velocity` (0..1) that the
 * scene reads every frame.
 */
export class PointerControls {
  constructor({ isMobile = false } = {}) {
    this.isMobile = isMobile;

    // target = raw input, mouse = interpolated. The 0.08 lerp is deliberate:
    // an immediate response feels cheap; the lag feels alive.
    this.lerp = 0.08;
    this.target = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0 };
    this.prev = { x: 0, y: 0 };
    this.velocity = 0;

    this._hasPointer = false;
    this._hasGyro = false;
    this._autonomous = true; // until a real input takes over
    this._t0 = performance.now();

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onDeviceOrientation = this._onDeviceOrientation.bind(this);
    this._onFirstTouch = this._onFirstTouch.bind(this);

    if (isMobile) {
      // iOS requires an explicit gesture-triggered permission request; never
      // ask on load — bind it to the first touch. Everything degrades to the
      // autonomous drift if permission is denied or unsupported.
      window.addEventListener('touchstart', this._onFirstTouch, { once: true, passive: true });
      // Non-iOS devices emit orientation without a prompt.
      window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
    } else {
      window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    }
  }

  _onPointerMove(e) {
    this._hasPointer = true;
    this._autonomous = false;
    this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  async _onFirstTouch() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission(); // requires HTTPS + gesture
        if (res === 'granted') {
          window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
        }
      } catch (_) {
        // Denied or errored — silently keep the autonomous drift.
      }
    }
  }

  _onDeviceOrientation(e) {
    if (e.gamma == null && e.beta == null) return;
    this._hasGyro = true;
    this._autonomous = false;
    // gamma: left/right [-90,90], beta: front/back [-180,180].
    this.target.x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
    this.target.y = Math.max(-1, Math.min(1, (e.beta || 0) / 45 - 0.6));
  }

  update() {
    if (this._autonomous) {
      // Slow, continuous, non-obvious drift. The user must never sense a failure.
      const t = (performance.now() - this._t0) * 0.001;
      this.target.x = Math.sin(t * 0.35) * 0.6 + Math.sin(t * 0.13) * 0.25;
      this.target.y = Math.cos(t * 0.27) * 0.5 + Math.sin(t * 0.11) * 0.2;
    }

    this.prev.x = this.mouse.x;
    this.prev.y = this.mouse.y;

    this.mouse.x += (this.target.x - this.mouse.x) * this.lerp;
    this.mouse.y += (this.target.y - this.mouse.y) * this.lerp;

    // Instantaneous speed of the interpolated point, normalized + smoothed.
    const dx = this.mouse.x - this.prev.x;
    const dy = this.mouse.y - this.prev.y;
    const speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 14);
    // Rise fast, fall slow — agitates on movement, settles back to calm.
    this.velocity += (speed - this.velocity) * (speed > this.velocity ? 0.4 : 0.05);
  }

  destroy() {
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('deviceorientation', this._onDeviceOrientation);
    window.removeEventListener('touchstart', this._onFirstTouch);
  }
}
