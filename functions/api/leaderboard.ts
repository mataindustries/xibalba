const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25
const MAX_SCORE = 999_999_999
const MAX_BODY_LENGTH = 2048
const MAX_VERSION_LENGTH = 32

interface D1Result<T = unknown> {
  success: boolean
  results?: T[]
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface Env {
  DB: D1Database
}

type PagesFunction<Environment> = (context: {
  request: Request
  env: Environment
}) => Response | Promise<Response>

type ScoreRow = {
  initials: string
  score: number
  createdAt: number
}

type ScoreSubmission = {
  initials: string
  score: number
  version?: string
}

type ValidationResult =
  | { ok: true; submission: ScoreSubmission }
  | { ok: false; error: string }

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasDatabase(env)) {
    return errorResponse(503, 'Leaderboard database is not configured.')
  }

  try {
    const limit = parseLimit(new URL(request.url).searchParams.get('limit'))
    return jsonResponse({ ok: true, scores: await loadTopScores(env.DB, limit) })
  } catch {
    return errorResponse(500, 'Leaderboard is temporarily unavailable.')
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isSameOriginRequest(request)) {
    return errorResponse(403, 'Cross-origin submissions are not allowed.')
  }
  if (!hasDatabase(env)) {
    return errorResponse(503, 'Leaderboard database is not configured.')
  }

  const body = await readJsonBody(request)
  if (!body.ok) {
    return errorResponse(400, body.error)
  }

  const validation = validateScoreSubmission(body.value)
  if (!validation.ok) {
    return errorResponse(400, validation.error)
  }

  try {
    const { initials, score, version } = validation.submission
    const insert = await env.DB.prepare(
      `INSERT INTO scores (initials, score, created_at, source, version)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(initials, score, Math.floor(Date.now() / 1000), 'pages', version ?? null)
      .run()

    if (!insert.success) {
      throw new Error('D1 insert failed')
    }

    return jsonResponse({ ok: true, scores: await loadTopScores(env.DB, DEFAULT_LIMIT) }, 201)
  } catch {
    return errorResponse(500, 'Score could not be saved.')
  }
}

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Allow: 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  })

export function sanitizeInitials(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const initials = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(initials) ? initials : null
}

export function sanitizeScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_SCORE ? value : null
}

export function validateScoreSubmission(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const candidate = value as Record<string, unknown>
  const initials = sanitizeInitials(candidate.initials)
  if (!initials) {
    return { ok: false, error: 'Initials must contain exactly three letters A-Z.' }
  }

  const score = sanitizeScore(candidate.score)
  if (score === null) {
    return { ok: false, error: `Score must be a positive integer no greater than ${MAX_SCORE}.` }
  }

  const version = sanitizeVersion(candidate.version)
  if (version === null) {
    return { ok: false, error: `Version must use safe characters and be at most ${MAX_VERSION_LENGTH} characters.` }
  }

  return {
    ok: true,
    submission: {
      initials,
      score,
      ...(version ? { version } : {}),
    },
  }
}

export function parseLimit(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) {
    return DEFAULT_LIMIT
  }

  const limit = Number.parseInt(value, 10)
  return limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT
}

function sanitizeVersion(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    return null
  }

  const version = value.trim()
  return version.length > 0 && version.length <= MAX_VERSION_LENGTH && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version) ? version : null
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const contentLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return { ok: false, error: 'Request body is too large.' }
  }

  try {
    const text = await request.text()
    if (!text || text.length > MAX_BODY_LENGTH) {
      return { ok: false, error: text ? 'Request body is too large.' : 'Request body is required.' }
    }
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' }
  }
}

async function loadTopScores(database: D1Database, limit: number): Promise<ScoreRow[]> {
  const result = await database
    .prepare(
      `SELECT initials, score, created_at AS createdAt
       FROM scores
       ORDER BY score DESC, created_at ASC, id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<ScoreRow>()

  if (!result.success) {
    throw new Error('D1 query failed')
  }

  return (result.results ?? []).map((row) => ({
    initials: row.initials,
    score: Number(row.score),
    createdAt: Number(row.createdAt),
  }))
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) {
    return true
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function hasDatabase(env: Env): env is Env & { DB: D1Database } {
  return Boolean(env?.DB && typeof env.DB.prepare === 'function')
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

function errorResponse(status: number, error: string): Response {
  return jsonResponse({ ok: false, error }, status)
}
