// ---------------------------------------------------------------------------
// PlayPage — the board must be driven IMPERATIVELY through boardRef.api
// after every move. Never pass a new config object to <ChessBoard> mid-game —
// Chessground's config prop is for initial setup only. After that, all board
// updates go through api.set(), which is what onMove() does below.
//
// Root cause of the "freezes after one move" bug:
//   The old version passed a config object built inline on every render.
//   ChessBoard's useEffect saw a new config reference and called api.set()
//   which reset movable.dests back to the starting position's legal moves,
//   locking the board.
//
// Fix: initialConfig is memoized with useMemo (never changes), and every
//   subsequent board update is done via boardRef.current.api.set() inside
//   onMove and after Maia's reply.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ChessBoard, type ChessBoardHandle } from '../components/ChessBoard'
import { EvalBar } from '../components/EvalBar'
import { CoachBanner } from '../components/CoachBanner'
import { MoveList } from '../components/MoveList'
import { getMaiaMove } from '../engine/maiaEngine'
import type { MoveResult, MoveLabel } from '../types'
import type { Key } from '@lichess-org/chessground/types'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** chess.js legal moves → Chessground dests Map */
function getLegalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>()
  for (const move of chess.moves({ verbose: true })) {
    const existing = dests.get(move.from as Key) ?? []
    existing.push(move.to as Key)
    dests.set(move.from as Key, existing)
  }
  return dests
}

export function PlayPage() {
  const boardRef = useRef<ChessBoardHandle>(null)

  // chess.js instance lives in a ref — mutated in place, never replaced.
  // Using a ref (not state) means mutations don't trigger re-renders;
  // the board is the source of visual truth, not React state.
  const chessRef = useRef(new Chess())

  const [moveHistory, setMoveHistory]     = useState<MoveResult[]>([])
  const [currentBanner, setCurrentBanner] = useState<MoveResult | null>(null)
  const [evalCp, setEvalCp]               = useState(0)
  const [analyzing, setAnalyzing]         = useState(false)
  const [activeIndex, setActiveIndex]     = useState(-1)
  const [waiting, setWaiting]             = useState(false) // true while Maia is thinking
  const [activeTab, setActiveTab]         = useState<'moves' | 'engine'>('moves')

  // ── Initial board config — created ONCE, never changes ─────────────────
  // This is the only time we pass a config to ChessBoard.
  // Everything after this is done via boardRef.current.api.set().
  const initialConfig = useMemo(() => ({
    fen: STARTING_FEN,
    orientation: 'white' as const,
    movable: {
      free: false,
      color: 'white' as const,
      showDests: true,
      dests: getLegalDests(chessRef.current),
      events: { after: onMove },
    },
    animation: { enabled: true, duration: 200 },
    highlight: { lastMove: true, check: true },
    premovable: { enabled: false },
    coordinates: true,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  // onMove is stable (defined below with useCallback and no deps that change)

  // ── Player move handler ─────────────────────────────────────────────────
  // Chessground calls this after it animates the piece. At this point the
  // move has already been shown visually — we need to:
  //   1. Validate + apply in chess.js
  //   2. Lock the board while Maia thinks
  //   3. Get Maia's reply and update the board imperatively
  //   4. Re-enable movable with the NEW legal dests
  const onMove = useCallback(async (from: string, to: string) => {
    const chess = chessRef.current
    const api   = boardRef.current?.api
    if (!api) return

    // 1. Apply in chess.js (validates legality)
    let san: string
    try {
      const moveObj = chess.move({ from, to, promotion: 'q' })
      san = moveObj.san
    } catch {
      // Illegal move — snap back
      api.set({ fen: chess.fen(), movable: { dests: getLegalDests(chess) } })
      return
    }

    // 2. Lock board while we wait for Maia
    setWaiting(true)
    api.set({ movable: { color: undefined, dests: new Map() } }) // lock

    // 3. (Optional) run live analysis — skip Stockfish for now to isolate bug
    //    Uncomment once the board is confirmed working:
    // try {
    //   const result = await analyzeMoveLive(fenBefore, san)
    //   setMoveHistory(prev => [...prev, result])
    //   setCurrentBanner(result)
    //   setActiveIndex(prev => prev + 1)
    // } catch (err) { console.error('Analysis failed:', err) }

    // Placeholder move result so MoveList shows something without Stockfish
    const placeholder: MoveResult = {
      fen: chess.fen(),
      playedMove: `${from}${to}`,
      label: 'good',
      evalBefore: 0, evalAfter: 0, delta: 0,
      bestMove: '', refutation: '',
      pieceMoved: '', fromSquare: from, toSquare: to,
      isCapture: false,
      coachText: san,
    }
    setMoveHistory(prev => [...prev, placeholder])
    setActiveIndex(prev => prev + 1)

    // 4. Maia's reply
    if (!chess.isGameOver()) {
      try {
        const maiaResp = await getMaiaMove(chess.fen(), '5m')

        // Apply Maia's move in chess.js
        chess.move(maiaResp.move)

        // Update board: new FEN + re-enable player moves with fresh legal dests
        api.set({
          fen: chess.fen(),
          turnColor: 'white',
          movable: {
            free: false,
            color: 'white',
            showDests: true,
            dests: getLegalDests(chess),
          },
          lastMove: [maiaResp.move.slice(0, 2) as Key, maiaResp.move.slice(2, 4) as Key],
        })

        // Maia placeholder entry
        const maiaPlaceholder: MoveResult = {
          fen: chess.fen(),
          playedMove: maiaResp.move,
          label: 'good',
          evalBefore: 0, evalAfter: 0, delta: 0,
          bestMove: '', refutation: '',
          pieceMoved: '', fromSquare: maiaResp.move.slice(0, 2),
          toSquare: maiaResp.move.slice(2, 4),
          isCapture: false,
          coachText: maiaResp.move,
        }
        setMoveHistory(prev => [...prev, maiaPlaceholder])
        setActiveIndex(prev => prev + 1)

      } catch (err) {
        console.error('Maia move failed:', err)
        // Maia bridge not running — still re-enable the board so you can keep playing
        api.set({
          fen: chess.fen(),
          turnColor: 'white',
          movable: {
            free: false,
            color: 'white',
            showDests: true,
            dests: getLegalDests(chess),
          },
        })
      }
    }

    setWaiting(false)
  }, []) // stable — chess ref and board ref never change

  // ── New game reset ──────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    chessRef.current.reset()
    setMoveHistory([])
    setCurrentBanner(null)
    setActiveIndex(-1)
    setEvalCp(0)
    setWaiting(false)

    boardRef.current?.api?.set({
      fen: STARTING_FEN,
      lastMove: undefined,
      check: false,
      turnColor: 'white',
      movable: {
        free: false,
        color: 'white',
        showDests: true,
        dests: getLegalDests(chessRef.current),
      },
    })
  }, [])

  return (
    <div className="play-layout">

      {/* ── Board column ─────────────────────────────────────────── */}
      <div className="board-area">

        <EvalBar cp={evalCp} thinking={analyzing} />

        {/* Opponent (Maia) */}
        <div className="player-strip">
          <div className="player-avatar">M</div>
          <span className="player-name">Maia 1500</span>
          {waiting && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
              thinking…
            </span>
          )}
        </div>

        {/* Board — only receives initialConfig once */}
        <ChessBoard ref={boardRef} config={initialConfig} />

        {/* Player */}
        <div className="player-strip">
          <div className="player-avatar">You</div>
          <span className="player-name">You</span>
        </div>

        {currentBanner && (
          <CoachBanner label={currentBanner.label} text={currentBanner.coachText} />
        )}
      </div>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'moves' ? 'active' : ''}`}
            onClick={() => setActiveTab('moves')}
          >
            Moves
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'engine' ? 'active' : ''}`}
            onClick={() => setActiveTab('engine')}
          >
            Engine
          </button>
        </div>

        {activeTab === 'moves' && (
          <MoveList
            moves={moveHistory}
            currentIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        )}

        {activeTab === 'engine' && (
          <div className="engine-panel">
            <div style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)', padding: '8px 0' }}>
              Engine analysis runs after you connect Stockfish (Phase 2).
            </div>
          </div>
        )}

        <div className="game-controls">
          <button className="btn btn-ghost" onClick={resetGame} disabled={waiting}>
            New Game
          </button>
        </div>
      </aside>
    </div>
  )
}
