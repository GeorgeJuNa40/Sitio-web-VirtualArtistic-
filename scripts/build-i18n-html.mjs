/**
 * Single source of truth → two real routes.
 *
 * Reads the shared critical CSS (src/templates/critical.css) and one dictionary
 * per language (src/i18n/*.json), then emits `index.html` (es, at root) and
 * `en/index.html` (en). The markup lives here once; only the strings differ by
 * route, so a copy change is a one-file edit in the dictionary — never hand-
 * duplicated HTML. hreflang + canonical + Open Graph are stamped per route.
 *
 * Chosen over a JS toggle because a toggle isn't crawlable: a buyer searching
 * in English must land on real, indexable `/en/` HTML, not JS-swapped text.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Deploy domain for absolute canonical/OG/hreflang URLs. Empty → root-relative
// (works everywhere; set this to the production origin before launch).
const SITE_URL = '';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function marqueeTrack(text) {
  // Duplicate enough copies to cover >2x the widest viewport so the wrap seam
  // is never visible; JS advances it with translate3d.
  const unit = `<span>${esc(text)}</span>`;
  return `<div class="marquee__track">${unit.repeat(8)}</div>`;
}

function page(t, criticalCss) {
  const abs = (route) => (SITE_URL ? SITE_URL.replace(/\/$/, '') + route : route);
  const isEs = t.lang === 'es';
  const esCls = `lang__link${isEs ? ' is-active' : ''}`;
  const enCls = `lang__link${!isEs ? ' is-active' : ''}`;
  const esCur = isEs ? ' aria-current="true"' : '';
  const enCur = !isEs ? ' aria-current="true"' : '';

  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#fdfdfd" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>${esc(t.meta.title)}</title>
    <meta name="description" content="${esc(t.meta.description)}" />
    <!-- canonical + hreflang alternates are injected by the Vite plugin's
         transformIndexHtml (post) so the bundler never tries to asset-resolve
         their directory URLs ("/", "/en/"). See vite.config.js / seoLinks(). -->

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(t.meta.ogTitle)}" />
    <meta property="og:description" content="${esc(t.meta.ogDescription)}" />
    <meta property="og:locale" content="${t.ogLocale}" />
    <meta property="og:url" content="${abs(t.canonical)}" />

    <!--
      Editorial geometric sans. display=swap → the headline paints in the
      metric-matched system fallback on the first frame (the <h1> stays the LCP
      element, never blocked on the font) and upgrades to the editorial face
      once it arrives. Space Grotesk = headline authority, Manrope = body.
    -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap"
    />

    <!-- CRITICAL CSS (inlined). The <h1> paints on the first frame. -->
    <style>
${criticalCss}
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="hero" id="hero">
        <div class="hero__sticky">
          <canvas id="scene" class="hero__canvas" aria-hidden="true"></canvas>
          <div class="hero__scrim" aria-hidden="true"></div>
          <div class="hero__grain" aria-hidden="true"></div>
          <div class="hero__vignette" aria-hidden="true"></div>

          <div class="hero__marquee" id="marquee" aria-hidden="true">
            ${marqueeTrack(t.marquee)}
          </div>

          <div class="hero__content">
            <div class="hero__top" data-hero-fade="0">
              <p class="brand">
                VirtualArtistic <span class="brand__mark" data-i18n="brandMark">${esc(t.brandMark)}</span>
              </p>
              <div class="hero__top-right">
                <p class="meta" data-i18n="topMeta">${esc(t.topMeta)}</p>
                <nav class="lang" aria-label="${esc(t.langLabel)}">
                  <a class="${esCls}" href="/"${esCur} hreflang="es" lang="es">ES</a>
                  <span class="lang__sep" aria-hidden="true">·</span>
                  <a class="${enCls}" href="/en/"${enCur} hreflang="en" lang="en">EN</a>
                </nav>
              </div>
            </div>

            <div class="hero__center">
              <span class="eyebrow" data-hero-fade="1" data-i18n="eyebrow">${esc(t.eyebrow)}</span>
              <h1 class="hero__title" data-hero-fade="2">
                <span class="line"><span class="line__i" data-i18n="h1line1">${esc(t.h1line1)}</span></span>
                <span class="line"><span class="line__i" data-i18n="h1line2">${esc(t.h1line2)}</span></span>
              </h1>
              <p class="hero__lede" data-hero-fade="3" data-i18n="lede">${esc(t.lede)}</p>
            </div>

            <div class="hero__bottom">
              <div class="hero__bottom-left">
                <div class="cta-stack" data-hero-fade="4">
                  <div class="cta-group">
                    <a class="cta" href="#contacto">
                      <span data-i18n="ctaPrimary">${esc(t.ctaPrimary)}</span>
                      <span class="cta__arrow" aria-hidden="true">→</span>
                    </a>
                    <a class="cta cta--ghost" href="#enfoque" data-i18n="ctaSecondary">${esc(t.ctaSecondary)}</a>
                  </div>
                  <p class="scarcity" data-i18n="scarcity">${esc(t.scarcity)}</p>
                </div>
                <p class="scope" data-hero-fade="5" data-i18n="scope">${esc(t.scope)}</p>
              </div>
              <span class="scroll-hint" data-hero-fade="6" aria-hidden="true">
                <span class="scroll-hint__line"></span>
                <span data-i18n="scrollHint">${esc(t.scrollHint)}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <section class="after" id="enfoque">
        <h2 class="after__title" data-i18n="after.title">${esc(t.after.title)}</h2>
        <div class="after__grid">
          ${t.after.cells
            .map(
              (c, i) => `<div class="after__cell">
            <h3 data-i18n="after.cells.${i}.h">${esc(c.h)}</h3>
            <p data-i18n="after.cells.${i}.p">${esc(c.p)}</p>
          </div>`
            )
            .join('\n          ')}
        </div>
      </section>
    </div>

    <div class="preloader" id="preloader" aria-hidden="true">
      <div class="preloader__stage">
        <div class="preloader__logo">
          <img class="preloader__logo-ghost" src="/logo.png" alt="" />
          <div class="preloader__logo-clip">
            <img class="preloader__logo-fill" src="/logo.png" alt="" />
          </div>
        </div>
        <div class="preloader__bar">
          <span class="preloader__bar-fill"></span>
        </div>
      </div>
      <div class="preloader__inner">
        <span class="preloader__word">VirtualArtistic</span>
        <span class="preloader__count" id="preloader-count">00</span>
      </div>
    </div>

    <aside
      class="lang-suggest"
      id="lang-suggest"
      data-suggest-lang="${t.other.code}"
      data-suggest-route="${t.other.route}"
      hidden
    >
      <span>${esc(t.suggest.text)}</span>
      <a href="${t.other.route}">${esc(t.suggest.cta)}</a>
      <button class="lang-suggest__close" type="button" aria-label="${esc(
        t.suggest.close
      )}">×</button>
    </aside>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}

/**
 * Canonical + hreflang <link> tags for a route. Injected post-bundle (see
 * vite.config.js) so Vite never asset-resolves the directory URLs.
 */
export function seoLinks(lang) {
  const abs = (route) => (SITE_URL ? SITE_URL.replace(/\/$/, '') + route : route);
  const route = lang === 'en' ? '/en/' : '/';
  return [
    `<link rel="canonical" href="${abs(route)}" />`,
    `<link rel="alternate" hreflang="es" href="${abs('/')}" />`,
    `<link rel="alternate" hreflang="en" href="${abs('/en/')}" />`,
    `<link rel="alternate" hreflang="x-default" href="${abs('/')}" />`
  ].join('\n    ');
}

export function generate() {
  const criticalCss = fs
    .readFileSync(path.join(ROOT, 'src/templates/critical.css'), 'utf8')
    .replace(/\n/g, '\n      ');
  const langs = ['es', 'en'];
  const outputs = [];
  for (const code of langs) {
    const dict = JSON.parse(
      fs.readFileSync(path.join(ROOT, `src/i18n/${code}.json`), 'utf8')
    );
    const html = page(dict, criticalCss);
    const outFile =
      code === 'es'
        ? path.join(ROOT, 'index.html')
        : path.join(ROOT, 'en', 'index.html');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    outputs.push(path.relative(ROOT, outFile));
  }
  return outputs;
}

// Allow running directly: `node scripts/build-i18n-html.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = generate();
  console.log('Generated:', out.join(', '));
}
