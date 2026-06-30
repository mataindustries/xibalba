import type { InvasionTargetType } from './ConquistadorInvasionTargets'

export type MissionState = 'inactive' | 'portalLit' | 'starting' | 'active' | 'success' | 'failed' | 'ending'

export type MissionResult = 'success' | 'failed' | null

export type ConquistadorInvasionConfig = {
  durationMs: number
  requiredTargetCount: number
  requiredShipCount: number
  shipTargetCount: number
  invaderTargetCount: number
  startingDurationMs: number
  resultDurationMs: number
  endingDurationMs: number
}

export type ConquistadorInvasionHooks = {
  onStateChange?: (state: MissionState, previousState: MissionState) => void
  onTargetDestroyed?: (type: InvasionTargetType, destroyedTargetCount: number) => void
}

export const CONQUISTADOR_INVASION_CONFIG: ConquistadorInvasionConfig = {
  durationMs: 30_000,
  requiredTargetCount: 8,
  requiredShipCount: 2,
  shipTargetCount: 3,
  invaderTargetCount: 9,
  startingDurationMs: 1_200,
  resultDurationMs: 2_400,
  endingDurationMs: 800,
}

export class ConquistadorInvasionMission {
  readonly config: ConquistadorInvasionConfig
  state: MissionState = 'inactive'
  missionActive = false
  portalPrimed = false
  remainingMs: number
  destroyedTargetCount = 0
  destroyedShipCount = 0
  destroyedInvaderCount = 0
  result: MissionResult = null

  private stateElapsedMs = 0
  private readonly hooks: ConquistadorInvasionHooks

  constructor(
    config = CONQUISTADOR_INVASION_CONFIG,
    hooks: ConquistadorInvasionHooks = {},
  ) {
    this.config = config
    this.hooks = hooks
    this.remainingMs = config.durationMs
  }

  primePortal() {
    if (this.state !== 'inactive' || this.portalPrimed) {
      return false
    }

    this.portalPrimed = true
    return true
  }

  lightPortal() {
    if (this.state !== 'inactive' || !this.portalPrimed) {
      return false
    }

    this.portalPrimed = false
    this.transitionTo('portalLit')
    return true
  }

  startFromPortal() {
    if (this.state !== 'portalLit') {
      return false
    }

    this.beginStartingSequence()
    return true
  }

  forceStartForDev() {
    this.reset()
    this.beginStartingSequence()
  }

  registerTargetDestroyed(type: InvasionTargetType) {
    if (!this.missionActive) {
      return false
    }

    this.destroyedTargetCount += 1
    if (type === 'ship') {
      this.destroyedShipCount += 1
    } else {
      this.destroyedInvaderCount += 1
    }
    this.hooks.onTargetDestroyed?.(type, this.destroyedTargetCount)

    if (
      this.destroyedShipCount >= this.config.requiredShipCount &&
      this.destroyedTargetCount >= this.config.requiredTargetCount
    ) {
      this.result = 'success'
      this.transitionTo('success')
    }
    return true
  }

  forceSuccessForDev() {
    if (this.state !== 'starting' && this.state !== 'active') {
      return false
    }

    this.destroyedShipCount = this.config.requiredShipCount
    this.destroyedTargetCount = Math.max(this.destroyedTargetCount, this.config.requiredTargetCount)
    this.result = 'success'
    this.transitionTo('success')
    return true
  }

  forceFailureForDev() {
    if (this.state !== 'starting' && this.state !== 'active') {
      return false
    }

    this.result = 'failed'
    this.transitionTo('failed')
    return true
  }

  update(deltaMs: number) {
    const safeDeltaMs = Math.max(0, deltaMs)
    this.stateElapsedMs += safeDeltaMs

    switch (this.state) {
      case 'starting':
        if (this.stateElapsedMs >= this.config.startingDurationMs) {
          this.transitionTo('active')
        }
        break
      case 'active':
        this.remainingMs = Math.max(0, this.remainingMs - safeDeltaMs)
        if (this.remainingMs === 0) {
          this.result = 'failed'
          this.transitionTo('failed')
        }
        break
      case 'success':
      case 'failed':
        if (this.stateElapsedMs >= this.config.resultDurationMs) {
          this.transitionTo('ending')
        }
        break
      case 'ending':
        if (this.stateElapsedMs >= this.config.endingDurationMs) {
          this.reset()
        }
        break
      case 'inactive':
      case 'portalLit':
        break
    }
  }

  reset() {
    const previousState = this.state
    this.state = 'inactive'
    this.missionActive = false
    this.portalPrimed = false
    this.remainingMs = this.config.durationMs
    this.destroyedTargetCount = 0
    this.destroyedShipCount = 0
    this.destroyedInvaderCount = 0
    this.result = null
    this.stateElapsedMs = 0

    if (previousState !== 'inactive') {
      this.hooks.onStateChange?.('inactive', previousState)
    }
  }

  private beginStartingSequence() {
    this.destroyedTargetCount = 0
    this.destroyedShipCount = 0
    this.destroyedInvaderCount = 0
    this.remainingMs = this.config.durationMs
    this.result = null
    this.transitionTo('starting')
  }

  private transitionTo(state: MissionState) {
    if (this.state === state) {
      return
    }

    const previousState = this.state
    this.state = state
    this.stateElapsedMs = 0
    this.missionActive = state === 'active'
    if (state === 'active') {
      this.remainingMs = this.config.durationMs
    }
    this.hooks.onStateChange?.(state, previousState)
  }
}
