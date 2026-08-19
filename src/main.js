import './styles/main.css';

import { detectQuality } from './utils/QualityManager.js';
import { Preloader } from './core/Preloader.js';
import { Scroll } from './core/Scroll.js';
import { PointerControls } from './hero/PointerControls.js';
import { HeroScene } from './hero/HeroScene.js';

/**
 * Orchestrator. Wires the modules together and owns the single rAF loop that
 * drives both smooth-scroll and the render — one loop, one budget.
 *
 * The reading layer (semantic HTML) is already painted by the time this runs.
 * Everything here only enhances; if any of it fails, the text still reads.
 */
function boot() {
  const preloader = new Preloader();
  preloader.start();

  const { tier, info, webglSupported, isMobile } = detectQuality();

  const canvas = document.getElementById('scene');

  // No WebGL at all: leave the pure black/white reading layer, resolve loader.
  if (!webglSupported || !canvas) {
    preloader.setSceneReady();
    return;
  }

  let scene = null;
  const pointer = new PointerControls({ isMobile: !!isMobile });

  try {
    scene = new HeroScene({ canvas, tier, pointer, quality: info });
  } catch (err) {
    // WebGL init failed unexpectedly — degrade to the text-only hero.
    console.warn('[VirtualArtistic] Hero scene init failed, text-only fallback.', err);
    preloader.setSceneReady();
    return;
  }

  const scroll = new Scroll({
    onProgress: (p) => scene.setScrollProgress(p)
  });

  scene.start();

  let frames = 0;
  let revealed = false;

  function loop(time) {
    if (scene && scene._disposed) return;
    scroll.raf(time);
    scene.frame();

    // Reveal only after the first frames actually rendered — protects LCP and
    // guarantees the <h1> owned the first paint before the canvas appears.
    if (!revealed && ++frames >= 2) {
      revealed = true;
      scene.reveal();
      preloader.setSceneReady();
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // Expose for debugging / teardown in embedded contexts.
  window.__virtualArtistic = { scene, scroll, pointer, tier: tier.name };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
