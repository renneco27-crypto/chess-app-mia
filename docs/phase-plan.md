# Chess Coach App — Build Plan

## Phase 1 — Foundation (Week 1–2)
Scaffold a Vite + React + TypeScript monorepo. Get Chessground rendering a board,
install chess.js for move validation, spin up a Stockfish 16 WASM Web Worker, and
write a thin Lichess API client. This is your "can I see a board and get an eval?"
milestone.

## Phase 2 — Core board + engine layer (Week 3–4)
Wire Chessground to chess.js so legal moves snap into place. Add a Stockfish
evaluation bar and best-move arrow overlay. Integrate Maia as a selectable
opponent at different Elo tiers (the CSSLab endpoint or a self-hosted model).
Goal: your sister can play a full game vs a human-level bot.

## Phase 3 — Lichess data pipeline (Week 5–6)
Add OAuth2 login so she can connect her Lichess account. Stream her game history
via the ndjson export API, parse PGNs, classify moves (Brilliant / Great / Book /
Blunder / Mistake) using Stockfish, and store results in IndexedDB via Dexie.
This feeds the review engine.

## Phase 4 — FSRS spaced repetition (Week 7–8)
Integrate ts-fsrs and design a move-card schema (position FEN → correct move →
difficulty). Build the daily review queue scheduler, gap detection that
cross-references her repertoire against Lichess explorer stats at her Elo, and
the real-game passive credit system (correct book moves in real games count as
reviews).

## Phase 5 — Training modules (Week 9–11)
Build the five core drills: opening repertoire trainer, middlegame practice
positions pulled from model games, endgame ladder (K+P → Rook endgames → B+N
mate), custom puzzle browser filtered by theme from the Lichess puzzle CSV, and
the coordinate vision trainer (flash "f6" → she clicks).

## Phase 6 — AI coach + game review (Week 12–13)
Add the automated game review page with a momentum chart. Plug in the Claude
API to generate plain-language explanations ("you played Qxf7?? because the
queen looked active, but after Ke8 your queen is trapped — here's what to do
instead"). Add live mistake alerts in the vs-computer module.

## Phase 7 — Insights + polish (Week 14–15)
Build the analytics dashboard (opening performance, tactical blind spot
heatmap, endgame accuracy trends). Add PWA manifest + service worker so
Stockfish WASM works offline. Design a gentle onboarding flow for your sister
with a skill self-assessment and auto-generated starter repertoire.
