interface PlayerClockProps {
  timeMs: number
  active: boolean
}

function fmt(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PlayerClock({ timeMs, active }: PlayerClockProps) {
  const urgent = timeMs > 0 && timeMs < 60000
  const expired = timeMs <= 0
  const [min, sec] = fmt(timeMs).split(':')

  return (
    <div className={`rclock ${active ? 'rclock-running' : ''} ${urgent ? 'rclock-urgent' : ''} ${expired ? 'rclock-expired' : ''}`}>
      <div className="rclock-time">
        <span className="rclock-digits">{min}</span>
        <span className="rclock-sep">:</span>
        <span className="rclock-digits">{sec}</span>
      </div>
    </div>
  )
}
