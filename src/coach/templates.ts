import type { MoveLabel } from '../types'

export interface TemplateVars {
  piece?: string
  fromSquare?: string
  toSquare?: string
  refutation?: string
  bestMove?: string
  playedMove?: string
  lostPiece?: string
}

// One entry per MoveLabel so this is exhaustively checked by the compiler —
// if a new label is ever added to types.ts and forgotten here, TS errors
// instead of silently rendering "undefined".
const TEMPLATES: Record<MoveLabel, string> = {
  blunder:
    'Oh no! Your ${piece} on ${fromSquare} moving to ${toSquare} drops material. ' +
    'Your opponent can now play ${refutation}, winning a ${lostPiece}. ' +
    'The correct move was ${bestMove}.',
  mistake:
    'This move gives your opponent the advantage. After ${refutation}, ' +
    'the position is clearly worse for you. You should have played ${bestMove} instead.',
  inaccuracy: '${bestMove} was more precise and kept the position balanced.',
  good: 'A reasonable move, though ${bestMove} was a touch more accurate.',
  excellent: 'Excellent — a tiny slip at most. ${bestMove} was the engine\'s exact top choice.',
  only_move_found:
    'Excellent find! ${playedMove} was the only move to stay in the game. ' +
    'Any other move would have been devastating.',
  only_move_missed:
    'This loses the thread. ${bestMove} was the only way to keep things balanced. ' +
    'Now your opponent has a decisive advantage.',
  brilliant:
    'Brilliant! ${playedMove} looks like a sacrifice, but after deep calculation ' +
    'it keeps — or even improves — your position.',
  best: 'Best move! ${playedMove} was exactly what the engine recommends.',
  forced_mate_for: '${playedMove} forces mate! Your opponent cannot escape.',
  forced_mate_against:
    'This allows a forced mate. ${bestMove} was necessary to stay in the game.',
}

/** Safe ${var} substitution — no eval, no Function() constructor. Missing
 *  variables render as an empty string rather than throwing, so a template
 *  never crashes the review page over a missing optional field. */
export function renderTemplate(label: MoveLabel, vars: TemplateVars): string {
  const template = TEMPLATES[label]
  return template.replace(/\$\{(\w+)\}/g, (_, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key]
    return value ?? ''
  })
}
