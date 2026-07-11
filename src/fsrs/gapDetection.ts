// ---------------------------------------------------------------------------
// Cross-references her known repertoire (FSRS cards) against what players at
// her Elo actually face, using the Lichess opening explorer's aggregate
// database. A "gap" is a position that's common at her level but she has no
// card for — i.e. a move she'll likely face soon with no prepared answer.
// ---------------------------------------------------------------------------

import type { StoredCard } from './scheduler'

const EXPLORER_BASE = 'https://explorer.lichess.ovh/lichess'

export interface ExplorerMove {
  uci: string
  san: string
  white: number
  draws: number
  black: number
}

export interface ExplorerResponse {
  moves: ExplorerMove[]
  white: number
  draws: number
  black: number
}

/** Elo brackets the explorer API accepts, e.g. [1400, 1600]. Pass her rating
 *  ± ~100 so the stats reflect what she'll actually face, not grandmaster prep. */
export async function fetchExplorerStats(fen: string, ratingBand: [number, number]): Promise<ExplorerResponse> {
  const params = new URLSearchParams({
    variant: 'standard',
    fen,
    ratings: ratingBand.join(','),
    speeds: 'blitz,rapid',
  })
  const res = await fetch(`${EXPLORER_BASE}?${params}`)
  if (!res.ok) throw new Error(`Lichess explorer request failed: ${res.status}`)
  return res.json()
}

export interface RepertoireGap {
  fen: string
  missingMove: string // SAN
  frequencyShare: number // 0-1, share of games at her level that reach this move
}

const MIN_FREQUENCY_SHARE = 0.05 // ignore rare sidelines, not worth a card
const MIN_SAMPLE_SIZE = 50 // ignore statistically noisy positions

/**
 * For a single position she reaches in her repertoire, find any opponent
 * replies that are common at her level and NOT covered by an existing card.
 * Call this walking down her repertoire tree, one FEN at a time — this
 * function does not recurse on its own, since branching factor makes an
 * unbounded recursive explorer walk expensive fast.
 */
export function findGapsAtPosition(
  fen: string,
  explorerStats: ExplorerResponse,
  existingCards: StoredCard[]
): RepertoireGap[] {
  const totalGames = explorerStats.white + explorerStats.draws + explorerStats.black
  if (totalGames < MIN_SAMPLE_SIZE) return []

  const coveredMoves = new Set(existingCards.filter((c) => c.fen === fen).map((c) => c.correctMove))

  const gaps: RepertoireGap[] = []
  for (const move of explorerStats.moves) {
    const gamesForMove = move.white + move.draws + move.black
    const share = gamesForMove / totalGames
    if (share < MIN_FREQUENCY_SHARE) continue
    if (coveredMoves.has(move.san)) continue
    gaps.push({ fen, missingMove: move.san, frequencyShare: share })
  }

  return gaps.sort((a, b) => b.frequencyShare - a.frequencyShare)
}
