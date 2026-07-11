interface PlayerClockProps {
  timeMs: number
  label: string
  active: boolean
}

function fmt(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PlayerClock({ timeMs, label, active }: PlayerClockProps) {
  const urgent = timeMs > 0 && timeMs < 60000
  const expired = timeMs <= 0

  return (
    <div className={`player-clock ${active ? 'clock-active' : ''} ${urgent ? 'clock-urgent' : ''} ${expired ? 'clock-expired' : ''}`}>
      <span className="clock-label">{label}</span>
      <span className="clock-time">{fmt(timeMs)}</span>
    </div>
  )
}
