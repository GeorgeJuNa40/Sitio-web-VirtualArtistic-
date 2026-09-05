import './styles/main.css';

import { Preloader } from './core/Preloader.js';
import { Scroll } from './core/Scroll.js';
import { PointerControls } from './hero/PointerControls.js';
import { ScrollSequence } from './hero/ScrollSequence.js';

/**
 * Orchestrator. The hero is a scroll-scrubbed image sequence (the logo
 * animation) on a premium-white stage: scroll drives which frame is drawn,
 * cursor / gyro add a subtle parallax. One rAF loop for scroll + draw.
 *
 * The semantic HTML is already painted before this runs; everything here only
 * enhances, and the copy still reads if it fails.
 */
function boot() {
  const preloader = new Preloader();
  preloader.start();

  const canvas = document.getElementById('scene');
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  if (!canvas || !canvas.getContext) {
    preloader.setSceneReady();
    return;
  }

  const pointer = new PointerControls({ isMobile });

  const sequence = new ScrollSequence({
    canvas,
    pointer,
    frameCount: 84,
    onReady: () => preloader.setSceneReady(),
    onProgress: () => {}
  });

  const scroll = new Scroll({
    onProgress: (p) => sequence.setProgress(p)
  });

  function loop(time) {
    scroll.raf(time);
    sequence.frame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.__virtualArtistic = { sequence, scroll, pointer };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
