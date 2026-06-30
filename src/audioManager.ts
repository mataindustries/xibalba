export const XIBALBA_AUDIO_MUTED_KEY = 'xibalba_audio_muted'

type ToneVoice = {
  kind: 'tone'
  frequency: number
  endFrequency?: number
  durationMs: number
  delayMs?: number
  gain: number
  type?: OscillatorType
  filterType?: BiquadFilterType
  filterFrequency?: number
  attackMs?: number
}

type NoiseVoice = {
  kind: 'noise'
  durationMs: number
  delayMs?: number
  gain: number
  filterType: BiquadFilterType
  filterFrequency: number
  q?: number
  attackMs?: number
}

type SynthVoice = ToneVoice | NoiseVoice
type CuePriority = 1 | 2 | 3

const MAX_ACTIVE_VOICES = 24
const MASTER_VOLUME = 0.62

const tone = (
  frequency: number,
  durationMs: number,
  gain: number,
  options: Omit<ToneVoice, 'kind' | 'frequency' | 'durationMs' | 'gain'> = {},
): ToneVoice => ({
  kind: 'tone',
  frequency,
  durationMs,
  gain,
  ...options,
})

const noise = (
  durationMs: number,
  gain: number,
  filterFrequency: number,
  options: Omit<NoiseVoice, 'kind' | 'durationMs' | 'gain' | 'filterFrequency' | 'filterType'> & {
    filterType?: BiquadFilterType
  } = {},
): NoiseVoice => ({
  kind: 'noise',
  durationMs,
  gain,
  filterFrequency,
  filterType: options.filterType ?? 'bandpass',
  ...options,
})

const RECIPES = {
  flipper: [
    noise(30, 0.065, 1450, { q: 0.8 }),
    tone(178, 48, 0.07, { type: 'square', endFrequency: 92 }),
    tone(940, 28, 0.025, { type: 'triangle', endFrequency: 620 }),
  ],
  plungerPull: [
    noise(120, 0.025, 720, { filterType: 'lowpass', q: 0.6 }),
    tone(82, 180, 0.035, { type: 'sawtooth', endFrequency: 148, attackMs: 18 }),
    tone(240, 90, 0.018, { type: 'triangle', endFrequency: 310, delayMs: 70 }),
  ],
  plungerLaunch: [
    noise(70, 0.085, 480, { filterType: 'lowpass', q: 0.7 }),
    tone(104, 150, 0.1, { type: 'sine', endFrequency: 42 }),
    tone(310, 72, 0.045, { type: 'triangle', endFrequency: 162 }),
  ],
  bumper: [
    noise(36, 0.04, 1750, { q: 1.2 }),
    tone(510, 105, 0.07, { type: 'sine', endFrequency: 482 }),
    tone(782, 145, 0.045, { type: 'sine', endFrequency: 744 }),
    tone(1174, 180, 0.025, { type: 'sine', endFrequency: 1120 }),
  ],
  sling: [
    noise(42, 0.05, 1100, { q: 0.8 }),
    tone(285, 68, 0.05, { type: 'square', endFrequency: 190 }),
  ],
  target: [
    noise(46, 0.065, 920, { q: 1.1 }),
    tone(265, 82, 0.045, { type: 'triangle', endFrequency: 178 }),
    tone(640, 42, 0.018, { type: 'sine' }),
  ],
  rollover: [
    tone(880, 82, 0.04, { type: 'triangle', endFrequency: 1040 }),
    tone(1320, 115, 0.022, { type: 'sine', endFrequency: 1390, delayMs: 18 }),
  ],
  jackpot: [
    noise(82, 0.08, 520, { filterType: 'lowpass' }),
    tone(98, 260, 0.11, { type: 'sine', endFrequency: 48 }),
    tone(392, 210, 0.055, { type: 'triangle', delayMs: 35 }),
    tone(588, 260, 0.045, { type: 'sine', delayMs: 90 }),
    tone(784, 330, 0.035, { type: 'sine', delayMs: 150 }),
  ],
  eclipseReady: [
    tone(220, 180, 0.045, { type: 'sine', endFrequency: 196 }),
    tone(440, 220, 0.045, { type: 'triangle', delayMs: 70 }),
    tone(660, 280, 0.03, { type: 'sine', delayMs: 145 }),
  ],
  multiball: [
    noise(150, 0.08, 360, { filterType: 'lowpass' }),
    tone(76, 420, 0.12, { type: 'sine', endFrequency: 38 }),
    tone(146, 260, 0.06, { type: 'sawtooth', endFrequency: 110, delayMs: 30 }),
    tone(293, 300, 0.055, { type: 'triangle', delayMs: 120 }),
    tone(440, 360, 0.045, { type: 'triangle', delayMs: 210 }),
    tone(659, 430, 0.03, { type: 'sine', delayMs: 300 }),
  ],
  missionStart: [
    noise(130, 0.065, 420, { filterType: 'lowpass' }),
    tone(84, 380, 0.095, { type: 'sine', endFrequency: 42 }),
    tone(330, 210, 0.04, { type: 'triangle', delayMs: 65 }),
    tone(494, 260, 0.035, { type: 'triangle', delayMs: 145 }),
    tone(740, 340, 0.026, { type: 'sine', delayMs: 230 }),
  ],
  missionTargetDestroyed: [
    noise(52, 0.055, 1120, { q: 1.1 }),
    tone(190, 90, 0.05, { type: 'square', endFrequency: 92 }),
    tone(690, 110, 0.026, { type: 'triangle', endFrequency: 920, delayMs: 24 }),
  ],
  missionShipDestroyed: [
    noise(110, 0.085, 390, { filterType: 'lowpass' }),
    tone(92, 240, 0.1, { type: 'sine', endFrequency: 40 }),
    tone(294, 170, 0.045, { type: 'sawtooth', endFrequency: 138, delayMs: 28 }),
    tone(588, 250, 0.03, { type: 'triangle', delayMs: 100 }),
  ],
  missionSuccess: [
    noise(110, 0.06, 520, { filterType: 'lowpass' }),
    tone(196, 180, 0.05, { type: 'triangle' }),
    tone(392, 230, 0.05, { type: 'triangle', delayMs: 85 }),
    tone(587, 290, 0.04, { type: 'triangle', delayMs: 175 }),
    tone(880, 390, 0.03, { type: 'sine', delayMs: 270 }),
  ],
  missionFailure: [
    noise(120, 0.06, 300, { filterType: 'lowpass' }),
    tone(164, 230, 0.065, { type: 'sawtooth', endFrequency: 82 }),
    tone(110, 310, 0.06, { type: 'triangle', endFrequency: 52, delayMs: 130 }),
    tone(55, 430, 0.055, { type: 'sine', endFrequency: 30, delayMs: 270 }),
  ],
  missionUrgency: [
    noise(28, 0.028, 1450, { q: 1.4 }),
    tone(880, 72, 0.024, { type: 'triangle', endFrequency: 660 }),
    tone(1760, 54, 0.012, { type: 'sine', delayMs: 26 }),
  ],
  drain: [
    noise(150, 0.07, 290, { filterType: 'lowpass' }),
    tone(128, 280, 0.09, { type: 'sawtooth', endFrequency: 46 }),
    tone(72, 320, 0.07, { type: 'sine', endFrequency: 34, delayMs: 45 }),
  ],
  ballSave: [
    tone(392, 130, 0.05, { type: 'triangle' }),
    tone(587, 170, 0.045, { type: 'triangle', delayMs: 72 }),
    tone(880, 240, 0.035, { type: 'sine', delayMs: 148 }),
  ],
  gameOver: [
    noise(90, 0.035, 340, { filterType: 'lowpass' }),
    tone(220, 190, 0.05, { type: 'triangle' }),
    tone(165, 230, 0.05, { type: 'triangle', delayMs: 150 }),
    tone(110, 360, 0.07, { type: 'sine', endFrequency: 72, delayMs: 330 }),
  ],
  newChampion: [
    noise(90, 0.075, 480, { filterType: 'lowpass' }),
    tone(92, 300, 0.1, { type: 'sine', endFrequency: 48 }),
    tone(392, 220, 0.055, { type: 'triangle', delayMs: 70 }),
    tone(523, 260, 0.05, { type: 'triangle', delayMs: 150 }),
    tone(659, 330, 0.04, { type: 'sine', delayMs: 235 }),
    tone(784, 430, 0.03, { type: 'sine', delayMs: 330 }),
  ],
  championCarved: [
    noise(58, 0.075, 760, { q: 0.9 }),
    tone(178, 110, 0.055, { type: 'triangle', endFrequency: 112 }),
    tone(523, 180, 0.05, { type: 'triangle', delayMs: 65 }),
    tone(659, 240, 0.042, { type: 'sine', delayMs: 130 }),
    tone(1046, 340, 0.028, { type: 'sine', delayMs: 205 }),
  ],
  unmute: [
    tone(660, 75, 0.035, { type: 'triangle' }),
    tone(990, 110, 0.025, { type: 'sine', delayMs: 55 }),
  ],
} satisfies Record<string, readonly SynthVoice[]>

type CueName = keyof typeof RECIPES

export class XibalbaAudioManager {
  private context?: AudioContext
  private masterGain?: GainNode
  private noiseBuffer?: AudioBuffer
  private muted = loadMutedPreference()
  private activeVoices = 0
  private lastPlayedAt = new Map<CueName, number>()

  isMuted() {
    return this.muted
  }

  toggleMuted() {
    this.setMuted(!this.muted)
    return this.muted
  }

  setMuted(muted: boolean) {
    this.muted = muted
    saveMutedPreference(muted)
    if (this.context && this.masterGain) {
      try {
        this.masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.context.currentTime, 0.012)
      } catch {
        // A closed or interrupted context should not block the mute control.
      }
    }
  }

  async unlock() {
    try {
      const context = this.ensureContext()
      if (!context) {
        return false
      }
      if (context.state === 'suspended') {
        await context.resume()
      }
      return context.state === 'running'
    } catch {
      return false
    }
  }

  playFlipper() {
    this.play('flipper', 38, 2)
  }

  playPlungerPull() {
    this.play('plungerPull', 180, 1)
  }

  playPlungerLaunch() {
    this.play('plungerLaunch', 120, 2)
  }

  playBumper() {
    this.play('bumper', 52, 1)
  }

  playSling() {
    this.play('sling', 48, 1)
  }

  playTarget() {
    this.play('target', 55, 1)
  }

  playRollover() {
    this.play('rollover', 85, 1)
  }

  playJackpot() {
    this.play('jackpot', 280, 3)
  }

  playEclipseReady() {
    this.play('eclipseReady', 700, 2)
  }

  playMultiball() {
    this.play('multiball', 1200, 3)
  }

  playMissionStart() {
    this.play('missionStart', 1000, 3)
  }

  playMissionTargetDestroyed() {
    this.play('missionTargetDestroyed', 70, 1)
  }

  playMissionShipDestroyed() {
    this.play('missionShipDestroyed', 180, 2)
  }

  playMissionSuccess() {
    this.play('missionSuccess', 1000, 3)
  }

  playMissionFailure() {
    this.play('missionFailure', 1000, 3)
  }

  playMissionUrgency() {
    this.play('missionUrgency', 760, 1)
  }

  playDrain() {
    this.play('drain', 180, 2)
  }

  playBallSave() {
    this.play('ballSave', 500, 3)
  }

  playGameOver() {
    this.play('gameOver', 1000, 3)
  }

  playNewChampion() {
    this.play('newChampion', 1200, 3)
  }

  playChampionCarved() {
    this.play('championCarved', 800, 3)
  }

  playUnmute() {
    this.play('unmute', 160, 2)
  }

  private play(cue: CueName, cooldownMs: number, priority: CuePriority) {
    if (this.muted) {
      return
    }

    const now = typeof performance === 'undefined' ? Date.now() : performance.now()
    const lastPlayed = this.lastPlayedAt.get(cue) ?? -Infinity
    if (now - lastPlayed < cooldownMs || (priority === 1 && this.activeVoices >= MAX_ACTIVE_VOICES)) {
      return
    }
    this.lastPlayedAt.set(cue, now)

    try {
      const context = this.ensureContext()
      if (!context) {
        return
      }
      if (context.state === 'suspended') {
        void context
          .resume()
          .then(() => {
            if (context.state === 'running' && !this.muted) {
              this.scheduleRecipe(context, RECIPES[cue], priority)
            }
          })
          .catch(() => undefined)
        return
      }
      if (context.state === 'running') {
        this.scheduleRecipe(context, RECIPES[cue], priority)
      }
    } catch {
      // Audio is optional; unsupported or exhausted Web Audio must never affect play.
    }
  }

  private ensureContext() {
    if (this.context?.state === 'closed') {
      this.context = undefined
      this.masterGain = undefined
      this.noiseBuffer = undefined
    }
    if (this.context) {
      return this.context
    }
    if (typeof window === 'undefined') {
      return undefined
    }

    try {
      const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
      const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext
      if (!AudioContextConstructor) {
        return undefined
      }

      const context = new AudioContextConstructor()
      const masterGain = context.createGain()
      const compressor = context.createDynamicsCompressor()
      masterGain.gain.value = this.muted ? 0 : MASTER_VOLUME
      compressor.threshold.value = -18
      compressor.knee.value = 18
      compressor.ratio.value = 5
      compressor.attack.value = 0.004
      compressor.release.value = 0.16
      masterGain.connect(compressor)
      compressor.connect(context.destination)
      this.context = context
      this.masterGain = masterGain
      return context
    } catch {
      return undefined
    }
  }

  private scheduleRecipe(context: AudioContext, recipe: readonly SynthVoice[], priority: CuePriority) {
    const output = this.masterGain
    if (!output) {
      return
    }

    recipe.forEach((voice) => {
      if (priority === 1 && this.activeVoices >= MAX_ACTIVE_VOICES) {
        return
      }
      if (voice.kind === 'tone') {
        this.scheduleTone(context, output, voice)
      } else {
        this.scheduleNoise(context, output, voice)
      }
    })
  }

  private scheduleTone(context: AudioContext, output: AudioNode, voice: ToneVoice) {
    const start = context.currentTime + (voice.delayMs ?? 0) / 1000
    const duration = voice.durationMs / 1000
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = voice.type ?? 'sine'
    oscillator.frequency.setValueAtTime(voice.frequency, start)
    if (voice.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, voice.endFrequency), start + duration)
    }

    const filter = voice.filterFrequency ? context.createBiquadFilter() : undefined
    if (filter) {
      filter.type = voice.filterType ?? 'lowpass'
      filter.frequency.value = voice.filterFrequency ?? 1200
      oscillator.connect(filter)
      filter.connect(gain)
    } else {
      oscillator.connect(gain)
    }

    this.applyEnvelope(gain, start, duration, voice.gain, voice.attackMs)
    gain.connect(output)
    this.trackVoice(oscillator, [oscillator, filter, gain])
    oscillator.start(start)
    oscillator.stop(start + duration + 0.025)
  }

  private scheduleNoise(context: AudioContext, output: AudioNode, voice: NoiseVoice) {
    const start = context.currentTime + (voice.delayMs ?? 0) / 1000
    const duration = voice.durationMs / 1000
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = this.getNoiseBuffer(context)
    filter.type = voice.filterType
    filter.frequency.value = voice.filterFrequency
    filter.Q.value = voice.q ?? 0.8
    source.connect(filter)
    filter.connect(gain)
    gain.connect(output)
    this.applyEnvelope(gain, start, duration, voice.gain, voice.attackMs)
    this.trackVoice(source, [source, filter, gain])
    source.start(start, Math.random() * 0.6, duration)
    source.stop(start + duration + 0.025)
  }

  private applyEnvelope(gain: GainNode, start: number, duration: number, peak: number, attackMs = 8) {
    const attack = Math.min(duration * 0.4, attackMs / 1000)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + Math.max(0.002, attack))
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  }

  private getNoiseBuffer(context: AudioContext) {
    if (this.noiseBuffer) {
      return this.noiseBuffer
    }

    const length = context.sampleRate
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  private trackVoice(source: AudioScheduledSourceNode, nodes: Array<AudioNode | undefined>) {
    this.activeVoices += 1
    source.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1)
      nodes.forEach((node) => node?.disconnect())
    }
  }
}

function loadMutedPreference() {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(XIBALBA_AUDIO_MUTED_KEY) === 'true'
  } catch {
    return false
  }
}

function saveMutedPreference(muted: boolean) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(XIBALBA_AUDIO_MUTED_KEY, String(muted))
  } catch {
    // Mute still works for the session when storage is unavailable.
  }
}
