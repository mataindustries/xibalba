export type ChampionEntry = {
  initials: string
  score: number
}

export const WALL_OF_CHAMPIONS_KEY = 'xibalba_wall_of_champions'

export const DEFAULT_CHAMPIONS: ChampionEntry[] = [
  { initials: 'SUN', score: 250000 },
  { initials: 'JAG', score: 150000 },
  { initials: 'KUK', score: 75000 },
]

const CHAMPION_LIMIT = 3
const INITIALS_LIMIT = 3

export function loadWallOfChampions(): ChampionEntry[] {
  const storage = getStorage()
  if (!storage) {
    return copyDefaults()
  }

  try {
    const stored = storage.getItem(WALL_OF_CHAMPIONS_KEY)
    if (!stored) {
      return writeChampions(storage, DEFAULT_CHAMPIONS)
    }

    const champions = normalizeChampions(JSON.parse(stored))
    writeChampions(storage, champions)
    return champions
  } catch {
    return writeChampions(storage, DEFAULT_CHAMPIONS)
  }
}

export function saveWallOfChampions(entries: readonly ChampionEntry[]): ChampionEntry[] {
  const champions = normalizeChampions(entries)
  const storage = getStorage()
  if (storage) {
    writeChampions(storage, champions)
  }
  return champions
}

export function qualifiesForWallOfChampions(score: number, entries: readonly ChampionEntry[]): boolean {
  const scoreValue = sanitizeScore(score)
  if (scoreValue === null) {
    return false
  }

  const champions = normalizeChampions(entries)
  return scoreValue > champions[CHAMPION_LIMIT - 1].score
}

export function saveChampionScore(score: number, initials: string, entries: readonly ChampionEntry[]): ChampionEntry[] {
  const sanitizedInitials = sanitizeInitials(initials)
  if (!sanitizedInitials || !qualifiesForWallOfChampions(score, entries)) {
    return normalizeChampions(entries)
  }

  const scoreValue = sanitizeScore(score) ?? 0
  return saveWallOfChampions([...entries, { initials: sanitizedInitials, score: scoreValue }])
}

export function normalizeChampions(entries: unknown): ChampionEntry[] {
  const sanitized = Array.isArray(entries) ? entries.map(sanitizeChampionEntry).filter((entry) => entry !== null) : []
  const filled = [...sanitized]

  DEFAULT_CHAMPIONS.forEach((champion) => {
    if (filled.length < CHAMPION_LIMIT) {
      filled.push({ ...champion })
    }
  })

  return filled.sort((a, b) => b.score - a.score).slice(0, CHAMPION_LIMIT)
}

export function sanitizeChampionEntry(entry: unknown): ChampionEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const candidate = entry as { initials?: unknown; score?: unknown }
  const initials = typeof candidate.initials === 'string' ? sanitizeInitials(candidate.initials) : null
  const score = typeof candidate.score === 'number' ? candidate.score : Number.parseInt(String(candidate.score ?? ''), 10)

  if (initials === null || !Number.isFinite(score) || score <= 0) {
    return null
  }

  return {
    initials,
    score: Math.floor(score),
  }
}

export function sanitizeInitials(initials: string): string | null {
  const sanitized = initials.replace(/[^a-z]/gi, '').toUpperCase().slice(0, INITIALS_LIMIT)
  return sanitized.length === INITIALS_LIMIT ? sanitized : null
}

function sanitizeScore(score: number): number | null {
  if (!Number.isFinite(score) || score <= 0) {
    return null
  }

  return Math.floor(score)
}

function writeChampions(storage: Storage, entries: readonly ChampionEntry[]): ChampionEntry[] {
  const champions = normalizeChampions(entries)

  try {
    storage.setItem(WALL_OF_CHAMPIONS_KEY, JSON.stringify(champions))
  } catch {
    return champions
  }

  return champions
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

function copyDefaults(): ChampionEntry[] {
  return DEFAULT_CHAMPIONS.map((champion) => ({ ...champion }))
}
