// ---------------------------------------------------------------------------
// Chessground React wrapper.
//
// KEY RULE: api.set(config) in the second useEffect runs whenever `config`
// changes reference. If the parent passes a new object on every render
// (even with identical values), this fires every render and resets
// movable.dests — which is exactly what froze the board after one move.
//
// Solution: parents must either:
//   (a) memoize config with useMemo so the reference is stable (PlayPage), OR
//   (b) pass only a truly static object (ReviewPage, DrillPage)
//
// For hot paths like mid-game board updates, parents should skip the config
// prop entirely and call boardRef.current.api.set(...) directly.
// ---------------------------------------------------------------------------

import { useEffect, useRef, forwardRef, useImperativeHandle, memo } from 'react'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'

export type ChessgroundApi = Api

export interface ChessBoardProps {
  config?: Config
  className?: string
}

export interface ChessBoardHandle {
  api: ChessgroundApi | null
}

export const ChessBoard = memo(forwardRef<ChessBoardHandle, ChessBoardProps>(
  function ChessBoard({ config = {}, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef       = useRef<ChessgroundApi | null>(null)

    useImperativeHandle(ref, () => ({ api: apiRef.current }), [])

    // Mount once — Chessground owns this DOM node for its lifetime
    useEffect(() => {
      if (!containerRef.current) return
      const api = Chessground(containerRef.current, config)
      apiRef.current = api
      return () => {
        api.destroy()
        apiRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // empty: intentional, see note above

    // Only propagate config changes when the reference actually changes.
    // PlayPage uses useMemo so this never fires after mount.
    // ViewOnly pages (Review, Drill) pass a new config when the position
    // changes, which is correct — they want a full reset.
    const isFirstRender = useRef(true)
    useEffect(() => {
      if (isFirstRender.current) {
        isFirstRender.current = false
        return // skip: Chessground already received this config at mount
      }
      apiRef.current?.set(config)
    }, [config])

    return <div ref={containerRef} className={`cg-wrap ${className ?? ''}`} />
  }
))
