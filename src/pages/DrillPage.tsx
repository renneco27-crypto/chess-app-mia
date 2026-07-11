// ---------------------------------------------------------------------------
// DrillPage — Phase 4 FSRS spaced repetition UI.
//
// Shows a position and asks her to find the right move. After she plays (or
// reveals the answer), she rates her recall → ts-fsrs schedules the next due date.
//
// TODO (your part):
//   - Load StoredCard[] from IndexedDB (Dexie) via buildDailyQueue()
//   - Persist updated cards back to Dexie after each rating
//   - Show the "due tomorrow" preview dates under each rating button
//   - Add a "Queue empty" state with a nice completion screen
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import type { Config } from '@lichess-org/chessground/config'
import { ChessBoard } from '../components/ChessBoard'
import { reviewCard, type ReviewOutcome, type StoredCard } from '../fsrs/scheduler'

interface DrillPageProps {
  // Inject the daily queue from your Dexie store (Phase 4)
  queue?: StoredCard[]
  onCardReviewed?: (updated: StoredCard) => void
}

type DrillPhase = 'attempt' | 'reveal'

const RATING_BUTTONS: { outcome: ReviewOutcome; label: string; sublabel: string }[] = [
  { outcome: 'incorrect',        label: 'Again',  sublabel: 'Didn\'t know it' },
  { outcome: 'correctAfterHint', label: 'Hard',   sublabel: 'Needed a hint' },
  { outcome: 'correctWithThink', label: 'Good',   sublabel: 'Got it' },
  { outcome: 'correctFirstTry',  label: 'Easy',   sublabel: 'Knew it cold' },
]

export function DrillPage({ queue = [], onCardReviewed }: DrillPageProps) {
  const [cardIndex, setCardIndex] = useState(0)
  const [phase, setPhase] = useState<DrillPhase>('attempt')
  const boardRef = useRef(null)

  const card = queue[cardIndex]

  if (!card) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div style={{ fontSize: '2rem' }}>✓</div>
        <h2 style={{ fontWeight: 700 }}>Queue complete</h2>
        <p style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>Come back tomorrow for your next batch.</p>
      </div>
    )
  }

  const boardConfig: Config = {
    fen: card.fen,
    viewOnly: phase === 'reveal',
    movable: {
      free: false,
      color: 'white', // TODO: derive from FEN whose turn it is
      // TODO: on move, check if it matches card.correctMove
      // If yes → setPhase('reveal') with correctFirstTry or correctWithThink
      // If no  → flash red, stay in 'attempt'
    },
    highlight: { lastMove: true },
  }

  const handleRate = (outcome: ReviewOutcome) => {
    const updated = reviewCard(card, outcome)
    onCardReviewed?.(updated)
    setCardIndex(i => i + 1)
    setPhase('attempt')
  }

  return (
    <div style={{ display: 'flex', gap: 32, padding: 32, height: '100%', alignItems: 'flex-start', justifyContent: 'center' }}>
      <ChessBoard ref={boardRef} config={boardConfig} />

      <div className="drill-card">
        <div className="drill-prompt">
          {phase === 'attempt' ? 'Find the best move' : `Best move: ${card.correctMove}`}
        </div>

        {phase === 'attempt' && (
          <button
            className="btn btn-ghost"
            onClick={() => setPhase('reveal')}
          >
            Show answer
          </button>
        )}

        {phase === 'reveal' && (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--c-text-muted)' }}>
              How well did you recall this?
            </p>
            <div className="drill-rating-btns">
              {RATING_BUTTONS.map(({ outcome, label, sublabel }) => (
                <button
                  key={outcome}
                  className="drill-rating-btn"
                  data-rating={label.toLowerCase()}
                  onClick={() => handleRate(outcome)}
                >
                  <div>{label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--c-text-muted)', fontWeight: 400 }}>{sublabel}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
          {cardIndex + 1} / {queue.length} cards today
        </div>
      </div>
    </div>
  )
}
