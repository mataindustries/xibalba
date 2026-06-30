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
  { id: 'ship-upper-left', type: 'ship', x: 286, y: 470, hitRadius: 64, points: INVASION_TARGET_POINTS.ship },
  { id: 'ship-upper-center', type: 'ship', x: 540, y: 438, hitRadius: 64, points: INVASION_TARGET_POINTS.ship },
  { id: 'ship-upper-right', type: 'ship', x: 794, y: 482, hitRadius: 64, points: INVASION_TARGET_POINTS.ship },
  { id: 'invader-left-high', type: 'invader', x: 292, y: 620, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center-high', type: 'invader', x: 514, y: 612, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-right-high', type: 'invader', x: 794, y: 632, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-left-mid', type: 'invader', x: 278, y: 780, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center-left', type: 'invader', x: 420, y: 790, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center', type: 'invader', x: 540, y: 760, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-center-right', type: 'invader', x: 664, y: 790, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-right-mid', type: 'invader', x: 814, y: 790, hitRadius: 34, points: INVASION_TARGET_POINTS.invader },
  { id: 'invader-temple-guard', type: 'invader', x: 540, y: 1010, hitRadius: 38, points: INVASION_TARGET_POINTS.invader },
] as const satisfies readonly InvasionTargetDefinition[]
