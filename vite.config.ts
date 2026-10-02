import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One config for both. Vitest reads `test`, Vite ignores it.
export default defineConfig({
  plugins: [react()],
  // The preview pane hands the dev server a free port in PORT when 5173 is
  // taken by another project's server. Vite does not read PORT itself, and
  // nothing here needs 5173 in particular: sign-in and the API live on the
  // Worker at 8787, not behind Vite.
  server: { port: Number(process.env.PORT) || 5173 },
  // The image library is served as-is, so a manifest path like
  // "boons/storm-ring.webp" is also its URL. A build copies all of it, and
  // scripts/prune.ts then deletes whatever the app never references, which is
  // what keeps the 39 MB of full-size Arcana PNGs out of dist/.
  publicDir: 'assets',
  build: {
    // dist/ is build output, and git ignores it. It once held the hand-authored
    // page that stood in for the app; that page moved to placeholder/ and was
    // deleted on 11 September 2026, once nothing served it.
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    // Node by default. A component test opts in with a
    // `// @vitest-environment jsdom` docblock at the top of its file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
  },
})
