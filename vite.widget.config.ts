// Widget-only Vite build. Run via `pnpm build:widget`.
// Emits a single self-contained IIFE bundle to public/widget.js so
// the snippet `<script src="https://usefeedbackbot.com/widget.js" defer>`
// works in any classic script context. html2canvas is dynamic-imported
// from a public CDN at screenshot time — keeps the main bundle small
// and dodges the cross-origin module-import CORS dance entirely.

import { defineConfig } from 'vite'

export default defineConfig({
  // Disable the default public-dir copy step — outDir IS public/, so
  // the copy would either no-op or chase its own tail. We only want
  // to emit `widget.js` into the existing tree.
  publicDir: false,
  build: {
    // Output goes straight into public/ so TanStack Start serves it
    // as /widget.js with no rewrites.
    outDir: 'public',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/widget/index.ts',
      // IIFE so the snippet `<script src="...widget.js" defer>` runs
      // without `type="module"` (which would break the snippet we've
      // already shipped to every customer). IIFE forces a single
      // self-contained bundle — code-split chunks (screenshot.ts)
      // get inlined automatically. The html2canvas dynamic import
      // is left external because its URL is marked @vite-ignore.
      output: {
        format: 'iife',
        entryFileNames: 'widget.js',
      },
    },
    reportCompressedSize: true,
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
})
