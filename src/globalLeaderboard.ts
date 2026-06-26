export type GlobalScoreEntry = {
  initials: string
  score: number
  createdAt: number
}

const LEADERBOARD_ENDPOINT = '/api/leaderboard'
const DEFAULT_TIMEOUT_MS = 4500
const MAX_SCORE = 999_999_999
const MAX_RESULTS = 25

export async function fetchGlobalScores(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<GlobalScoreEntry[] | null> {
  return requestGlobalScores(
    LEADERBOARD_ENDPOINT,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    },
    timeoutMs,
  )
}

export async function submitGlobalScore(
  initials: string,
  score: number,
  version?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GlobalScoreEntry[] | null> {
  const sanitizedInitials = sanitizeSubmissionInitials(initials)
  const sanitizedVersion = sanitizeVersion(version)
  if (!sanitizedInitials || !isValidScore(score) || sanitizedVersion === null) {
    return null
  }

  return requestGlobalScores(
    LEADERBOARD_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initials: sanitizedInitials,
        score,
        ...(sanitizedVersion ? { version: sanitizedVersion } : {}),
      }),
      cache: 'no-store',
      credentials: 'same-origin',
    },
    timeoutMs,
  )
}

export function parseGlobalScoresResponse(value: unknown): GlobalScoreEntry[] | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const response = value as { ok?: unknown; scores?: unknown }
  if (response.ok !== true || !Array.isArray(response.scores) || response.scores.length > MAX_RESULTS) {
    return null
  }

  const scores: GlobalScoreEntry[] = []
  for (const candidate of response.scores) {
    if (!candidate || typeof candidate !== 'object') {
      return null
    }

    const entry = candidate as Record<string, unknown>
    if (!isValidInitials(entry.initials) || !isValidScore(entry.score) || !isValidCreatedAt(entry.createdAt)) {
      return null
    }

    scores.push({
      initials: entry.initials,
      score: entry.score,
      createdAt: entry.createdAt,
    })
  }

  return scores.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt).slice(0, MAX_RESULTS)
}

async function requestGlobalScores(url: string, init: RequestInit, timeoutMs: number): Promise<GlobalScoreEntry[] | null> {
  if (typeof fetch !== 'function' || typeof AbortController === 'undefined') {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    if (!response.ok) {
      return null
    }

    return parseGlobalScoresResponse(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function sanitizeSubmissionInitials(initials: string): string | null {
  const sanitized = initials.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3)
  return isValidInitials(sanitized) ? sanitized : null
}

function sanitizeVersion(version: string | undefined): string | null | undefined {
  if (version === undefined || version === '') {
    return undefined
  }

  const sanitized = version.trim()
  return sanitized.length > 0 && sanitized.length <= 32 && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(sanitized) ? sanitized : null
}

function isValidInitials(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
}

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_SCORE
}

function isValidCreatedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
