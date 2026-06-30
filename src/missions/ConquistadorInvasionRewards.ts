export const ORB_JACKPOT_BONUS = 100_000
export const INVASION_FAILURE_BONUS_PER_TARGET = 2_500

export const invasionFailureBonus = (destroyedTargetCount: number) =>
  Math.max(0, Math.floor(destroyedTargetCount)) * INVASION_FAILURE_BONUS_PER_TARGET

export class OrbJackpotReward {
  private lit = false

  get isLit() {
    return this.lit
  }

  light() {
    const newlyLit = !this.lit
    this.lit = true
    return newlyLit
  }

  consume() {
    if (!this.lit) {
      return 0
    }

    this.lit = false
    return ORB_JACKPOT_BONUS
  }

  reset() {
    this.lit = false
  }
}
