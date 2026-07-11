// ---------------------------------------------------------------------------
// Shared types. Every module below depends on these — keep them stable.
// ---------------------------------------------------------------------------

export type MoveLabel =
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'only_move_found'
  | 'only_move_missed'
  | 'forced_mate_for'
  | 'forced_mate_against'

/** One line out of a MultiPV Stockfish search, already normalized to the
 *  perspective of the side who was to move in the position searched. */
export interface EngineLine {
  move: string // UCI, e.g. "e2e4"
  cp: number | null // centipawns, null if mateIn is set
  mateIn: number | null // positive = side to move mates in N, negative = gets mated in N
}

export interface EngineResult {
  lines: EngineLine[] // sorted best-first, length = requested multiPV
  bestMove: string
  depth: number
}

export interface MoveResult {
  fen: string // position BEFORE the move
  playedMove: string // UCI, e.g. "e2e4"
  label: MoveLabel
  evalBefore: number // centipawns, mover's perspective (mate scores pre-clamped, see classifyMove)
  evalAfter: number // centipawns, mover's perspective
  delta: number // centipawn loss, mover's perspective (can be negative)
  bestMove: string // engine's top choice in the position before the move
  refutation: string // opponent's best reply after the played move
  pieceMoved: string // "Knight", "Bishop", "Pawn", etc.
  fromSquare: string
  toSquare: string
  isCapture: boolean
  coachText: string // rendered template
}

export interface FsrsCardData {
  id: string // stable key, e.g. `${fen}|${bestMove}`
  fen: string
  correctMove: string
  sourceGameId?: string
  // ts-fsrs owns the scheduling fields (due, stability, difficulty, etc.);
  // this is just the payload we attach to a ts-fsrs Card.
}
