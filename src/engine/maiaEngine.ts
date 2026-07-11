// ---------------------------------------------------------------------------
// Maia 3 engine client — UCI bridge.
//
// Maia 3 is built on Chessformer and runs as a standard UCI engine process,
// NOT as an HTTP API. This means we talk to it the same way we talk to
// Stockfish: via stdin/stdout UCI protocol.
//
// IN THE BROWSER this is impossible to do directly (no child_process).
// The bridge is a tiny local server (maia-bridge.py, see docs/manual-installs.md)
// that runs on your machine, spawns the Maia 3 UCI process, and exposes a
// single HTTP endpoint: POST /move  { fen, model } → { move }.
//
// MANUAL SETUP (one time):
//   1. pip install maia3          (installs the UCI engine)
//   2. maia3-cache --model 5m     (downloads the 5M model weights from HuggingFace)
//   3. python maia-bridge/server.py   (starts the local bridge on port 8175)
//   See docs/manual-installs.md for the full bridge server code.
//
// MODEL SIZES:
//   '5m'  — fast, good for CPU, recommended default
//   '23m' — better accuracy
//   '79m' — best accuracy (needs more RAM/GPU)
// ---------------------------------------------------------------------------

export type MaiaModel = '5m' | '23m' | '79m'

// The local bridge server — change the port if 8175 conflicts
const MAIA_BRIDGE_URL = 'http://localhost:8175'

export interface MaiaResponse {
  move: string   // UCI, e.g. "e2e4"
}

/**
 * Ask Maia 3 for a move. Requires the local bridge server to be running.
 * Throws a clear error if the bridge is unreachable so the UI can show
 * "Start the Maia bridge server" instead of a cryptic network error.
 */
export async function getMaiaMove(fen: string, model: MaiaModel = '5m'): Promise<MaiaResponse> {
  let res: Response
  try {
    res = await fetch(`${MAIA_BRIDGE_URL}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, model: `maia3-${model}` }),
    })
  } catch {
    throw new Error(
      `Maia bridge unreachable at ${MAIA_BRIDGE_URL}. ` +
      `Run: python maia-bridge/server.py  (see docs/manual-installs.md)`
    )
  }

  if (!res.ok) {
    throw new Error(`Maia bridge error: ${res.status} ${await res.text()}`)
  }

  return res.json() as Promise<MaiaResponse>
}
