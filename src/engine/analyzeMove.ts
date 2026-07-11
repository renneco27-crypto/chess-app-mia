// ---------------------------------------------------------------------------
// The single entry point every phase (3, 5, 6) calls: given a position and
// the move played, return a fully classified, fully worded MoveResult.
// ---------------------------------------------------------------------------

import { Chess } from 'chess.js'
import { getEngine } from './stockfishEngine'
import { classifyMove, confirmBrilliantSacrifice } from './classifyMove'
import { renderTemplate } from '../coach/templates'
import type { MoveResult } from '../types'

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

const LIVE_DEPTH = 15 // Phase 5, must stay under ~200ms
const REVIEW_DEPTH = 19 // Phase 3/6 post-game analysis
const BRILLIANT_SHALLOW_DEPTH = 8

export interface AnalyzeOptions {
  depth?: number
  /** Set true only for post-game review (Phase 3/6) — runs the extra
   *  shallow/deep pair needed to confirm sacrifices. Skip for live play. */
  detectBrilliancies?: boolean
}

export async function analyzeMove(
  fenBefore: string,
  playedMoveSan: string,
  options: AnalyzeOptions = {}
): Promise<MoveResult> {
  const depth = options.depth ?? REVIEW_DEPTH
  const engine = getEngine()
  await engine.init()

  // chess.js is the single source of truth for legality, piece identity,
  // and SAN<->UCI conversion — never hand-parse squares out of a UCI string.
  const chess = new Chess(fenBefore)
  const moveObj = chess.move(playedMoveSan) // throws if illegal — let it throw, don't swallow
  if (!moveObj) {
    throw new Error(`Illegal move "${playedMoveSan}" in position ${fenBefore}`)
  }
  const fenAfter = chess.fen()
  const playedMoveUci = moveObj.from + moveObj.to + (moveObj.promotion ?? '')

  const before = await engine.evaluate(fenBefore, depth, 3)
  const afterRaw = await engine.evaluate(fenAfter, depth, 1)

  const classified = classifyMove({
    topBefore: before.lines[0]!,
    secondBefore: before.lines[1] ?? null,
    afterRaw: afterRaw.lines[0]!,
    playedMove: playedMoveUci,
  })

  let label = classified.label
  if (
    options.detectBrilliancies &&
    (label === 'brilliant' || label === 'best') &&
    (moveObj.captured || moveObj.flags.includes('e'))
  ) {
    // Only spend the extra two searches when material actually moved —
    // this is the expensive path, gate it hard.
    const [shallow, deep] = await Promise.all([
      engine.evaluate(fenAfter, BRILLIANT_SHALLOW_DEPTH, 1),
      engine.evaluate(fenAfter, REVIEW_DEPTH, 1),
    ])
    const confirmed = confirmBrilliantSacrifice(shallow.lines[0]!, deep.lines[0]!)
    label = confirmed ? 'brilliant' : label === 'best' ? 'best' : 'excellent'
  }

  const pieceMoved = PIECE_NAMES[moveObj.piece] ?? moveObj.piece
  const lostPiece = moveObj.captured ? PIECE_NAMES[moveObj.captured] ?? moveObj.captured : ''

  const coachText = renderTemplate(label, {
    piece: pieceMoved,
    fromSquare: moveObj.from,
    toSquare: moveObj.to,
    refutation: afterRaw.bestMove,
    bestMove: before.bestMove,
    playedMove: playedMoveSan,
    lostPiece,
  })

  return {
    fen: fenBefore,
    playedMove: playedMoveUci,
    label,
    evalBefore: classified.evalBefore,
    evalAfter: classified.evalAfter,
    delta: classified.delta,
    bestMove: before.bestMove,
    refutation: afterRaw.bestMove,
    pieceMoved,
    fromSquare: moveObj.from,
    toSquare: moveObj.to,
    isCapture: Boolean(moveObj.captured),
    coachText,
  }
}

/** Live-play convenience wrapper (Phase 5) — shallower depth, no brilliancy pass. */
export function analyzeMoveLive(fenBefore: string, playedMoveSan: string) {
  return analyzeMove(fenBefore, playedMoveSan, { depth: LIVE_DEPTH, detectBrilliancies: false })
}

/** Post-game review wrapper (Phase 3/6) — full depth + brilliancy detection. */
export function analyzeMoveForReview(fenBefore: string, playedMoveSan: string) {
  return analyzeMove(fenBefore, playedMoveSan, { depth: REVIEW_DEPTH, detectBrilliancies: true })
}
