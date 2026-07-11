interface GameEndResultProps {
  result: string
  onNewGame: () => void
}

const LABELS: Record<string, string> = {
  'checkmate-white': 'Checkmate — White wins!',
  'checkmate-black': 'Checkmate — Black wins!',
  stalemate: 'Stalemate — Draw',
  draw: 'Draw',
  'timeout-white': 'White ran out of time — Black wins!',
  'timeout-black': 'Black ran out of time — White wins!',
}

export function GameEndResult({ result, onNewGame }: GameEndResultProps) {
  return (
    <div className="game-end-overlay">
      <div className="game-end-card">
        <div className="game-end-text">{LABELS[result] ?? result}</div>
        <button className="btn btn-primary" onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  )
}
