# What's Left To Build

---

## ✅ Done (skeleton + wiring)

### Engine layer
- `stockfishEngine.ts` — serialized UCI queue, MultiPV parsing, mate handling
- `classifyMove.ts` — centipawn delta, perspective negation, only-move, brilliancy confirmation
- `analyzeMove.ts` — full pipeline: chess.js + Stockfish → MoveResult
- `maiaEngine.ts` — UCI bridge client (talks to maia-bridge/server.py)
- `maia-bridge/server.py` — Python UCI bridge, lazy model pool, CORS

### Chess coach layer (no AI — pure Stockfish math + templates)
- `coach/templates.ts` — all move label templates (Blunder / Mistake / Inaccuracy / Good / Excellent / Best / Brilliant / Only Move / Forced Mate), safe `${}` interpolation, exhaustive `Record<MoveLabel, string>` so missing labels are TS errors
- `classifyMove.ts` — the classification itself: centipawn drop → label, `only-move` gap detection, `confirmBrilliantSacrifice()` two-depth check
- `analyzeMove.ts` — `analyzeMoveLive()` (depth 15, no brilliancy pass) and `analyzeMoveForReview()` (depth 19 + brilliancy) already split by use case
- `components/CoachBanner.tsx` — colored badge + template text, one component used in both PlayPage and ReviewPage

### Data layer
- `types.ts` — MoveResult, MoveLabel, FsrsCardData, EngineLine
- `lichess/client.ts` — OAuth2 PKCE, streamGames, getExplorerStats, getPuzzle, getCloudEval
- `fsrs/scheduler.ts` — ts-fsrs card schema, ReviewOutcome → Rating mapping, buildDailyQueue, creditFromRealGame
- `fsrs/gapDetection.ts` — repertoire vs. Lichess explorer gap detection

### UI shell
- `styles/global.css` — full design system (dark palette, amber accent, all component classes, LearnPage layout)
- `index.html` — fonts, viewport, root div
- `main.tsx` — Chessground CSS import order, React mount
- `vite.config.ts` — COOP/COEP headers for SharedArrayBuffer
- `App.tsx` — top-level page router (Learn is the default page)
- `components/Nav.tsx` — top nav bar (Learn / Play / Review / Drill)
- `components/ChessBoard.tsx` — Chessground React wrapper with ref/imperative API
- `components/EvalBar.tsx` — centipawn bar
- `components/MoveList.tsx` — move notation with quality dots, click to jump
- `pages/LearnPage.tsx` — three-column layout: left module sidebar, center board + controls, right lesson/stats panel
- `pages/PlayPage.tsx` — vs-Maia game skeleton (board + move handler + coach banner + sidebar)
- `pages/ReviewPage.tsx` — game replayer skeleton (board + move list + accuracy chips + coach banner)
- `pages/DrillPage.tsx` — FSRS drill queue skeleton (board + Again/Hard/Good/Easy rating buttons)

---

## ❌ Not Done — your tasks

### Phase 1 — Foundation
- [ ] Run `npm install` to pull chess.js, ts-fsrs, dexie, chessground, react
- [ ] Copy Stockfish WASM files to `public/stockfish/` (see `docs/manual-installs.md`)
- [ ] Confirm board renders in browser and engine eval arrives in console

### Phase 2 — Board + engine layer
- [ ] **EvalBar wired to live Stockfish** — call `engine.evaluate()` after every move, feed cp into `<EvalBar>`
- [ ] **Best-move arrow** — after Stockfish returns bestMove, call `cgApi.setShapes([{ orig, dest, brush: 'yellow' }])`
- [ ] **Game-end detection** — check `chess.isGameOver()` after every move; show result banner (checkmate / stalemate / resignation)
- [ ] **Player clock** — countdown timer component, wired into PlayPage
- [ ] **Game mode selector** — Maia 5M / 23M / 79M; pass model string to `getMaiaMove()`
- [ ] **Color choice** — let player pick white or black before the game starts

### Phase 3 — Lichess data pipeline
- [ ] **`src/lichess/config.ts`** — create with your OAuth client_id (register at lichess.org/account/oauth/app)
- [ ] **OAuth callback route** — `/oauth/callback` page that calls `exchangeCode()`, stores token in localStorage
- [ ] **Token persistence** — restore token from localStorage on app load; show "Connect Lichess" if missing
- [ ] **Game list UI** — list imported games (date, opponent, result, time control); click to open in ReviewPage
- [ ] **Import progress** — `streamGames()` is ready; show a progress bar as games arrive one by one
- [ ] **PGN → MoveResult pipeline** — for each game: parse PGN with chess.js, call `analyzeMoveForReview()` per move, store MoveResult[] in IndexedDB via Dexie
- [ ] **Dexie schema** — `db.games` and `db.moveResults` tables; MoveResult and LichessGame types are both ready to store as-is
- [ ] **Incremental sync** — store `lastSyncedAt` timestamp, pass as `since` to `streamGames()` on re-sync so you don't reimport everything

### Phase 4 — FSRS spaced repetition
- [ ] **Dexie schema for cards** — `db.cards` table using the `StoredCard` type from `fsrs/scheduler.ts`
- [ ] **Card creation from mistakes** — after game analysis, call `newMoveCard()` for every position labelled mistake or blunder; store in Dexie
- [ ] **Daily queue loader** — call `buildDailyQueue(allCards)` on DrillPage mount, inject into `<DrillPage queue={...} />`
- [ ] **Card persistence after rating** — in `onCardReviewed`, write the updated `StoredCard` back to Dexie
- [ ] **Due-date preview** — show "Again: 10min / Hard: 1d / Good: 3d / Easy: 7d" under the four rating buttons
- [ ] **Gap detection** — wire `findGapsAtPosition()` + `getExplorerStats()` to surface common moves she has no card for
- [ ] **Passive credit** — after each game import, call `creditFromRealGame()` for any correct book moves played

### Phase 5 — Training modules (all UI, none built yet)
- [ ] **Opening repertoire trainer** — board + move tree; she builds White/Black repertoire move by move
- [ ] **Middlegame positions** — curated FEN list from model games, timed challenge mode
- [ ] **Endgame ladder** — K+P → Rook endgames → B+N mate, progression unlock UI
- [ ] **Puzzle browser** — download Lichess puzzle CSV (database.lichess.org/#puzzles), filter by theme, render queue
- [ ] **Coordinate trainer** — flash square name ("f6") → she clicks the correct square; score + timer

### Phase 6 — Chess coach + game review (no AI)
The coach is 100% Stockfish math + pre-written templates — `coach/templates.ts` and `classifyMove.ts` are already done. What's left is wiring them into the UI:

- [ ] **Momentum / eval chart** — line chart of `MoveResult.evalAfter` across all moves (recharts); click a point to jump to that move in the board replayer
- [ ] **Live mistake alerts in PlayPage** — `analyzeMoveLive()` already runs after each move and returns a `MoveResult`; add a flash animation on the `<CoachBanner>` and auto-dismiss after 4 seconds for good/excellent, keep it pinned for mistake/blunder
- [ ] **"What should I have played?" button** — on demand: show the best-move arrow (`cgApi.setShapes`) + the engine lines panel with the top 3 Stockfish moves
- [ ] **Game review page** — `ReviewPage.tsx` skeleton is done; wire it to a real `MoveResult[]` from Dexie, render the eval chart above the move list, show `coachText` in the banner as she steps through moves

### Phase 7 — Insights + polish
- [ ] **Analytics dashboard** — opening win-rate by ECO code, tactical theme heatmap (which blunder types recur), endgame accuracy over time
- [ ] **PWA manifest** — `public/manifest.json` + `src/workers/sw.ts` service worker; Stockfish WASM must be pre-cached for offline use
- [ ] **Onboarding flow** — rating input + time control preference → auto-generates starter FSRS cards from common openings at her Elo
- [ ] **Mobile layout** — board stacks above sidebar below 768px; CSS breakpoints are already in global.css, pages need responsive testing

---

## File map — what's in each file

| File | Phase | Status |
|---|---|---|
| `src/types.ts` | All | ✅ done |
| `src/engine/stockfishEngine.ts` | 1,2,6 | ✅ done |
| `src/engine/classifyMove.ts` | 6 | ✅ done |
| `src/engine/analyzeMove.ts` | 3,5,6 | ✅ done |
| `src/engine/maiaEngine.ts` | 2 | ✅ done |
| `src/coach/templates.ts` | 6 | ✅ done |
| `src/lichess/client.ts` | 3,4,5 | ✅ done |
| `src/fsrs/scheduler.ts` | 4 | ✅ done |
| `src/fsrs/gapDetection.ts` | 4 | ✅ done |
| `maia-bridge/server.py` | 2 | ✅ done |
| `src/styles/global.css` | All | ✅ done |
| `src/components/ChessBoard.tsx` | All | ✅ done |
| `src/components/EvalBar.tsx` | 2,6 | ✅ done |
| `src/components/CoachBanner.tsx` | 5,6 | ✅ done |
| `src/components/MoveList.tsx` | 3,6 | ✅ done |
| `src/pages/LearnPage.tsx` | 5 | ✅ done (UI shell) |
| `src/pages/PlayPage.tsx` | 2,5 | ✅ skeleton — needs eval bar wiring, clock, end detection |
| `src/pages/ReviewPage.tsx` | 3,6 | ✅ skeleton — needs real MoveResult[] from Dexie + eval chart |
| `src/pages/DrillPage.tsx` | 4 | ✅ skeleton — needs Dexie queue + card persistence |
| `src/lichess/config.ts` | 3 | ❌ you create this with your client_id |
| `src/db/schema.ts` | 3,4 | ❌ Dexie schema (games, moveResults, cards tables) |
| `src/pages/OAuthCallback.tsx` | 3 | ❌ handles the redirect from Lichess |
| `src/pages/AnalyticsPage.tsx` | 7 | ❌ insights dashboard |
| `src/workers/sw.ts` | 7 | ❌ PWA service worker |
| `public/manifest.json` | 7 | ❌ PWA manifest |
