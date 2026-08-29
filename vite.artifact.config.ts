/**
 * The build behind `npm run artifact`.
 *
 * Separate from `vite.config.ts` because it differs in the two things that
 * matter: the entry is `artifact/index.html` rather than the app's, and
 * **`publicDir` is off**. The main build copies the whole image library beside
 * the bundle and serves it; this one has no server to serve it from, so
 * `scripts/artifact.ts` inlines what the page draws instead.
 *
 * One chunk and one stylesheet, because the post-processing folds exactly one
 * of each into the page.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'artifact',
  publicDir: false,
  build: {
    outDir: '../dist-artifact/build',
    emptyOutDir: true,
    // The page inlines the module itself, so a sourcemap would be dead weight
    // and the asset names only have to be findable, not cacheable.
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
})
