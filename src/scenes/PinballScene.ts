import Phaser from 'phaser'
import { tableLayout } from '../config/tableLayout'
import type {
  BumperBody,
  FlipperConfig,
  Point,
  RoundedPost,
  SensorBody,
  SlingBody,
  TrapKickerZone,
  WallSegment,
} from '../config/tableLayout'

type FlipperRuntime = {
  config: FlipperConfig
  body: MatterJS.BodyType
  visual: Phaser.GameObjects.Rectangle
  accent: Phaser.GameObjects.Rectangle
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
type SoundCue = keyof typeof tableLayout.juice.sounds

type ShotTestPlacement = 'leftFlipper' | 'rightFlipper' | 'centerLower' | 'shooterExit' | 'upperRollovers'
type ShotTestLaunch = 'leftUpper' | 'rightUpper' | 'centerJackpot'

type ScorePopupOptions = {
  major?: boolean
  event?: boolean
  color?: string
}

const HIGH_SCORE_KEY = 'xibalba-pinball-high-score'
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
  private visualAlignmentText!: Phaser.GameObjects.Text
  private shotTestText!: Phaser.GameObjects.Text
  private startOverlay!: Phaser.GameObjects.Container
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
  private ballState: 'IN PLAY' | 'PLUNGER' | 'DRAINED' = 'PLUNGER'
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
  private gamePaused = false
  private devModeEnabled = false
  private debugEnabled = false
  private shotTestMode = false
  private eclipseState: EclipseState = 'NORMAL'
  private lastSensorHit = 'none'
  private lastScoreEvent = 'none'
  private highScore = 0
  private audioContext?: AudioContext
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
    this.createHud()
    this.createTouchHints()
    this.createStartOverlay()
    this.createPauseOverlay()
    this.bindInput()
    this.bindCollisions()
    this.drawRuntimeInsertUnderlays()
    this.setGameplayFrozen(true)
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
    // Runtime-only jackpot glow; static temple art comes from the playfield PNG.
    this.jackpotVisual = this.add
      .rectangle(sensor.x, sensor.y, sensor.width, sensor.height, theme.eclipseRed, 0.08)
      .setStrokeStyle(4, theme.agedGold, 0.36)
      .setDepth(3)
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
      .rectangle(0, 0, visualWidth + 14, visualHeight + 12, theme.ink, 0.5)
      .setStrokeStyle(2, theme.goldShadow, 0.34)
      .setName('backing')
    const insert = this.add
      .rectangle(0, 0, visualWidth, visualHeight, theme.obsidian, 0.82)
      .setStrokeStyle(2, theme.agedGold, 0.7)
      .setName('insert')
    const glow = this.add
      .rectangle(0, 0, visualWidth + 8, visualHeight + 8, theme.jade, 0)
      .setStrokeStyle(2, theme.brightJade, 0)
      .setName('glow')
    const glyph = this.add
      .triangle(0, 1, 0, -visualHeight * 0.22, visualWidth * 0.26, visualHeight * 0.2, -visualWidth * 0.26, visualHeight * 0.2, theme.jade, 0.22)
      .setStrokeStyle(1, theme.goldShadow, 0.45)
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
    const visual = this.add.container(bumper.x + alignment.offsetX, bumper.y + alignment.offsetY).setDepth(6)
    const halo = this.add.circle(0, 0, radius * 1.18, theme.jade, 0.055).setStrokeStyle(2, theme.brightJade, 0.16)
    const cover = this.add.circle(0, 0, radius * 1.05, theme.ink, 0.46).setStrokeStyle(3, theme.goldShadow, 0.32)
    const outerRing = this.add.circle(0, 0, radius * 0.9, theme.goldShadow, 0.78).setStrokeStyle(5, theme.agedGold, 0.84)
    const innerHousing = this.add.circle(0, 0, radius * 0.56, theme.obsidian, 0.9).setStrokeStyle(3, theme.goldShadow, 0.66)
    const coreGlow = this.add.circle(0, 0, radius * 0.33, theme.jade, 0.32).setStrokeStyle(2, theme.brightJade, 0.62)
    const core = this.add.circle(0, 0, radius * 0.18, theme.brightJade, 0.74)
    const highlight = this.add.circle(-radius * 0.08, -radius * 0.1, radius * 0.055, theme.ivory, 0.36)

    visual.add([halo, cover, outerRing, innerHousing, coreGlow, core, highlight])

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const x = Math.cos(angle) * radius * 0.78
      const y = Math.sin(angle) * radius * 0.78
      visual.add(this.add.circle(x, y, radius * 0.055, theme.agedGold, 0.82))
    }

    return visual
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

    const visual = this.add
      .rectangle(center.x, center.y, config.length, config.width, theme.goldShadow, 0.95)
      .setStrokeStyle(4, theme.agedGold, 0.9)
      .setDepth(7)
    visual.rotation = angle
    const accent = this.add
      .rectangle(center.x, center.y, config.length * 0.68, config.width * 0.42, config.id === 'left' ? theme.jade : theme.eclipseRed, 0.72)
      .setStrokeStyle(2, config.id === 'left' ? theme.brightJade : theme.ember, 0.64)
      .setDepth(7.1)
    accent.rotation = angle

    this.flippers.push({ config, body, visual, accent, currentAngle: angle, lastImpulseAt: 0, pressed: false })
    this.collisionBodies.push(body)
    return body
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
    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(theme.ivory, 1)
    graphics.fillCircle(radius, radius, radius)
    graphics.fillStyle(0xffffff, 0.42)
    graphics.fillCircle(radius - 5, radius - 6, radius * 0.38)
    graphics.lineStyle(4, theme.agedGold, 1)
    graphics.strokeCircle(radius, radius, radius - 2)
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
      .rectangle(visualX, visualRestY - 250, visualWidth + 26, 548, theme.ink, 0.28)
      .setStrokeStyle(2, theme.goldShadow, 0.34)
      .setDepth(5.4)
    this.add
      .rectangle(visualX - visualWidth * 0.58, visualRestY - 250, 4, 512, theme.agedGold, 0.54)
      .setDepth(5.5)
    this.add
      .rectangle(visualX + visualWidth * 0.58, visualRestY - 250, 4, 512, theme.agedGold, 0.54)
      .setDepth(5.5)
    this.add
      .rectangle(visualX, visualRestY - 250, visualWidth * 0.42, 470, theme.obsidian, 0.46)
      .setStrokeStyle(1, theme.goldShadow, 0.34)
      .setDepth(5.55)

    const handle = this.add
      .rectangle(0, 0, visualWidth, visualHeight, theme.goldShadow, 0.82)
      .setStrokeStyle(3, theme.agedGold, 0.82)
    const grip = this.add.rectangle(0, -visualHeight * 0.08, visualWidth * 0.42, visualHeight * 0.62, theme.obsidian, 0.82)
    const accent = this.add
      .rectangle(0, visualHeight * 0.26, visualWidth * 0.42, 8, theme.jade, 0.62)
      .setStrokeStyle(1, theme.brightJade, 0.48)
      .setName('accent')
    const chargeGlow = this.add
      .circle(0, -visualHeight * 0.36, visualWidth * 0.2, theme.ember, 0.12)
      .setStrokeStyle(1, theme.agedGold, 0.38)
      .setName('chargeGlow')

    this.plungerVisual = this.add.container(visualX, visualRestY, [handle, grip, accent, chargeGlow]).setDepth(6.4)
  }

  private createHud() {
    this.add
      .rectangle(18, 18, 432, 112, theme.ink, 0.54)
      .setOrigin(0)
      .setStrokeStyle(2, theme.goldShadow, 0.42)
      .setDepth(39)

    this.add
      .rectangle(tableLayout.table.width - 448, 18, 430, 118, theme.ink, 0.54)
      .setOrigin(0)
      .setStrokeStyle(2, theme.goldShadow, 0.42)
      .setDepth(39)

    this.scoreText = this.add
      .text(24, 22, 'SCORE 0', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '26px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 5,
      })
      .setDepth(40)

    this.highScoreText = this.add
      .text(tableLayout.table.width - 24, 22, `HIGH ${this.highScore}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '22px',
        color: theme.css.agedGold,
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
      .text(24, 82, 'BALL PLUNGER', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '13px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 3,
      })
      .setDepth(40)
      .setAlpha(0.88)

    this.ballSaveText = this.add
      .text(tableLayout.table.width - 24, 54, 'BALL SAVE', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '20px',
        color: theme.css.agedGold,
        stroke: theme.css.ink,
        strokeThickness: 5,
      })
      .setOrigin(1, 0)
      .setDepth(42)
      .setVisible(false)

    this.rolloverText = this.add
      .text(24, 104, `ROLLOVERS 0/${this.rolloverCount()}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '13px',
        color: theme.css.brightJade,
        stroke: theme.css.ink,
        strokeThickness: 3,
      })
      .setDepth(40)
      .setAlpha(0.9)

    this.eclipseStateText = this.add
      .text(tableLayout.table.width - 24, 82, 'STATE NORMAL', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '15px',
        color: theme.css.bone,
        stroke: theme.css.ink,
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(40)
      .setAlpha(0.92)

    this.devModeText = this.add
      .text(tableLayout.table.width - 24, 108, 'DEV MODE', {
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

    const dev = this.add
      .text(tableLayout.table.width / 2, 1292, '` or F1 toggles dev tools', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '18px',
        color: theme.css.goldShadow,
        stroke: theme.css.ink,
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(91)

    this.startOverlay = this.add.container(0, 0, [titleArt, textPlate, high, prompt, controls, dev]).setDepth(90)
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
      this.input.keyboard.on('keydown', () => this.unlockAudio())
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

  private ensureAudioContext() {
    if (this.audioContext) {
      return this.audioContext
    }

    if (typeof window === 'undefined') {
      return undefined
    }

    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext
    if (!AudioContextConstructor) {
      return undefined
    }

    this.audioContext = new AudioContextConstructor()
    return this.audioContext
  }

  private unlockAudio() {
    const context = this.ensureAudioContext()
    if (context?.state === 'suspended') {
      void context.resume()
    }
  }

  private playSound(cue: SoundCue) {
    // SOUND: generated Web Audio tones keep the prototype self-contained until final audio assets exist.
    const context = this.ensureAudioContext()
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      void context.resume()
    }

    const now = context.currentTime
    tableLayout.juice.sounds[cue].forEach((tone) => {
      const timedTone = tone as typeof tone & { delayMs?: number }
      const start = now + (timedTone.delayMs ?? 0) / 1000
      const duration = tone.durationMs / 1000
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = tone.type as OscillatorType
      oscillator.frequency.setValueAtTime(tone.frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tableLayout.juice.soundVolume * tone.volume), start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
    })
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
      this.playSound('bumperHit')
      this.shakeCamera('bumper')
      this.addScore(points)
      this.showScorePopup(otherBody.position.x, otherBody.position.y - 28, 'BUMPER HIT', points)
      if (bumper) {
        this.pulse(this.bumperVisuals.get(bumper.id), tableLayout.tuning.pulseScale + 0.1)
        this.flashCircle(bumper.x, bumper.y, bumper.radius * 1.45, theme.ember)
      }
      this.kickBallAwayFrom(ball, otherBody.position, tableLayout.tuning.bumperForce)
      this.registerComboHit('bumper', ball)
      return
    }

    if (label.startsWith('sling:')) {
      const sling = tableLayout.slingshots.find((item) => label === `sling:${item.id}`)
      if (sling) {
        this.playSound('slingHit')
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
      this.playSound('targetHit')
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
    }
    if (!keyboardPlunger && this.lastKeyboardPlunger) {
      this.releasePlunger()
    }
    this.lastKeyboardPlunger = keyboardPlunger

    if (this.devModeEnabled && Phaser.Input.Keyboard.JustDown(this.keys.debug)) {
      this.debugEnabled = !this.debugEnabled
      this.debugGraphics.setVisible(this.debugEnabled)
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
    if (this.hasStarted) {
      return
    }

    this.hasStarted = true
    this.startOverlay.setVisible(false)
    this.setGameplayFrozen(false)
    this.unlockAudio()
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
    this.visualAlignmentText.setVisible(enabled)
    if (!enabled) {
      this.debugEnabled = false
      this.debugGraphics.setVisible(false)
      this.debugGraphics.clear()
      this.setShotTestMode(false)
    }
  }

  private resetGameState() {
    this.score = 0
    this.lastScoreEvent = 'none'
    this.updateHud()
    this.resetBall()
    if (this.gamePaused) {
      this.setPaused(false)
    }
  }

  private updateHud() {
    this.scoreText?.setText(`SCORE ${this.score}`)
    this.highScoreText?.setText(`HIGH ${this.highScore}`)
    this.ballStateText?.setText(`BALL ${this.ballState}`)
    this.rolloverText?.setText(`ROLLOVERS ${this.litRollovers.size}/${this.rolloverCount()}`)
    this.eclipseStateText?.setText(`STATE ${this.currentModeState()}`)
    this.eclipseStateText?.setColor(this.currentModeColor())
    this.ballSaveText?.setVisible(this.isBallSaverActive())
    this.devModeText?.setVisible(this.devModeEnabled)
    this.visualAlignmentText?.setText(this.visualAlignmentSummary())
    this.visualAlignmentText?.setVisible(this.devModeEnabled)
    this.controlsText?.setVisible(this.hasStarted)
    this.touchHintLeft?.setVisible(this.hasStarted && !this.gamePaused)
    this.touchHintRight?.setVisible(this.hasStarted && !this.gamePaused)
    this.touchHintLaunch?.setVisible(this.hasStarted && !this.gamePaused)
  }

  private visualAlignmentSummary() {
    const { bumpers, rollovers, plunger } = tableLayout.visualAlignment

    return [
      `VISUAL ALIGN`,
      `BUMP x ${bumpers.offsetX} y ${bumpers.offsetY} s ${bumpers.scale}`,
      `ROLL x ${rollovers.offsetX} y ${rollovers.offsetY} ws ${rollovers.widthScale} hs ${rollovers.heightScale} gap ${rollovers.gapAdjust}`,
      `PLNG x ${plunger.offsetX} y ${plunger.offsetY} ${plunger.width}x${plunger.height}`,
    ].join('\n')
  }

  private currentModeState() {
    if (this.isBallSaverActive() && this.eclipseState !== 'ECLIPSE MULTIBALL') {
      return 'BALL SAVE'
    }

    return this.eclipseState
  }

  private currentModeColor() {
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
      const launchVelocity = Phaser.Math.Linear(tableLayout.tuning.plungerTapForce, tableLayout.tuning.plungerForce, Math.max(0.12, this.plungerCharge))
      ball.image.setPosition(tableLayout.plunger.x, ball.image.y)
      ball.image.setVelocity(0, -launchVelocity)
      ball.image.setAngularVelocity(0)
      ball.lastMotionAt = this.time.now
      this.ballSaverArmed = true
    }
    this.plungerCharge = 0
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    this.unlockAudio()
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
    if (this.ballState === 'DRAINED') {
      return
    }

    if (this.balls.length === 0) {
      this.setBallState('DRAINED')
      return
    }

    this.setBallState(this.balls.every((ball) => this.isBallInPlungerLane(ball)) ? 'PLUNGER' : 'IN PLAY')
  }

  private setBallState(state: 'IN PLAY' | 'PLUNGER' | 'DRAINED') {
    if (this.ballState === state) {
      return
    }

    this.ballState = state
    this.ballStateText?.setText(`BALL ${state}`)
  }

  private updateAntiStuck() {
    if (this.ballState === 'DRAINED') {
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
    if (this.ballState === 'DRAINED') {
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
    // TUNING: shooterExitRepositionX/Y should sit just left of the shooter lane exit.
    this.setBallPositionAndVelocity(ball, { x: tableLayout.tuning.shooterExitRepositionX, y: tableLayout.tuning.shooterExitRepositionY }, {
      x: tableLayout.tuning.shooterExitVelocityX,
      y: tableLayout.tuning.shooterExitVelocityY,
    })
    if (this.ballSaverArmed) {
      this.ballSaverArmed = false
      this.activateBallSaver()
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
    this.playSound('drain')
    this.showScorePopup(ball.image.x, ball.image.y - 30, 'DRAIN')
    this.removeBall(ball)
    this.checkMultiballEnd()

    if (this.balls.length === 0 && !this.drainResetPending) {
      this.drainResetPending = true
      this.setBallState('DRAINED')
      this.time.delayedCall(260, () => this.resetBall())
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
    this.playSound('ballSave')
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
    this.playSound('jackpot')
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
    this.playSound('rolloverHit')
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
      this.playSound('eclipseReady')
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
    this.playSound('eclipseMultiball')
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

  private updateStartHighScore() {
    const highScoreText = this.startOverlay?.getByName('startHighScore') as Phaser.GameObjects.Text | null
    highScoreText?.setText(`HIGH SCORE ${this.highScore}`)
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

    this.playSound('flipperHit')
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
    if (!ball || this.ballState === 'DRAINED' || this.isBallInPlungerLane(ball)) {
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
    const bumperAlignment = tableLayout.visualAlignment.bumpers
    const minBumperX = Math.min(...tableLayout.bumpers.map((bumper) => bumper.x + bumperAlignment.offsetX))
    const maxBumperX = Math.max(...tableLayout.bumpers.map((bumper) => bumper.x + bumperAlignment.offsetX))
    const minBumperY = Math.min(...tableLayout.bumpers.map((bumper) => bumper.y + bumperAlignment.offsetY))
    const maxBumperY = Math.max(...tableLayout.bumpers.map((bumper) => bumper.y + bumperAlignment.offsetY))
    graphics.fillStyle(theme.obsidian, 0.34)
    graphics.fillRoundedRect(minBumperX - 72, minBumperY - 62, maxBumperX - minBumperX + 144, maxBumperY - minBumperY + 124, 42)
    graphics.lineStyle(2, theme.goldShadow, 0.18)
    graphics.strokeRoundedRect(minBumperX - 72, minBumperY - 62, maxBumperX - minBumperX + 144, maxBumperY - minBumperY + 124, 42)

    const rolloverAlignment = tableLayout.visualAlignment.rollovers
    const rolloverSensors = tableLayout.sensors.filter((sensor) => sensor.kind === 'rollover')
    const minRolloverX = Math.min(...rolloverSensors.map((sensor) => sensor.x + rolloverAlignment.offsetX))
    const maxRolloverX = Math.max(...rolloverSensors.map((sensor) => sensor.x + rolloverAlignment.offsetX))
    const rolloverY = rolloverSensors[0]?.y ?? 760
    graphics.fillStyle(theme.obsidian, 0.26)
    graphics.fillRoundedRect(minRolloverX - 36, rolloverY + rolloverAlignment.offsetY - 34, maxRolloverX - minRolloverX + 72, 68, 18)
    graphics.lineStyle(2, theme.goldShadow, 0.14)
    graphics.strokeRoundedRect(minRolloverX - 36, rolloverY + rolloverAlignment.offsetY - 34, maxRolloverX - minRolloverX + 72, 68, 18)
  }

  private drawDebugOverlay() {
    const graphics = this.debugGraphics
    graphics.clear()

    this.collisionBodies.forEach((body) => {
      const isSensor = body.isSensor
      const isBall = Boolean(this.ballFromBody(body))
      graphics.lineStyle(isSensor ? 2 : 3, isBall ? theme.ivory : isSensor ? theme.agedGold : theme.brightJade, isSensor ? 0.65 : 0.82)

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
