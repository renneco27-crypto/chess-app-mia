# Chess Coach App — Skeleton

This is the "cannot be wrong" layer: the pieces where a subtle bug silently
corrupts every downstream feature (wrong evals, wrong FSRS ratings, wrong
OAuth flow). Everything here is self-contained TypeScript with no UI —
wire it up to Chessground/React as you build each phase.

## What's here

| File | What it does | Why it's the risky part |
|---|---|---|
| `src/types.ts` | Shared interfaces | Single source of truth so modules don't drift |
| `src/engine/stockfishEngine.ts` | Worker wrapper, serialized command queue, MultiPV parsing | Concurrent calls to one Stockfish worker silently corrupt results if not queued |
| `src/engine/classifyMove.ts` | Centipawn-loss classification, mate handling, only-move, brilliancy confirmation | Perspective-negation bug (before vs. after eval) inverts blunders and brilliancies |
| `src/engine/analyzeMove.ts` | Full pipeline: chess.js + engine → `MoveResult` | Glue point where piece/square/UCI conversion bugs hide |
| `src/coach/templates.ts` | Template strings + safe `${var}` interpolation | Exhaustive `Record<MoveLabel, string>` so a new label can't ship without text |
| `src/lichess/client.ts` | OAuth2 PKCE flow + ndjson game stream | PKCE verifier/challenge mixups fail with an opaque 400; streaming must handle partial lines |
| `src/fsrs/scheduler.ts` | ts-fsrs card schema + Rating mapping + due-queue | Reversing the Easy/Again rating mapping silently breaks scheduling |
| `src/fsrs/gapDetection.ts` | Repertoire vs. Lichess explorer stats | Sample-size and frequency-threshold guards, or you get cards for one-off games |

## What's intentionally NOT here (the easy part — yours)

- Chessground board rendering + move input UI
- React pages/routing/state management
- IndexedDB (Dexie) schema wiring — `MoveResult`/`StoredCard` are ready to store as-is
- Maia opponent integration
- Momentum chart / analytics dashboard visuals
- Claude API call for plain-language explanations (Phase 6) — `MoveResult.coachText`
  already gives you label + numbers to hand to the prompt; the API call itself
  is a straightforward fetch, not a correctness-critical piece
- PWA manifest / service worker

## One decision to make before wiring UI

`analyzeMoveLive` (depth 15, no brilliancy check) vs. `analyzeMoveForReview`
(depth 19, brilliancy check gated on captures) are already split by phase.
Use the live one in Phase 5's vs-computer mode; use the review one for
Phase 3 game import and Phase 6's review page.
