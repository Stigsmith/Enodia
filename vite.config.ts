import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One config for both. Vitest reads `test`, Vite ignores it.
export default defineConfig({
  plugins: [react()],
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
