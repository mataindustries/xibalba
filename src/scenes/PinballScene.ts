import Phaser from 'phaser'
import { XibalbaAudioManager } from '../audioManager'
import { tableLayout } from '../config/tableLayout'
import { fetchGlobalScores, submitGlobalScore } from '../globalLeaderboard'
import { loadWallOfChampions, qualifiesForWallOfChampions, saveChampionScore } from '../wallOfChampions'
import type {
  BumperBody,
  FlipperConfig,
  GuideRailVisual,
  Point,
  RoundedPost,
  SensorBody,
  SlingBody,
  TrapKickerZone,
  WallSegment,
} from '../config/tableLayout'
import type { ChampionEntry } from '../wallOfChampions'

type FlipperRuntime = {
  config: FlipperConfig
  body: MatterJS.BodyType
  visual: Phaser.GameObjects.Container
  accent: Phaser.GameObjects.Container
  currentAngle: number
  lastImpulseAt: number
  pressed: boolean
}

type BallRuntime = {
  id: number
  image: Phaser.Physics.Matter.Image
  body: MatterJS.BodyType
  lastMotionAt: number
  lastDrainAt: number
}

type ControlKeys = {
  left: Phaser.Input.Keyboard.Key
  leftAlt: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  rightAlt: Phaser.Input.Keyboard.Key
  plunger: Phaser.Input.Keyboard.Key
  plungerAlt: Phaser.Input.Keyboard.Key
  pause: Phaser.Input.Keyboard.Key
  reset: Phaser.Input.Keyboard.Key
  devMode: Phaser.Input.Keyboard.Key
  devModeAlt: Phaser.Input.Keyboard.Key
  debug: Phaser.Input.Keyboard.Key
  testMode: Phaser.Input.Keyboard.Key
  clearVelocity: Phaser.Input.Keyboard.Key
  shift: Phaser.Input.Keyboard.Key
  one: Phaser.Input.Keyboard.Key
  two: Phaser.Input.Keyboard.Key
  three: Phaser.Input.Keyboard.Key
  four: Phaser.Input.Keyboard.Key
  five: Phaser.Input.Keyboard.Key
  multiball: Phaser.Input.Keyboard.Key
}

type ComboHitKind = 'bumper' | 'sling' | 'targetOrLane'
type EclipseState = 'NORMAL' | 'ECLIPSE READY' | 'ECLIPSE MULTIBALL'
type BallState = 'IN PLAY' | 'PLUNGER' | 'DRAINED' | 'GAME OVER'
type WallView = 'local' | 'global'
type GlobalWallState = 'idle' | 'loading' | 'ready' | 'unreachable'
type WallStatusTone = 'local' | 'global' | 'loading' | 'warning'

type ShotTestPlacement = 'leftFlipper' | 'rightFlipper' | 'centerLower' | 'shooterExit' | 'upperRollovers'
type ShotTestLaunch = 'leftUpper' | 'rightUpper' | 'centerJackpot'

type ScorePopupOptions = {
  major?: boolean
  event?: boolean
  color?: string
}

const HIGH_SCORE_KEY = 'xibalba-pinball-high-score'
const GLOBAL_LEADERBOARD_VERSION = 'g3'
const GLOBAL_WALL_CACHE_LIMIT = 10
const WALL_DISPLAY_LIMIT = 3
const assets = {
  playfield: tableLayout.table.background,
  titleCard: {
    key: 'xibalba-title-card',
    path: '/art/ui/xibalba-title-card-v1.png',
    // Same source aspect as the playfield; keep full-table display for menu/game alignment.
    x: 0,
    y: 0,
    width: tableLayout.table.width,
    height: tableLayout.table.height,
  },
} as const
const theme = {
  obsidian: 0x0b0b0f,
  charcoal: 0x1a1a1f,
  agedGold: 0xc89b3c,
  goldShadow: 0x7a5a1e,
  bone: 0xe8dfc8,
  jade: 0x1fa36b,
  brightJade: 0x5be39d,
  ember: 0xb63a2b,
  eclipseRed: 0x7e1f1f,
  ivory: 0xf7f1df,
  ink: 0x050507,
  css: {
    obsidian: '#0B0B0F',
    charcoal: '#1A1A1F',
    agedGold: '#C89B3C',
    goldShadow: '#7A5A1E',
    bone: '#E8DFC8',
    jade: '#1FA36B',
    brightJade: '#5BE39D',
    ember: '#B63A2B',
    eclipseRed: '#7E1F1F',
    ivory: '#F7F1DF',
    ink: '#050507',
  },
} as const

export class PinballScene extends Phaser.Scene {
  private balls: BallRuntime[] = []
  private nextBallId = 1
  private flippers: FlipperRuntime[] = []
  private collisionBodies: MatterJS.BodyType[] = []
  private debugGraphics!: Phaser.GameObjects.Graphics
  private playfieldGraphics!: Phaser.GameObjects.Graphics
  private plungerVisual!: Phaser.GameObjects.Container
  private scoreText!: Phaser.GameObjects.Text
  private highScoreText!: Phaser.GameObjects.Text
  private ballStateText!: Phaser.GameObjects.Text
  private ballSaveText!: Phaser.GameObjects.Text
  private eclipseStateText!: Phaser.GameObjects.Text
  private rolloverText!: Phaser.GameObjects.Text
  private controlsText!: Phaser.GameObjects.Text
  private devModeText!: Phaser.GameObjects.Text
  private startDevHint?: Phaser.GameObjects.Text
  private visualAlignmentText!: Phaser.GameObjects.Text
  private shotTestText!: Phaser.GameObjects.Text
  private startOverlay!: Phaser.GameObjects.Container
  private gameOverOverlay!: Phaser.GameObjects.Container
  private pauseOverlay!: Phaser.GameObjects.Container
  private touchHintLeft!: Phaser.GameObjects.Text
  private touchHintRight!: Phaser.GameObjects.Text
  private touchHintLaunch!: Phaser.GameObjects.Text
  private keys?: ControlKeys
  private bumperVisuals = new Map<string, Phaser.GameObjects.Container>()
  private slingVisuals = new Map<string, Phaser.GameObjects.Rectangle>()
  private rolloverVisuals = new Map<string, Phaser.GameObjects.Container>()
  private litRollovers = new Set<string>()
  private jackpotVisual?: Phaser.GameObjects.Rectangle
  private pointerControls = new Map<number, 'left' | 'right' | 'plunger'>()
  private score = 0
  private currentBall = 1
  private ballState: BallState = 'PLUNGER'
  private plungerCharge = 0
  private plungerHeld = false
  private lastKeyboardPlunger = false
  private lastShooterExitAt = 0
  private ballSaveUntil = 0
  private ballSaverArmed = true
  private drainResetPending = false
  private lastTrapKickAt = new Map<string, number>()
  private comboStep = 0
  private lastComboAt = 0
  private lastLaneComboAt = 0
  private hasStarted = false
  private gameOver = false
  private gamePaused = false
  private devModeEnabled = false
  private debugEnabled = false
  private shotTestMode = false
  private eclipseState: EclipseState = 'NORMAL'
  private lastSensorHit = 'none'
  private lastScoreEvent = 'none'
  private highScore = 0
  private champions: ChampionEntry[] = []
  private wallOfChampionsPanel?: Phaser.GameObjects.Container
  private wallOfChampionsRowsText?: Phaser.GameObjects.Text
  private wallOfChampionsEngravingText?: Phaser.GameObjects.Text
  private wallOfChampionsStatusText?: Phaser.GameObjects.Text
  private wallOfChampionsRevealAccent?: Phaser.GameObjects.Graphics
  private wallTopRankAccent?: Phaser.GameObjects.Graphics
  private wallRecentEntryAccent?: Phaser.GameObjects.Graphics
  private wallLocalToggleBacking?: Phaser.GameObjects.Rectangle
  private wallGlobalToggleBacking?: Phaser.GameObjects.Rectangle
  private wallLocalToggleText?: Phaser.GameObjects.Text
  private wallGlobalToggleText?: Phaser.GameObjects.Text
  private wallView: WallView = 'local'
  private globalWallState: GlobalWallState = 'idle'
  private globalChampions: ChampionEntry[] = []
  private globalLeaderboardRequestId = 0
  private gameOverPlateShadow?: Phaser.GameObjects.Rectangle
  private gameOverPlate?: Phaser.GameObjects.Rectangle
  private gameOverPlateTrim?: Phaser.GameObjects.Rectangle
  private championCeremonyDecor?: Phaser.GameObjects.Container
  private championCeremonyGlow?: Phaser.GameObjects.Graphics
  private initialsEntryPanel?: Phaser.GameObjects.Container
  private initialsSelectionMarker?: Phaser.GameObjects.Graphics
  private initialsSlotBackings: Phaser.GameObjects.Rectangle[] = []
  private initialsSlotTexts: Phaser.GameObjects.Text[] = []
  private initialsSaveButtonBacking?: Phaser.GameObjects.Rectangle
  private initialsSaveButtonText?: Phaser.GameObjects.Text
  private championInitials = ['A', 'A', 'A']
  private championInitialsTouched = [false, false, false]
  private selectedInitialIndex = 0
  private pendingChampionScore: number | null = null
  private awaitingChampionInitials = false
  private readonly audio = new XibalbaAudioManager()
  private audioToggleBacking?: Phaser.GameObjects.Rectangle
  private audioToggleIcon?: Phaser.GameObjects.Graphics
  private lastTrailAt = 0

  constructor() {
    super('PinballScene')
  }

  preload() {
    this.load.image(assets.playfield.key, assets.playfield.path)
    this.load.image(assets.titleCard.key, assets.titleCard.path)
  }

  create() {
    this.matter.world.setBounds(0, 0, tableLayout.table.width, tableLayout.table.height, 40, true, true, false, false)
    this.cameras.main.setBackgroundColor(theme.css.obsidian)

    this.add
      .image(assets.playfield.x, assets.playfield.y, assets.playfield.key)
      .setOrigin(0)
      .setDisplaySize(assets.playfield.width, assets.playfield.height)
      .setDepth(0)

    this.createBallTexture()
    this.playfieldGraphics = this.add.graphics().setDepth(2)
    this.debugGraphics = this.add.graphics().setDepth(30).setVisible(false)

    tableLayout.wallSegments.forEach((segment) => this.createStaticWallSegment(segment))
    tableLayout.posts.forEach((post) => this.createRoundedPost(post))
    tableLayout.sensors.forEach((sensor) => this.createSensor(sensor))
    tableLayout.trapKickers.forEach((zone) => this.createTrapKickerSensor(zone))
    tableLayout.bumpers.forEach((bumper) => this.createBumper(bumper))
    tableLayout.slingshots.forEach((sling) => this.createSling(sling))
    tableLayout.flippers.forEach((flipper) => this.createFlipper(flipper))

    this.spawnBall(tableLayout.ball.spawn, tableLayout.ball.resetVelocity)
    this.createPlungerVisual()
    this.highScore = this.loadHighScore()
    this.champions = loadWallOfChampions()
    this.createHud()
    this.createAudioToggle()
    this.createTouchHints()
    this.createStartOverlay()
    this.createPauseOverlay()
    this.createGameOverOverlay()
    this.bindInput()
    this.bindCollisions()
    this.drawRuntimeInsertUnderlays()
    this.setGameplayFrozen(true)
    void this.loadGlobalLeaderboard().catch(() => this.showGlobalWallUnavailable())
  }

  update(_time: number, delta: number) {
    this.updateKeyboardState()
    this.updateHud()

    if (!this.hasStarted || this.gamePaused) {
      return
    }

    this.updateFlippers(delta)
    this.updatePlunger()
    this.maybeAssistShooterExit()
    this.updateBallState()
    this.updateTrapKickers()
    this.updateAntiStuck()
    this.keepBallPlayable()
    this.updateBallSaverUi()
    this.updateMultiballTrail()

    if (this.debugEnabled) {
      this.drawDebugOverlay()
    }

    if (this.shotTestMode) {
      this.updateShotTestOverlay()
    }
  }

  private createStaticWallSegment(segment: WallSegment) {
    const { x, y, length, angle } = this.segmentTransform(segment.from, segment.to)
    const body = this.matter.add.rectangle(x, y, length, segment.thickness, {
      isStatic: true,
      label: `${segment.kind}:${segment.id}`,
      friction: 0.02,
      restitution: segment.restitution ?? tableLayout.tuning.wallBounce,
    })

    this.matter.body.setAngle(body, angle)
    this.collisionBodies.push(body)
    return body
  }

  private createRoundedPost(post: RoundedPost) {
    const body = this.matter.add.circle(post.x, post.y, post.radius, {
      isStatic: true,
      label: `${post.kind}:${post.id}`,
      friction: 0.01,
      restitution: post.restitution ?? tableLayout.tuning.rubberBounce,
    })

    this.collisionBodies.push(body)
    return body
  }

  private createSensor(sensor: SensorBody) {
    const body = this.matter.add.rectangle(sensor.x, sensor.y, sensor.width, sensor.height, {
      isStatic: true,
      isSensor: true,
      label: `${sensor.kind}:${sensor.id}`,
    })

    this.matter.body.setAngle(body, sensor.angle ?? 0)
    this.collisionBodies.push(body)

    if (sensor.kind === 'jackpot') {
      this.createJackpotVisual(sensor)
    }
    if (sensor.kind === 'rollover') {
      this.createRolloverVisual(sensor)
    }

    return body
  }

  private createJackpotVisual(sensor: SensorBody) {
    // Debug-only jackpot helper; static temple art and score flashes carry normal gameplay.
    this.jackpotVisual = this.add
      .rectangle(sensor.x, sensor.y, sensor.width, sensor.height, theme.ink, 0)
      .setStrokeStyle(2, theme.goldShadow, 0.28)
      .setDepth(29)
      .setVisible(false)
    this.jackpotVisual.rotation = sensor.angle ?? 0
  }

  private createRolloverVisual(sensor: SensorBody) {
    const alignment = tableLayout.visualAlignment.rollovers
    const rolloverIndex = Number.parseInt(sensor.id.replace('rollover-', ''), 10)
    const centerIndex = (this.rolloverCount() + 1) / 2
    const visualX = sensor.x + alignment.offsetX + (Number.isFinite(rolloverIndex) ? (rolloverIndex - centerIndex) * alignment.gapAdjust : 0)
    const visualY = sensor.y + alignment.offsetY
    const visualWidth = sensor.width * alignment.widthScale
    const visualHeight = sensor.height * alignment.heightScale
    const visual = this.add.container(visualX, visualY).setDepth(4)
    const backing = this.add
      .rectangle(0, 0, visualWidth + 16, visualHeight + 14, theme.ink, 0.66)
      .setStrokeStyle(3, theme.goldShadow, 0.46)
      .setName('backing')
    const insert = this.add
      .rectangle(0, 0, visualWidth, visualHeight, theme.obsidian, 0.9)
      .setStrokeStyle(3, theme.agedGold, 0.82)
      .setName('insert')
    const glow = this.add
      .rectangle(0, 0, visualWidth + 12, visualHeight + 12, theme.jade, 0)
      .setStrokeStyle(3, theme.brightJade, 0)
      .setName('glow')
    const glyph = this.add
      .triangle(0, 2, 0, -visualHeight * 0.24, visualWidth * 0.28, visualHeight * 0.22, -visualWidth * 0.28, visualHeight * 0.22, theme.jade, 0.26)
      .setStrokeStyle(2, theme.goldShadow, 0.5)
      .setName('glyph')

    visual.add([backing, glow, insert, glyph])
    visual.rotation = sensor.angle ?? 0
    this.rolloverVisuals.set(sensor.id, visual)
  }

  private createTrapKickerSensor(zone: TrapKickerZone) {
    const body = this.matter.add.rectangle(zone.x, zone.y, zone.width, zone.height, {
      isStatic: true,
      isSensor: true,
      label: `trapKicker:${zone.id}`,
    })

    this.collisionBodies.push(body)
    return body
  }

  private createBumper(bumper: BumperBody) {
    const body = this.matter.add.circle(bumper.x, bumper.y, bumper.radius, {
      isStatic: true,
      label: `bumper:${bumper.id}`,
      friction: 0,
      restitution: tableLayout.tuning.bumperBounce,
    })

    const visual = this.createBumperVisual(bumper)
    this.bumperVisuals.set(bumper.id, visual)
    this.collisionBodies.push(body)
    return body
  }

  private createBumperVisual(bumper: BumperBody) {
    const alignment = tableLayout.visualAlignment.bumpers
    const radius = bumper.radius * alignment.scale
    const position = this.visualBumperPosition(bumper)
    const visual = this.add.container(position.x, position.y).setDepth(6)
    const halo = this.add.circle(0, 0, radius * 1.22, theme.jade, 0.08).setStrokeStyle(3, theme.brightJade, 0.18)
    const hitGlow = this.add
      .circle(0, 0, radius * 1.05, theme.ember, 0.34)
      .setStrokeStyle(3, theme.brightJade, 0.42)
      .setAlpha(0)
      .setName('hitGlow')
    const cover = this.add.circle(0, 0, radius * 1.08, theme.ink, 0.58).setStrokeStyle(4, theme.goldShadow, 0.4)
    const outerRing = this.add.circle(0, 0, radius * 0.94, theme.goldShadow, 0.82).setStrokeStyle(7, theme.agedGold, 0.9)
    const bevel = this.add.circle(0, 0, radius * 0.73, theme.agedGold, 0.18).setStrokeStyle(3, theme.goldShadow, 0.58)
    const innerHousing = this.add.circle(0, 0, radius * 0.58, theme.obsidian, 0.94).setStrokeStyle(4, theme.goldShadow, 0.7)
    const coreGlow = this.add
      .circle(0, 0, radius * 0.39, theme.jade, 0.36)
      .setStrokeStyle(3, theme.brightJade, 0.66)
      .setName('coreGlow')
    const core = this.add.circle(0, 0, radius * 0.22, theme.brightJade, 0.78)
    const emberAccent = this.add.circle(0, 0, radius * 0.3, theme.ember, 0.1).setStrokeStyle(1, theme.ember, 0.3)
    const highlight = this.add.circle(-radius * 0.1, -radius * 0.12, radius * 0.06, theme.ivory, 0.42)

    visual.add([halo, hitGlow, cover, outerRing, bevel, innerHousing, emberAccent, coreGlow, core, highlight])

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const x = Math.cos(angle) * radius * 0.82
      const y = Math.sin(angle) * radius * 0.82
      visual.add(this.add.circle(x, y, radius * 0.06, theme.agedGold, 0.86))
    }

    return visual
  }

  private visualBumperPosition(bumper: BumperBody) {
    const alignment = tableLayout.visualAlignment.bumpers
    const perBumper = alignment.perBumper[bumper.id as keyof typeof alignment.perBumper] ?? { offsetX: 0, offsetY: 0 }

    return {
      x: bumper.x + alignment.offsetX + perBumper.offsetX,
      y: bumper.y + alignment.offsetY + perBumper.offsetY,
    }
  }

  private createSling(sling: SlingBody) {
    const { x, y, length, angle } = this.segmentTransform(sling.from, sling.to)
    const body = this.matter.add.rectangle(x, y, length, sling.thickness, {
      isStatic: true,
      label: `sling:${sling.id}`,
      friction: 0.01,
      restitution: tableLayout.tuning.rubberBounce,
    })

    this.matter.body.setAngle(body, angle)
    const visual = this.add
      .rectangle(x, y, length, sling.thickness, theme.goldShadow, 0.68)
      .setStrokeStyle(3, theme.agedGold, 0.72)
      .setDepth(5)
    visual.rotation = angle
    const insert = this.add
      .rectangle(x, y, length * 0.62, Math.max(6, sling.thickness * 0.28), theme.jade, 0.3)
      .setStrokeStyle(1, theme.brightJade, 0.42)
      .setDepth(5.1)
    insert.rotation = angle
    this.slingVisuals.set(sling.id, visual)
    this.collisionBodies.push(body)
    return body
  }

  private createFlipper(config: FlipperConfig) {
    const angle = Phaser.Math.DegToRad(tableLayout.tuning.flipperRestAngle[config.id])
    const center = this.pointFromPivot(config.pivot, angle, config.length / 2)
    const body = this.matter.add.rectangle(center.x, center.y, config.length, config.width, {
      isStatic: true,
      label: `flipper:${config.id}`,
      friction: 0.025,
      restitution: tableLayout.tuning.ballBounce,
      chamfer: { radius: config.width / 2 },
    })

    this.matter.body.setAngle(body, angle)

    const visual = this.createFlipperHardwareVisual(config, center, angle)
    const accent = this.createFlipperAccentVisual(config, center, angle)

    this.flippers.push({ config, body, visual, accent, currentAngle: angle, lastImpulseAt: 0, pressed: false })
    this.collisionBodies.push(body)
    return body
  }

  private createFlipperHardwareVisual(config: FlipperConfig, center: Point, angle: number) {
    const length = config.length
    const width = config.width
    const pivotRadius = width * 0.74
    const tipRadius = width * 0.46
    const pivotX = -length / 2 + pivotRadius
    const tipX = length / 2 - tipRadius
    const bodyLength = tipX - pivotX
    const bodyCenterX = (pivotX + tipX) / 2
    const visual = this.add.container(center.x, center.y).setDepth(7)

    const shadowOffsetX = 2
    const shadowOffsetY = 4
    const shadow = [
      this.add.rectangle(bodyCenterX + shadowOffsetX, shadowOffsetY, bodyLength, width + 10, theme.ink, 0.46),
      this.add.circle(pivotX + shadowOffsetX, shadowOffsetY, pivotRadius + 5, theme.ink, 0.46),
      this.add.circle(tipX + shadowOffsetX, shadowOffsetY, tipRadius + 5, theme.ink, 0.46),
    ]

    const goldShell = [
      this.add.rectangle(bodyCenterX, 0, bodyLength, width + 7, theme.goldShadow, 0.96),
      this.add.circle(pivotX, 0, pivotRadius + 3.5, theme.goldShadow, 0.96),
      this.add.circle(tipX, 0, tipRadius + 3.5, theme.goldShadow, 0.96),
    ]

    const obsidianBody = [
      this.add
        .rectangle(bodyCenterX, 0, bodyLength, width, theme.obsidian, 0.99)
        .setStrokeStyle(2, theme.agedGold, 0.58),
      this.add
        .circle(pivotX, 0, pivotRadius, theme.obsidian, 0.99)
        .setStrokeStyle(3, theme.agedGold, 0.86),
      this.add
        .circle(tipX, 0, tipRadius, theme.obsidian, 0.99)
        .setStrokeStyle(2, theme.agedGold, 0.76),
    ]

    const bevels = [
      this.add.rectangle(bodyCenterX, -width * 0.36, bodyLength * 0.88, 3, theme.agedGold, 0.54),
      this.add.rectangle(bodyCenterX, width * 0.37, bodyLength * 0.82, 2, theme.goldShadow, 0.56),
      this.add.circle(pivotX - pivotRadius * 0.18, -pivotRadius * 0.2, pivotRadius * 0.18, theme.ivory, 0.18),
    ]

    const pivotCap = [
      this.add.circle(pivotX, 0, pivotRadius * 0.68, theme.goldShadow, 0.92).setStrokeStyle(3, theme.agedGold, 0.9),
      this.add.circle(pivotX, 0, pivotRadius * 0.43, theme.charcoal, 0.98).setStrokeStyle(2, theme.goldShadow, 0.7),
      this.add.circle(pivotX, 0, pivotRadius * 0.18, theme.jade, 0.68).setStrokeStyle(1, theme.brightJade, 0.5),
    ]

    visual.add([...shadow, ...goldShell, ...obsidianBody, ...bevels, ...pivotCap])
    visual.rotation = angle
    return visual
  }

  private createFlipperAccentVisual(config: FlipperConfig, center: Point, angle: number) {
    const length = config.length
    const width = config.width
    const pivotRadius = width * 0.74
    const tipRadius = width * 0.46
    const pivotX = -length / 2 + pivotRadius
    const tipX = length / 2 - tipRadius
    const accent = this.add.container(center.x, center.y).setDepth(7.2)
    const inlayLength = length * 0.48
    const inlayX = pivotX + pivotRadius + inlayLength * 0.46

    const inlay = this.add
      .rectangle(inlayX, 0, inlayLength, Math.max(5, width * 0.18), theme.jade, 0.58)
      .setStrokeStyle(1, theme.brightJade, 0.55)
    const inlayGlow = this.add.rectangle(inlayX, 0, inlayLength * 0.82, Math.max(2, width * 0.08), theme.brightJade, 0.28)
    const centerRune = this.add
      .triangle(inlayX, 0, 0, -width * 0.18, width * 0.18, width * 0.14, -width * 0.18, width * 0.14, theme.agedGold, 0.66)
      .setStrokeStyle(1, theme.goldShadow, 0.5)
    const runeTicks = [
      this.add.rectangle(inlayX - inlayLength * 0.28, 0, 3, width * 0.32, theme.agedGold, 0.62),
      this.add.rectangle(inlayX + inlayLength * 0.28, 0, 3, width * 0.32, theme.agedGold, 0.62),
      this.add.circle(inlayX - inlayLength * 0.12, 0, 2.2, theme.brightJade, 0.52),
      this.add.circle(inlayX + inlayLength * 0.12, 0, 2.2, theme.brightJade, 0.52),
    ]
    const tipInsert = this.add
      .circle(tipX, 0, tipRadius * 0.54, theme.eclipseRed, 0.68)
      .setStrokeStyle(2, theme.ember, 0.76)
    const tipSpark = this.add.circle(tipX + tipRadius * 0.14, -tipRadius * 0.16, tipRadius * 0.2, theme.ember, 0.66)
    const goldPins = [
      this.add.circle(pivotX + pivotRadius * 1.12, -width * 0.34, 2.6, theme.agedGold, 0.8),
      this.add.circle(tipX - tipRadius * 1.18, width * 0.34, 2.4, theme.agedGold, 0.78),
    ]

    accent.add([inlay, inlayGlow, centerRune, ...runeTicks, tipInsert, tipSpark, ...goldPins])
    accent.rotation = angle
    return accent
  }

  private spawnBall(position: Point, velocity: Point): BallRuntime {
    // BALLS: every active ball is tracked here so drains, nudges, and scoring can target one ball at a time.
    const image = this.matter.add.image(position.x, position.y, 'ball')
    image.setCircle(tableLayout.ball.radius)
    image.setBounce(tableLayout.tuning.ballBounce)
    image.setFriction(tableLayout.tuning.ballFriction, 0.002, 0.01)
    image.setFrictionAir(tableLayout.tuning.ballFrictionAir)
    image.setMass(0.55)
    image.setDepth(10)
    image.setVelocity(velocity.x, velocity.y)
    image.setAngularVelocity(0)

    const body = image.body as MatterJS.BodyType
    const ball = { id: this.nextBallId, image, body, lastMotionAt: this.time.now, lastDrainAt: 0 }
    this.nextBallId += 1
    body.label = `ball:${ball.id}`

    this.balls.push(ball)
    this.collisionBodies.push(body)
    return ball
  }

  private createBallTexture() {
    if (this.textures.exists('ball')) {
      return
    }

    const radius = tableLayout.ball.radius
    const visual = tableLayout.ball.visual
    const edgeAlpha = Phaser.Math.Clamp(visual.edgeShadeStrength, 0, 1)
    const highlightAlpha = Phaser.Math.Clamp(visual.highlightStrength, 0, 1)
    const graphics = this.make.graphics({ x: 0, y: 0 }, false)

    graphics.fillStyle(0x07080a, 1)
    graphics.fillCircle(radius, radius, radius)

    graphics.fillStyle(0x2b3036, edgeAlpha)
    graphics.fillCircle(radius, radius, radius * 0.94)
    graphics.fillStyle(0x66717c, 1)
    graphics.fillCircle(radius - radius * 0.05, radius - radius * 0.05, radius * 0.78)
    graphics.fillStyle(0xd7dee4, 0.96)
    graphics.fillCircle(radius - radius * 0.12, radius - radius * 0.16, radius * 0.58)
    graphics.fillStyle(0xf9fbff, 0.72)
    graphics.fillCircle(radius - radius * 0.26, radius - radius * 0.33, radius * 0.28)

    graphics.fillStyle(theme.agedGold, 0.26)
    graphics.fillEllipse(radius + radius * 0.2, radius + radius * 0.24, radius * 1.02, radius * 0.44)
    graphics.fillStyle(theme.jade, 0.18)
    graphics.fillEllipse(radius - radius * 0.08, radius + radius * 0.4, radius * 0.92, radius * 0.34)
    graphics.fillStyle(0x15181d, 0.32)
    graphics.fillEllipse(radius + radius * 0.28, radius - radius * 0.02, radius * 0.72, radius * 0.22)

    graphics.fillStyle(0xffffff, highlightAlpha)
    graphics.fillCircle(radius - radius * 0.38, radius - radius * 0.42, radius * 0.16)
    graphics.fillStyle(0xffffff, highlightAlpha * 0.44)
    graphics.fillCircle(radius - radius * 0.18, radius - radius * 0.28, radius * 0.08)

    graphics.lineStyle(3, 0x090a0d, 1)
    graphics.strokeCircle(radius, radius, radius - 1.5)
    graphics.lineStyle(1, 0xf7fbff, 0.62)
    graphics.strokeCircle(radius, radius, radius - 3.5)
    graphics.generateTexture('ball', radius * 2, radius * 2)
    graphics.destroy()
  }

  private createPlungerVisual() {
    const plunger = tableLayout.plunger
    const alignment = tableLayout.visualAlignment.plunger
    const visualX = plunger.x + alignment.offsetX
    const visualRestY = plunger.restY + alignment.offsetY
    const visualWidth = alignment.width
    const visualHeight = alignment.height
    this.add
      .rectangle(visualX, visualRestY - 250, visualWidth + 20, 548, theme.ink, 0.12)
      .setStrokeStyle(1, theme.goldShadow, 0.22)
      .setDepth(5.4)
    this.add
      .rectangle(visualX - visualWidth * 0.56, visualRestY - 250, 3, 512, theme.agedGold, 0.34)
      .setDepth(5.5)
    this.add
      .rectangle(visualX + visualWidth * 0.56, visualRestY - 250, 3, 512, theme.agedGold, 0.34)
      .setDepth(5.5)
    this.add
      .rectangle(visualX, visualRestY - 250, visualWidth * 0.34, 470, theme.obsidian, 0.26)
      .setStrokeStyle(1, theme.goldShadow, 0.2)
      .setDepth(5.55)

    const handle = this.add
      .rectangle(0, 0, visualWidth, visualHeight, theme.goldShadow, 0.74)
      .setStrokeStyle(2, theme.agedGold, 0.76)
    const grip = this.add.rectangle(0, -visualHeight * 0.08, visualWidth * 0.38, visualHeight * 0.58, theme.obsidian, 0.78)
    const accent = this.add
      .rectangle(0, visualHeight * 0.26, visualWidth * 0.42, 6, theme.jade, 0.52)
      .setStrokeStyle(1, theme.brightJade, 0.38)
      .setName('accent')
    const chargeGlow = this.add
      .circle(0, -visualHeight * 0.36, visualWidth * 0.2, theme.ember, 0.12)
      .setStrokeStyle(1, theme.agedGold, 0.38)
      .setName('chargeGlow')

    this.plungerVisual = this.add.container(visualX, visualRestY, [handle, grip, accent, chargeGlow]).setDepth(6.4)
  }

  private createHud() {
    this.add
      .rectangle(18, 18, 452, 124, theme.ink, 0.6)
      .setOrigin(0)
      .setStrokeStyle(2, theme.agedGold, 0.56)
      .setDepth(39)

    this.add
      .rectangle(tableLayout.table.width - 478, 18, 460, 124, theme.ink, 0.6)
      .setOrigin(0)
      .setStrokeStyle(2, theme.agedGold, 0.56)
      .setDepth(39)

    this.scoreText = this.add
      .text(24, 22, 'SCORE 0', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '29px',
        color: theme.css.ivory,
        stroke: theme.css.ink,
        strokeThickness: 6,
      })
      .setDepth(40)

    this.highScoreText = this.add
      .text(tableLayout.table.width - 24, 22, `HIGH ${this.highScore}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '24px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setDepth(40)

    this.controlsText = this.add
      .text(24, 60, 'A/LEFT + D/RIGHT FLIPPERS   SPACE/DOWN LAUNCH   P PAUSE   R RESTART', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '13px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 3,
      })
      .setDepth(40)
      .setAlpha(0.72)

    this.ballStateText = this.add
      .text(24, 84, this.ballHudLabel(), {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '17px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 5,
      })
      .setDepth(40)
      .setAlpha(1)

    this.ballSaveText = this.add
      .text(tableLayout.table.width - 24, 54, 'BALL SAVE', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '22px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setDepth(42)
      .setVisible(false)

    this.rolloverText = this.add
      .text(24, 108, `ROLLOVERS 0/${this.rolloverCount()}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '15px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 4,
      })
      .setDepth(40)
      .setAlpha(0.96)

    this.eclipseStateText = this.add
      .text(tableLayout.table.width - 24, 84, 'STATE NORMAL', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '17px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 4,
      })
      .setOrigin(1, 0)
      .setDepth(40)
      .setAlpha(0.96)

    this.devModeText = this.add
      .text(tableLayout.table.width - 24, 112, 'DEV MODE', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '13px',
        color: theme.css.ember,
        stroke: theme.css.ink,
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(46)
      .setVisible(false)

    this.visualAlignmentText = this.add
      .text(tableLayout.table.width - 24, 134, this.visualAlignmentSummary(), {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '12px',
        color: theme.css.goldShadow,
        stroke: theme.css.ink,
        strokeThickness: 3,
        align: 'right',
        lineSpacing: 4,
      })
      .setOrigin(1, 0)
      .setDepth(46)
      .setVisible(false)

    this.shotTestText = this.add
      .text(24, 134, '', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 4,
        lineSpacing: 4,
      })
      .setDepth(46)
      .setVisible(false)
  }

  private createAudioToggle() {
    const button = this.add.container(tableLayout.table.width / 2, 60).setDepth(100)
    this.audioToggleBacking = this.add
      .rectangle(0, 0, 112, 78, theme.ink, 0.84)
      .setStrokeStyle(3, theme.goldShadow, 0.72)
      .setAlpha(0.86)
    this.audioToggleIcon = this.add.graphics()
    button.add([this.audioToggleBacking, this.audioToggleIcon])
    button.setSize(112, 78)
    button.setInteractive(new Phaser.Geom.Rectangle(-56, -39, 112, 78), Phaser.Geom.Rectangle.Contains)
    button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      const muted = this.audio.toggleMuted()
      this.updateAudioToggle()
      if (!muted) {
        void this.audio.unlock().then((unlocked) => {
          if (unlocked) {
            this.audio.playUnmute()
          }
        })
      }
    })
    button.on('pointerover', () => this.audioToggleBacking?.setAlpha(1))
    button.on('pointerout', () => this.audioToggleBacking?.setAlpha(0.86))
    this.updateAudioToggle()
  }

  private updateAudioToggle() {
    const muted = this.audio.isMuted()
    this.audioToggleBacking
      ?.setFillStyle(muted ? theme.charcoal : theme.obsidian, 0.9)
      .setStrokeStyle(3, muted ? theme.ember : theme.agedGold, muted ? 0.76 : 0.82)

    const icon = this.audioToggleIcon
    if (!icon) {
      return
    }

    icon.clear()
    icon.fillStyle(muted ? theme.goldShadow : theme.bone, 0.96)
    icon.fillRect(-24, -8, 10, 16)
    icon.fillTriangle(-14, -9, 2, -21, 2, 21)
    if (muted) {
      icon.lineStyle(6, theme.ember, 0.96)
      icon.lineBetween(12, -18, 34, 18)
      icon.lineStyle(2, theme.ink, 0.88)
      icon.lineBetween(15, -18, 37, 18)
      return
    }

    icon.lineStyle(4, theme.brightJade, 0.82)
    icon.beginPath()
    icon.arc(4, 0, 15, -0.8, 0.8, false)
    icon.strokePath()
    icon.lineStyle(3, theme.agedGold, 0.78)
    icon.beginPath()
    icon.arc(4, 0, 27, -0.72, 0.72, false)
    icon.strokePath()
  }

  private createTouchHints() {
    const hintStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: '18px',
      color: theme.css.agedGold,
      stroke: theme.css.ink,
      strokeThickness: 4,
    }

    this.touchHintLeft = this.add
      .text(62, tableLayout.table.height - 152, 'LEFT FLIP', hintStyle)
      .setDepth(38)
      .setAlpha(0.2)

    this.touchHintRight = this.add
      .text(tableLayout.table.width - 62, tableLayout.table.height - 152, 'RIGHT FLIP', hintStyle)
      .setOrigin(1, 0)
      .setDepth(38)
      .setAlpha(0.2)

    this.touchHintLaunch = this.add
      .text(tableLayout.table.width - 62, tableLayout.table.height - 300, 'LAUNCH', hintStyle)
      .setOrigin(1, 0)
      .setDepth(38)
      .setAlpha(0.24)
  }

  private createStartOverlay() {
    const titleArt = this.add
      .image(assets.titleCard.x, assets.titleCard.y, assets.titleCard.key)
      .setOrigin(0)
      .setDisplaySize(assets.titleCard.width, assets.titleCard.height)
      .setDepth(90)

    const textPlate = this.add
      .rectangle(tableLayout.table.width / 2, 1035, 690, 360, theme.ink, 0.62)
      .setStrokeStyle(3, theme.goldShadow, 0.54)
      .setDepth(90.6)

    const high = this.add
      .text(tableLayout.table.width / 2, 905, `HIGH SCORE ${this.highScore}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '24px',
        color: theme.css.brightJade,
        stroke: theme.css.ink,
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('startHighScore')
      .setDepth(91)

    const prompt = this.add
      .text(tableLayout.table.width / 2, 1000, 'Tap / Press Space to Start', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '34px',
        color: theme.css.ivory,
        stroke: theme.css.ink,
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('startPrompt')
      .setDepth(91)

    const controls = this.add
      .text(
        tableLayout.table.width / 2,
        1128,
        ['A / Left  left flipper', 'D / Right  right flipper', 'Space / Down  launch', 'P pause   R restart'].join('\n'),
        {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '22px',
          color: theme.css.bone,
          stroke: theme.css.ink,
          strokeThickness: 4,
          align: 'center',
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5)
      .setDepth(91)

    this.startDevHint = this.add
      .text(tableLayout.table.width / 2, 1292, 'DEV MODE  •  B COLLISIONS  •  T SHOT TEST  •  M MULTIBALL', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '16px',
        color: theme.css.goldShadow,
        stroke: theme.css.ink,
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(91)
      .setVisible(false)

    this.wallOfChampionsPanel = this.createWallOfChampionsPanel(this.champions)

    this.startOverlay = this.add
      .container(0, 0, [titleArt, textPlate, high, prompt, controls, this.startDevHint, this.wallOfChampionsPanel])
      .setDepth(90)
  }

  private createWallOfChampionsPanel(champions: ChampionEntry[]) {
    const width = 700
    const height = 400
    const panel = this.add.container(tableLayout.table.width / 2, 1512).setDepth(91)
    const stone = this.add.graphics()

    stone.fillStyle(theme.ink, 0.7)
    stone.fillRoundedRect(-width / 2 + 10, -height / 2 + 14, width, height, 8)
    stone.fillStyle(theme.ink, 0.94)
    stone.fillRoundedRect(-width / 2, -height / 2, width, height, 8)
    stone.fillStyle(theme.charcoal, 0.7)
    stone.fillRoundedRect(-width / 2 + 12, -height / 2 + 12, width - 24, height - 24, 5)
    stone.fillStyle(theme.obsidian, 0.54)
    stone.fillRoundedRect(-width / 2 + 24, -height / 2 + 24, width - 48, height - 48, 3)
    stone.lineStyle(9, theme.goldShadow, 0.76)
    stone.strokeRoundedRect(-width / 2, -height / 2, width, height, 8)
    stone.lineStyle(3, theme.agedGold, 0.94)
    stone.strokeRoundedRect(-width / 2 + 11, -height / 2 + 11, width - 22, height - 22, 5)
    stone.lineStyle(2, theme.jade, 0.42)
    stone.strokeRoundedRect(-width / 2 + 25, -height / 2 + 25, width - 50, height - 50, 3)

    stone.fillStyle(theme.jade, 0.13)
    stone.fillTriangle(-width / 2 + 34, -height / 2 + 36, -width / 2 + 98, -height / 2 + 36, -width / 2 + 66, -height / 2 + 84)
    stone.fillTriangle(width / 2 - 34, -height / 2 + 36, width / 2 - 98, -height / 2 + 36, width / 2 - 66, -height / 2 + 84)
    stone.fillStyle(theme.ember, 0.24)
    stone.fillCircle(-width / 2 + 44, height / 2 - 42, 9)
    stone.fillCircle(width / 2 - 44, height / 2 - 42, 9)

    for (let index = 0; index < 10; index += 1) {
      const x = -width / 2 + 63 + index * 64
      const topY = -height / 2 + 18
      const bottomY = height / 2 - 18
      stone.fillStyle(index % 2 === 0 ? theme.agedGold : theme.goldShadow, 0.5)
      stone.fillRect(x, topY, 20, 4)
      stone.fillRect(x + 8, topY + 6, 4, 12)
      stone.fillStyle(theme.jade, 0.18)
      stone.fillRect(x, bottomY - 4, 20, 4)
      stone.fillRect(x + 8, bottomY - 18, 4, 12)
    }

    const title = this.add
      .text(0, -165, 'WALL OF CHAMPIONS', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '29px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 2, theme.css.ink, 8, true, true)

    const localToggle = this.createWallToggleButton('LOCAL', -140, -111, () => this.selectWall('local'))
    const globalToggle = this.createWallToggleButton('GLOBAL', 140, -111, () => this.selectWall('global'))
    this.wallLocalToggleBacking = localToggle.backing
    this.wallGlobalToggleBacking = globalToggle.backing
    this.wallLocalToggleText = localToggle.text
    this.wallGlobalToggleText = globalToggle.text

    const divider = this.add.graphics()
    divider.lineStyle(3, theme.goldShadow, 0.6)
    divider.lineBetween(-244, -60, 244, -60)
    divider.lineStyle(1, theme.brightJade, 0.38)
    divider.lineBetween(-198, -50, 198, -50)
    divider.fillStyle(theme.ember, 0.24)
    divider.fillCircle(0, -56, 17)
    divider.fillStyle(theme.agedGold, 0.72)
    divider.fillTriangle(-22, -56, -8, -66, -8, -46)
    divider.fillTriangle(22, -56, 8, -66, 8, -46)
    divider.fillStyle(theme.ink, 0.98)
    divider.fillCircle(0, -59, 11)
    divider.fillRect(-7, -57, 14, 12)
    divider.lineStyle(2, theme.agedGold, 0.82)
    divider.strokeCircle(0, -59, 11)
    divider.fillStyle(theme.brightJade, 0.7)
    divider.fillCircle(-4, -60, 2)
    divider.fillCircle(4, -60, 2)
    divider.fillStyle(theme.goldShadow, 0.82)
    divider.fillRect(-5, -51, 3, 4)
    divider.fillRect(2, -51, 3, 4)

    const rowsBacking = this.add.graphics()
    for (let index = 0; index < 3; index += 1) {
      const rowY = -29 + index * 56
      rowsBacking.fillStyle(index === 0 ? theme.goldShadow : index % 2 === 0 ? theme.obsidian : theme.ink, index === 0 ? 0.22 : 0.56)
      rowsBacking.fillRoundedRect(-268, rowY - 21, 536, 42, 4)
      rowsBacking.lineStyle(1, index === 0 ? theme.agedGold : theme.goldShadow, index === 0 ? 0.52 : 0.26)
      rowsBacking.strokeRoundedRect(-268, rowY - 21, 536, 42, 4)
      rowsBacking.fillStyle(index === 0 ? theme.brightJade : theme.jade, index === 0 ? 0.24 : 0.12)
      rowsBacking.fillRect(-255, rowY - 11, 5, 22)
      rowsBacking.fillRect(250, rowY - 11, 5, 22)
    }

    const topRankAccent = this.add.graphics()
    topRankAccent.fillStyle(theme.jade, 0.22)
    topRankAccent.fillRoundedRect(-263, -49, 526, 40, 4)
    topRankAccent.lineStyle(2, theme.agedGold, 0.78)
    topRankAccent.strokeRoundedRect(-263, -49, 526, 40, 4)
    topRankAccent.fillStyle(theme.brightJade, 0.54)
    topRankAccent.fillTriangle(-252, -29, -244, -36, -244, -22)
    topRankAccent.fillTriangle(252, -29, 244, -36, 244, -22)
    topRankAccent.setAlpha(0.18)
    this.wallTopRankAccent = topRankAccent

    const recentEntryAccent = this.add.graphics()
    recentEntryAccent.fillStyle(theme.agedGold, 0.24)
    recentEntryAccent.fillRoundedRect(-263, -20, 526, 40, 4)
    recentEntryAccent.lineStyle(3, theme.brightJade, 0.94)
    recentEntryAccent.strokeRoundedRect(-263, -20, 526, 40, 4)
    recentEntryAccent.fillStyle(theme.ember, 0.78)
    recentEntryAccent.fillCircle(-250, 0, 4)
    recentEntryAccent.fillCircle(250, 0, 4)
    recentEntryAccent.setVisible(false)
    this.wallRecentEntryAccent = recentEntryAccent

    const engravingRows = this.add
      .text(-228, -46, this.wallOfChampionsRows(champions, 'local'), {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '32px',
        color: theme.css.goldShadow,
        lineSpacing: 17,
      })
      .setOrigin(0, 0)
      .setAlpha(0.34)
    this.wallOfChampionsEngravingText = engravingRows

    const rows = this.add
      .text(-230, -48, this.wallOfChampionsRows(champions, 'local'), {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '32px',
        color: theme.css.ivory,
        stroke: theme.css.ink,
        strokeThickness: 6,
        lineSpacing: 17,
      })
      .setOrigin(0, 0)
      .setShadow(0, 2, theme.css.ink, 6, true, true)
    this.wallOfChampionsRowsText = rows

    const status = this.add
      .text(0, 165, 'LOCAL WALL', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '16px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.88)
    this.wallOfChampionsStatusText = status

    const sideGlyphs = this.add.graphics()
    ;[-1, 1].forEach((side) => {
      const x = side * 304
      sideGlyphs.lineStyle(2, theme.goldShadow, 0.54)
      sideGlyphs.strokeTriangle(x, -31, x + side * 23, -13, x, 5)
      sideGlyphs.strokeTriangle(x, 27, x + side * 23, 45, x, 63)
      sideGlyphs.fillStyle(theme.jade, 0.2)
      sideGlyphs.fillCircle(x + side * 9, 91, 6)
    })

    const revealAccent = this.add.graphics()
    revealAccent.lineStyle(4, theme.brightJade, 0.72)
    revealAccent.strokeRoundedRect(-width / 2 + 20, -height / 2 + 20, width - 40, height - 40, 4)
    revealAccent.fillStyle(theme.ember, 0.7)
    revealAccent.fillCircle(-width / 2 + 44, height / 2 - 42, 5)
    revealAccent.fillCircle(width / 2 - 44, height / 2 - 42, 5)
    revealAccent.setAlpha(0.18)
    this.wallOfChampionsRevealAccent = revealAccent

    panel.add([
      stone,
      title,
      localToggle.button,
      globalToggle.button,
      divider,
      rowsBacking,
      topRankAccent,
      recentEntryAccent,
      engravingRows,
      rows,
      status,
      sideGlyphs,
      revealAccent,
    ])
    this.updateWallToggleControls()
    this.tweens.add({
      targets: topRankAccent,
      alpha: 0.38,
      duration: 1700,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
    return panel
  }

  private createWallToggleButton(label: 'LOCAL' | 'GLOBAL', x: number, y: number, onPress: () => void) {
    const width = 250
    const height = 64
    const button = this.add.container(x, y)
    const frame = this.add.graphics()
    frame.fillStyle(theme.ink, 0.72)
    frame.fillRoundedRect(-width / 2 + 4, -height / 2 + 7, width, height, 5)
    frame.fillStyle(theme.goldShadow, 0.72)
    frame.fillRoundedRect(-width / 2, -height / 2, width, height, 5)
    frame.lineStyle(2, theme.agedGold, 0.72)
    frame.strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 3)
    frame.lineStyle(1, theme.jade, 0.5)
    frame.lineBetween(-width / 2 + 18, -height / 2 + 12, -width / 2 + 46, -height / 2 + 12)
    frame.lineBetween(width / 2 - 46, height / 2 - 12, width / 2 - 18, height / 2 - 12)
    frame.setAlpha(0.78)

    const backing = this.add
      .rectangle(0, 0, width - 18, height - 18, theme.obsidian, 0.94)
      .setStrokeStyle(2, theme.goldShadow, 0.64)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '20px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)

    button.add([frame, backing, text])
    button.setSize(width + 16, height + 16)
    button.setInteractive(
      new Phaser.Geom.Rectangle(-(width + 16) / 2, -(height + 16) / 2, width + 16, height + 16),
      Phaser.Geom.Rectangle.Contains,
    )
    button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      button.setScale(0.97)
      frame.setAlpha(1)
      this.time.delayedCall(90, () => button.setScale(1))
      onPress()
    })
    button.on('pointerup', () => button.setScale(1))
    button.on('pointerover', () => frame.setAlpha(1))
    button.on('pointerout', () => {
      button.setScale(1)
      frame.setAlpha(0.78)
    })

    return { button, backing, text }
  }

  private wallOfChampionsRows(champions: ChampionEntry[], view: WallView) {
    if (champions.length === 0) {
      return view === 'global' ? '      AWAITING CHAMPIONS' : '       NO SCORES CARVED'
    }

    return champions
      .slice(0, WALL_DISPLAY_LIMIT)
      .map((champion, index) => `${index + 1}.  ${champion.initials.padEnd(3, ' ')}        ${champion.score.toLocaleString('en-US').padStart(7, ' ')}`)
      .join('\n')
  }

  private updateWallOfChampionsPanel(champions: ChampionEntry[], view: WallView) {
    const rows = this.wallOfChampionsRows(champions, view)
    this.wallOfChampionsRowsText?.setText(rows)
    this.wallOfChampionsEngravingText?.setText(rows)
    this.wallTopRankAccent?.setVisible(champions.length > 0)
  }

  private selectWall(view: WallView) {
    if (view === 'local') {
      this.globalLeaderboardRequestId += 1
      if (this.globalWallState === 'loading') {
        this.globalWallState = this.globalChampions.length > 0 ? 'ready' : 'idle'
      }
      this.showLocalWall()
      return
    }

    if (this.globalWallState !== 'loading') {
      void this.loadGlobalLeaderboard().catch(() => this.showGlobalWallUnavailable())
    }
  }

  private async loadGlobalLeaderboard() {
    const requestId = ++this.globalLeaderboardRequestId
    const showCachedGlobalScores = this.globalWallState === 'ready'
    this.globalWallState = 'loading'
    this.wallView = 'global'
    this.updateWallOfChampionsPanel(showCachedGlobalScores ? this.globalChampions : [], 'global')
    this.updateWallToggleControls()
    this.setWallStatus('CONTACTING TEMPLE...', 'loading')

    const scores = await fetchGlobalScores()
    if (requestId !== this.globalLeaderboardRequestId) {
      return
    }

    if (scores === null) {
      this.showGlobalWallUnavailable()
      return
    }

    this.globalChampions = scores.slice(0, GLOBAL_WALL_CACHE_LIMIT)
    this.globalWallState = 'ready'
    this.clearRecentWallHighlight()
    this.showGlobalWall()
  }

  private async submitChampionGlobally(initials: string, score: number) {
    const requestId = ++this.globalLeaderboardRequestId
    this.globalWallState = 'loading'
    this.wallView = 'global'
    this.updateWallOfChampionsPanel(
      this.globalChampions.length > 0 ? this.globalChampions : this.champions,
      this.globalChampions.length > 0 ? 'global' : 'local',
    )
    this.updateWallToggleControls()
    this.setWallStatus('CONTACTING TEMPLE...', 'loading')

    const submittedScores = await submitGlobalScore(initials, score, GLOBAL_LEADERBOARD_VERSION)
    if (requestId !== this.globalLeaderboardRequestId) {
      return
    }

    if (submittedScores === null) {
      this.showGlobalWallUnavailable(true)
      return
    }

    const refreshedScores = await fetchGlobalScores()
    if (requestId !== this.globalLeaderboardRequestId) {
      return
    }

    this.globalChampions = (refreshedScores ?? submittedScores).slice(0, GLOBAL_WALL_CACHE_LIMIT)
    this.globalWallState = 'ready'
    this.clearRecentWallHighlight()
    this.showGlobalWall('SCORE SENT TO GLOBAL WALL')
    const displayedScores = this.globalChampions.slice(0, WALL_DISPLAY_LIMIT)
    const globalRank = displayedScores.findIndex((champion) => champion.initials === initials && champion.score === score)
    this.highlightWallEntry(globalRank, displayedScores.length)
  }

  private showLocalWall(status = 'LOCAL WALL', tone: WallStatusTone = 'local') {
    this.wallView = 'local'
    this.updateWallOfChampionsPanel(this.champions, 'local')
    this.updateWallToggleControls()
    this.setWallStatus(status, tone)
  }

  private showGlobalWall(status = 'GLOBAL WALL') {
    this.wallView = 'global'
    this.updateWallOfChampionsPanel(this.globalChampions, 'global')
    this.updateWallToggleControls()
    this.setWallStatus(status, 'global')
  }

  private showGlobalWallUnavailable(savedLocally = false) {
    this.globalWallState = 'unreachable'
    this.showLocalWall(
      savedLocally ? 'SAVED LOCALLY  •  GLOBAL WALL UNREACHABLE' : 'GLOBAL WALL UNREACHABLE  •  LOCAL WALL ACTIVE',
      'warning',
    )
  }

  private setWallStatus(message: string, tone: WallStatusTone) {
    const statusColors: Record<WallStatusTone, string> = {
      local: theme.css.agedGold,
      global: theme.css.brightJade,
      loading: theme.css.bone,
      warning: theme.css.agedGold,
    }
    this.wallOfChampionsStatusText
      ?.setText(message)
      .setFontSize(message.length > 30 ? 14 : 16)
      .setColor(statusColors[tone])
      .setAlpha(tone === 'loading' ? 0.72 : tone === 'warning' ? 0.82 : 0.94)
  }

  private updateWallToggleControls() {
    const localActive = this.wallView === 'local'
    const globalActive = this.wallView === 'global'

    this.wallLocalToggleBacking
      ?.setFillStyle(localActive ? theme.goldShadow : theme.obsidian, localActive ? 0.88 : 0.94)
      .setStrokeStyle(localActive ? 3 : 2, localActive ? theme.agedGold : theme.goldShadow, localActive ? 0.94 : 0.54)
    this.wallGlobalToggleBacking
      ?.setFillStyle(globalActive ? theme.jade : theme.obsidian, globalActive ? 0.68 : 0.94)
      .setStrokeStyle(globalActive ? 3 : 2, globalActive ? theme.brightJade : theme.goldShadow, globalActive ? 0.94 : 0.54)
    this.wallLocalToggleText?.setColor(localActive ? theme.css.ivory : theme.css.goldShadow).setAlpha(localActive ? 1 : 0.76)
    this.wallGlobalToggleText?.setColor(globalActive ? theme.css.ivory : theme.css.goldShadow).setAlpha(globalActive ? 1 : 0.76)
  }

  private clearRecentWallHighlight() {
    if (!this.wallRecentEntryAccent) {
      return
    }

    this.tweens.killTweensOf(this.wallRecentEntryAccent)
    this.wallRecentEntryAccent.setVisible(false)
  }

  private createPauseOverlay() {
    const scrim = this.add
      .rectangle(tableLayout.table.width / 2, tableLayout.table.height / 2, tableLayout.table.width, tableLayout.table.height, theme.obsidian, 0.56)
      .setDepth(80)

    const label = this.add
      .text(tableLayout.table.width / 2, tableLayout.table.height / 2, 'PAUSED\nP to resume', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '44px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 7,
        align: 'center',
        lineSpacing: 16,
      })
      .setOrigin(0.5)
      .setDepth(81)

    this.pauseOverlay = this.add.container(0, 0, [scrim, label]).setDepth(80).setVisible(false)
  }

  private createGameOverOverlay() {
    const scrim = this.add
      .rectangle(tableLayout.table.width / 2, tableLayout.table.height / 2, tableLayout.table.width, tableLayout.table.height, theme.obsidian, 0.76)
      .setDepth(84)

    this.gameOverPlateShadow = this.add
      .rectangle(tableLayout.table.width / 2 + 10, 1032, 728, 428, theme.ink, 0.72)
      .setDepth(85)

    this.gameOverPlate = this.add
      .rectangle(tableLayout.table.width / 2, 1020, 720, 420, theme.ink, 0.76)
      .setStrokeStyle(6, theme.goldShadow, 0.76)
      .setDepth(85)

    this.gameOverPlateTrim = this.add
      .rectangle(tableLayout.table.width / 2, 1020, 686, 386, theme.charcoal, 0.22)
      .setStrokeStyle(2, theme.agedGold, 0.68)
      .setDepth(85.2)

    this.championCeremonyDecor = this.createChampionCeremonyDecor()

    const label = this.add
      .text(tableLayout.table.width / 2, 900, 'GAME OVER', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '54px',
        color: theme.css.ivory,
        stroke: theme.css.ink,
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('gameOverLabel')
      .setShadow(0, 3, theme.css.ink, 10, true, true)
      .setDepth(86)

    const finalScore = this.add
      .text(tableLayout.table.width / 2, 994, 'FINAL SCORE 0', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '28px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('gameOverFinalScore')
      .setShadow(0, 2, theme.css.ink, 8, true, true)
      .setDepth(86)

    const highScore = this.add
      .text(tableLayout.table.width / 2, 1054, `HIGH SCORE ${this.highScore}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '24px',
        color: theme.css.brightJade,
        stroke: theme.css.ink,
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('gameOverHighScore')
      .setDepth(86)

    const prompt = this.add
      .text(tableLayout.table.width / 2, 1160, 'Tap / Press Space to Restart', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '27px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setName('gameOverPrompt')
      .setDepth(86)

    this.initialsEntryPanel = this.createInitialsEntryPanel()

    this.gameOverOverlay = this.add
      .container(0, 0, [
        scrim,
        this.gameOverPlateShadow,
        this.gameOverPlate,
        this.gameOverPlateTrim,
        this.championCeremonyDecor,
        label,
        finalScore,
        highScore,
        prompt,
        this.initialsEntryPanel,
      ])
      .setDepth(84)
      .setVisible(false)
  }

  private createChampionCeremonyDecor() {
    const width = 820
    const height = 900
    const decor = this.add.container(tableLayout.table.width / 2, 1050).setVisible(false)
    const shadow = this.add.rectangle(12, 14, width, height, theme.ink, 0.82)
    const stone = this.add.rectangle(0, 0, width, height, theme.ink, 0.96).setStrokeStyle(8, theme.goldShadow, 0.9)
    const innerStone = this.add.rectangle(0, 0, width - 34, height - 34, theme.charcoal, 0.48).setStrokeStyle(3, theme.agedGold, 0.88)
    const innerRecess = this.add.rectangle(0, 8, width - 70, height - 78, theme.obsidian, 0.58).setStrokeStyle(2, theme.jade, 0.32)
    const ceremonyGlow = this.add.graphics()
    ceremonyGlow.lineStyle(5, theme.brightJade, 0.7)
    ceremonyGlow.strokeRoundedRect(-width / 2 + 27, -height / 2 + 27, width - 54, height - 54, 5)
    ceremonyGlow.lineStyle(3, theme.agedGold, 0.72)
    ceremonyGlow.lineBetween(-286, -410, 286, -410)
    ceremonyGlow.lineBetween(-286, 410, 286, 410)
    ceremonyGlow.fillStyle(theme.ember, 0.7)
    ceremonyGlow.fillCircle(-350, -374, 6)
    ceremonyGlow.fillCircle(350, -374, 6)
    ceremonyGlow.setAlpha(0.08)
    this.championCeremonyGlow = ceremonyGlow
    const glyphs = this.add.graphics()

    glyphs.lineStyle(4, theme.goldShadow, 0.74)
    glyphs.lineBetween(-278, -270, -42, -270)
    glyphs.lineBetween(42, -270, 278, -270)
    glyphs.lineStyle(2, theme.brightJade, 0.46)
    glyphs.lineBetween(-230, -259, -72, -259)
    glyphs.lineBetween(72, -259, 230, -259)
    glyphs.fillStyle(theme.ember, 0.9)
    glyphs.fillCircle(0, -265, 9)
    glyphs.fillStyle(theme.agedGold, 0.86)
    glyphs.fillTriangle(-32, -265, -13, -278, -13, -252)
    glyphs.fillTriangle(32, -265, 13, -278, 13, -252)

    ;[-1, 1].forEach((side) => {
      const x = side * 365
      glyphs.lineStyle(3, theme.goldShadow, 0.64)
      glyphs.lineBetween(x, -330, x, 332)
      ;[-210, -70, 70, 210].forEach((y, index) => {
        glyphs.lineStyle(2, index % 2 === 0 ? theme.agedGold : theme.jade, 0.56)
        glyphs.strokeTriangle(x, y - 24, x + side * 22, y, x, y + 24)
        glyphs.fillStyle(index === 1 ? theme.ember : theme.jade, index === 1 ? 0.54 : 0.24)
        glyphs.fillCircle(x + side * 8, y, 5)
      })
    })

    glyphs.lineStyle(3, theme.goldShadow, 0.62)
    glyphs.lineBetween(-278, 362, -36, 362)
    glyphs.lineBetween(36, 362, 278, 362)
    glyphs.fillStyle(theme.agedGold, 0.72)
    glyphs.fillTriangle(-28, 362, -8, 348, -8, 376)
    glyphs.fillTriangle(28, 362, 8, 348, 8, 376)
    glyphs.fillStyle(theme.jade, 0.52)
    glyphs.fillRect(-5, 357, 10, 10)

    decor.add([shadow, stone, innerStone, innerRecess, ceremonyGlow, glyphs])
    return decor
  }

  private createInitialsEntryPanel() {
    const panel = this.add.container(tableLayout.table.width / 2, 1110).setDepth(86.5).setVisible(false)
    const title = this.add
      .text(0, -186, 'CARVE YOUR INITIALS', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '28px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 2, theme.css.ink, 8, true, true)

    const titleDivider = this.add.graphics()
    titleDivider.lineStyle(2, theme.goldShadow, 0.72)
    titleDivider.lineBetween(-244, -154, 244, -154)
    titleDivider.lineStyle(1, theme.brightJade, 0.44)
    titleDivider.lineBetween(-188, -146, 188, -146)
    titleDivider.fillStyle(theme.ember, 0.72)
    titleDivider.fillCircle(0, -150, 5)

    this.initialsSelectionMarker = this.add.graphics()
    this.initialsSelectionMarker.lineStyle(7, theme.brightJade, 0.88)
    this.initialsSelectionMarker.strokeRoundedRect(-64, -68, 128, 136, 6)
    this.initialsSelectionMarker.lineStyle(2, theme.ivory, 0.4)
    this.initialsSelectionMarker.strokeRoundedRect(-57, -61, 114, 122, 4)
    this.initialsSelectionMarker.fillStyle(theme.jade, 0.78)
    this.initialsSelectionMarker.fillTriangle(-10, 76, 10, 76, 0, 88)
    this.initialsSelectionMarker.setPosition(-140, -76)

    panel.add([title, titleDivider, this.initialsSelectionMarker])
    this.initialsSlotBackings = []
    this.initialsSlotTexts = []

    ;[-1, 0, 1].forEach((slot, index) => {
      const x = slot * 140
      const slotBacking = this.add
        .rectangle(x, -76, 104, 112, theme.obsidian, 0.96)
        .setStrokeStyle(4, theme.goldShadow, 0.74)
      const slotText = this.add
        .text(x, -79, this.championInitials[index], {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '58px',
          color: theme.css.ivory,
          stroke: theme.css.ink,
          strokeThickness: 7,
          align: 'center',
        })
        .setOrigin(0.5)
        .setShadow(0, 3, theme.css.ink, 7, true, true)

      this.initialsSlotBackings.push(slotBacking)
      this.initialsSlotTexts.push(slotText)
      panel.add([slotBacking, slotText])
    })

    const upButton = this.createInitialsButton('UP', -242, 72, 156, 112, () => this.cycleSelectedInitial(1))
    const downButton = this.createInitialsButton('DOWN', -76, 72, 156, 112, () => this.cycleSelectedInitial(-1))
    const nextButton = this.createInitialsButton('NEXT', 188, 72, 210, 112, () => this.moveSelectedInitial(1))
    const saveButton = this.createInitialsButton('CARVE SCORE', 0, 210, 550, 112, () => this.confirmChampionInitials())

    this.initialsSaveButtonBacking = saveButton.backing
    this.initialsSaveButtonText = saveButton.text
    panel.add([upButton.button, downButton.button, nextButton.button, saveButton.button])
    return panel
  }

  private createInitialsButton(label: string, x: number, y: number, width: number, height: number, onPress: () => void) {
    const button = this.add.container(x, y)
    const frame = this.add.graphics()
    frame.fillStyle(theme.ink, 0.74)
    frame.fillRoundedRect(-width / 2 + 5, -height / 2 + 9, width, height, 6)
    frame.fillStyle(theme.goldShadow, 0.86)
    frame.fillRoundedRect(-width / 2, -height / 2, width, height, 6)
    frame.fillStyle(theme.charcoal, 1)
    frame.fillRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 4)
    frame.lineStyle(2, theme.agedGold, 0.9)
    frame.strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 4)
    frame.lineStyle(2, theme.jade, 0.42)
    frame.lineBetween(-width / 2 + 18, -height / 2 + 15, -width / 2 + 42, -height / 2 + 15)
    frame.lineBetween(width / 2 - 42, height / 2 - 15, width / 2 - 18, height / 2 - 15)
    frame.setAlpha(0.86)

    const backing = this.add.rectangle(0, 0, width - 22, height - 22, theme.obsidian, 0.94).setStrokeStyle(2, theme.goldShadow, 0.66)
    const pressFlash = this.add
      .rectangle(0, 0, width - 28, height - 28, theme.jade, 0.42)
      .setStrokeStyle(2, theme.brightJade, 0.8)
      .setAlpha(0)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: label === 'CARVE SCORE' ? '27px' : '25px',
        color: theme.css.ivory,
        stroke: theme.css.ink,
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 2, theme.css.ink, 5, true, true)

    button.add([frame, backing, pressFlash, text])
    button.setSize(width, height)
    button.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains)
    button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      button.setScale(0.96)
      frame.setAlpha(1)
      this.tweens.killTweensOf(pressFlash)
      pressFlash.setAlpha(0.72)
      this.tweens.add({
        targets: pressFlash,
        alpha: 0,
        duration: 190,
        ease: 'Sine.easeOut',
      })
      this.time.delayedCall(90, () => button.setScale(1))
      onPress()
    })
    button.on('pointerup', () => button.setScale(1))
    button.on('pointerout', () => {
      button.setScale(1)
      frame.setAlpha(0.86)
    })
    button.on('pointerover', () => frame.setAlpha(1))

    return { button, backing, text }
  }

  private beginChampionInitialsEntry(score: number) {
    this.pendingChampionScore = score
    this.awaitingChampionInitials = true
    this.championInitials = ['A', 'A', 'A']
    this.championInitialsTouched = [false, false, false]
    this.selectedInitialIndex = 0
    this.updateInitialsEntryUi()
    if (this.initialsSelectionMarker) {
      this.tweens.killTweensOf(this.initialsSelectionMarker)
      this.initialsSelectionMarker.setAlpha(0.68)
      this.tweens.add({
        targets: this.initialsSelectionMarker,
        alpha: 1,
        duration: 760,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
    }
  }

  private handleInitialsKeyDown(event: KeyboardEvent) {
    if (!this.awaitingChampionInitials) {
      return
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    if (/^[a-z]$/i.test(event.key)) {
      this.setSelectedInitial(event.key.toUpperCase(), true)
      event.preventDefault()
      return
    }

    switch (event.key) {
      case 'Backspace':
        this.deleteSelectedInitial()
        event.preventDefault()
        return
      case 'Enter':
        this.confirmChampionInitials()
        event.preventDefault()
        return
      case 'ArrowLeft':
        this.moveSelectedInitial(-1)
        event.preventDefault()
        return
      case 'ArrowRight':
        this.moveSelectedInitial(1)
        event.preventDefault()
        return
      case 'ArrowUp':
        this.cycleSelectedInitial(1)
        event.preventDefault()
        return
      case 'ArrowDown':
        this.cycleSelectedInitial(-1)
        event.preventDefault()
        return
      case ' ':
      case 'Spacebar':
        event.preventDefault()
        return
    }
  }

  private setSelectedInitial(letter: string, advance: boolean) {
    if (!/^[A-Z]$/.test(letter)) {
      return
    }

    this.championInitials[this.selectedInitialIndex] = letter
    this.championInitialsTouched[this.selectedInitialIndex] = true
    if (advance && this.selectedInitialIndex < this.championInitials.length - 1) {
      this.selectedInitialIndex += 1
    }
    this.updateInitialsEntryUi()
  }

  private deleteSelectedInitial() {
    if (this.selectedInitialIndex > 0 && !this.championInitialsTouched[this.selectedInitialIndex]) {
      this.selectedInitialIndex -= 1
    }

    this.championInitials[this.selectedInitialIndex] = ''
    this.championInitialsTouched[this.selectedInitialIndex] = false
    this.updateInitialsEntryUi()
  }

  private cycleSelectedInitial(direction: 1 | -1) {
    const current = this.championInitials[this.selectedInitialIndex] || 'A'
    const currentIndex = current.charCodeAt(0) - 65
    const nextIndex = (currentIndex + direction + 26) % 26
    this.championInitials[this.selectedInitialIndex] = String.fromCharCode(65 + nextIndex)
    this.championInitialsTouched[this.selectedInitialIndex] = true
    this.updateInitialsEntryUi()
  }

  private moveSelectedInitial(direction: 1 | -1) {
    this.selectedInitialIndex = Phaser.Math.Wrap(this.selectedInitialIndex + direction, 0, this.championInitials.length)
    this.updateInitialsEntryUi()
  }

  private championInitialsReady() {
    return this.championInitials.every((letter) => /^[A-Z]$/.test(letter))
  }

  private updateInitialsEntryUi() {
    this.initialsSlotTexts.forEach((text, index) => {
      const selected = index === this.selectedInitialIndex
      const letter = this.championInitials[index]
      const backing = this.initialsSlotBackings[index]

      text.setText(letter || '_')
      text.setColor(selected ? theme.css.brightJade : theme.css.ivory)
      text.setShadow(0, 3, selected ? theme.css.jade : theme.css.ink, selected ? 12 : 7, true, true)
      backing?.setFillStyle(selected ? theme.jade : theme.obsidian, selected ? 0.42 : 0.96)
      backing?.setStrokeStyle(selected ? 5 : 4, selected ? theme.brightJade : theme.goldShadow, selected ? 1 : 0.74)
      if (selected && backing) {
        this.initialsSelectionMarker?.setPosition(backing.x, backing.y)
      }
    })

    const ready = this.championInitialsReady()
    this.initialsSaveButtonBacking?.setFillStyle(ready ? theme.goldShadow : theme.charcoal, ready ? 0.96 : 0.58)
    this.initialsSaveButtonBacking?.setStrokeStyle(ready ? 3 : 2, ready ? theme.agedGold : theme.goldShadow, ready ? 1 : 0.42)
    this.initialsSaveButtonText?.setAlpha(ready ? 1 : 0.5)
  }

  private bindInput() {
    if (this.input.keyboard) {
      this.keys = {
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        leftAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        rightAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        plunger: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        plungerAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        pause: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
        reset: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
        devMode: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK),
        devModeAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1),
        debug: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B),
        testMode: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
        clearVelocity: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
        shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
        one: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        two: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        three: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        four: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
        five: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
        multiball: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M),
      }
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        void this.audio.unlock()
        this.handleInitialsKeyDown(event)
      })
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer))
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer))
    this.input.on('pointerout', (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer))
    this.input.on('gameout', () => this.releaseAllPointerControls())
  }

  private bindCollisions() {
    this.matter.world.on(
      Phaser.Physics.Matter.Events.COLLISION_START,
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        event.pairs.forEach((pair: Phaser.Types.Physics.Matter.MatterCollisionPair) => {
          const bodyA = pair.collision.bodyA
          const bodyB = pair.collision.bodyB
          const ballA = this.ballFromBody(bodyA)
          const ballB = this.ballFromBody(bodyB)

          if (ballA && !ballB) {
            this.handleBallCollision(ballA, bodyB)
          } else if (ballB && !ballA) {
            this.handleBallCollision(ballB, bodyA)
          }
        })
      },
    )
  }

  private shakeCamera(kind: keyof typeof tableLayout.juice.screenShake) {
    const shake = tableLayout.juice.screenShake[kind]
    this.cameras.main.shake(shake.durationMs, shake.intensity)
  }

  private flashCircle(x: number, y: number, radius: number, color: number, duration = tableLayout.juice.flashDurationMs) {
    const flash = this.add
      .circle(x, y, radius, color, tableLayout.juice.flashAlpha * 0.34)
      .setStrokeStyle(5, color, 0.82)
      .setDepth(8)
      .setAlpha(1)

    this.tweens.add({
      targets: flash,
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  private flashRectangle(x: number, y: number, width: number, height: number, color: number, duration = tableLayout.juice.flashDurationMs) {
    const flash = this.add
      .rectangle(x, y, width, height, color, tableLayout.juice.flashAlpha * 0.42)
      .setStrokeStyle(5, color, 0.82)
      .setDepth(8)

    this.tweens.add({
      targets: flash,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  private flashPlayfield(color: number) {
    const flash = this.add
      .rectangle(tableLayout.table.width / 2, tableLayout.table.height / 2, tableLayout.table.width, tableLayout.table.height, color, 0.085)
      .setDepth(8)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: tableLayout.juice.multiballFlashDurationMs,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  private ceremonialBurst(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 46, color, 0.08).setStrokeStyle(5, theme.agedGold, 0.62).setDepth(44)
    const inner = this.add.circle(x, y, 24, theme.ink, 0.4).setStrokeStyle(3, color, 0.62).setDepth(44)
    const barH = this.add.rectangle(x, y, 190, 4, theme.agedGold, 0.48).setDepth(44)
    const barV = this.add.rectangle(x, y, 4, 142, theme.agedGold, 0.38).setDepth(44)

    this.tweens.add({
      targets: [ring, inner, barH, barV],
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration: tableLayout.tuning.majorScorePopupDurationMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        ring.destroy()
        inner.destroy()
        barH.destroy()
        barV.destroy()
      },
    })
  }

  private handleBallCollision(ball: BallRuntime, otherBody: MatterJS.BodyType) {
    const label = otherBody.label

    if (otherBody.isSensor) {
      this.lastSensorHit = label
    }

    if (label.startsWith('bumper:')) {
      const bumper = tableLayout.bumpers.find((item) => label === `bumper:${item.id}`)
      const points = bumper?.score ?? 1000
      this.audio.playBumper()
      this.shakeCamera('bumper')
      this.addScore(points)
      this.showScorePopup(otherBody.position.x, otherBody.position.y - 28, 'BUMPER HIT', points)
      if (bumper) {
        this.pulseBumperVisual(bumper)
        this.flashCircle(bumper.x, bumper.y, bumper.radius * 1.45, theme.ember)
      }
      this.kickBallAwayFrom(ball, otherBody.position, tableLayout.tuning.bumperForce)
      this.registerComboHit('bumper', ball)
      return
    }

    if (label.startsWith('sling:')) {
      const sling = tableLayout.slingshots.find((item) => label === `sling:${item.id}`)
      if (sling) {
        this.audio.playSling()
        this.addScore(sling.score)
        this.showScorePopup(otherBody.position.x, otherBody.position.y - 22, 'SLING HIT', sling.score)
        this.pulse(this.slingVisuals.get(sling.id))
        this.applyBallForce(ball, sling.force.x * tableLayout.tuning.slingForceScale, sling.force.y * tableLayout.tuning.slingForceScale)
        this.registerComboHit('sling', ball)
      }
      return
    }

    if (label.startsWith('targetBank:')) {
      const targetId = label.split(':')[1]
      const target = tableLayout.sensors.find((sensor) => sensor.id === targetId)
      const points = target?.score ?? 250
      this.audio.playTarget()
      this.addScore(points)
      this.showScorePopup(ball.image.x, ball.image.y - 28, 'TARGET HIT', points)
      this.registerComboHit('targetOrLane', ball)
      return
    }

    if (label.startsWith('jackpot:')) {
      this.handleJackpotHit(ball, label)
      return
    }

    if (label.startsWith('rollover:')) {
      this.handleRolloverHit(label)
      return
    }

    if (label.startsWith('drain:')) {
      this.handleDrainedBall(ball)
      return
    }

    if (label.startsWith('shooterExit:')) {
      this.feedShooterExit(ball)
      return
    }

    if (label.startsWith('orbit:') || label.startsWith('rampEntrance:')) {
      this.registerLaneComboHit(ball)
    }
  }

  private updateKeyboardState() {
    if (!this.keys) {
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.devMode) || Phaser.Input.Keyboard.JustDown(this.keys.devModeAlt)) {
      this.setDevMode(!this.devModeEnabled)
    }

    const keyboardPlunger = this.keys.plunger.isDown || this.keys.plungerAlt.isDown

    if (this.awaitingChampionInitials) {
      this.lastKeyboardPlunger = keyboardPlunger
      return
    }

    if (!this.hasStarted) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.plunger) || Phaser.Input.Keyboard.JustDown(this.keys.plungerAlt)) {
        this.startGame()
      }
      this.lastKeyboardPlunger = keyboardPlunger
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.setPaused(!this.gamePaused)
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) {
      this.resetGameState()
    }

    if (this.gamePaused) {
      this.releaseAllPointerControls()
      this.updateFlipperInputState()
      this.plungerHeld = false
      this.lastKeyboardPlunger = keyboardPlunger
      return
    }

    this.updateFlipperInputState()

    if (keyboardPlunger && !this.lastKeyboardPlunger) {
      this.plungerHeld = Boolean(this.plungerBall())
      if (this.plungerHeld) {
        this.audio.playPlungerPull()
      }
    }
    if (!keyboardPlunger && this.lastKeyboardPlunger) {
      this.releasePlunger()
    }
    this.lastKeyboardPlunger = keyboardPlunger

    if (this.devModeEnabled && Phaser.Input.Keyboard.JustDown(this.keys.debug)) {
      this.debugEnabled = !this.debugEnabled
      this.debugGraphics.setVisible(this.debugEnabled)
      this.jackpotVisual?.setVisible(this.debugEnabled)
      if (!this.debugEnabled) {
        this.debugGraphics.clear()
      }
    }

    if (this.devModeEnabled && Phaser.Input.Keyboard.JustDown(this.keys.testMode)) {
      this.setShotTestMode(!this.shotTestMode)
    }

    if (this.devModeEnabled && Phaser.Input.Keyboard.JustDown(this.keys.multiball)) {
      this.startEclipseMultiball()
    }

    if (this.devModeEnabled && this.shotTestMode) {
      this.handleShotTestInput()
    }
  }

  private setShotTestMode(enabled: boolean) {
    this.shotTestMode = enabled && this.devModeEnabled
    this.shotTestText.setVisible(this.shotTestMode)
    if (!this.shotTestMode) {
      this.shotTestText.setText('')
    }
  }

  private startGame() {
    if (this.awaitingChampionInitials) {
      return
    }

    if (this.gameOver) {
      this.resetGameState()
    }

    if (this.hasStarted) {
      return
    }

    this.hasStarted = true
    this.startOverlay.setVisible(false)
    this.gameOverOverlay.setVisible(false)
    this.setGameplayFrozen(false)
    void this.audio.unlock()
  }

  private setPaused(paused: boolean) {
    if (!this.hasStarted) {
      return
    }

    this.gamePaused = paused
    this.pauseOverlay.setVisible(paused)
    this.setGameplayFrozen(paused)
    if (paused) {
      this.releaseAllPointerControls()
      this.updateFlipperInputState()
      this.plungerHeld = false
    }
  }

  private setGameplayFrozen(frozen: boolean) {
    if (frozen) {
      this.matter.world.pause()
    } else {
      this.matter.world.resume()
    }
  }

  private setDevMode(enabled: boolean) {
    this.devModeEnabled = enabled
    this.devModeText.setVisible(enabled)
    this.startDevHint?.setVisible(enabled)
    this.visualAlignmentText.setVisible(enabled)
    if (!enabled) {
      this.debugEnabled = false
      this.debugGraphics.setVisible(false)
      this.debugGraphics.clear()
      this.jackpotVisual?.setVisible(false)
      this.setShotTestMode(false)
    }
  }

  private resetGameState() {
    this.score = 0
    this.currentBall = 1
    this.gameOver = false
    this.pendingChampionScore = null
    this.awaitingChampionInitials = false
    this.lastScoreEvent = 'none'
    this.gameOverOverlay?.setVisible(false)
    this.startOverlay?.setVisible(false)
    this.resetBall()
    if (this.gamePaused) {
      this.setPaused(false)
    }
    this.updateHud()
  }

  private updateHud() {
    this.scoreText?.setText(`SCORE ${this.score}`)
    this.highScoreText?.setText(`HIGH ${this.highScore}`)
    this.ballStateText?.setText(this.ballHudLabel())
    this.rolloverText?.setText(`ROLLOVERS ${this.litRollovers.size}/${this.rolloverCount()}`)
    this.eclipseStateText?.setText(`STATE ${this.currentModeState()}`)
    this.eclipseStateText?.setColor(this.currentModeColor())
    this.ballSaveText?.setVisible(this.isBallSaverActive() && !this.gameOver)
    this.devModeText?.setVisible(this.devModeEnabled)
    this.visualAlignmentText?.setText(this.visualAlignmentSummary())
    this.visualAlignmentText?.setVisible(this.devModeEnabled)
    this.controlsText?.setVisible(this.hasStarted && !this.gameOver)
    this.touchHintLeft?.setVisible(this.hasStarted && !this.gamePaused && !this.gameOver)
    this.touchHintRight?.setVisible(this.hasStarted && !this.gamePaused && !this.gameOver)
    this.touchHintLaunch?.setVisible(this.hasStarted && !this.gamePaused && !this.gameOver)
  }

  private ballHudLabel() {
    return `BALL ${this.currentBall}/${tableLayout.game.ballsPerGame}  ${this.ballState}`
  }

  private visualAlignmentSummary() {
    const { bumpers, rollovers, plunger } = tableLayout.visualAlignment

    return [
      `VISUAL ALIGN`,
      `BUMP x ${bumpers.offsetX} y ${bumpers.offsetY} s ${bumpers.scale}`,
      `BUMP q ${bumpers.perBumper.quetzal.offsetX},${bumpers.perBumper.quetzal.offsetY} j ${bumpers.perBumper.jaguar.offsetX},${bumpers.perBumper.jaguar.offsetY} sun ${bumpers.perBumper.sun.offsetX},${bumpers.perBumper.sun.offsetY}`,
      `ROLL x ${rollovers.offsetX} y ${rollovers.offsetY} ws ${rollovers.widthScale} hs ${rollovers.heightScale} gap ${rollovers.gapAdjust}`,
      `PLNG x ${plunger.offsetX} y ${plunger.offsetY} ${plunger.width}x${plunger.height}`,
    ].join('\n')
  }

  private currentModeState() {
    if (this.gameOver) {
      return 'GAME OVER'
    }

    if (this.isBallSaverActive() && this.eclipseState !== 'ECLIPSE MULTIBALL') {
      return 'BALL SAVE'
    }

    return this.eclipseState
  }

  private currentModeColor() {
    if (this.gameOver) {
      return theme.css.agedGold
    }

    if (this.eclipseState === 'ECLIPSE MULTIBALL') {
      return theme.css.ember
    }

    if (this.eclipseState === 'ECLIPSE READY') {
      return theme.css.brightJade
    }

    if (this.isBallSaverActive()) {
      return theme.css.agedGold
    }

    return theme.css.bone
  }

  private handleShotTestInput() {
    if (!this.keys) {
      return
    }

    const shiftHeld = this.keys.shift.isDown

    if (Phaser.Input.Keyboard.JustDown(this.keys.clearVelocity)) {
      this.clearBallVelocity()
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
      if (shiftHeld) {
        this.launchShotTestBall('leftUpper')
      } else {
        this.placeShotTestBall('leftFlipper')
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
      if (shiftHeld) {
        this.launchShotTestBall('rightUpper')
      } else {
        this.placeShotTestBall('rightFlipper')
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
      if (shiftHeld) {
        this.launchShotTestBall('centerJackpot')
      } else {
        this.placeShotTestBall('centerLower')
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) {
      this.placeShotTestBall('shooterExit')
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.five)) {
      this.placeShotTestBall('upperRollovers')
    }
  }

  private placeShotTestBall(placement: ShotTestPlacement) {
    this.setBallForShotTest(this.shotTestPosition(placement), { x: 0, y: 0 })
  }

  private launchShotTestBall(launch: ShotTestLaunch) {
    const shot = this.shotTestLaunch(launch)
    this.setBallForShotTest(shot.position, shot.velocity)
  }

  private clearBallVelocity() {
    const ball = this.primaryBall()
    if (!ball) {
      return
    }

    ball.image.setVelocity(0, 0)
    ball.image.setAngularVelocity(0)
    ball.lastMotionAt = this.time.now
  }

  private setBallForShotTest(position: Point, velocity: Point) {
    const ball = this.ensureSingleBall()
    this.setBallPositionAndVelocity(ball, position, velocity)
    this.plungerHeld = false
    this.plungerCharge = 0
    this.drainResetPending = false
    this.clearBallSaver()
    this.ballSaverArmed = false
    ball.lastMotionAt = this.time.now
    this.setEclipseState('NORMAL')
    this.resetRollovers()
    this.setBallState(this.isBallInPlungerLane(ball) ? 'PLUNGER' : 'IN PLAY')
  }

  private shotTestPosition(placement: ShotTestPlacement): Point {
    switch (placement) {
      case 'leftFlipper':
        return this.flipperCradlePosition('left')
      case 'rightFlipper':
        return this.flipperCradlePosition('right')
      case 'centerLower':
        return { x: tableLayout.table.width / 2, y: 1375 }
      case 'shooterExit':
        return { x: tableLayout.tuning.shooterExitRepositionX, y: tableLayout.tuning.shooterExitRepositionY }
      case 'upperRollovers':
        return { x: tableLayout.table.width / 2, y: 830 }
    }
  }

  private shotTestLaunch(launch: ShotTestLaunch): { position: Point; velocity: Point } {
    switch (launch) {
      case 'leftUpper':
        return {
          position: this.shotTestPosition('leftFlipper'),
          velocity: { x: 12, y: -35 },
        }
      case 'rightUpper':
        return {
          position: this.shotTestPosition('rightFlipper'),
          velocity: { x: -12, y: -35 },
        }
      case 'centerJackpot':
        return {
          position: this.shotTestPosition('centerLower'),
          velocity: { x: 0, y: -36 },
        }
    }
  }

  private flipperCradlePosition(id: 'left' | 'right'): Point {
    const config = tableLayout.flippers.find((flipper) => flipper.id === id)
    if (!config) {
      return { x: tableLayout.table.width / 2, y: 1625 }
    }

    const restAngle = Phaser.Math.DegToRad(tableLayout.tuning.flipperRestAngle[id])
    const centerline = this.pointFromPivot(config.pivot, restAngle, config.length * 0.58)

    return {
      x: centerline.x,
      y: centerline.y - tableLayout.ball.radius - config.width * 0.35,
    }
  }

  private updateFlippers(delta: number) {
    const deltaScale = Math.max(0.5, Math.min(2, delta / 16.6667))

    this.flippers.forEach((flipper) => {
      const targetAngle = Phaser.Math.DegToRad(
        flipper.pressed ? tableLayout.tuning.flipperActiveAngle[flipper.config.id] : tableLayout.tuning.flipperRestAngle[flipper.config.id],
      )
      const angularSpeed = flipper.pressed ? tableLayout.tuning.flipperSpeed : tableLayout.tuning.flipperReturnSpeed
      const step = angularSpeed * deltaScale
      const angleDelta = Phaser.Math.Angle.Wrap(targetAngle - flipper.currentAngle)

      if (Math.abs(angleDelta) <= step) {
        flipper.currentAngle = targetAngle
      } else {
        flipper.currentAngle += Math.sign(angleDelta) * step
      }

      const center = this.pointFromPivot(flipper.config.pivot, flipper.currentAngle, flipper.config.length / 2)

      // TUNING: flipperSpeed/flipperReturnSpeed set snap/return; flipperImpulse controls contact kick.
      this.matter.body.setPosition(flipper.body, center, true)
      this.matter.body.setAngle(flipper.body, flipper.currentAngle, true)
      flipper.visual.setPosition(center.x, center.y)
      flipper.visual.rotation = flipper.currentAngle
      flipper.accent.setPosition(center.x, center.y)
      flipper.accent.rotation = flipper.currentAngle
      this.maybeApplyFlipperImpulse(flipper)
    })
  }

  private updatePlunger() {
    if (this.plungerHeld) {
      this.plungerCharge = Math.min(1, this.plungerCharge + tableLayout.tuning.plungerChargeRate)
    }

    this.plungerVisual.y = tableLayout.plunger.restY + tableLayout.visualAlignment.plunger.offsetY + this.plungerCharge * tableLayout.plunger.chargeTravel
    const chargeGlow = this.plungerVisual.getByName('chargeGlow') as Phaser.GameObjects.Arc | null
    const accent = this.plungerVisual.getByName('accent') as Phaser.GameObjects.Rectangle | null
    chargeGlow?.setAlpha(0.18 + this.plungerCharge * 0.58)
    chargeGlow?.setScale(1 + this.plungerCharge * 0.45)
    accent?.setFillStyle(this.plungerCharge > 0.66 ? theme.ember : theme.jade, 0.78)
  }

  private releasePlunger() {
    if (!this.plungerHeld) {
      return
    }

    this.plungerHeld = false
    const ball = this.plungerBall()
    if (ball) {
      const launchVelocity = Phaser.Math.Linear(
        tableLayout.tuning.plungerMinVelocity,
        tableLayout.tuning.plungerMaxVelocity,
        Math.max(0.1, this.plungerCharge),
      )
      ball.image.setPosition(tableLayout.plunger.x, ball.image.y)
      ball.image.setVelocity(0, -launchVelocity)
      ball.image.setAngularVelocity(0)
      ball.lastMotionAt = this.time.now
      this.ballSaverArmed = true
      this.audio.playPlungerLaunch()
    }
    this.plungerCharge = 0
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    void this.audio.unlock()
    if (this.awaitingChampionInitials) {
      return
    }

    if (!this.hasStarted) {
      this.startGame()
      return
    }

    if (this.gamePaused) {
      return
    }

    const worldPoint = this.screenToTablePoint(pointer)
    let control: 'left' | 'right' | 'plunger'

    if (this.pointInRect(worldPoint, tableLayout.plunger.touchArea) && this.plungerBall()) {
      control = 'plunger'
      this.plungerHeld = true
      this.audio.playPlungerPull()
    } else {
      control = worldPoint.x < tableLayout.table.width / 2 ? 'left' : 'right'
    }

    this.pointerControls.set(pointer.id, control)
    this.updateFlipperInputState()
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    const control = this.pointerControls.get(pointer.id)
    if (!control) {
      return
    }

    if (control === 'plunger') {
      this.releasePlunger()
    }
    this.pointerControls.delete(pointer.id)
    this.updateFlipperInputState()
  }

  private releaseAllPointerControls() {
    if (this.pointerControls.size === 0) {
      return
    }

    const hadPlunger = [...this.pointerControls.values()].includes('plunger')
    this.pointerControls.clear()
    if (hadPlunger) {
      this.releasePlunger()
    }
    this.updateFlipperInputState()
  }

  private updateFlipperInputState() {
    const keyboardLeft = Boolean(this.keys && (this.keys.left.isDown || this.keys.leftAlt.isDown))
    const keyboardRight = Boolean(this.keys && (this.keys.right.isDown || this.keys.rightAlt.isDown))
    const touchLeft = [...this.pointerControls.values()].includes('left')
    const touchRight = [...this.pointerControls.values()].includes('right')

    this.setFlipperPressed('left', keyboardLeft || touchLeft)
    this.setFlipperPressed('right', keyboardRight || touchRight)
  }

  private setFlipperPressed(id: 'left' | 'right', pressed: boolean) {
    const flipper = this.flippers.find((item) => item.config.id === id)
    if (flipper) {
      if (pressed && !flipper.pressed) {
        this.audio.playFlipper()
      }
      flipper.pressed = pressed
    }
  }

  private resetBall() {
    this.releaseAllPointerControls()
    this.clearAllBalls()
    this.spawnBall(tableLayout.ball.spawn, tableLayout.ball.resetVelocity)
    this.plungerCharge = 0
    this.plungerHeld = false
    this.drainResetPending = false
    this.clearBallSaver()
    this.ballSaverArmed = true
    this.setEclipseState('NORMAL')
    this.resetRollovers()
    this.setBallState('PLUNGER')
  }

  private serveNextBallOrEndGame() {
    this.drainResetPending = false
    if (this.currentBall >= tableLayout.game.ballsPerGame) {
      this.endGame()
      return
    }

    this.currentBall += 1
    this.resetBall()
  }

  private endGame() {
    this.releaseAllPointerControls()
    this.clearAllBalls()
    this.plungerHeld = false
    this.plungerCharge = 0
    this.drainResetPending = false
    this.gamePaused = false
    this.gameOver = true
    this.hasStarted = false
    this.clearBallSaver()
    this.ballSaverArmed = false
    this.setEclipseState('NORMAL')
    this.resetRollovers()
    this.setBallState('GAME OVER')
    const newChampion = qualifiesForWallOfChampions(this.score, this.champions)
    if (newChampion) {
      this.audio.playNewChampion()
      this.beginChampionInitialsEntry(this.score)
    } else {
      this.audio.playGameOver()
      this.pendingChampionScore = null
      this.awaitingChampionInitials = false
    }
    this.setGameplayFrozen(true)
    this.pauseOverlay?.setVisible(false)
    this.startOverlay?.setVisible(false)
    this.updateGameOverOverlay()
    this.gameOverOverlay.setVisible(true)
    this.updateHud()
  }

  private ensureSingleBall() {
    let ball = this.primaryBall()
    if (!ball) {
      return this.spawnBall(tableLayout.ball.spawn, tableLayout.ball.resetVelocity)
    }

    this.balls
      .filter((item) => item !== ball)
      .forEach((item) => this.removeBall(item))
    return ball
  }

  private clearAllBalls() {
    ;[...this.balls].forEach((ball) => this.removeBall(ball))
  }

  private removeBall(ball: BallRuntime) {
    this.collisionBodies = this.collisionBodies.filter((body) => body !== ball.body)
    this.balls = this.balls.filter((item) => item !== ball)
    ball.image.destroy()
  }

  private primaryBall() {
    return this.balls[0]
  }

  private plungerBall() {
    return this.balls.find((ball) => this.isBallInPlungerLane(ball))
  }

  private ballFromBody(body: MatterJS.BodyType) {
    return this.balls.find((ball) => ball.body === body)
  }

  private setBallPositionAndVelocity(ball: BallRuntime, position: Point, velocity: Point) {
    ball.image.setPosition(position.x, position.y)
    ball.image.setVelocity(velocity.x, velocity.y)
    ball.image.setAngularVelocity(0)
    ball.lastMotionAt = this.time.now
  }

  private keepBallPlayable() {
    ;[...this.balls].forEach((ball) => {
      const outOfBounds = ball.image.y > tableLayout.table.height + 130 || ball.image.x < -130 || ball.image.x > tableLayout.table.width + 130
      if (outOfBounds) {
        this.handleDrainedBall(ball, false)
      }
    })
  }

  private isBallInPlungerLane(ball = this.primaryBall()) {
    return Boolean(ball && ball.image.x > tableLayout.plunger.laneMinX && ball.image.y > tableLayout.plunger.launchMinY)
  }

  private updateBallState() {
    if (this.ballState === 'DRAINED' || this.gameOver) {
      return
    }

    if (this.balls.length === 0) {
      this.setBallState('DRAINED')
      return
    }

    this.setBallState(this.balls.every((ball) => this.isBallInPlungerLane(ball)) ? 'PLUNGER' : 'IN PLAY')
  }

  private setBallState(state: BallState) {
    if (this.ballState === state) {
      return
    }

    this.ballState = state
    this.ballStateText?.setText(this.ballHudLabel())
  }

  private updateAntiStuck() {
    if (this.ballState === 'DRAINED' || this.gameOver) {
      return
    }

    this.balls.forEach((ball) => {
      if (this.isBallInPlungerLane(ball)) {
        ball.lastMotionAt = this.time.now
        return
      }

      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
      if (speed > tableLayout.tuning.stuckVelocityThreshold) {
        ball.lastMotionAt = this.time.now
        return
      }

      if (this.time.now - ball.lastMotionAt < tableLayout.tuning.stuckDurationMs) {
        return
      }

      const horizontalDirection = ball.image.x < tableLayout.table.width / 2 ? 1 : -1
      ball.image.setVelocity(
        ball.body.velocity.x + horizontalDirection * tableLayout.tuning.stuckNudgeVelocityX,
        ball.body.velocity.y + tableLayout.tuning.stuckNudgeVelocityY,
      )
      ball.lastMotionAt = this.time.now
    })
  }

  private updateTrapKickers() {
    if (this.ballState === 'DRAINED' || this.gameOver) {
      return
    }

    this.balls.forEach((ball) => {
      if (this.isBallInPlungerLane(ball)) {
        return
      }

      const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
      if (speed > tableLayout.tuning.trapKickSpeedThreshold) {
        return
      }

      tableLayout.trapKickers.forEach((zone) => {
        if (!this.pointInCenteredRect(ball.image, zone)) {
          return
        }

        const cooldownKey = `${zone.id}:${ball.id}`
        const lastKickAt = this.lastTrapKickAt.get(cooldownKey) ?? 0
        if (this.time.now - lastKickAt < tableLayout.tuning.trapKickerCooldownMs) {
          return
        }

        this.lastTrapKickAt.set(cooldownKey, this.time.now)
        this.lastSensorHit = `trapKicker:${zone.id}`
        if (zone.reposition) {
          ball.image.setPosition(zone.reposition.x, zone.reposition.y)
        }
        ball.image.setVelocity(zone.velocity.x, zone.velocity.y)
        ball.image.setAngularVelocity(0)
        ball.lastMotionAt = this.time.now
      })
    })
  }

  private maybeAssistShooterExit() {
    const shooterExit = tableLayout.sensors.find((sensor) => sensor.kind === 'shooterExit')

    this.balls.forEach((ball) => {
      const overlapsExitSensor = Boolean(shooterExit && this.pointInCenteredRect(ball.image, shooterExit))
      const reachedOpenLaneTop = ball.image.x > tableLayout.plunger.laneMinX && ball.image.y < tableLayout.tuning.shooterExitFallbackY

      if (overlapsExitSensor || reachedOpenLaneTop) {
        this.lastSensorHit = overlapsExitSensor && shooterExit ? `shooterExit:${shooterExit.id}` : 'shooterExit:fallback'
        this.feedShooterExit(ball)
      }
    })
  }

  private feedShooterExit(ball: BallRuntime) {
    if (this.time.now - this.lastShooterExitAt < tableLayout.tuning.shooterExitCooldownMs) {
      return
    }

    this.lastShooterExitAt = this.time.now
    const exitVelocity = this.shooterExitVelocity(ball)
    // TUNING: shooterExitRepositionX/Y should sit just left of the shooter lane exit.
    this.setBallPositionAndVelocity(
      ball,
      { x: tableLayout.tuning.shooterExitRepositionX, y: tableLayout.tuning.shooterExitRepositionY },
      exitVelocity,
    )
    if (this.ballSaverArmed) {
      this.ballSaverArmed = false
      this.activateBallSaver()
    }
  }

  private shooterExitVelocity(ball: BallRuntime): Point {
    const incomingVelocity = ball.body.velocity
    const incomingSpeed = Math.hypot(incomingVelocity.x, incomingVelocity.y)
    const minimumExitSpeed = tableLayout.tuning.plungerMinVelocity * tableLayout.tuning.shooterExitVelocityScale
    const exitSpeed = Phaser.Math.Clamp(
      incomingSpeed * tableLayout.tuning.shooterExitVelocityScale,
      minimumExitSpeed,
      tableLayout.tuning.shooterExitVelocityCap,
    )
    const direction = this.normalizedVector(tableLayout.tuning.shooterExitDirection, { x: -0.9, y: -0.44 })

    return {
      x: direction.x * exitSpeed,
      y: direction.y * exitSpeed,
    }
  }

  private activateBallSaver(durationMs = tableLayout.tuning.ballSaveDurationMs) {
    // BALL SAVER: one timer protects every active ball, including the 10s multiball grace period.
    this.ballSaveUntil = this.time.now + durationMs
    this.updateBallSaverUi()
  }

  private clearBallSaver() {
    this.ballSaveUntil = 0
    this.updateBallSaverUi()
  }

  private isBallSaverActive() {
    return this.ballSaveUntil > this.time.now
  }

  private updateBallSaverUi() {
    this.ballSaveText?.setVisible(this.isBallSaverActive())
  }

  private handleDrainedBall(ball: BallRuntime, allowBallSaver = true) {
    if (!this.balls.includes(ball)) {
      return
    }

    if (this.time.now - ball.lastDrainAt < 120) {
      return
    }
    ball.lastDrainAt = this.time.now

    if (allowBallSaver && this.isBallSaverActive()) {
      this.saveDrainedBall(ball)
      return
    }

    // DRAIN: remove only the drained ball; the table resets only when no active balls remain.
    this.audio.playDrain()
    this.showScorePopup(ball.image.x, ball.image.y - 30, 'DRAIN')
    this.removeBall(ball)
    this.checkMultiballEnd()

    if (this.balls.length === 0 && !this.drainResetPending) {
      this.drainResetPending = true
      this.setBallState('DRAINED')
      this.time.delayedCall(260, () => this.serveNextBallOrEndGame())
      return
    }

    this.updateBallState()
  }

  private relaunchSavedBall(ball: BallRuntime) {
    const launch = tableLayout.multiball.launches[ball.id % tableLayout.multiball.launches.length]
    this.setBallPositionAndVelocity(ball, launch.position, launch.velocity)
    this.setBallState('IN PLAY')
  }

  private saveDrainedBall(ball: BallRuntime) {
    this.lastScoreEvent = 'BALL SAVE'
    this.audio.playBallSave()
    this.showScorePopup(ball.image.x, ball.image.y - 42, 'BALL SAVE', undefined, {
      event: true,
      color: theme.css.agedGold,
    })

    if (this.eclipseState === 'ECLIPSE MULTIBALL' || this.balls.length > 1) {
      this.relaunchSavedBall(ball)
      return
    }

    this.setBallPositionAndVelocity(ball, tableLayout.ball.spawn, tableLayout.ball.resetVelocity)
    this.plungerCharge = 0
    this.plungerHeld = false
    this.drainResetPending = false
    this.clearBallSaver()
    this.ballSaverArmed = true
    this.setBallState('PLUNGER')
  }

  private handleJackpotHit(ball: BallRuntime, label: string) {
    if (this.eclipseState === 'ECLIPSE READY') {
      this.startEclipseMultiball(ball)
      return
    }

    const sensor = this.sensorFromLabel(label)
    const points =
      this.eclipseState === 'ECLIPSE MULTIBALL' ? tableLayout.tuning.eclipseMultiballJackpotScore : sensor?.score ?? tableLayout.tuning.jackpotScore
    this.audio.playJackpot()
    this.shakeCamera('jackpot')
    this.addScore(points)
    this.showScorePopup(ball.image.x, ball.image.y - 54, 'TEMPLE JACKPOT', points, {
      major: true,
      event: true,
      color: theme.css.agedGold,
    })
    this.pulse(this.jackpotVisual, tableLayout.tuning.jackpotPulseScale, tableLayout.tuning.majorScorePopupDurationMs * 0.18)
    this.ceremonialBurst(ball.image.x, ball.image.y - 54, theme.agedGold)
    if (sensor) {
      this.flashRectangle(sensor.x, sensor.y, sensor.width, sensor.height, theme.agedGold, tableLayout.juice.jackpotFlashDurationMs)
      this.flashCircle(sensor.x, sensor.y, sensor.width * 0.75, theme.eclipseRed, tableLayout.juice.jackpotFlashDurationMs)
    }
    this.registerComboHit('targetOrLane', ball)
  }

  private handleRolloverHit(label: string) {
    const sensor = this.sensorFromLabel(label)
    if (!sensor || this.litRollovers.has(sensor.id)) {
      return
    }

    const points = sensor.score ?? tableLayout.tuning.rolloverScore
    this.audio.playRollover()
    this.litRollovers.add(sensor.id)
    this.setRolloverVisualLit(sensor.id, true)
    this.addScore(points)
    this.showScorePopup(sensor.x, sensor.y - 30, 'ROLLOVER', points)
    this.pulse(this.rolloverVisuals.get(sensor.id), tableLayout.tuning.rolloverPulseScale)
    this.flashRectangle(sensor.x, sensor.y, sensor.width, sensor.height, theme.brightJade)
    this.updateRolloverUi()

    if (this.litRollovers.size >= this.rolloverCount()) {
      this.handleRolloverCompletion(sensor)
    }
  }

  private handleRolloverCompletion(sensor: SensorBody) {
    if (this.eclipseState === 'NORMAL') {
      this.setEclipseState('ECLIPSE READY')
      this.audio.playEclipseReady()
      this.showScorePopup(tableLayout.table.width / 2, sensor.y - 86, 'ECLIPSE READY', undefined, {
        major: true,
        event: true,
        color: theme.css.brightJade,
      })
      this.flashPlayfield(theme.jade)
      return
    }

    if (this.eclipseState === 'ECLIPSE MULTIBALL') {
      this.time.delayedCall(tableLayout.tuning.rolloverBonusResetDelayMs, () => this.resetRollovers())
    }
  }

  private sensorFromLabel(label: string) {
    const sensorId = label.split(':')[1]
    return tableLayout.sensors.find((sensor) => sensor.id === sensorId)
  }

  private rolloverCount() {
    return tableLayout.sensors.filter((sensor) => sensor.kind === 'rollover').length
  }

  private updateRolloverUi() {
    this.updateHud()
  }

  private setRolloverVisualLit(id: string, lit: boolean) {
    const visual = this.rolloverVisuals.get(id)
    if (!visual) {
      return
    }

    const backing = visual.getByName('backing') as Phaser.GameObjects.Rectangle | null
    const glow = visual.getByName('glow') as Phaser.GameObjects.Rectangle | null
    const insert = visual.getByName('insert') as Phaser.GameObjects.Rectangle | null
    const glyph = visual.getByName('glyph') as Phaser.GameObjects.Triangle | null

    backing?.setFillStyle(theme.ink, lit ? 0.66 : 0.74)
    backing?.setStrokeStyle(3, lit ? theme.agedGold : theme.goldShadow, lit ? 0.74 : 0.42)
    glow?.setFillStyle(theme.jade, lit ? 0.22 : 0)
    glow?.setStrokeStyle(2, theme.brightJade, lit ? 0.58 : 0)
    insert?.setFillStyle(lit ? theme.jade : theme.obsidian, lit ? 0.78 : 0.9)
    insert?.setStrokeStyle(3, lit ? theme.brightJade : theme.agedGold, lit ? 0.95 : 0.76)
    glyph?.setFillStyle(lit ? theme.brightJade : theme.jade, lit ? 0.82 : 0.26)
    glyph?.setStrokeStyle(2, lit ? theme.ivory : theme.goldShadow, lit ? 0.62 : 0.5)
  }

  private resetRollovers() {
    this.litRollovers.clear()
    this.rolloverVisuals.forEach((_visual, id) => this.setRolloverVisualLit(id, false))
    this.updateRolloverUi()
  }

  private setEclipseState(state: EclipseState) {
    // MULTIBALL STATE: NORMAL builds rollover progress, READY waits for Jackpot, MULTIBALL runs until one ball remains.
    if (this.eclipseState === state) {
      return
    }

    this.eclipseState = state
    this.updateHud()
  }

  private startEclipseMultiball(sourceBall = this.primaryBall()) {
    if (this.eclipseState === 'ECLIPSE MULTIBALL') {
      return
    }

    const firstBall = sourceBall ?? this.spawnBall(tableLayout.multiball.launches[0].position, tableLayout.multiball.launches[0].velocity)

    // MULTIBALL START: use existing playfield balls when present, then add enough balls to reach three total.
    if (this.isBallInPlungerLane(firstBall) || this.ballState === 'PLUNGER') {
      const launch = tableLayout.multiball.launches[0]
      this.setBallPositionAndVelocity(firstBall, launch.position, launch.velocity)
    }

    while (this.balls.length < tableLayout.tuning.eclipseMultiballExtraBalls + 1) {
      const launch = tableLayout.multiball.launches[this.balls.length % tableLayout.multiball.launches.length]
      this.spawnBall(launch.position, launch.velocity)
    }

    this.setEclipseState('ECLIPSE MULTIBALL')
    this.resetRollovers()
    this.audio.playMultiball()
    this.shakeCamera('multiball')
    this.flashPlayfield(theme.eclipseRed)
    this.ceremonialBurst(tableLayout.table.width / 2, 650, theme.ember)
    this.balls.forEach((ball) => this.flashCircle(ball.image.x, ball.image.y, tableLayout.ball.radius * 2.2, theme.ember, tableLayout.juice.jackpotFlashDurationMs))
    this.addScore(tableLayout.tuning.eclipseMultiballStartScore)
    this.showScorePopup(tableLayout.table.width / 2, 650, 'ECLIPSE MULTIBALL', tableLayout.tuning.eclipseMultiballStartScore, {
      major: true,
      event: true,
      color: theme.css.ember,
    })
    this.activateBallSaver(tableLayout.tuning.eclipseMultiballBallSaveDurationMs)
    this.ballSaverArmed = false
    this.drainResetPending = false
    this.setBallState('IN PLAY')
  }

  private checkMultiballEnd() {
    if (this.eclipseState !== 'ECLIPSE MULTIBALL' || this.balls.length > 1) {
      return
    }

    this.setEclipseState('NORMAL')
    this.resetRollovers()
  }

  private registerLaneComboHit(ball?: BallRuntime) {
    if (this.time.now - this.lastLaneComboAt < tableLayout.tuning.comboLaneCooldownMs) {
      return
    }

    this.lastLaneComboAt = this.time.now
    this.registerComboHit('targetOrLane', ball)
  }

  private registerComboHit(hit: ComboHitKind, ball = this.primaryBall()) {
    const now = this.time.now
    if (now - this.lastComboAt > tableLayout.tuning.comboWindowMs) {
      this.comboStep = 0
    }

    if (hit === 'bumper') {
      this.comboStep = 1
      this.lastComboAt = now
      return
    }

    if (hit === 'sling' && this.comboStep === 1) {
      this.comboStep = 2
      this.lastComboAt = now
      this.awardCombo(2, ball)
      return
    }

    if (hit === 'targetOrLane' && this.comboStep === 2) {
      this.comboStep = 0
      this.lastComboAt = 0
      this.awardCombo(3, ball)
      return
    }

    this.comboStep = 0
    this.lastComboAt = 0
  }

  private awardCombo(multiplier: 2 | 3, ball = this.primaryBall()) {
    if (!ball) {
      return
    }

    const points = multiplier === 2 ? tableLayout.tuning.comboX2Score : tableLayout.tuning.comboX3Score
    this.addScore(points)
    this.showScorePopup(ball.image.x, ball.image.y - 64, `COMBO x${multiplier}`, points, {
      major: multiplier === 3,
      color: theme.css.brightJade,
    })
  }

  private addScore(points: number) {
    this.score += points
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.saveHighScore()
      this.updateStartHighScore()
    }
    this.updateHud()
  }

  private loadHighScore() {
    if (typeof window === 'undefined') {
      return 0
    }

    const stored = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10)
    return Number.isFinite(stored) && stored > 0 ? stored : 0
  }

  private saveHighScore() {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore))
  }

  private confirmChampionInitials() {
    if (!this.awaitingChampionInitials || this.pendingChampionScore === null || !this.championInitialsReady()) {
      return
    }

    const carvedScore = this.pendingChampionScore
    const carvedInitials = this.championInitials.join('')
    this.champions = saveChampionScore(carvedScore, carvedInitials, this.champions)
    this.audio.playChampionCarved()
    const carvedRank = this.champions.findIndex((champion) => champion.score === carvedScore && champion.initials === carvedInitials)
    this.pendingChampionScore = null
    this.awaitingChampionInitials = false
    if (this.initialsSelectionMarker) {
      this.tweens.killTweensOf(this.initialsSelectionMarker)
      this.initialsSelectionMarker.setAlpha(0.9)
    }
    this.showLocalWall('SAVED LOCALLY')
    this.gameOverOverlay?.setVisible(false)
    this.initialsEntryPanel?.setVisible(false)
    this.startOverlay?.setVisible(true)
    this.revealUpdatedWallOfChampions(carvedRank)
    this.updateHud()
    void this.submitChampionGlobally(carvedInitials, carvedScore).catch(() => this.showGlobalWallUnavailable(true))
  }

  private revealUpdatedWallOfChampions(carvedRank: number) {
    const startPrompt = this.startOverlay?.getByName('startPrompt') as Phaser.GameObjects.Text | null
    startPrompt
      ?.setText('SCORE CARVED\nTap / Press Space to Start')
      .setFontSize(30)
      .setLineSpacing(7)

    if (!this.wallOfChampionsRevealAccent) {
      return
    }

    this.tweens.killTweensOf(this.wallOfChampionsRevealAccent)
    this.wallOfChampionsRevealAccent.setAlpha(0.18)
    this.tweens.add({
      targets: this.wallOfChampionsRevealAccent,
      alpha: 0.96,
      duration: 280,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 2,
    })

    this.highlightWallEntry(carvedRank, this.champions.length)
  }

  private highlightWallEntry(rank: number, entryCount: number) {
    if (!this.wallRecentEntryAccent || rank < 0 || rank >= entryCount) {
      return
    }

    this.tweens.killTweensOf(this.wallRecentEntryAccent)
    this.wallRecentEntryAccent
      .setY(-29 + rank * 56)
      .setVisible(true)
      .setAlpha(0)
    this.tweens.add({
      targets: this.wallRecentEntryAccent,
      alpha: 0.84,
      duration: 320,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 3,
      onComplete: () => this.wallRecentEntryAccent?.setVisible(false),
    })
  }

  private updateStartHighScore() {
    const highScoreText = this.startOverlay?.getByName('startHighScore') as Phaser.GameObjects.Text | null
    highScoreText?.setText(`HIGH SCORE ${this.highScore}`)
  }

  private updateGameOverOverlay() {
    this.updateStartHighScore()
    const labelText = this.gameOverOverlay?.getByName('gameOverLabel') as Phaser.GameObjects.Text | null
    const finalScoreText = this.gameOverOverlay?.getByName('gameOverFinalScore') as Phaser.GameObjects.Text | null
    const highScoreText = this.gameOverOverlay?.getByName('gameOverHighScore') as Phaser.GameObjects.Text | null
    const promptText = this.gameOverOverlay?.getByName('gameOverPrompt') as Phaser.GameObjects.Text | null
    const championFlow = this.awaitingChampionInitials

    this.gameOverPlateShadow?.setVisible(!championFlow)
    this.gameOverPlate?.setVisible(!championFlow)
    this.gameOverPlateTrim?.setVisible(!championFlow)
    this.championCeremonyDecor?.setVisible(championFlow)

    labelText
      ?.setText(championFlow ? 'NEW CHAMPION' : 'GAME OVER')
      .setColor(championFlow ? theme.css.ember : theme.css.ivory)
      .setFontSize(championFlow ? 64 : 54)
      .setY(championFlow ? 710 : 900)
      .setShadow(0, championFlow ? 0 : 3, championFlow ? theme.css.ember : theme.css.ink, championFlow ? 20 : 10, true, true)

    finalScoreText
      ?.setY(championFlow ? 838 : 994)
      .setFontSize(championFlow ? 38 : 28)
      .setColor(theme.css.agedGold)
      .setLineSpacing(championFlow ? 8 : 0)
      .setText(championFlow ? `FINAL SCORE\n${this.score.toLocaleString('en-US')}` : `FINAL SCORE ${this.score.toLocaleString('en-US')}`)

    highScoreText?.setVisible(!championFlow)
    highScoreText?.setText(`HIGH SCORE ${this.highScore}`)
    promptText
      ?.setY(championFlow ? 1450 : 1160)
      .setFontSize(27)
      .setColor(theme.css.bone)
      .setText(championFlow ? 'Tap CARVE SCORE or press Enter' : 'Tap / Press Space to Restart')
    this.initialsEntryPanel?.setVisible(championFlow)
    if (championFlow) {
      this.updateInitialsEntryUi()
      this.championCeremonyDecor?.setAlpha(0)
      this.initialsEntryPanel?.setAlpha(0)
      labelText?.setAlpha(0).setScale(0.92)
      finalScoreText?.setAlpha(0)
      promptText?.setAlpha(0)
      this.championCeremonyGlow?.setAlpha(0.08)
      this.tweens.add({
        targets: this.championCeremonyDecor,
        alpha: 1,
        duration: 380,
        ease: 'Sine.easeOut',
      })
      if (this.championCeremonyGlow) {
        this.tweens.killTweensOf(this.championCeremonyGlow)
        this.tweens.add({
          targets: this.championCeremonyGlow,
          alpha: 0.5,
          duration: 620,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: 2,
        })
      }
      if (labelText) {
        this.tweens.add({
          targets: labelText,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 430,
          delay: 70,
          ease: 'Back.easeOut',
        })
      }
      if (finalScoreText) {
        this.tweens.add({
          targets: finalScoreText,
          alpha: 1,
          duration: 340,
          delay: 150,
          ease: 'Sine.easeOut',
        })
      }
      if (this.initialsEntryPanel) {
        this.tweens.add({
          targets: this.initialsEntryPanel,
          alpha: 1,
          duration: 360,
          delay: 210,
          ease: 'Sine.easeOut',
        })
      }
      if (promptText) {
        this.tweens.add({
          targets: promptText,
          alpha: 1,
          duration: 300,
          delay: 280,
          ease: 'Sine.easeOut',
        })
      }
    } else {
      labelText?.setAlpha(1).setScale(1)
      finalScoreText?.setAlpha(1)
      promptText?.setAlpha(1)
    }
  }

  private showScorePopup(x: number, y: number, label: string, points?: number, options: ScorePopupOptions = {}) {
    if (points !== undefined) {
      this.lastScoreEvent = `${label} +${points}`
    }

    const popupRise = options.event
      ? tableLayout.tuning.eventScorePopupRise
      : options.major
        ? tableLayout.tuning.majorScorePopupRise
        : tableLayout.tuning.scorePopupRise
    const popupDuration = options.event
      ? tableLayout.tuning.eventScorePopupDurationMs
      : options.major
        ? tableLayout.tuning.majorScorePopupDurationMs
        : tableLayout.tuning.scorePopupDurationMs
    const fontSize = options.event
      ? tableLayout.tuning.eventScorePopupFontSize
      : options.major
        ? tableLayout.tuning.majorScorePopupFontSize
        : tableLayout.tuning.scorePopupFontSize
    const text = this.add
      .text(x, y, points ? `${label} +${points}` : label, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: `${fontSize}px`,
        color: options.color ?? theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: options.major ? 6 : 4,
      })
      .setOrigin(0.5)
      .setDepth(45)

    this.tweens.add({
      targets: text,
      y: y - popupRise,
      alpha: 0,
      duration: popupDuration,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  private pulse(
    target?: Phaser.GameObjects.GameObject & { setScale: (x: number, y?: number) => unknown },
    scale = tableLayout.tuning.pulseScale,
    duration = tableLayout.tuning.pulseDurationMs,
  ) {
    if (!target) {
      return
    }

    this.tweens.killTweensOf(target)
    target.setScale(1)
    this.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => target.setScale(1),
    })
  }

  private pulseBumperVisual(bumper: BumperBody) {
    const visual = this.bumperVisuals.get(bumper.id)
    this.pulse(visual, tableLayout.tuning.pulseScale + 0.1)

    const hitGlow = visual?.getByName('hitGlow') as Phaser.GameObjects.Arc | null
    const coreGlow = visual?.getByName('coreGlow') as Phaser.GameObjects.Arc | null

    if (hitGlow) {
      this.tweens.killTweensOf(hitGlow)
      hitGlow.setAlpha(0.68)
      hitGlow.setScale(0.86)
      this.tweens.add({
        targets: hitGlow,
        alpha: 0,
        scaleX: 1.45,
        scaleY: 1.45,
        duration: tableLayout.tuning.pulseDurationMs * 1.65,
        ease: 'Sine.easeOut',
        onComplete: () => hitGlow.setScale(1),
      })
    }

    if (coreGlow) {
      this.tweens.killTweensOf(coreGlow)
      coreGlow.setFillStyle(theme.brightJade, 0.62)
      this.tweens.add({
        targets: coreGlow,
        alpha: 0.78,
        scaleX: 1.22,
        scaleY: 1.22,
        duration: tableLayout.tuning.pulseDurationMs,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => {
          coreGlow.setAlpha(1)
          coreGlow.setScale(1)
          coreGlow.setFillStyle(theme.jade, 0.36)
        },
      })
    }
  }

  private updateMultiballTrail() {
    if (this.eclipseState !== 'ECLIPSE MULTIBALL' || this.time.now - this.lastTrailAt < tableLayout.juice.trailIntervalMs) {
      return
    }

    this.lastTrailAt = this.time.now
    this.balls.forEach((ball) => {
      const trail = this.add
        .circle(
          ball.image.x,
          ball.image.y,
          tableLayout.ball.radius * tableLayout.juice.trailRadiusScale,
          theme.ember,
          tableLayout.juice.trailAlpha,
        )
        .setDepth(9)

      this.tweens.add({
        targets: trail,
        scaleX: 0.35,
        scaleY: 0.35,
        alpha: 0,
        duration: tableLayout.juice.trailDurationMs,
        ease: 'Sine.easeOut',
        onComplete: () => trail.destroy(),
      })
    })
  }

  private applyBallForce(ball: BallRuntime, x: number, y: number) {
    this.matter.body.applyForce(ball.body, ball.body.position, { x, y })
  }

  private kickBallAwayFrom(ball: BallRuntime, origin: Point, force: number) {
    const dx = ball.body.position.x - origin.x
    const dy = ball.body.position.y - origin.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    this.applyBallForce(ball, (dx / distance) * force, (dy / distance) * force)
  }

  private maybeApplyFlipperImpulse(flipper: FlipperRuntime) {
    if (!flipper.pressed || this.time.now - flipper.lastImpulseAt < tableLayout.tuning.flipperImpulseCooldownMs) {
      return
    }

    const segmentStart = flipper.config.pivot
    const segmentEnd = this.pointFromPivot(flipper.config.pivot, flipper.currentAngle, flipper.config.length)
    const hitRange = tableLayout.ball.radius + flipper.config.width / 2 + tableLayout.tuning.flipperContactRadius
    const hit = this.balls
      .map((ball) => ({ ball, closest: this.closestPointOnSegment(ball.body.position, segmentStart, segmentEnd) }))
      .filter((candidate) => candidate.closest.distance <= hitRange)
      .sort((a, b) => b.closest.t - a.closest.t)[0]

    if (!hit) {
      return
    }

    flipper.lastImpulseAt = this.time.now
    const side = flipper.config.id === 'left' ? 1 : -1
    const tipPower = 0.75 + hit.closest.t * 0.55
    const impulse = tableLayout.tuning.flipperImpulse * tipPower
    const nextVelocityX = Phaser.Math.Clamp(hit.ball.body.velocity.x + side * impulse * 0.5, -34, 34)
    const nextVelocityY = Math.min(hit.ball.body.velocity.y, -3) - impulse

    hit.ball.image.setVelocity(nextVelocityX, nextVelocityY)
    hit.ball.lastMotionAt = this.time.now
  }

  private segmentTransform(from: Point, to: Point) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      length: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx),
    }
  }

  private pointFromPivot(pivot: Point, angle: number, distance: number): Point {
    return {
      x: pivot.x + Math.cos(angle) * distance,
      y: pivot.y + Math.sin(angle) * distance,
    }
  }

  private normalizedVector(vector: Point, fallback: Point): Point {
    const length = Math.hypot(vector.x, vector.y)
    if (length > 0) {
      return {
        x: vector.x / length,
        y: vector.y / length,
      }
    }

    const fallbackLength = Math.max(1, Math.hypot(fallback.x, fallback.y))
    return {
      x: fallback.x / fallbackLength,
      y: fallback.y / fallbackLength,
    }
  }

  private screenToTablePoint(pointer: Phaser.Input.Pointer): Point {
    return {
      x: pointer.x,
      y: pointer.y,
    }
  }

  private pointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    )
  }

  private pointInCenteredRect(point: Point, rect: { x: number; y: number; width: number; height: number }) {
    return (
      point.x >= rect.x - rect.width / 2 &&
      point.x <= rect.x + rect.width / 2 &&
      point.y >= rect.y - rect.height / 2 &&
      point.y <= rect.y + rect.height / 2
    )
  }

  private closestPointOnSegment(point: Point, start: Point, end: Point) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const rawT = lengthSquared === 0 ? 0 : ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    const t = Phaser.Math.Clamp(rawT, 0, 1)
    const x = start.x + dx * t
    const y = start.y + dy * t

    return {
      x,
      y,
      t,
      distance: Math.hypot(point.x - x, point.y - y),
    }
  }

  private updateShotTestOverlay() {
    const ball = this.primaryBall()
    if (!ball) {
      this.shotTestText.setText('SHOT TEST MODE  no active balls')
      return
    }

    const velocity = ball.body.velocity
    const stuckSeconds = this.stuckTimerMs() / 1000
    this.shotTestText.setText(
      [
        'SHOT TEST MODE  1-5 place  Shift+1-3 shot  C clear',
        `BALLS ${this.balls.length}  MODE ${this.eclipseState}`,
        `BALL x ${this.formatTelemetryNumber(ball.image.x)}  y ${this.formatTelemetryNumber(ball.image.y)}`,
        `VEL  x ${this.formatTelemetryNumber(velocity.x)}  y ${this.formatTelemetryNumber(velocity.y)}`,
        `ZONE ${this.currentZone()}`,
        `LAST SENSOR ${this.lastSensorHit}`,
        `LAST SCORE ${this.lastScoreEvent}`,
        `STUCK ${stuckSeconds.toFixed(2)}s`,
      ].join('\n'),
    )
  }

  private currentZone(ball = this.primaryBall()) {
    if (!ball) {
      return 'no ball'
    }

    const outOfBounds = ball.image.x < 0 || ball.image.x > tableLayout.table.width || ball.image.y < 0 || ball.image.y > tableLayout.table.height
    if (outOfBounds) {
      return 'out of bounds'
    }

    const sensor = tableLayout.sensors.find((item) => this.pointInCenteredRect(ball.image, item))
    if (sensor) {
      return `${sensor.kind}:${sensor.id}`
    }

    const trapKicker = tableLayout.trapKickers.find((zone) => this.pointInCenteredRect(ball.image, zone))
    if (trapKicker) {
      return `trapKicker:${trapKicker.id}`
    }

    if (this.isBallInPlungerLane(ball)) {
      return 'plunger lane'
    }

    if (ball.image.y < 860) {
      return 'upper playfield'
    }

    if (ball.image.y < 1320) {
      return 'middle playfield'
    }

    if (ball.image.y < 1740) {
      return 'lower playfield'
    }

    return 'drain apron'
  }

  private stuckTimerMs(ball = this.primaryBall()) {
    if (!ball || this.ballState === 'DRAINED' || this.gameOver || this.isBallInPlungerLane(ball)) {
      return 0
    }

    const speed = Math.hypot(ball.body.velocity.x, ball.body.velocity.y)
    if (speed > tableLayout.tuning.stuckVelocityThreshold) {
      return 0
    }

    return Math.max(0, this.time.now - ball.lastMotionAt)
  }

  private formatTelemetryNumber(value: number) {
    return value.toFixed(1).padStart(6, ' ')
  }

  private drawRuntimeInsertUnderlays() {
    const graphics = this.playfieldGraphics
    graphics.clear()
    this.drawGuideRails(graphics)
    this.drawRolloverGateHardware(graphics)

    const bumperAlignment = tableLayout.visualAlignment.bumpers
    tableLayout.bumpers.forEach((bumper) => {
      const position = this.visualBumperPosition(bumper)
      const radius = bumper.radius * bumperAlignment.scale * 1.28
      graphics.fillStyle(theme.obsidian, 0.12)
      graphics.fillCircle(position.x, position.y, radius)
      graphics.lineStyle(2, theme.goldShadow, 0.16)
      graphics.strokeCircle(position.x, position.y, radius)
    })
  }

  private drawRolloverGateHardware(graphics: Phaser.GameObjects.Graphics) {
    const hardware = tableLayout.rolloverGateHardware
    const alignment = tableLayout.visualAlignment.rollovers
    const rolloverSensors = tableLayout.sensors.filter((sensor) => sensor.kind === 'rollover')
    if (rolloverSensors.length === 0) {
      return
    }

    const centerIndex = (this.rolloverCount() + 1) / 2
    const visualCenters = rolloverSensors.map((sensor) => {
      const rolloverIndex = Number.parseInt(sensor.id.replace('rollover-', ''), 10)
      const gapOffset = Number.isFinite(rolloverIndex) ? (rolloverIndex - centerIndex) * alignment.gapAdjust : 0
      return sensor.x + alignment.offsetX + gapOffset
    })
    const visualY = rolloverSensors[0].y + alignment.offsetY
    const visualWidth = rolloverSensors[0].width * alignment.widthScale
    const leftEdge = Math.min(...visualCenters) - visualWidth / 2
    const rightEdge = Math.max(...visualCenters) + visualWidth / 2
    const topY = visualY + hardware.topOffsetY
    const lowerY = visualY + hardware.lowerOffsetY
    const leftTop = { x: leftEdge - hardware.sideOverhang, y: topY }
    const rightTop = { x: rightEdge + hardware.sideOverhang, y: topY }
    const leftLower = { x: leftEdge - 8, y: lowerY }
    const rightLower = { x: rightEdge + 8, y: lowerY }
    const backingX = leftTop.x - hardware.postRadius
    const backingY = topY - hardware.railWidth * 0.72
    const backingWidth = rightTop.x - leftTop.x + hardware.postRadius * 2
    const backingHeight = lowerY - topY + hardware.bracketDrop + hardware.railWidth * 0.98

    graphics.fillStyle(theme.ink, hardware.backingAlpha)
    graphics.fillRoundedRect(backingX, backingY, backingWidth, backingHeight, 9)
    graphics.lineStyle(1, theme.goldShadow, hardware.alpha * 0.22)
    graphics.strokeRoundedRect(backingX, backingY, backingWidth, backingHeight, 9)

    this.drawPremiumHardwareBar(graphics, leftTop, rightTop, hardware.railWidth, hardware.alpha, {
      trimAlpha: hardware.alpha * 0.78,
      jadeAlpha: hardware.jadeAlpha,
      endCaps: true,
      capRadius: hardware.postRadius,
    })
    this.drawPremiumHardwareBar(graphics, { x: leftTop.x + 8, y: topY + 4 }, leftLower, Math.max(7, hardware.railWidth * 0.58), hardware.alpha * 0.86, {
      trimAlpha: hardware.alpha * 0.62,
      jadeAlpha: hardware.jadeAlpha * 0.74,
      endCaps: false,
    })
    this.drawPremiumHardwareBar(graphics, { x: rightTop.x - 8, y: topY + 4 }, rightLower, Math.max(7, hardware.railWidth * 0.58), hardware.alpha * 0.86, {
      trimAlpha: hardware.alpha * 0.62,
      jadeAlpha: hardware.jadeAlpha * 0.74,
      endCaps: false,
    })
    this.drawPremiumHardwareBar(graphics, leftLower, rightLower, hardware.lipWidth, hardware.alpha * 0.8, {
      trimAlpha: hardware.alpha * 0.64,
      jadeAlpha: hardware.jadeAlpha * 0.42,
      endCaps: false,
    })

    visualCenters.forEach((centerX) => {
      this.drawPremiumHardwareBar(
        graphics,
        { x: centerX, y: lowerY - hardware.bracketDrop * 0.42 },
        { x: centerX, y: lowerY + hardware.bracketDrop },
        hardware.bracketWidth,
        hardware.alpha * 0.72,
        {
          trimAlpha: hardware.alpha * 0.5,
          jadeAlpha: hardware.jadeAlpha * 0.36,
          endCaps: false,
        },
      )
    })

    this.drawMetalPost(graphics, leftLower.x, leftLower.y, hardware.postRadius * 0.78, hardware.alpha * 0.92, true)
    this.drawMetalPost(graphics, rightLower.x, rightLower.y, hardware.postRadius * 0.78, hardware.alpha * 0.92, true)
    for (let index = 0; index < visualCenters.length - 1; index += 1) {
      const dividerX = (visualCenters[index] + visualCenters[index + 1]) / 2
      this.drawMetalPost(graphics, dividerX, lowerY + hardware.bracketDrop * 0.26, hardware.postRadius * 0.62, hardware.alpha * 0.82, true)
    }
  }

  private drawGuideRails(graphics: Phaser.GameObjects.Graphics) {
    tableLayout.guideRails.forEach((guide) => {
      const segment = tableLayout.wallSegments.find((item) => item.id === guide.wallId)
      if (!segment) {
        return
      }

      this.drawGuideRail(graphics, segment, guide)
    })
  }

  private drawGuideRail(graphics: Phaser.GameObjects.Graphics, segment: WallSegment, guide: GuideRailVisual) {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }

    const ux = dx / length
    const uy = dy / length
    const startInset = Math.max(0, guide.startInset ?? 0)
    const endInset = Math.max(0, guide.endInset ?? 0)
    const drawableLength = length - startInset - endInset
    if (drawableLength <= 0) {
      return
    }

    const from = {
      x: segment.from.x + ux * startInset,
      y: segment.from.y + uy * startInset,
    }
    const to = {
      x: segment.to.x - ux * endInset,
      y: segment.to.y - uy * endInset,
    }
    const nx = -uy
    const ny = ux
    const width = guide.width ?? Math.max(8, segment.thickness * 0.62)
    const alpha = guide.alpha ?? 0.22
    const trimOffset = guide.trimOffset ?? width * 0.62
    const trimAlpha = guide.trimAlpha ?? alpha * 0.78
    const trimWidth = Math.max(1.4, width * 0.12)

    if (guide.style === 'slingGuard') {
      this.drawSlingGuardHardware(graphics, from, to, width, alpha, {
        trimOffset,
        trimAlpha,
        jadeAlpha: guide.jadeEdge ? alpha * 0.52 : alpha * 0.12,
        endCaps: guide.endCaps ?? true,
        rivetSpacing: guide.rivetSpacing,
        rivetAlpha: guide.rivetAlpha,
      })
      return
    }

    if (guide.style === 'lowerHardware') {
      this.drawLowerGuideHardware(graphics, from, to, width, alpha, {
        trimOffset,
        trimAlpha,
        jadeAlpha: guide.jadeEdge ? alpha * 0.42 : alpha * 0.12,
        endCaps: guide.endCaps ?? true,
        rivetSpacing: guide.rivetSpacing,
        rivetAlpha: guide.rivetAlpha,
      })
      return
    }

    if (guide.style === 'shortDeflector') {
      this.drawShortDeflectorHardware(graphics, from, to, width, alpha, {
        trimOffset,
        trimAlpha,
        jadeAlpha: guide.jadeEdge ? alpha * 0.46 : 0,
        endCaps: guide.endCaps ?? true,
        rivetSpacing: guide.rivetSpacing,
        rivetAlpha: guide.rivetAlpha,
      })
      return
    }

    if (guide.style === 'deflector') {
      this.drawPremiumHardwareBar(graphics, from, to, width, alpha, {
        trimAlpha,
        jadeAlpha: guide.jadeEdge ? alpha * 0.34 : alpha * 0.12,
        endCaps: guide.endCaps ?? true,
        rivetSpacing: guide.rivetSpacing,
        rivetAlpha: guide.rivetAlpha,
        capRadius: Math.max(5, width * 0.48),
      })
      return
    }

    const line = (offset: number, color: number, lineWidth: number, lineAlpha: number) => {
      graphics.lineStyle(lineWidth, color, lineAlpha)
      graphics.lineBetween(
        from.x + nx * offset,
        from.y + ny * offset,
        to.x + nx * offset,
        to.y + ny * offset,
      )
    }

    line(0, theme.ink, width + 8, alpha * 0.42)
    line(0, theme.charcoal, width + 2, alpha * 0.46)
    line(0, theme.obsidian, width, alpha)
    line(0, theme.goldShadow, Math.max(1, width * 0.08), alpha * 0.12)
    line(trimOffset, theme.agedGold, trimWidth, trimAlpha)
    line(-trimOffset, theme.goldShadow, Math.max(1.2, trimWidth * 0.82), trimAlpha * 0.78)

    if (guide.jadeEdge) {
      line(trimOffset * 0.48, theme.jade, Math.max(1, trimWidth * 0.58), alpha * 0.34)
    }

    if (guide.rivetSpacing && guide.rivetSpacing > 0) {
      for (let distance = guide.rivetSpacing; distance < drawableLength; distance += guide.rivetSpacing) {
        const x = from.x + ux * distance
        const y = from.y + uy * distance
        graphics.fillStyle(theme.goldShadow, guide.rivetAlpha ?? alpha * 0.52)
        graphics.fillCircle(x, y, Math.max(1.6, width * 0.12))
        graphics.fillStyle(theme.agedGold, (guide.rivetAlpha ?? alpha * 0.52) * 0.5)
        graphics.fillCircle(x - nx * width * 0.04, y - ny * width * 0.04, Math.max(0.9, width * 0.06))
      }
    }

    if (guide.endCaps) {
      const capRadius = Math.max(4, width * 0.42)
      graphics.fillStyle(theme.obsidian, alpha)
      graphics.fillCircle(from.x, from.y, capRadius)
      graphics.fillCircle(to.x, to.y, capRadius)
      graphics.lineStyle(Math.max(1.5, trimWidth), theme.agedGold, trimAlpha)
      graphics.strokeCircle(from.x, from.y, capRadius)
      graphics.strokeCircle(to.x, to.y, capRadius)
    }
  }

  private drawShortDeflectorHardware(
    graphics: Phaser.GameObjects.Graphics,
    from: Point,
    to: Point,
    width: number,
    alpha: number,
    options: {
      trimOffset: number
      trimAlpha: number
      jadeAlpha: number
      endCaps: boolean
      rivetSpacing?: number
      rivetAlpha?: number
    },
  ) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }

    const ux = dx / length
    const uy = dy / length
    const nx = -uy
    const ny = ux
    const line = (offset: number, color: number, lineWidth: number, lineAlpha: number) => {
      graphics.lineStyle(lineWidth, color, lineAlpha)
      graphics.lineBetween(
        from.x + nx * offset,
        from.y + ny * offset,
        to.x + nx * offset,
        to.y + ny * offset,
      )
    }

    graphics.lineStyle(width + 18, theme.ink, alpha * 0.4)
    graphics.lineBetween(from.x + 3, from.y + 5, to.x + 3, to.y + 5)
    line(0, theme.goldShadow, width + 8, alpha * 0.72)
    line(0, theme.obsidian, width + 1, alpha * 0.98)
    line(-options.trimOffset * 0.7, theme.agedGold, Math.max(3.2, width * 0.18), options.trimAlpha)
    line(options.trimOffset * 0.68, theme.goldShadow, Math.max(2.2, width * 0.12), options.trimAlpha * 0.72)
    line(0, theme.charcoal, Math.max(3.4, width * 0.18), alpha * 0.66)
    line(0, theme.ink, Math.max(1.4, width * 0.06), alpha * 0.38)

    if (options.jadeAlpha > 0) {
      line(width * 0.1, theme.jade, Math.max(1.6, width * 0.07), options.jadeAlpha)
      line(width * 0.1, theme.brightJade, Math.max(0.8, width * 0.032), options.jadeAlpha * 0.44)
    }

    const bracketSpan = width * 0.58
    ;[length * 0.32, length * 0.68].forEach((distance) => {
      const x = from.x + ux * distance
      const y = from.y + uy * distance
      graphics.lineStyle(Math.max(3, width * 0.15), theme.agedGold, options.trimAlpha * 0.66)
      graphics.lineBetween(x - nx * bracketSpan, y - ny * bracketSpan, x + nx * bracketSpan, y + ny * bracketSpan)
      graphics.lineStyle(Math.max(1.2, width * 0.055), theme.ink, alpha * 0.44)
      graphics.lineBetween(x - nx * bracketSpan * 0.48, y - ny * bracketSpan * 0.48, x + nx * bracketSpan * 0.48, y + ny * bracketSpan * 0.48)
    })

    if (options.rivetSpacing && options.rivetSpacing > 0) {
      for (let distance = options.rivetSpacing; distance < length; distance += options.rivetSpacing) {
        const x = from.x + ux * distance
        const y = from.y + uy * distance
        const rivetAlpha = options.rivetAlpha ?? alpha * 0.58
        this.drawMetalPost(graphics, x - nx * width * 0.24, y - ny * width * 0.24, Math.max(3.2, width * 0.13), rivetAlpha, false)
        this.drawMetalPost(graphics, x + nx * width * 0.24, y + ny * width * 0.24, Math.max(2.8, width * 0.11), rivetAlpha * 0.76, false)
      }
    }

    graphics.fillStyle(theme.ember, alpha * 0.24)
    graphics.fillCircle(from.x + ux * length * 0.5, from.y + uy * length * 0.5, Math.max(2.2, width * 0.09))

    if (options.endCaps) {
      const capRadius = Math.max(7, width * 0.34)
      this.drawMetalPost(graphics, from.x, from.y, capRadius, alpha * 0.94, options.jadeAlpha > 0)
      this.drawMetalPost(graphics, to.x, to.y, capRadius, alpha * 0.94, options.jadeAlpha > 0)
    }
  }

  private drawSlingGuardHardware(
    graphics: Phaser.GameObjects.Graphics,
    from: Point,
    to: Point,
    width: number,
    alpha: number,
    options: {
      trimOffset: number
      trimAlpha: number
      jadeAlpha: number
      endCaps: boolean
      rivetSpacing?: number
      rivetAlpha?: number
    },
  ) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }

    const ux = dx / length
    const uy = dy / length
    const nx = -uy
    const ny = ux
    const line = (offset: number, color: number, lineWidth: number, lineAlpha: number) => {
      graphics.lineStyle(lineWidth, color, lineAlpha)
      graphics.lineBetween(
        from.x + nx * offset,
        from.y + ny * offset,
        to.x + nx * offset,
        to.y + ny * offset,
      )
    }

    graphics.lineStyle(width + 20, theme.ink, alpha * 0.34)
    graphics.lineBetween(from.x + 3, from.y + 6, to.x + 3, to.y + 6)
    line(0, theme.ink, width + 13, alpha * 0.66)
    line(0, theme.goldShadow, width + 7, alpha * 0.54)
    line(0, theme.obsidian, width + 1, alpha)
    line(-options.trimOffset * 0.72, theme.agedGold, Math.max(3, width * 0.18), options.trimAlpha)
    line(options.trimOffset * 0.68, theme.goldShadow, Math.max(2, width * 0.12), options.trimAlpha * 0.84)
    line(0, theme.charcoal, Math.max(3.5, width * 0.2), alpha * 0.68)
    line(0, theme.ink, Math.max(1.4, width * 0.06), alpha * 0.42)

    if (options.jadeAlpha > 0) {
      line(width * 0.18, theme.jade, Math.max(1.5, width * 0.07), options.jadeAlpha)
      line(width * 0.18, theme.brightJade, Math.max(0.8, width * 0.03), options.jadeAlpha * 0.42)
    }

    const bracketWidth = Math.max(4, width * 0.18)
    const bracketSpan = width * 0.68
    const bracketDistances = [Math.min(18, length * 0.16), length * 0.5, length - Math.min(18, length * 0.16)]
    bracketDistances.forEach((distance, index) => {
      const x = from.x + ux * distance
      const y = from.y + uy * distance
      graphics.lineStyle(bracketWidth, index === 1 ? theme.agedGold : theme.goldShadow, options.trimAlpha * (index === 1 ? 0.74 : 0.62))
      graphics.lineBetween(x - nx * bracketSpan, y - ny * bracketSpan, x + nx * bracketSpan, y + ny * bracketSpan)
      graphics.lineStyle(Math.max(1.4, bracketWidth * 0.38), theme.ink, alpha * 0.42)
      graphics.lineBetween(x - nx * bracketSpan * 0.58, y - ny * bracketSpan * 0.58, x + nx * bracketSpan * 0.58, y + ny * bracketSpan * 0.58)
    })

    if (options.rivetSpacing && options.rivetSpacing > 0) {
      for (let distance = options.rivetSpacing; distance < length; distance += options.rivetSpacing) {
        const rivetAlpha = options.rivetAlpha ?? alpha * 0.54
        const leftX = from.x + ux * distance - nx * width * 0.31
        const leftY = from.y + uy * distance - ny * width * 0.31
        const rightX = from.x + ux * distance + nx * width * 0.31
        const rightY = from.y + uy * distance + ny * width * 0.31
        this.drawMetalPost(graphics, leftX, leftY, Math.max(3.4, width * 0.13), rivetAlpha, false)
        this.drawMetalPost(graphics, rightX, rightY, Math.max(3.1, width * 0.11), rivetAlpha * 0.84, false)
      }
    }

    const accentDistance = length * 0.64
    graphics.fillStyle(theme.ember, alpha * 0.26)
    graphics.fillCircle(
      from.x + ux * accentDistance - nx * width * 0.05,
      from.y + uy * accentDistance - ny * width * 0.05,
      Math.max(2.2, width * 0.09),
    )

    if (options.endCaps) {
      const capRadius = Math.max(7, width * 0.34)
      this.drawMetalPost(graphics, from.x, from.y, capRadius, alpha * 0.92, options.jadeAlpha > alpha * 0.18)
      this.drawMetalPost(graphics, to.x, to.y, capRadius, alpha * 0.92, options.jadeAlpha > alpha * 0.18)
    }
  }

  private drawLowerGuideHardware(
    graphics: Phaser.GameObjects.Graphics,
    from: Point,
    to: Point,
    width: number,
    alpha: number,
    options: {
      trimOffset: number
      trimAlpha: number
      jadeAlpha: number
      endCaps: boolean
      rivetSpacing?: number
      rivetAlpha?: number
    },
  ) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }

    const ux = dx / length
    const uy = dy / length
    const nx = -uy
    const ny = ux
    const line = (offset: number, color: number, lineWidth: number, lineAlpha: number) => {
      graphics.lineStyle(lineWidth, color, lineAlpha)
      graphics.lineBetween(
        from.x + nx * offset,
        from.y + ny * offset,
        to.x + nx * offset,
        to.y + ny * offset,
      )
    }

    graphics.lineStyle(width + 16, theme.ink, alpha * 0.26)
    graphics.lineBetween(from.x + 2, from.y + 5, to.x + 2, to.y + 5)
    line(0, theme.ink, width + 10, alpha * 0.58)
    line(0, theme.charcoal, width + 5, alpha * 0.78)
    line(0, theme.obsidian, width, alpha * 1.08)
    line(-width * 0.42, theme.goldShadow, Math.max(2.2, width * 0.18), options.trimAlpha * 0.82)
    line(-width * 0.28, theme.agedGold, Math.max(1.5, width * 0.09), options.trimAlpha)
    line(width * 0.38, theme.goldShadow, Math.max(1.4, width * 0.08), options.trimAlpha * 0.66)
    line(0, theme.ink, Math.max(1.4, width * 0.08), alpha * 0.34)

    if (options.jadeAlpha > 0) {
      line(width * 0.08, theme.jade, Math.max(1.2, width * 0.07), options.jadeAlpha)
      line(width * 0.08, theme.brightJade, Math.max(0.8, width * 0.035), options.jadeAlpha * 0.42)
    }

    const bracketInset = Math.min(24, length * 0.18)
    ;[bracketInset, length - bracketInset].forEach((distance) => {
      const x = from.x + ux * distance
      const y = from.y + uy * distance
      lineAtPoint(graphics, x, y, nx, ny, width * 0.58, Math.max(3, width * 0.16), theme.agedGold, options.trimAlpha * 0.72)
      lineAtPoint(graphics, x + ux * 2, y + uy * 2, nx, ny, width * 0.36, Math.max(1.6, width * 0.08), theme.ink, alpha * 0.48)
    })

    if (options.rivetSpacing && options.rivetSpacing > 0) {
      for (let distance = options.rivetSpacing; distance < length; distance += options.rivetSpacing) {
        const x = from.x + ux * distance
        const y = from.y + uy * distance
        const rivetAlpha = options.rivetAlpha ?? alpha * 0.54
        this.drawMetalPost(graphics, x - nx * width * 0.18, y - ny * width * 0.18, Math.max(3.2, width * 0.18), rivetAlpha, false)
      }
    }

    const accentDistance = length * 0.54
    const accentX = from.x + ux * accentDistance + nx * width * 0.2
    const accentY = from.y + uy * accentDistance + ny * width * 0.2
    graphics.fillStyle(theme.ember, alpha * 0.22)
    graphics.fillCircle(accentX, accentY, Math.max(1.8, width * 0.1))

    if (options.endCaps) {
      const capRadius = Math.max(5.5, width * 0.38)
      this.drawMetalPost(graphics, from.x, from.y, capRadius, alpha * 0.9, options.jadeAlpha > alpha * 0.2)
      this.drawMetalPost(graphics, to.x, to.y, capRadius, alpha * 0.9, options.jadeAlpha > alpha * 0.2)
    }

    function lineAtPoint(
      target: Phaser.GameObjects.Graphics,
      x: number,
      y: number,
      normalX: number,
      normalY: number,
      span: number,
      lineWidth: number,
      color: number,
      lineAlpha: number,
    ) {
      target.lineStyle(lineWidth, color, lineAlpha)
      target.lineBetween(x - normalX * span, y - normalY * span, x + normalX * span, y + normalY * span)
    }
  }

  private drawPremiumHardwareBar(
    graphics: Phaser.GameObjects.Graphics,
    from: Point,
    to: Point,
    width: number,
    alpha: number,
    options: {
      trimAlpha?: number
      jadeAlpha?: number
      endCaps?: boolean
      rivetSpacing?: number
      rivetAlpha?: number
      capRadius?: number
    } = {},
  ) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }

    const ux = dx / length
    const uy = dy / length
    const nx = -uy
    const ny = ux
    const trimAlpha = options.trimAlpha ?? alpha * 0.78
    const jadeAlpha = options.jadeAlpha ?? 0
    const line = (offset: number, color: number, lineWidth: number, lineAlpha: number) => {
      graphics.lineStyle(lineWidth, color, lineAlpha)
      graphics.lineBetween(
        from.x + nx * offset,
        from.y + ny * offset,
        to.x + nx * offset,
        to.y + ny * offset,
      )
    }

    graphics.lineStyle(width + 10, theme.ink, alpha * 0.3)
    graphics.lineBetween(from.x + 2, from.y + 4, to.x + 2, to.y + 4)
    line(0, theme.charcoal, width + 5, alpha * 0.7)
    line(0, theme.obsidian, width, alpha)
    line(-width * 0.34, theme.agedGold, Math.max(1.6, width * 0.13), trimAlpha)
    line(width * 0.34, theme.goldShadow, Math.max(1.4, width * 0.11), trimAlpha * 0.78)
    line(0, theme.ink, Math.max(1.2, width * 0.08), alpha * 0.28)

    if (jadeAlpha > 0) {
      line(0, theme.jade, Math.max(1.2, width * 0.06), jadeAlpha)
    }

    if (options.rivetSpacing && options.rivetSpacing > 0) {
      for (let distance = options.rivetSpacing; distance < length; distance += options.rivetSpacing) {
        const x = from.x + ux * distance
        const y = from.y + uy * distance
        const rivetAlpha = options.rivetAlpha ?? alpha * 0.5
        graphics.fillStyle(theme.goldShadow, rivetAlpha)
        graphics.fillCircle(x, y, Math.max(1.8, width * 0.11))
        graphics.fillStyle(theme.agedGold, rivetAlpha * 0.56)
        graphics.fillCircle(x - nx * width * 0.05, y - ny * width * 0.05, Math.max(0.9, width * 0.055))
      }
    }

    if (options.endCaps) {
      const capRadius = options.capRadius ?? Math.max(4, width * 0.46)
      this.drawMetalPost(graphics, from.x, from.y, capRadius, alpha * 0.96, jadeAlpha > 0)
      this.drawMetalPost(graphics, to.x, to.y, capRadius, alpha * 0.96, jadeAlpha > 0)
    }
  }

  private drawMetalPost(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, alpha: number, jadeCore = false) {
    graphics.fillStyle(theme.ink, alpha * 0.42)
    graphics.fillCircle(x + 2, y + 3, radius * 1.16)
    graphics.fillStyle(theme.goldShadow, alpha * 0.78)
    graphics.fillCircle(x, y, radius)
    graphics.lineStyle(Math.max(1.4, radius * 0.22), theme.agedGold, alpha * 0.82)
    graphics.strokeCircle(x, y, radius)
    graphics.fillStyle(theme.obsidian, alpha * 0.92)
    graphics.fillCircle(x, y, radius * 0.62)

    if (jadeCore) {
      graphics.fillStyle(theme.jade, alpha * 0.42)
      graphics.fillCircle(x, y, radius * 0.34)
    }

    graphics.fillStyle(theme.ivory, alpha * 0.28)
    graphics.fillCircle(x - radius * 0.22, y - radius * 0.28, Math.max(0.7, radius * 0.12))
  }

  private drawDebugOverlay() {
    const graphics = this.debugGraphics
    graphics.clear()

    this.collisionBodies.forEach((body) => {
      const isSensor = body.isSensor
      const isBall = Boolean(this.ballFromBody(body))
      const isJackpotSensor = body.label.startsWith('jackpot:')
      const color = isBall ? theme.ivory : isJackpotSensor ? theme.goldShadow : isSensor ? theme.agedGold : theme.brightJade
      const alpha = isJackpotSensor ? 0.38 : isSensor ? 0.65 : 0.82
      graphics.lineStyle(isSensor ? 2 : 3, color, alpha)

      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body]
      parts.forEach((part) => {
        const vertices = part.vertices ?? []
        if (vertices.length === 0) {
          return
        }

        graphics.beginPath()
        graphics.moveTo(vertices[0].x, vertices[0].y)
        for (let index = 1; index < vertices.length; index += 1) {
          graphics.lineTo(vertices[index].x, vertices[index].y)
        }
        graphics.closePath()
        graphics.strokePath()
      })
    })
  }
}
