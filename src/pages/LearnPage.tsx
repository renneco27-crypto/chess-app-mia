// ---------------------------------------------------------------------------
// LearnPage — matches the Chess Mastery screenshot layout exactly:
//   Left:   module sidebar (Dashboard / Learn / Tactics / Strategy /
//           Openings / Endgames / Master Games) + Log In button
//   Center: chessboard with FEN header, move list footer, and
//           Takeback / Hint / Analysis Engine / Auto-play controls
//   Right:  Current Lesson panel, action buttons, engine eval chip,
//           Recommended Courses cards, Daily Puzzle, Player Stats
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import type { Config } from '@lichess-org/chessground/config'
import { ChessBoard } from '../components/ChessBoard'

// ── Left sidebar nav items ──────────────────────────────────────────────────

const SIDEBAR_NAV = [
  { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { id: 'learn',     icon: '◈', label: 'Learn',      active: true },
  { id: 'tactics',   icon: '⚔', label: 'Tactics' },
  { id: 'strategy',  icon: '◎', label: 'Strategy' },
  { id: 'openings',  icon: '◇', label: 'Openings' },
  { id: 'endgames',  icon: '⚑', label: 'Endgames' },
  { id: 'master',    icon: '♛', label: 'Master Games' },
]

// ── Demo lesson data ────────────────────────────────────────────────────────

const DEMO_LESSON = {
  title: "Mastering the Queen's Gambit",
  fen:   'r1bqk2r/pp1n1pbp/2p1np2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQkq - 2 7',
  fenLabel: 'r1bgk2r/pp1n1pbp/2p1np1/3p4·c6',
  moveCounter: 'KNkq · 2',
  description:
    "The Queen's Gambit is a popular opening that gives White early centre control. Evaluate, analyse a Merowin's Gambit, the d14 cross Opening evaluate. The popular opening with bval quality should escalate 3. c6 and easy.",
  engineEval: '+0.41',
  currentMove: '3. Nf3',
  movesPlayed: '1. d4 Nf6  2. c4 e5  3. Nf3  d5  4. Ni  c6 …',
  notationFull: '1. d4 Nf6 2. c4 e5 3. Nf3 d5 4. Nc3 e2. 3N3 c6 Nt3k2r\npp1n1pbp/2p1np1/3p44/ZPPP4/2N1PWE2  PPQ2PPP R1B1KIB',
}

const RECOMMENDED_COURSES = [
  { id: 'opening', title: 'Opening Principles', sub: 'Opening Principles & popular opening travia intro appears…', color: '#e68a3a' },
  { id: 'endgame', title: 'Endgame Tactics',    sub: 'Endgame Tactic.8 Endgame Tactics',                          color: '#5c8ee6' },
]

// ── Component ───────────────────────────────────────────────────────────────

type LearnSection = 'dashboard' | 'learn' | 'tactics' | 'strategy' | 'openings' | 'endgames' | 'master'

export function LearnPage() {
  const boardRef     = useRef(null)
  const [section, setSection]         = useState<LearnSection>('learn')
  const [analysisOn, setAnalysisOn]   = useState(true)
  const [autoPlay,   setAutoPlay]     = useState(false)
  const [showSol,    setShowSol]      = useState(false)

  const boardConfig: Config = {
    fen:      DEMO_LESSON.fen,
    viewOnly: true,
    highlight: { lastMove: true },
    coordinates: true,
    animation: { enabled: true, duration: 200 },
  }

  return (
    <div className="learn-shell">

      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside className="learn-sidebar">
        <div className="learn-sidebar-nav">
          {SIDEBAR_NAV.map(item => (
            <button
              key={item.id}
              className={`learn-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id as LearnSection)}
            >
              <span className="learn-nav-icon">{item.icon}</span>
              <span className="learn-nav-label">{item.label}</span>
            </button>
          ))}
        </div>
        <button className="learn-login-btn">Log In</button>
        <div className="learn-sidebar-footer">
          <button className="learn-icon-btn" title="Help">?</button>
          <button className="learn-icon-btn" title="Settings">⚙</button>
        </div>
      </aside>

      {/* ── Center: board + controls ─────────────────────────────────── */}
      <main className="learn-board-col">

        {/* FEN / position header */}
        <div className="learn-fen-bar">
          <span className="learn-fen-text">{DEMO_LESSON.fenLabel}</span>
          <span className="learn-fen-counter">{DEMO_LESSON.moveCounter}</span>
        </div>

        {/* Board */}
        <div className="learn-board-wrap">
          <ChessBoard ref={boardRef} config={boardConfig} />
        </div>

        {/* Move notation strip */}
        <div className="learn-moves-strip">
          {DEMO_LESSON.movesPlayed}
        </div>

        {/* Board controls row */}
        <div className="learn-controls-row">
          <button className="learn-ctrl-btn">
            <span>↩</span> Takeback
          </button>
          <button className="learn-ctrl-btn">
            <span>💡</span> Hint
          </button>

          <div className="learn-ctrl-toggle">
            <span>◈ Analysis Engine</span>
            <button
              className={`learn-toggle ${analysisOn ? 'on' : ''}`}
              onClick={() => setAnalysisOn(v => !v)}
              aria-label="Toggle analysis engine"
            >
              <span className="learn-toggle-knob" />
            </button>
          </div>

          <div className="learn-ctrl-toggle">
            <span>▶ Auto-play</span>
            <button
              className={`learn-toggle ${autoPlay ? 'on' : ''}`}
              onClick={() => setAutoPlay(v => !v)}
              aria-label="Toggle auto-play"
            >
              <span className="learn-toggle-knob" />
            </button>
          </div>
        </div>

        {/* Notation textarea */}
        <div className="learn-notation-box">
          <div className="learn-notation-label">Notation</div>
          <div className="learn-notation-actions">
            <span>⇄ NRT</span>
            <span>⊕ Fmt·▾ p≀y</span>
          </div>
          <div className="learn-notation-text">
            {DEMO_LESSON.notationFull}
          </div>
        </div>

      </main>

      {/* ── Right panel ──────────────────────────────────────────────── */}
      <aside className="learn-right-panel">

        {/* Current Lesson */}
        <section className="learn-lesson-card">
          <div className="learn-lesson-eyebrow">Current Lesson:</div>
          <div className="learn-lesson-header">
            <h2 className="learn-lesson-title">{DEMO_LESSON.title}</h2>
            <button className="learn-start-btn">Start Learning</button>
          </div>
          <p className="learn-lesson-desc">{DEMO_LESSON.description}</p>
          <div className="learn-lesson-cue">Evaluate 3. Nf3 c6.</div>

          {/* Action buttons */}
          <div className="learn-action-grid">
            <button
              className={`learn-action-btn outline ${showSol ? 'active' : ''}`}
              onClick={() => setShowSol(v => !v)}
            >
              View Solution
            </button>
            <button className="learn-action-btn primary">Next Puzzle</button>
            <button className="learn-action-btn outline">Next Puzzle</button>
            <button className="learn-action-btn outline">Practice Position</button>
          </div>

          {/* Engine eval chip */}
          <button className="learn-eval-chip">
            Engine Evaluation (<span style={{ color: 'var(--c-excellent)' }}>
              +{DEMO_LESSON.engineEval}
            </span>)
          </button>
        </section>

        {/* Recommended Courses */}
        <section className="learn-section-block">
          <div className="learn-section-heading">Recommended Courses</div>
          <div className="learn-courses-row">
            {RECOMMENDED_COURSES.map(c => (
              <button key={c.id} className="learn-course-card">
                <div className="learn-course-thumb" style={{ background: c.color }}>
                  {c.id === 'opening' ? '♟' : '♜'}
                </div>
                <div>
                  <div className="learn-course-title">{c.title}</div>
                  <div className="learn-course-sub">{c.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bottom row: Daily Puzzle + Player Stats */}
        <div className="learn-bottom-row">

          <section className="learn-section-block learn-daily-puzzle">
            <div className="learn-section-heading">Daily Puzzle</div>
            <div className="learn-puzzle-thumb">
              {/* placeholder for puzzle miniboard */}
              <span style={{ fontSize: '2rem' }}>♞</span>
            </div>
          </section>

          <section className="learn-section-block learn-player-stats">
            <div className="learn-section-heading">Player Stats</div>
            <div className="learn-stats-row">
              <div className="learn-stat">
                <div className="learn-stat-value">1850</div>
                <div className="learn-stat-label">Rating</div>
              </div>
              <div className="learn-stat">
                <div className="learn-stat-value">2120</div>
                <div className="learn-stat-label">Puzzles</div>
              </div>
              <div className="learn-stat-diamond">◆</div>
            </div>
          </section>

        </div>
      </aside>
    </div>
  )
}
