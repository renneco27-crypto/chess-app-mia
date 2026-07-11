// ---------------------------------------------------------------------------
// Stockfish engine wrapper.
//
// THE THING THAT CANNOT BE WRONG: Stockfish is a single-threaded UCI process.
// If you fire `evaluate()` twice concurrently without queuing, the second
// `position` command lands while the first search is still running and both
// results get corrupted silently (you'll get plausible-looking but wrong
// evals — the worst kind of bug). Every call goes through a single queue.
//
// Only ONE instance of this class should ever exist for the app's lifetime.
// Never spin up a new Worker per move.
// ---------------------------------------------------------------------------

import type { EngineLine, EngineResult } from '../types'

type PendingJob = {
  fen: string
  depth: number
  multiPV: number
  resolve: (result: EngineResult) => void
  reject: (err: Error) => void
}

export class StockfishEngine {
  private worker: Worker
  private ready = false
  private queue: PendingJob[] = []
  private busy = false
  private currentJob: PendingJob | null = null
  private linesByMultiPv = new Map<number, EngineLine>()
  private currentDepthSeen = 0
  private lastConfiguredMultiPV = 1

  constructor(wasmUrl = '/stockfish.js') {
    this.worker = new Worker(wasmUrl)
    this.worker.onmessage = (e: MessageEvent<string>) => this.onMessage(e.data)
    this.worker.postMessage('uci')
  }

  /** Resolves once Stockfish has confirmed `uciok` + `readyok`. */
  private handshake(): Promise<void> {
    return new Promise((resolve) => {
      const onMsg = (e: MessageEvent<string>) => {
        if (e.data === 'readyok') {
          this.worker.removeEventListener('message', onMsg)
          this.ready = true
          resolve()
        }
      }
      this.worker.addEventListener('message', onMsg)
      this.worker.postMessage('isready')
    })
  }

  async init(): Promise<void> {
    if (!this.ready) await this.handshake()
  }

  /**
   * Evaluate a FEN. Returns `multiPV` lines, sorted best-first, all scores
   * normalized to the perspective of the side to move in `fen`.
   */
  evaluate(fen: string, depth = 18, multiPV = 1): Promise<EngineResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, multiPV, resolve, reject })
      this.pump()
    })
  }

  private pump() {
    if (this.busy || this.queue.length === 0) return
    this.busy = true
    const job = this.queue.shift()!
    this.currentJob = job
    this.linesByMultiPv.clear()
    this.currentDepthSeen = 0

    if (job.multiPV !== this.lastConfiguredMultiPV) {
      this.worker.postMessage(`setoption name MultiPV value ${job.multiPV}`)
      this.lastConfiguredMultiPV = job.multiPV
    }
    this.worker.postMessage('ucinewgame')
    this.worker.postMessage(`position fen ${job.fen}`)
    this.worker.postMessage(`go depth ${job.depth}`)
  }

  private onMessage(data: string) {
    if (!this.currentJob) return // handshake traffic, ignore here

    if (data.startsWith('info') && data.includes('multipv')) {
      this.parseInfoLine(data)
      return
    }

    if (data.startsWith('bestmove')) {
      const job = this.currentJob
      const parts = data.split(' ')
      const bestMove = parts[1]!

      const lines = Array.from(this.linesByMultiPv.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, line]) => line)

      if (lines.length === 0) {
        lines.push({ move: bestMove, cp: 0, mateIn: null })
      }

      job.resolve({ lines, bestMove, depth: job.depth })

      this.currentJob = null
      this.busy = false
      this.pump()
    }
  }

  private parseInfoLine(data: string) {
    const multipvMatch = data.match(/multipv (\d+)/)
    const depthMatch = data.match(/depth (\d+)/)
    const pvMatch = data.match(/ pv (\S+)/)
    if (!multipvMatch || !pvMatch) return

    const multipv = parseInt(multipvMatch[1]!, 10)
    const depth = depthMatch ? parseInt(depthMatch[1]!, 10) : 0
    const move = pvMatch[1]!

    // Stockfish streams increasing depths; only trust the latest depth per
    // multipv slot so a partial shallow line doesn't clobber a deeper one
    // that already arrived (can happen with out-of-order info spam).
    const existing = this.linesByMultiPv.get(multipv)
    if (existing && depth < this.currentDepthSeen) return
    this.currentDepthSeen = Math.max(this.currentDepthSeen, depth)

    const mateMatch = data.match(/score mate (-?\d+)/)
    const cpMatch = data.match(/score cp (-?\d+)/)

    let cp: number | null = null
    let mateIn: number | null = null
    if (mateMatch) {
      mateIn = parseInt(mateMatch[1]!, 10)
    } else if (cpMatch) {
      cp = parseInt(cpMatch[1]!, 10)
    } else {
      return
    }

    this.linesByMultiPv.set(multipv, { move, cp, mateIn })
  }

  terminate() {
    this.worker.terminate()
  }
}

/** Module-level singleton. Import this everywhere instead of `new StockfishEngine()`. */
let singleton: StockfishEngine | null = null
export function getEngine(): StockfishEngine {
  if (!singleton) singleton = new StockfishEngine()
  return singleton
}
