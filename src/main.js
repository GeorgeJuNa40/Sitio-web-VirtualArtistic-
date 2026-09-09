import './styles/main.css';
import { gsap } from 'gsap';

import { Preloader } from './core/Preloader.js';
import { Scroll } from './core/Scroll.js';
import { PointerControls } from './hero/PointerControls.js';
import { ScrollSequence } from './hero/ScrollSequence.js';
import { PointerFlash } from './core/PointerFlash.js';

/**
 * Orchestrator. The hero is a scroll-scrubbed image sequence (the logo
 * animation) on a premium-white stage: scroll drives which frame is drawn,
 * cursor / gyro add a subtle parallax, and a golden "destello" trails the
 * cursor site-wide. One rAF loop for scroll + draw.
 */
function boot() {
  const preloader = new Preloader();
  preloader.start();

  // Golden flash that follows the cursor, across the whole site.
  new PointerFlash();

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
    frameCount: 100,
    onReady: () => {
      preloader.setSceneReady();
      playIntro(scroll);
    }
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

/**
 * Staggered entrance for the hero text — reveals as the preloader clears, then
 * hands the fade back to the scroll controller.
 */
function playIntro(scroll) {
  const els = Array.from(document.querySelectorAll('[data-hero-fade]')).sort(
    (a, b) => Number(a.dataset.heroFade) - Number(b.dataset.heroFade)
  );
  if (!els.length) {
    scroll.enableFade();
    return;
  }
  gsap.set(els, { opacity: 0, y: 28, filter: 'blur(6px)' });
  gsap.to(els, {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    duration: 1.0,
    ease: 'power3.out',
    stagger: 0.13,
    delay: 0.7,
    onComplete: () => scroll.enableFade()
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
