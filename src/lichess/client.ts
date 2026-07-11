// ---------------------------------------------------------------------------
// Lichess API client — covers everything this app needs across all phases.
//
// NO MANUAL SETUP for the API itself — it's a public HTTPS API.
// The only manual step is registering your app for OAuth (Phase 3):
//   https://lichess.org/account/oauth/app  → create an app, get a client_id
//   Set your redirect URI to http://localhost:5173/oauth/callback
//   Paste the client_id into src/lichess/config.ts (create that file yourself)
//
// This file covers:
//   Auth     — OAuth2 PKCE (no client secret, safe for SPAs)
//   Games    — stream game history as ndjson, one game object at a time
//   Explorer — opening stats at any Elo range (for gap detection in Phase 4)
//   Puzzles  — fetch puzzles by theme from the Lichess puzzle DB
//   User     — fetch profile / rating history
// ---------------------------------------------------------------------------

// ─── Auth ──────────────────────────────────────────────────────────────────

const LICHESS = 'https://lichess.org'
const VERIFIER_KEY = 'lc_pkce_verifier'

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const arr = new Uint8Array(64)
  crypto.getRandomValues(arr)
  return b64url(arr.buffer)
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(digest)
}

export interface LichessAuthConfig {
  clientId: string
  redirectUri: string
}

/**
 * Phase 3 — Step 1. Build the Lichess OAuth URL and store the PKCE verifier.
 * Call this when the user clicks "Connect Lichess", then redirect to the URL.
 *
 * Scopes we request:
 *   preference:read  — read username, rating
 *   (no write scopes needed — we only read games and opening explorer)
 */
export async function buildAuthUrl(cfg: LichessAuthConfig): Promise<string> {
  const verifier = randomVerifier()
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: await pkceChallenge(verifier),
    scope: 'preference:read',
  })
  return `${LICHESS}/oauth?${params}`
}

/**
 * Phase 3 — Step 2. Exchange the auth code for a token.
 * Call this in the /oauth/callback route after Lichess redirects back.
 */
export async function exchangeCode(
  code: string,
  cfg: LichessAuthConfig
): Promise<{ token: string; expiresIn: number }> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('PKCE verifier missing — user may have refreshed during OAuth')
  sessionStorage.removeItem(VERIFIER_KEY)

  const res = await fetch(`${LICHESS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return { token: json.access_token, expiresIn: json.expires_in }
}

/** Revoke the token (logout). */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`${LICHESS}/api/token`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ─── User ──────────────────────────────────────────────────────────────────

export interface LichessUser {
  id: string
  username: string
  perfs: Record<string, { rating: number; games: number }>
}

export async function getMe(token: string): Promise<LichessUser> {
  const res = await fetch(`${LICHESS}/api/account`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`getMe failed: ${res.status}`)
  return res.json()
}

// ─── Games ─────────────────────────────────────────────────────────────────

export interface LichessGame {
  id: string
  rated: boolean
  variant: { key: string }
  speed: string           // "blitz" | "rapid" | "classical" | "bullet" | "correspondence"
  perf: string
  createdAt: number       // Unix ms
  lastMoveAt: number
  status: string
  players: {
    white: { user?: { name: string; id: string }; rating?: number }
    black: { user?: { name: string; id: string }; rating?: number }
  }
  winner?: 'white' | 'black'
  pgn: string             // only present when pgnInJson=true
  moves?: string          // space-separated SAN moves
}

export interface StreamGamesOptions {
  /** Maximum number of games to return. Default: 20, max: 200 per request. */
  max?: number
  /** Only games after this Unix timestamp (ms). Use for incremental sync. */
  since?: number
  /** Only games before this Unix timestamp (ms). */
  until?: number
  /** Filter by speed. */
  perfType?: 'bullet' | 'blitz' | 'rapid' | 'classical'
  /** Include full PGN in each game object. */
  pgnInJson?: boolean
  /** Include move list as a "moves" field. */
  moves?: boolean
}

/**
 * Phase 3 — Stream a user's game history as ndjson.
 *
 * Games arrive one at a time as the response streams — `onGame` is called
 * for each game as soon as it lands, not after the whole response finishes.
 * For a user with thousands of games, this keeps the UI responsive and lets
 * you start analysis before the import is complete.
 *
 * @param username  Lichess username (not case-sensitive)
 * @param token     OAuth access token (can be null for public game history)
 * @param onGame    Called once per game, in chronological order
 * @param options   Filters / pagination
 */
export async function streamGames(
  username: string,
  token: string | null,
  onGame: (game: LichessGame) => void,
  options: StreamGamesOptions = {}
): Promise<void> {
  const params = new URLSearchParams()
  if (options.max)        params.set('max',      String(options.max))
  if (options.since)      params.set('since',    String(options.since))
  if (options.until)      params.set('until',    String(options.until))
  if (options.perfType)   params.set('perfType', options.perfType)
  params.set('pgnInJson', String(options.pgnInJson ?? true))
  params.set('moves',     String(options.moves   ?? true))
  params.set('clocks',    'false')   // we don't need clock data
  params.set('evals',     'false')   // we run our own evals via Stockfish

  const headers: Record<string, string> = { Accept: 'application/x-ndjson' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${LICHESS}/api/games/user/${username}?${params}`, { headers })
  if (!res.ok) throw new Error(`streamGames failed: ${res.status}`)
  if (!res.body) throw new Error('streamGames: no response body')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // ndjson: one JSON object per line. A chunk can end mid-line, so only
    // consume complete lines and keep the tail in the buffer.
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer     = buffer.slice(nl + 1)
      if (line) onGame(JSON.parse(line) as LichessGame)
    }
  }
  if (buffer.trim()) onGame(JSON.parse(buffer.trim()) as LichessGame)
}

// ─── Opening Explorer ──────────────────────────────────────────────────────

export interface ExplorerMove {
  uci: string
  san: string
  white: number    // wins for white
  draws: number
  black: number    // wins for black
  averageRating?: number
}

export interface ExplorerResult {
  white: number
  draws: number
  black: number
  moves: ExplorerMove[]
  // topGames / recentGames omitted — we don't use them
}

/**
 * Phase 4 — Fetch opening stats for a position at a given Elo range.
 * Used by gapDetection.ts to find moves common at her level that aren't
 * in her repertoire yet.
 *
 * @param fen         Position to query
 * @param ratingRange Elo bracket, e.g. [1400, 1600]
 * @param speeds      Time controls to include (default: blitz + rapid)
 */
export async function getExplorerStats(
  fen: string,
  ratingRange: [number, number] = [1400, 1600],
  speeds: string[] = ['blitz', 'rapid']
): Promise<ExplorerResult> {
  const params = new URLSearchParams({
    variant: 'standard',
    fen,
    ratings:  ratingRange.join(','),
    speeds:   speeds.join(','),
    topGames: '0',
    recentGames: '0',
  })
  const res = await fetch(`https://explorer.lichess.ovh/lichess?${params}`)
  if (!res.ok) throw new Error(`Explorer request failed: ${res.status}`)
  return res.json()
}

// ─── Puzzles ───────────────────────────────────────────────────────────────

export interface LichessPuzzle {
  puzzle: {
    id: string
    rating: number
    themes: string[]
    solution: string[]   // UCI moves
    initialPly: number
  }
  game: {
    pgn: string
    id: string
  }
}

/**
 * Phase 5 — Fetch a single puzzle by ID.
 * Use the Lichess puzzle CSV (downloadable from https://database.lichess.org/#puzzles)
 * to build your own filtered puzzle list, then call this to get the full data.
 */
export async function getPuzzle(puzzleId: string): Promise<LichessPuzzle> {
  const res = await fetch(`${LICHESS}/api/puzzle/${puzzleId}`)
  if (!res.ok) throw new Error(`getPuzzle failed: ${res.status}`)
  return res.json()
}

/**
 * Phase 5 — Fetch the puzzle of the day (useful as a daily hook in the UI).
 */
export async function getDailyPuzzle(): Promise<LichessPuzzle> {
  const res = await fetch(`${LICHESS}/api/puzzle/daily`)
  if (!res.ok) throw new Error(`getDailyPuzzle failed: ${res.status}`)
  return res.json()
}

// ─── Cloud eval (optional fast-path) ───────────────────────────────────────

export interface CloudEval {
  fen: string
  knodes: number
  depth: number
  pvs: Array<{ moves: string; cp?: number; mate?: number }>
}

/**
 * Lichess pre-computes Stockfish evals for millions of positions at depth 20+.
 * If a position hits the cloud cache, this is instant and saves a local
 * Stockfish search — use as a fast-path before falling back to local analysis.
 *
 * Returns null on a cache miss (HTTP 404).
 */
export async function getCloudEval(fen: string, multiPv = 1): Promise<CloudEval | null> {
  const params = new URLSearchParams({ fen, multiPv: String(multiPv) })
  const res = await fetch(`${LICHESS}/api/cloud-eval?${params}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`cloudEval failed: ${res.status}`)
  return res.json()
}
