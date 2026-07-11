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

  constructor(wasmUrl = '/stockfish/stockfish.js') {
    this.worker = new Worker(wasmUrl)
    this.worker.onmessage = (e: MessageEvent<string>) => this.onMessage(e.data)
    this.worker.onerror = (e) => this.onError(e)
    this.worker.postMessage('uci')
  }

  private onError(e: ErrorEvent) {
    console.error('Stockfish worker error:', e.message)
    if (this.currentJob) {
      this.currentJob.reject(new Error(`Stockfish worker error: ${e.message}`))
      this.currentJob = null
      this.busy = false
      this.pump()
    }
  }

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

  evaluate(fen: string, depth = 18, multiPV = 1, timeoutMs = 25000): Promise<EngineResult> {
    return new Promise<EngineResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.currentJob?.fen === fen && this.currentJob?.depth === depth) {
          this.currentJob = null
          this.busy = false
          this.pump()
        } else {
          const idx = this.queue.findIndex(j => j.fen === fen && j.depth === depth)
          if (idx >= 0) this.queue.splice(idx, 1)
        }
        reject(new Error(`Stockfish evaluate timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const wrappedReject = (err: Error) => {
        clearTimeout(timer)
        reject(err)
      }

      this.queue.push({ fen, depth, multiPV, resolve, reject: wrappedReject })
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
    if (!this.currentJob) return

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

let singleton: StockfishEngine | null = null
export function getEngine(): StockfishEngine {
  if (!singleton) singleton = new StockfishEngine()
  return singleton
}
