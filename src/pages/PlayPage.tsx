import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ChessBoard, type ChessBoardHandle } from '../components/ChessBoard'
import { EvalBar } from '../components/EvalBar'
import { CoachBanner } from '../components/CoachBanner'
import { MoveList } from '../components/MoveList'
import { PlayerClock } from '../components/PlayerClock'
import { GameEndResult } from '../components/GameEndResult'
import { getMaiaMove, type MaiaModel } from '../engine/maiaEngine'
import { analyzeMoveLive } from '../engine/analyzeMove'
import type { MoveResult } from '../types'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CLOCK_INITIAL_MS = 600000

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
  const chessRef = useRef(new Chess())

  // Game setup
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [gameStarted, setGameStarted] = useState(false)
  const [maiaModel, setMaiaModel] = useState<MaiaModel>('5m')

  // Board state
  const [moveHistory, setMoveHistory] = useState<MoveResult[]>([])
  const [currentBanner, setCurrentBanner] = useState<MoveResult | null>(null)
  const [evalCp, setEvalCp] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [waiting, setWaiting] = useState(false)
  const [activeTab, setActiveTab] = useState<'moves' | 'engine'>('moves')
  const [gameResult, setGameResult] = useState<string | null>(null)

  // Clocks
  const clockRef = useRef({ white: CLOCK_INITIAL_MS, black: CLOCK_INITIAL_MS })
  const [clockRunning, setClockRunning] = useState<'white' | 'black' | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!clockRunning) return
    const id = setInterval(() => {
      clockRef.current[clockRunning] = Math.max(0, clockRef.current[clockRunning] - 100)
      if (clockRef.current[clockRunning] <= 0) {
        clearInterval(id)
        setClockRunning(null)
        setGameResult(`timeout-${clockRunning}`)
      }
      setTick(t => t + 1)
    }, 100)
    return () => clearInterval(id)
  }, [clockRunning])

  // Maia first move when player is black
  useEffect(() => {
    if (!gameStarted || playerColor !== 'black') return
    maiaFirstMove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted])

  async function maiaFirstMove() {
    const chess = chessRef.current
    const api = boardRef.current?.api
    if (!api) return

    setWaiting(true)
    setClockRunning('black')

    try {
      const maiaResp = await getMaiaMove(chess.fen(), maiaModel)
      chess.move(maiaResp.move)
      api.set({
        fen: chess.fen(),
        turnColor: 'white',
        lastMove: [maiaResp.move.slice(0, 2) as Key, maiaResp.move.slice(2, 4) as Key],
        movable: {
          free: false,
          color: 'white',
          showDests: true,
          dests: getLegalDests(chess),
        },
      })
      setClockRunning('white')
    } catch (err) {
      console.error('Maia first move failed:', err)
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
      setClockRunning('white')
    }

    setWaiting(false)
  }

  // Player move handler
  const onMove = useCallback(async (from: string, to: string) => {
    const chess = chessRef.current
    const api = boardRef.current?.api
    if (!api) return

    const fenBefore = chess.fen()
    let san: string
    try {
      const moveObj = chess.move({ from, to, promotion: 'q' })
      san = moveObj.san
    } catch {
      api.set({ fen: chess.fen(), movable: { dests: getLegalDests(chess) } })
      return
    }

    setWaiting(true)
    setClockRunning(null)
    api.set({ movable: { color: undefined, dests: new Map() } })

    // Run analysis
    setAnalyzing(true)
    let result: MoveResult | null = null
    try {
      result = await analyzeMoveLive(fenBefore, san)
      const r = result
      setEvalCp(r.evalAfter)
      setCurrentBanner(r)
      setMoveHistory(prev => [...prev, r])
      setActiveIndex(prev => prev + 1)

      if (r.bestMove && r.bestMove.length >= 4) {
        api.setShapes([{
          orig: r.bestMove.slice(0, 2) as Key,
          dest: r.bestMove.slice(2, 4) as Key,
          brush: 'yellow',
        }] as DrawShape[])
      }
    } catch (err) {
      console.error('Analysis failed:', err)
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
    }
    setAnalyzing(false)

    const turnColor = chess.turn() === 'w' ? 'white' : 'black'

    // Check game over
    if (chess.isGameOver()) {
      setWaiting(false)
      setClockRunning(null)
      if (chess.isCheckmate()) {
        setGameResult(`checkmate-${turnColor === 'white' ? 'black' : 'white'}`)
      } else if (chess.isStalemate() || chess.isDraw()) {
        setGameResult('draw')
      }
      return
    }

    // Maia's reply
    try {
      const maiaResp = await getMaiaMove(chess.fen(), maiaModel)
      chess.move(maiaResp.move)

      api.set({
        fen: chess.fen(),
        turnColor: playerColor === 'white' ? 'white' : 'black',
        movable: {
          free: false,
          color: playerColor === 'white' ? 'white' : 'black',
          showDests: true,
          dests: getLegalDests(chess),
        },
        lastMove: [maiaResp.move.slice(0, 2) as Key, maiaResp.move.slice(2, 4) as Key],
      })

      const maiaEntry: MoveResult = {
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
      setMoveHistory(prev => [...prev, maiaEntry])
      setActiveIndex(prev => prev + 1)
    } catch (err) {
      console.error('Maia move failed:', err)
      api.set({
        fen: chess.fen(),
        turnColor: playerColor === 'white' ? 'white' : 'black',
        movable: {
          free: false,
          color: playerColor === 'white' ? 'white' : 'black',
          showDests: true,
          dests: getLegalDests(chess),
        },
      })
    }

    // Check game over after Maia's move
    if (chess.isGameOver()) {
      setClockRunning(null)
      if (chess.isCheckmate()) {
        setGameResult(`checkmate-${turnColor === 'white' ? 'black' : 'white'}`)
      } else if (chess.isStalemate() || chess.isDraw()) {
        setGameResult('draw')
      }
    } else {
      setClockRunning(playerColor === 'white' ? 'white' : 'black')
    }

    setWaiting(false)
  }, [playerColor, maiaModel])

  // Initial board config — created once when game starts
  const initialConfig = useMemo(() => ({
    fen: STARTING_FEN,
    orientation: playerColor as 'white' | 'black',
    movable: {
      free: false,
      color: playerColor as 'white' | 'black',
      showDests: true,
      dests: getLegalDests(chessRef.current),
      events: { after: onMove },
    },
    animation: { enabled: true, duration: 200 },
    highlight: { lastMove: true, check: true },
    premovable: { enabled: false },
    coordinates: true,
  }), [playerColor]) // eslint-disable-line react-hooks/exhaustive-deps

  // New game reset
  const resetGame = useCallback(() => {
    chessRef.current.reset()
    setMoveHistory([])
    setCurrentBanner(null)
    setActiveIndex(-1)
    setEvalCp(0)
    setWaiting(false)
    setAnalyzing(false)
    setGameResult(null)
    setClockRunning(null)
    clockRef.current = { white: CLOCK_INITIAL_MS, black: CLOCK_INITIAL_MS }
    setTick(0)
    setGameStarted(false)

    boardRef.current?.api?.setShapes([])
  }, [])

  // Start game with chosen color
  function startGame(color: 'white' | 'black') {
    chessRef.current.reset()
    setPlayerColor(color)
    setMoveHistory([])
    setCurrentBanner(null)
    setActiveIndex(-1)
    setEvalCp(0)
    setWaiting(false)
    setAnalyzing(false)
    setGameResult(null)
    clockRef.current = { white: CLOCK_INITIAL_MS, black: CLOCK_INITIAL_MS }
    setTick(0)
    setGameStarted(true)

    if (color === 'white') {
      setClockRunning('white')
    }
  }

  // Pre-game color picker
  if (!gameStarted) {
    return (
      <div className="play-layout">
        <div className="board-area">
          <div className="color-picker">
            <h2>Choose your color</h2>
            <div className="color-picker-buttons">
              <button className="btn btn-primary" onClick={() => startGame('white')}>
                Play as White
              </button>
              <button className="btn btn-primary" onClick={() => startGame('black')}>
                Play as Black
              </button>
            </div>
            <div className="color-picker-model">
              <span>Maia model:</span>
              {(['5m', '23m', '79m'] as MaiaModel[]).map(m => (
                <button
                  key={m}
                  className={`btn btn-ghost ${maiaModel === m ? 'active' : ''}`}
                  onClick={() => setMaiaModel(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <aside className="sidebar">
          <div className="sidebar-content">
            <p style={{ padding: 16, color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>
              Choose your side above, then the game begins against Maia.
            </p>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="play-layout">
      {gameResult && (
        <GameEndResult result={gameResult} onNewGame={resetGame} />
      )}

      <div className="board-area">

        <div className="clock-row">
          <PlayerClock
            timeMs={clockRef.current.black}
            active={clockRunning === 'black'}
          />
          <PlayerClock
            timeMs={clockRef.current.white}
            active={clockRunning === 'white'}
          />
        </div>

        <div className="board-row">
          <EvalBar cp={evalCp} thinking={analyzing} />

          <div className="board-col">
            <div className="player-strip">
              <div className="player-avatar">M</div>
              <span className="player-name">Maia 1500</span>
              {waiting && (
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                  thinking…
                </span>
              )}
            </div>

            <ChessBoard ref={boardRef} config={initialConfig} />

            <div className="player-strip">
              <div className="player-avatar">You</div>
              <span className="player-name">You</span>
            </div>
          </div>
        </div>

        {currentBanner && (
          <CoachBanner label={currentBanner.label} text={currentBanner.coachText} />
        )}
      </div>

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
              Engine analysis runs live after every move.
            </div>
          </div>
        )}

        <div className="game-controls">
          <div className="model-selector">
            <span className="model-label">Maia</span>
            <div className="model-buttons">
              {(['5m', '23m', '79m'] as MaiaModel[]).map(m => (
                <button
                  key={m}
                  className={`btn btn-ghost btn-sm ${maiaModel === m ? 'active' : ''}`}
                  onClick={() => setMaiaModel(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={resetGame} disabled={waiting}>
            New Game
          </button>
        </div>
      </aside>
    </div>
  )
}
