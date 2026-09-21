import { defineConfig } from 'vite';
import { generate, seoLinks } from './scripts/build-i18n-html.mjs';

// Dependency-free toolchain: the hero is a scroll-scrubbed image sequence drawn
// on a 2D canvas, so there is no 3D/GLSL build step — only GSAP + Lenis are
// bundled as vendor.
//
// Two real, indexable routes: `/` (es) and `/en/` (en). Both HTML entries are
// generated from one template + the i18n dictionaries by scripts/build-i18n-
// html.mjs, so the copy has a single source of truth. The plugin below
// regenerates them on server start / build and live-reloads when a template or
// dictionary changes.
function i18nHtml() {
  const watched = ['src/templates/', 'src/i18n/'];
  return {
    name: 'virtualartistic-i18n-html',
    buildStart() {
      generate();
    },
    configureServer(server) {
      generate();
      const isWatched = (f) => watched.some((w) => f.replace(/\\/g, '/').includes(w));
      const regen = (f) => {
        if (!isWatched(f)) return;
        generate();
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', regen);
      server.watcher.on('add', regen);
    },
    // Inject canonical + hreflang after Vite's asset pass, so it never tries to
    // asset-resolve the directory URLs ("/", "/en/") those links point to.
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const isEn = (ctx.path || ctx.filename || '').replace(/\\/g, '/').includes('/en/');
        return html.replace('</head>', `  ${seoLinks(isEn ? 'en' : 'es')}\n  </head>`);
      }
    }
  };
}

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [i18nHtml()],
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        en: 'en/index.html'
      },
      output: {
        manualChunks: {
          vendor: ['gsap', 'lenis']
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
});
