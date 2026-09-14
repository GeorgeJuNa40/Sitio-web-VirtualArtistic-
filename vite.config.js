import { defineConfig } from 'vite';

// Dependency-free toolchain: the hero is a scroll-scrubbed image sequence drawn
// on a 2D canvas, so there is no 3D/GLSL build step — only GSAP + Lenis are
// bundled as vendor.
export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
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
