// ---------------------------------------------------------------------------
// Classification math. This is the part that's easy to get subtly wrong:
// Stockfish always scores from the perspective of the side to move. Before
// the move, that's the player; after the move, it's the opponent — so the
// post-move eval must be NEGATED before comparing to the pre-move eval.
// Getting this backwards silently inverts "blunder" and "brilliant".
//
// Mate scores are handled separately from centipawn deltas — you cannot
// average "mate in 3" into a cp number without inventing a scale, and any
// scale you invent is a guess. We short-circuit instead.
// ---------------------------------------------------------------------------

import type { EngineLine, MoveLabel } from '../types'

const ONLY_MOVE_GAP_CP = 350 // per spec: top line beats 2nd line by >= this
const BRILLIANT_SHALLOW_THRESHOLD = -100 // cp, shallow-depth eval must look this bad
const BRILLIANT_DEEP_FLOOR = -50 // cp, deep-depth eval must recover to at least this

export interface ClassifyInput {
  /** Top engine line BEFORE the move, mover's perspective. */
  topBefore: EngineLine
  /** Second-best engine line BEFORE the move, mover's perspective (for only-move detection). */
  secondBefore: EngineLine | null
  /** Engine's single best line AFTER the move, RAW (opponent's perspective, NOT yet negated). */
  afterRaw: EngineLine
  playedMove: string
}

export interface ClassifyOutput {
  label: MoveLabel
  evalBefore: number
  evalAfter: number // mover's perspective, after negation
  delta: number
}

/** Converts an EngineLine to a single comparable cp number, mover's perspective.
 *  Mate-for-mover becomes a very large positive number; mate-against becomes
 *  very large negative. This is ONLY used for ordering/only-move comparisons,
 *  never surfaced to the user as a fake cp value. */
function toComparableCp(line: EngineLine): number {
  if (line.mateIn !== null) {
    return line.mateIn > 0 ? 100000 - line.mateIn : -100000 - line.mateIn
  }
  return line.cp ?? 0
}

/** Negates an EngineLine's perspective (for converting "after" scores,
 *  which come back from the opponent's point of view, into the mover's). */
function negate(line: EngineLine): EngineLine {
  return {
    move: line.move,
    cp: line.cp === null ? null : -line.cp,
    mateIn: line.mateIn === null ? null : -line.mateIn,
  }
}

export function classifyMove(input: ClassifyInput): ClassifyOutput {
  const { topBefore, secondBefore, afterRaw, playedMove } = input
  const after = negate(afterRaw)

  const evalBefore = toComparableCp(topBefore)
  const evalAfter = toComparableCp(after)
  const delta = evalBefore - evalAfter

  const foundBest = playedMove === topBefore.move
  const onlyMove =
    secondBefore !== null && toComparableCp(topBefore) - toComparableCp(secondBefore) >= ONLY_MOVE_GAP_CP

  // Mate short-circuits: if the position after the move is a forced mate
  // against the mover that wasn't there before, that's an unambiguous
  // blunder regardless of cp math (and vice versa).
  if (after.mateIn !== null && after.mateIn < 0) {
    return { label: 'forced_mate_against', evalBefore, evalAfter, delta }
  }
  if (after.mateIn !== null && after.mateIn > 0) {
    return { label: 'forced_mate_for', evalBefore, evalAfter, delta }
  }

  if (foundBest && onlyMove) return { label: 'only_move_found', evalBefore, evalAfter, delta }
  if (!foundBest && onlyMove) return { label: 'only_move_missed', evalBefore, evalAfter, delta }
  if (foundBest) return { label: 'best', evalBefore, evalAfter, delta }

  if (delta < 0) return { label: 'brilliant', evalBefore, evalAfter, delta } // eval improved
  if (delta < 20) return { label: 'excellent', evalBefore, evalAfter, delta }
  if (delta < 50) return { label: 'good', evalBefore, evalAfter, delta }
  if (delta < 100) return { label: 'inaccuracy', evalBefore, evalAfter, delta }
  if (delta < 200) return { label: 'mistake', evalBefore, evalAfter, delta }
  return { label: 'blunder', evalBefore, evalAfter, delta }
}

/**
 * Brilliant-sacrifice confirmation. Only call this when classifyMove already
 * returned 'brilliant' or 'best' AND the move captured/gave up material —
 * running a second deep search on every move defeats the "keep it lightweight"
 * goal, so this is opt-in and caller-gated.
 *
 * shallowLine / deepLine must both be RAW (opponent's perspective) evals of
 * the position AFTER the move, at depth ~8 and ~18+ respectively.
 */
export function confirmBrilliantSacrifice(shallowRaw: EngineLine, deepRaw: EngineLine): boolean {
  const shallow = negate(shallowRaw)
  const deep = negate(deepRaw)
  const shallowCp = toComparableCp(shallow)
  const deepCp = toComparableCp(deep)
  return shallowCp < BRILLIANT_SHALLOW_THRESHOLD && deepCp > BRILLIANT_DEEP_FLOOR
}
