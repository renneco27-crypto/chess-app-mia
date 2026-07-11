import type { MoveLabel } from '../types'

interface CoachBannerProps {
  label: MoveLabel
  text: string
}

const LABEL_DISPLAY: Record<MoveLabel, string> = {
  brilliant:          '!! Brilliant',
  best:               '✓ Best',
  excellent:          '! Excellent',
  good:               'Good',
  inaccuracy:         '?! Inaccuracy',
  mistake:            '? Mistake',
  blunder:            '?? Blunder',
  only_move_found:    '⚡ Only Move',
  only_move_missed:   '?? Only Move Missed',
  forced_mate_for:    '# Checkmate!',
  forced_mate_against:'?? Allows Mate',
}

export function CoachBanner({ label, text }: CoachBannerProps) {
  return (
    <div className="coach-banner" data-label={label}>
      <span className="coach-badge">{LABEL_DISPLAY[label]}</span>
      <span className="coach-text">{text}</span>
    </div>
  )
}
