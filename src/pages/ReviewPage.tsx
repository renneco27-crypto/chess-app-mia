// ---------------------------------------------------------------------------
// ReviewPage — Phase 3 & 6.
//
// Shows a fully analysed game: board replayer, move list with quality dots,
// per-move coach text, and accuracy summary chips.
//
// Data flow:
//   Lichess ndjson stream  →  parse PGN  →  analyzeMoveForReview()  →  MoveResult[]
//   MoveResult[]           →  this page
//
// TODO (your part):
//   - Wire Lichess OAuth (client.ts is ready) — show login prompt if no token
//   - Fetch game list from Lichess and let her pick one
//   - Run analyzeMoveForReview() in a background loop with progress indicator
//   - Add momentum/eval chart (Phase 6) — MoveResult.evalAfter is the y-axis
//   - Wire real MoveResult[] from Dexie (schema.ts, Phase 3)
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import { ChessBoard, type ChessBoardHandle } from '../components/ChessBoard'
import { CoachBanner } from '../components/CoachBanner'
import { MoveList } from '../components/MoveList'
import type { MoveResult, MoveLabel } from '../types'

const LABEL_COLORS: Record<MoveLabel, string> = {
  brilliant: 'var(--c-brilliant)',
  best: 'var(--c-best)',
  excellent: 'var(--c-excellent)',
  good: 'var(--c-good)',
  inaccuracy: 'var(--c-inaccuracy)',
  mistake: 'var(--c-mistake)',
  blunder: 'var(--c-blunder)',
  only_move_found: 'var(--c-only-move)',
  only_move_missed: 'var(--c-blunder)',
  forced_mate_for: 'var(--c-brilliant)',
  forced_mate_against: 'var(--c-blunder)',
}

interface ReviewPageProps {
  // Pass in a completed MoveResult[] from the analysis pipeline.
  // Will be undefined/empty until a game is loaded & analysed.
  moves?: MoveResult[]
}

export function ReviewPage({ moves = [] }: ReviewPageProps) {
  const boardRef = useRef<ChessBoardHandle>(null)
  const [currentIndex, setCurrentIndex] = useState(-1)

  const currentMove = moves[currentIndex] ?? null

  // Rebuild the FEN up to `currentIndex` by replaying moves
  const fenAtIndex = (() => {
    const chess = new Chess()
    for (let i = 0; i <= currentIndex && i < moves.length; i++) {
      try { chess.move(moves[i]!.playedMove) } catch { break }
    }
    return chess.fen()
  })()

  const boardConfig: Config = {
    fen: fenAtIndex,
    movable: { free: false, color: undefined }, // read-only in review
    viewOnly: true,
    lastMove: currentMove ? [currentMove.fromSquare as import('@lichess-org/chessground/types').Key, currentMove.toSquare as import('@lichess-org/chessground/types').Key] : undefined,
    highlight: { lastMove: true },
  }

  // Count by label for the accuracy chips
  const counts = moves.reduce<Partial<Record<MoveLabel, number>>>((acc, m) => {
    acc[m.label] = (acc[m.label] ?? 0) + 1
    return acc
  }, {})

  const navigate = (delta: -1 | 1) => {
    setCurrentIndex(i => Math.max(-1, Math.min(moves.length - 1, i + delta)))
  }

  if (moves.length === 0) {
    return (
      <div className="review-layout">
        <div className="lichess-connect">
          <h2>No game loaded</h2>
          <p>Connect your Lichess account to import and review your games.</p>
          {/* TODO: wire LichessConnectButton here */}
          <button className="btn btn-primary">Connect Lichess</button>
        </div>
      </div>
    )
  }

  return (
    <div className="review-layout">
      <div className="review-header">
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
          ← Games
        </button>
        <h1>Game Review</h1>
        {/* TODO: show opponent name, date, time control */}
      </div>

      <div className="review-body">
        {/* Left: board + coach */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ChessBoard ref={boardRef} config={boardConfig} />

          <div className="game-controls">
            <button className="ctrl-btn" onClick={() => setCurrentIndex(-1)} title="Start">⏮</button>
            <button className="ctrl-btn" onClick={() => navigate(-1)} title="Previous">◀</button>
            <button className="ctrl-btn" onClick={() => navigate(1)} title="Next">▶</button>
            <button className="ctrl-btn" onClick={() => setCurrentIndex(moves.length - 1)} title="End">⏭</button>
          </div>

          {currentMove && (
            <CoachBanner label={currentMove.label} text={currentMove.coachText} />
          )}
        </div>

        {/* Right: move list + accuracy summary */}
        <div className="review-moves-panel">
          <div className="accuracy-chips">
            {(Object.entries(counts) as [MoveLabel, number][]).map(([label, count]) => (
              <span key={label} className="accuracy-chip">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LABEL_COLORS[label], display: 'inline-block' }} />
                {count} {label.replace('_', ' ')}
              </span>
            ))}
          </div>

          <MoveList
            moves={moves}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </div>
      </div>
    </div>
  )
}
