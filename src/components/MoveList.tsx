import type { MoveResult } from '../types'

interface MoveListProps {
  moves: MoveResult[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function MoveList({ moves, currentIndex, onSelect }: MoveListProps) {
  // Pair moves into rows: [white, black?]
  const rows: Array<{ num: number; white: MoveResult; black?: MoveResult }> = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i]!,
      black: moves[i + 1],
    })
  }

  return (
    <div className="move-list">
      <div className="move-list-header">Moves</div>
      {rows.map(({ num, white, black }, rowIdx) => (
        <div className="move-row" key={num}>
          <span className="move-num">{num}.</span>

          <MoveCell
            move={white}
            index={rowIdx * 2}
            active={currentIndex === rowIdx * 2}
            onSelect={onSelect}
          />

          {black ? (
            <MoveCell
              move={black}
              index={rowIdx * 2 + 1}
              active={currentIndex === rowIdx * 2 + 1}
              onSelect={onSelect}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  )
}

function MoveCell({
  move,
  index,
  active,
  onSelect,
}: {
  move: MoveResult
  index: number
  active: boolean
  onSelect: (i: number) => void
}) {
  return (
    <button
      className={`move-cell ${active ? 'active' : ''}`}
      onClick={() => onSelect(index)}
    >
      <span className="move-dot" data-label={move.label} />
      {move.playedMove}
    </button>
  )
}
