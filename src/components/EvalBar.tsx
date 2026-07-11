interface EvalBarProps {
  cp: number
  thinking?: boolean
}

function formatEval(cp: number): string {
  if (Math.abs(cp) > 800) return cp > 0 ? '+M' : '-M'
  const pawns = cp / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
}

function cpToPercent(cp: number): number {
  const clamped = Math.max(-800, Math.min(800, cp))
  return 50 + (clamped / 800) * 50
}

export function EvalBar({ cp, thinking = false }: EvalBarProps) {
  const whitePct = cpToPercent(cp)

  return (
    <div className="eval-bar-vert">
      <div className="eval-bar-track" title={`Eval: ${formatEval(cp)}`}>
        <div className="eval-bar-white" style={{ height: `${whitePct}%` }} />
        <div className="eval-bar-line" style={{ top: `${whitePct}%` }} />
      </div>
      <div className="eval-bar-number">
        {formatEval(cp)}
      </div>
    </div>
  )
}
