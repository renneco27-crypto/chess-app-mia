# Manual Installation Guide

Run `npm install` first, then follow the steps below for each dependency.

---

## 1. Chessground — `npm install`, nothing else

```bash
npm install @lichess-org/chessground
```

Done. CSS and piece SVGs ship inside the package. `src/main.tsx` imports them.

---

## 2. Stockfish 16 WASM

Stockfish's `.wasm` binary (~6–40 MB) must be served as a static file —
it cannot go through Vite's bundler.

**Steps:**

```bash
# Option A — copy from the npm package (easiest)
npm install stockfish
cp node_modules/stockfish/src/stockfish.js  public/stockfish/stockfish.js
cp node_modules/stockfish/src/stockfish.wasm public/stockfish/stockfish.wasm

# Option B — download the official release directly
# Go to: https://github.com/official-stockfish/Stockfish/releases/latest
# Download stockfish-nnue-16-lite.js + stockfish-nnue-16-lite.wasm
# Place both in public/stockfish/ and rename to stockfish.js + stockfish.wasm
```

Final layout:
```
public/
  stockfish/
    stockfish.js
    stockfish.wasm
```

**SharedArrayBuffer headers** — Stockfish multi-threading requires these
on every response. `vite.config.ts` sets them for dev. For production add
them in your host (Vercel: `vercel.json`, Netlify: `_headers`):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## 3. Maia 3 — Python process + local bridge server

Maia 3 is a UCI engine, not an HTTP API. It runs as a Python process on
your machine. A tiny bridge server (`maia-bridge/server.py`) translates
the browser's fetch calls into UCI stdin/stdout.

### Step 1 — Install Maia 3

```bash
pip install maia3
```

### Step 2 — Download model weights (pick one)

```bash
maia3-cache --model 5m    # 5M params — fast, great on CPU (recommended)
maia3-cache --model 23m   # better accuracy
maia3-cache --model 79m   # best accuracy, needs more RAM
```

Weights download from HuggingFace and cache locally (~100 MB for 5m).
Run this once before opening the app so the first move isn't slow.

### Step 3 — Start the bridge server

In a terminal, from the project root:

```bash
python maia-bridge/server.py --model maia3-5m
# → [bridge] Loading maia3-5m ...
# → [bridge] maia3-5m ready
# → [bridge] Listening on http://127.0.0.1:8175
```

Keep this terminal open while you use the app. The bridge stays alive
and reuses the loaded model — moves arrive in ~100–300ms.

To switch models at runtime, POST with `"model": "maia3-79m"` and the
bridge lazy-loads it the first time that model is requested.

### Step 4 — Start the Vite dev server

```bash
npm run dev
# → http://localhost:5173
```

The bridge and Vite dev server run side by side in separate terminals.

---

## 4. Lichess API — register an OAuth app (Phase 3)

The Lichess API itself is public — no install needed. For OAuth login
(so your sister can connect her Lichess account), register an app:

1. Log into Lichess and go to: https://lichess.org/account/oauth/app
2. Click **New application**
3. Fill in:
   - **Name**: Chess Coach (anything)
   - **Redirect URI**: `http://localhost:5173/oauth/callback`
   - **Scopes**: `preference:read` (that's all we need)
4. Copy the **client_id** that appears
5. Create `src/lichess/config.ts`:

```ts
// src/lichess/config.ts
export const LICHESS_CONFIG = {
  clientId:    'your-client-id-here',
  redirectUri: 'http://localhost:5173/oauth/callback',
}
```

`src/lichess/client.ts` imports from this file — TypeScript will error
if you forget to create it.

For production, update `redirectUri` to your deployed domain.

---

## Startup checklist

```
[ ] npm install
[ ] mkdir -p public/stockfish && copy stockfish.js + stockfish.wasm there
[ ] pip install maia3
[ ] maia3-cache --model 5m
[ ] python maia-bridge/server.py          (terminal 1, keep open)
[ ] npm run dev                            (terminal 2)
[ ] Create src/lichess/config.ts with your OAuth client_id
[ ] Open http://localhost:5173
```
