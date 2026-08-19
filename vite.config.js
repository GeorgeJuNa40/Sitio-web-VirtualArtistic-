import { defineConfig } from 'vite';

// Shaders are imported via Vite's native `?raw` suffix and composed in JS,
// so no GLSL plugin is required. This keeps the toolchain dependency-free.
export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
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
