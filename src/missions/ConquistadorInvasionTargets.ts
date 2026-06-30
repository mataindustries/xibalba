export type InvasionTargetType = 'ship' | 'invader'

export type InvasionTargetDefinition = {
  id: string
  type: InvasionTargetType
  x: number
  y: number
  hitRadius: number
  points: number
}

export const INVASION_TARGET_POINTS = {
  ship: 35_000,
  invader: 10_000,
} as const

export const INVASION_CLEAR_BONUS = 100_000
export const INVASION_COMBO_WINDOW_MS = 1_400
export const INVASION_COMBO_STEP_SCORE = 5_000
export const INVASION_COMBO_MAX = 4

export const CONQUISTADOR_INVASION_TARGETS = [
  // Upper ships sit on the left orbit, temple lane, and right orbit.
  { id: 'ship-upper-left', type: 'ship', x: 260, y: 455, hitRadius: 58, points: INVASION_TARGET_POINTS.ship },
  { id: 'ship-upper-center', type: 'ship', x: 540, y: 430, hitRadius: 58, points: INVASION_TARGET_POINTS.ship },
  { id: 'ship-upper-right', type: 'ship', x: 830, y: 485, hitRadius: 58, points: INVASION_TARGET_POINTS.ship },
  // Invaders form three separated shot bands: bumper approaches, rollover lanes, and target-bank/center lanes.
  { id: 'invader-left-high', type: 'invader', x: 300, y: 660, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center-high', type: 'invader', x: 540, y: 650, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-right-high', type: 'invader', x: 780, y: 660, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-left-mid', type: 'invader', x: 360, y: 850, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center', type: 'invader', x: 540, y: 840, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-right-mid', type: 'invader', x: 720, y: 850, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-left-bank', type: 'invader', x: 350, y: 1010, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-right-bank', type: 'invader', x: 730, y: 1010, hitRadius: 32, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-temple-guard', type: 'invader', x: 540, y: 1170, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
] as const satisfies readonly InvasionTargetDefinition[]
