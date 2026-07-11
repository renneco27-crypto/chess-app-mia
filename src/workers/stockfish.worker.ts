// ---------------------------------------------------------------------------
// Stockfish Web Worker — runs the engine in a separate thread so it never
// blocks the UI.
//
// MANUAL STEP REQUIRED before this works:
// ----------------------------------------
// 1. Download Stockfish 16 WASM from the official release:
//    https://github.com/official-stockfish/Stockfish/releases
//    — get the "sf16-nnue.wasm" + "sf16-nnue.js" pair (or the -lite variant
//      for faster load on mobile).
//
// 2. Place BOTH files in /public/stockfish/:
//      public/
//        stockfish/
//          stockfish.js      ← the JS loader
//          stockfish.wasm    ← the WASM binary
//
// 3. The engine wrapper in src/engine/stockfishEngine.ts points to
//    '/stockfish/stockfish.js' — update that path if you rename the files.
//
// WHY a public/ file and not an npm package?
//   The WASM binary (~40 MB for full NNUE, ~6 MB for lite) can't go through
//   Vite's module bundler — it must be served as a static asset so the
//   browser can stream it with SharedArrayBuffer/COOP/COEP headers.
//   The JS shim just does: importScripts('/stockfish/stockfish.js')
//   and Stockfish takes over from there.
// ---------------------------------------------------------------------------

// This worker file is thin — it just bootstraps the WASM engine.
// All UCI protocol handling lives in src/engine/stockfishEngine.ts.

declare function importScripts(...urls: string[]): void

importScripts('/stockfish/stockfish.js')

// Stockfish's JS loader installs its own onmessage handler.
// No extra setup needed — stockfishEngine.ts talks to this worker via
// postMessage/onmessage exactly as with any UCI stdin/stdout.
