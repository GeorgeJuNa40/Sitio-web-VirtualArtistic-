import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Separate config used only to produce a single self-contained HTML for the
// live preview Artifact. Does not affect the normal `npm run build`.
// Parameterized by env so it can build either route:
//   SF_INPUT  — the HTML entry (default index.html → es; en/index.html → en)
//   SF_OUTDIR — the output directory for the single file
const OUT_DEFAULT =
  '/tmp/claude-0/-home-user-Sitio-web-VirtualArtistic-/52093a43-2699-5bc8-bd80-f1209a4abac4/scratchpad/preview';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: process.env.SF_OUTDIR || OUT_DEFAULT,
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: process.env.SF_INPUT || 'index.html',
      output: { inlineDynamicImports: true }
    }
  }
});
