import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One config for both. Vitest reads `test`, Vite ignores it.
export default defineConfig({
  plugins: [react()],
  // The image library is served as-is, so a manifest path like
  // "boons/storm-ring.webp" is also its URL. 35 MB of it ships, 23 of which is
  // Arcana card art that Phase 1 never renders and that wants downscaling
  // before this is deployed for real.
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
