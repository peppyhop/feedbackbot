// Widget-only Vite build. Run via `pnpm build:widget`.
// Emits a single self-contained IIFE bundle to public/widget.js so
// the snippet `<script src="https://usefeedbackbot.com/widget.js" defer>`
// works in any classic script context. html2canvas is dynamic-imported
// from a public CDN at screenshot time — keeps the main bundle small
// and dodges the cross-origin module-import CORS dance entirely.

import { defineConfig } from 'vite'

// Public Turnstile site key — baked into the bundle. Same value
// the worker reads at runtime via `env.CF_TURNSTILE_WIDGET_ID`
// (the CF API addresses the widget by its site key, so site-key
// and widget-id are literally the same string). One env var, two
// contexts — avoids a duplicated-secret-that-can-drift trap.
// Empty string → Turnstile OFF (graceful mode: widget submits
// without a token, server bypasses the gate when
// TURNSTILE_SECRET is also unset).
const TURNSTILE_SITEKEY = process.env.CF_TURNSTILE_WIDGET_ID ?? ''

// API base — baked into the bundle so widget.js doesn't have to
// derive it at runtime. Earlier we tried reading
// document.currentScript.src in the IIFE; turned out to be brittle
// on heavy host pages where currentScript is null by the time our
// code runs through the rollup wrapper. Falls back to prod canonical
// URL — preview deploys override via the workflow env.
const API_BASE =
  process.env.VITE_FB_API_BASE ?? 'https://usefeedbackbot.com'

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
  define: {
    // Bare identifier (NOT wrapped in quotes in source) so Vite's
    // define-substitution actually fires. The wrapped-in-quotes
    // form fails silently — see DECISIONS.md 2026-04-29.
    __FB_TURNSTILE_SITEKEY__: JSON.stringify(TURNSTILE_SITEKEY),
    __FB_API_BASE__: JSON.stringify(API_BASE),
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
})
