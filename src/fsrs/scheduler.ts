// ---------------------------------------------------------------------------
// ts-fsrs owns the actual scheduling math (stability/difficulty curves) —
// do not reimplement that. This module only owns: (1) the move-card schema,
// (2) mapping our domain concepts ("she got it right/wrong, first try or
// after a hint") onto ts-fsrs's 4-point Rating enum correctly, and (3) the
// due-today query. Getting the Rating mapping backwards is the classic bug
// here — "Again" and "Easy" are opposite ends, not a spectrum you can guess at.
// ---------------------------------------------------------------------------

import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import type { Card, RecordLog } from 'ts-fsrs'
import type { FsrsCardData } from '../types'

export type StoredCard = Card & FsrsCardData

const params = generatorParameters({ enable_fuzz: true })
const scheduler = fsrs(params)

export function newMoveCard(data: FsrsCardData): StoredCard {
  return { ...createEmptyCard(), ...data }
}

/**
 * Domain-level outcomes → ts-fsrs Rating. This is the one mapping every
 * caller must go through instead of touching `Rating.*` directly, so the
 * meaning stays consistent everywhere it's used (drills, passive credit, etc).
 *
 *   correctFirstTry   → Easy   (she knew it cold)
 *   correctWithThink   → Good   (got there, took a moment — the normal case)
 *   correctAfterHint   → Hard   (needed a nudge, still recalled it)
 *   incorrect          → Again  (didn't know it, must resurface soon)
 */
export type ReviewOutcome = 'correctFirstTry' | 'correctWithThink' | 'correctAfterHint' | 'incorrect'

const OUTCOME_TO_RATING: Record<ReviewOutcome, Rating> = {
  correctFirstTry: Rating.Easy,
  correctWithThink: Rating.Good,
  correctAfterHint: Rating.Hard,
  incorrect: Rating.Again,
}

export function reviewCard(card: StoredCard, outcome: ReviewOutcome, now = new Date()): StoredCard {
  const rating = OUTCOME_TO_RATING[outcome]
  const recordLog: RecordLog = scheduler.repeat(card, now)
  const updated = recordLog[rating as keyof RecordLog].card
  return { ...updated, id: card.id, fen: card.fen, correctMove: card.correctMove, sourceGameId: card.sourceGameId }
}

/** Cards due at or before `now`, sorted most-overdue first. New (never
 *  reviewed) cards are always included — ts-fsrs sets their `due` to the
 *  creation time, so they'd otherwise be starved by long-overdue old cards. */
export function buildDailyQueue(allCards: StoredCard[], now = new Date(), limit = 30): StoredCard[] {
  return allCards
    .filter((c) => c.due <= now || c.state === State.New)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, limit)
}

/** Passive credit (Phase 4 spec): a correct book move played in a *real*
 *  Lichess game counts as a review without her opening the drill UI. Feed
 *  this straight into `reviewCard` with 'correctWithThink' — real-game
 *  recall under time pressure is treated as the "normal recall" tier, not
 *  the free "Easy" tier, since it wasn't a flashcard-style isolated recall. */
export function creditFromRealGame(card: StoredCard, now = new Date()): StoredCard {
  return reviewCard(card, 'correctWithThink', now)
}
