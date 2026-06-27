export type GlobalScoreEntry = {
  initials: string
  score: number
  createdAt: number
}

type GlobalLeaderboardResponse = {
  scores: GlobalScoreEntry[]
  duplicate: boolean
}

const LEADERBOARD_ENDPOINT = '/api/leaderboard'
const DEFAULT_TIMEOUT_MS = 4500
const MAX_SCORE = 999_999_999
const MAX_RESULTS = 25
const MAX_SUBMITTED_SCORE_SIGNATURES = 20

export const SUBMITTED_GLOBAL_SCORES_KEY = 'xibalba_submitted_global_scores'

const pendingScoreSubmissions = new Map<string, Promise<GlobalScoreEntry[] | null>>()

export async function fetchGlobalScores(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<GlobalScoreEntry[] | null> {
  const response = await requestGlobalLeaderboard(
    LEADERBOARD_ENDPOINT,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    },
    timeoutMs,
  )
  return response?.scores ?? null
}

export function submitGlobalScore(
  initials: string,
  score: number,
  version?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GlobalScoreEntry[] | null> {
  const sanitizedInitials = sanitizeSubmissionInitials(initials)
  const sanitizedVersion = sanitizeVersion(version)
  if (!sanitizedInitials || !isValidScore(score) || sanitizedVersion === null) {
    return Promise.resolve(null)
  }

  const signature = scoreSignature(sanitizedInitials, score)
  if (hasSubmittedGlobalScore(sanitizedInitials, score)) {
    return fetchGlobalScores(timeoutMs)
  }

  const pendingSubmission = pendingScoreSubmissions.get(signature)
  if (pendingSubmission) {
    return pendingSubmission
  }

  const submission = submitScoreOnce(sanitizedInitials, score, sanitizedVersion, signature, timeoutMs)
  pendingScoreSubmissions.set(signature, submission)
  return submission
}

export function parseGlobalScoresResponse(value: unknown): GlobalScoreEntry[] | null {
  return parseGlobalLeaderboardResponse(value)?.scores ?? null
}

export function hasSubmittedGlobalScore(initials: string, score: number): boolean {
  const sanitizedInitials = sanitizeSubmissionInitials(initials)
  return Boolean(sanitizedInitials && isValidScore(score) && loadSubmittedScoreSignatures().includes(scoreSignature(sanitizedInitials, score)))
}

async function submitScoreOnce(
  initials: string,
  score: number,
  version: string | undefined,
  signature: string,
  timeoutMs: number,
): Promise<GlobalScoreEntry[] | null> {
  try {
    const response = await requestGlobalLeaderboard(
      LEADERBOARD_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initials,
          score,
          ...(version ? { version } : {}),
        }),
        cache: 'no-store',
        credentials: 'same-origin',
      },
      timeoutMs,
    )

    if (!response) {
      return null
    }

    rememberSubmittedGlobalScore(signature)
    return response.scores
  } finally {
    pendingScoreSubmissions.delete(signature)
  }
}

function parseGlobalLeaderboardResponse(value: unknown): GlobalLeaderboardResponse | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const response = value as { ok?: unknown; duplicate?: unknown; scores?: unknown; source?: unknown }
  if (
    response.ok !== true ||
    response.source !== 'global' ||
    (response.duplicate !== undefined && typeof response.duplicate !== 'boolean') ||
    !Array.isArray(response.scores) ||
    response.scores.length > MAX_RESULTS
  ) {
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

  return {
    scores: scores.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt).slice(0, MAX_RESULTS),
    duplicate: response.duplicate === true,
  }
}

async function requestGlobalLeaderboard(url: string, init: RequestInit, timeoutMs: number): Promise<GlobalLeaderboardResponse | null> {
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

    return parseGlobalLeaderboardResponse(await response.json())
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

function scoreSignature(initials: string, score: number): string {
  return `${initials}:${score}`
}

function rememberSubmittedGlobalScore(signature: string) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  const signatures = [signature, ...loadSubmittedScoreSignatures(storage).filter((candidate) => candidate !== signature)].slice(
    0,
    MAX_SUBMITTED_SCORE_SIGNATURES,
  )

  try {
    storage.setItem(SUBMITTED_GLOBAL_SCORES_KEY, JSON.stringify(signatures))
  } catch {
    // A successful global save must not fail the game flow when storage is unavailable.
  }
}

function loadSubmittedScoreSignatures(storage = getStorage()): string[] {
  if (!storage) {
    return []
  }

  try {
    const stored = JSON.parse(storage.getItem(SUBMITTED_GLOBAL_SCORES_KEY) ?? '[]')
    if (!Array.isArray(stored)) {
      return []
    }

    return stored
      .filter((signature): signature is string => typeof signature === 'string' && isValidScoreSignature(signature))
      .slice(0, MAX_SUBMITTED_SCORE_SIGNATURES)
  } catch {
    return []
  }
}

function isValidScoreSignature(signature: string): boolean {
  const match = /^([A-Z]{3}):([1-9]\d*)$/.exec(signature)
  return Boolean(match && isValidScore(Number(match[2])))
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}
