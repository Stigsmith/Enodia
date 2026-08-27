import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One config for both. Vitest reads `test`, Vite ignores it.
export default defineConfig({
  plugins: [react()],
  build: {
    // dist/ used to hold the hand-authored placeholder page. That page now
    // lives in placeholder/ and dist/ is build output, ignored by git.
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
