import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Separate config used only to produce a single self-contained HTML for the
// live preview Artifact. Does not affect the normal `npm run build`.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: '/tmp/claude-0/-home-user-Sitio-web-VirtualArtistic-/52093a43-2699-5bc8-bd80-f1209a4abac4/scratchpad/preview',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
});
