interface EvalBarProps {
  /** Centipawns from White's perspective. Positive = White better. */
  cp: number
  /** True if the engine is still thinking */
  thinking?: boolean
}

/** Clamp cp to ±800 for display purposes; beyond that the bar is already maxed. */
function cpToPercent(cp: number): number {
  const clamped = Math.max(-800, Math.min(800, cp))
  return 50 + (clamped / 800) * 50
}

function formatEval(cp: number): string {
  if (Math.abs(cp) > 800) return cp > 0 ? '+M' : '-M'
  const pawns = cp / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}

export function EvalBar({ cp, thinking = false }: EvalBarProps) {
  const whitePct = cpToPercent(cp)

  return (
    <div>
      <div className="eval-bar-wrap" title={`Eval: ${formatEval(cp)}`}>
        <div
          className="eval-bar-fill"
          style={{ width: `${whitePct}%`, opacity: thinking ? 0.5 : 1 }}
        />
      </div>
      <div className="eval-label">
        <span>⬛ {formatEval(-cp)}</span>
        <span>{formatEval(cp)} ⬜</span>
      </div>
    </div>
  )
}
