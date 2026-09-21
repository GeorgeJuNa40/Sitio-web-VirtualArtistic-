import './styles/main.css';
import { gsap } from 'gsap';

import { Preloader } from './core/Preloader.js';
import { Scroll } from './core/Scroll.js';
import { PointerControls } from './hero/PointerControls.js';
import { ScrollSequence } from './hero/ScrollSequence.js';
import { Cursor } from './core/Cursor.js';
import { Marquee } from './core/Marquee.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Orchestrator. The hero is a scroll-scrubbed image sequence (the logo
 * animation) on a premium-white stage. A SINGLE shared requestAnimationFrame
 * drives everything — Lenis, the frame sequence, the custom cursor and the
 * marquee — so nothing runs a competing loop.
 */
function boot() {
  restoreScroll();

  const preloader = new Preloader();
  preloader.start();

  // Custom cursor (desktop only; inert on touch / reduced motion).
  const cursor = new Cursor();
  const marquee = new Marquee(document.getElementById('marquee'));

  initLangSuggest();

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
    onProgress: (p) => preloader.setProgress(p),
    onReady: () => {
      preloader.setSceneReady();
      playIntro(scroll);
    }
  });

  const scroll = new Scroll({
    onProgress: (p) => sequence.setProgress(p)
  });

  // One rAF for the whole hero: scroll → draw → cursor → marquee.
  let last = performance.now();
  function loop(time) {
    const dt = time - last;
    last = time;
    scroll.raf(time);
    sequence.frame();
    cursor.frame();
    marquee.frame(dt, scroll.velocity, scroll.progress);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.__virtualArtistic = { sequence, scroll, pointer, cursor, marquee };
}

/**
 * Masked, staggered entrance. Each H1 line rides up from behind a hard edge
 * (its overflow-hidden mask); the other rows translate up and resolve a 6px
 * blur. One master easing (power3.out), 0.16s stagger, in reading order:
 * top → eyebrow → H1 line 1 → H1 line 2 → lede → CTAs → scope → scroll hint.
 */
function playIntro(scroll) {
  const q = (sel) => document.querySelector(sel);
  const lines = Array.from(document.querySelectorAll('.hero__title .line__i'));
  const order = [
    { el: q('[data-hero-fade="0"]'), mask: false },
    { el: q('[data-hero-fade="1"]'), mask: false },
    { el: lines[0], mask: true },
    { el: lines[1], mask: true },
    { el: q('[data-hero-fade="3"]'), mask: false },
    { el: q('[data-hero-fade="4"]'), mask: false },
    { el: q('[data-hero-fade="5"]'), mask: false },
    { el: q('[data-hero-fade="6"]'), mask: false }
  ].filter((o) => o.el);

  if (!order.length) {
    scroll.enableFade();
    return;
  }

  if (REDUCED) {
    // No entrance animation — everything visible and legible immediately.
    order.forEach((o) => gsap.set(o.el, { opacity: 1, y: 0, filter: 'none' }));
    scroll.enableFade();
    return;
  }

  const tl = gsap.timeline({
    delay: 0.7,
    onComplete: () => {
      order.forEach((o) => (o.el.style.willChange = 'auto'));
      scroll.enableFade();
    }
  });

  order.forEach((o, i) => {
    o.el.style.willChange = 'transform, opacity, filter';
    const from = o.mask
      ? { yPercent: 115, opacity: 0, filter: 'blur(6px)' }
      : { y: 32, opacity: 0, filter: 'blur(6px)' };
    const to = o.mask
      ? { yPercent: 0, opacity: 1, filter: 'blur(0px)' }
      : { y: 0, opacity: 1, filter: 'blur(0px)' };
    gsap.set(o.el, from);
    tl.to(o.el, { ...to, duration: 1.0, ease: 'power3.out' }, i * 0.16);
  });
}

/**
 * Discreet, never forced language suggestion. If the browser prefers the other
 * language than the current route and the visitor hasn't chosen before, offer
 * the alternate route. The choice is remembered in localStorage.
 */
function initLangSuggest() {
  const el = document.getElementById('lang-suggest');
  const PREF = 'va-lang-pref';
  const current = document.documentElement.lang;

  // Remember the chosen language on any selector / suggestion click, and keep
  // scroll position across the route change.
  document.querySelectorAll('.lang__link, #lang-suggest a').forEach((a) => {
    a.addEventListener('click', () => {
      const code = a.getAttribute('lang') || a.getAttribute('hreflang') || '';
      try {
        if (code) localStorage.setItem(PREF, code);
        sessionStorage.setItem('va-scroll', String(window.scrollY || window.pageYOffset || 0));
      } catch (_) {}
    });
  });

  if (!el) return;
  let pref = null;
  try {
    pref = localStorage.getItem(PREF);
  } catch (_) {}
  if (pref) return; // already chose — don't nag

  const want = el.dataset.suggestLang;
  const nav = (navigator.language || '').toLowerCase();
  if (want && nav.startsWith(want)) {
    el.hidden = false;
  }

  const close = el.querySelector('.lang-suggest__close');
  if (close) {
    close.addEventListener('click', () => {
      el.hidden = true;
      try {
        localStorage.setItem(PREF, current);
      } catch (_) {}
    });
  }
}

/** Restore scroll position saved when switching language, so the route change
 *  doesn't jump the visitor back to the top. */
function restoreScroll() {
  try {
    const s = sessionStorage.getItem('va-scroll');
    if (s !== null) {
      sessionStorage.removeItem('va-scroll');
      const y = parseInt(s, 10) || 0;
      if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    }
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
