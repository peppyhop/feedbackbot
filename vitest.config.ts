// Unit test config — runs .test.ts in node, independent of the Vite
// Cloudflare plugin that drives the app build. Crypto tests use
// WebCrypto via node:crypto's webcrypto global (Node >=19).

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test-helpers/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.alchemy/**',
    ],
  },
  resolve: {
    alias: {
      '#': '/src',
    },
  },
})
