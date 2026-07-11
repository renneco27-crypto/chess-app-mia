import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ---------------------------------------------------------------------------
// IMPORTANT: Stockfish 16 WASM uses SharedArrayBuffer for multi-threading.
// SharedArrayBuffer requires Cross-Origin Isolation, which means the server
// MUST send these two headers on EVERY response:
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp
//
// Vite's dev server sets them here via the `headers` option.
// For production (Vercel / Netlify / your own server), you must also set
// them in your hosting config — see docs/deployment.md (to be created).
//
// If you use the *single-threaded* Stockfish WASM variant (sf16-lite-single),
// you can remove these headers — but analysis will be ~4× slower.
// ---------------------------------------------------------------------------

export default defineConfig({
  plugins: [react()],

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Prevent Vite from trying to bundle the Stockfish WASM/JS —
  // it must be served statically from public/stockfish/
  assetsInclude: ['**/*.wasm'],

  build: {
    target: 'es2022', // needed for top-level await in some chess libs
  },
})
