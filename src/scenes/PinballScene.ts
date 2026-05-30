import Phaser from 'phaser'
import { tableLayout } from '../config/tableLayout'
import type {
  BumperBody,
  FlipperConfig,
  Point,
  RoundedPost,
  SensorBody,
  SlingBody,
  WallSegment,
} from '../config/tableLayout'

type FlipperRuntime = {
  config: FlipperConfig
  body: MatterJS.BodyType
  visual: Phaser.GameObjects.Rectangle
  currentAngle: number
  pressed: boolean
}

type ControlKeys = {
  left: Phaser.Input.Keyboard.Key
  leftAlt: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  rightAlt: Phaser.Input.Keyboard.Key
  plunger: Phaser.Input.Keyboard.Key
  plungerAlt: Phaser.Input.Keyboard.Key
  reset: Phaser.Input.Keyboard.Key
  debug: Phaser.Input.Keyboard.Key
}

export class PinballScene extends Phaser.Scene {
  private ball!: Phaser.Physics.Matter.Image
  private ballBody!: MatterJS.BodyType
  private flippers: FlipperRuntime[] = []
  private collisionBodies: MatterJS.BodyType[] = []
  private debugGraphics!: Phaser.GameObjects.Graphics
  private playfieldGraphics!: Phaser.GameObjects.Graphics
  private plungerVisual!: Phaser.GameObjects.Rectangle
  private scoreText!: Phaser.GameObjects.Text
  private keys?: ControlKeys
  private pointerControls = new Map<number, 'left' | 'right' | 'plunger'>()
  private score = 0
  private plungerCharge = 0
  private plungerHeld = false
  private lastKeyboardPlunger = false
  private debugEnabled = false

  constructor() {
    super('PinballScene')
  }

  preload() {
    this.load.image('blockout', tableLayout.table.backgroundPath)
  }

  create() {
    this.matter.world.setBounds(0, 0, tableLayout.table.width, tableLayout.table.height, 40, true, true, false, false)
    this.cameras.main.setBackgroundColor('#050810')

    this.add
      .image(0, 0, 'blockout')
      .setOrigin(0)
      .setDisplaySize(tableLayout.table.width, tableLayout.table.height)
      .setAlpha(tableLayout.table.backgroundAlpha)
      .setDepth(0)

    this.createBallTexture()
    this.playfieldGraphics = this.add.graphics().setDepth(2)
    this.debugGraphics = this.add.graphics().setDepth(30).setVisible(false)

    tableLayout.wallSegments.forEach((segment) => this.createStaticWallSegment(segment))
    tableLayout.posts.forEach((post) => this.createRoundedPost(post))
    tableLayout.sensors.forEach((sensor) => this.createSensor(sensor))
    tableLayout.bumpers.forEach((bumper) => this.createBumper(bumper))
    tableLayout.slingshots.forEach((sling) => this.createSling(sling))
    tableLayout.flippers.forEach((flipper) => this.createFlipper(flipper))

    this.createBall()
    this.createPlungerVisual()
    this.createHud()
    this.bindInput()
    this.bindCollisions()
    this.drawPlaceholderPlayfield()
  }

  update(_time: number, delta: number) {
    this.updateKeyboardState()
    this.updateFlippers(delta)
    this.updatePlunger()
    this.keepBallPlayable()

    if (this.debugEnabled) {
      this.drawDebugOverlay()
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
    return body
  }

  private createBumper(bumper: BumperBody) {
    const body = this.matter.add.circle(bumper.x, bumper.y, bumper.radius, {
      isStatic: true,
      label: `bumper:${bumper.id}`,
      friction: 0,
      restitution: tableLayout.tuning.bumperBounce,
    })

    this.add.circle(bumper.x, bumper.y, bumper.radius, 0xff3bc7, 0.34).setStrokeStyle(5, 0x58fff8, 0.9).setDepth(4)
    this.collisionBodies.push(body)
    return body
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
    this.collisionBodies.push(body)
    return body
  }

  private createFlipper(config: FlipperConfig) {
    const angle = Phaser.Math.DegToRad(config.restAngle)
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
      .rectangle(center.x, center.y, config.length, config.width, config.id === 'left' ? 0x54d7ff : 0xff5bd5, 0.9)
      .setStrokeStyle(3, 0xffffff, 0.75)
      .setDepth(7)
    visual.rotation = angle

    this.flippers.push({ config, body, visual, currentAngle: angle, pressed: false })
    this.collisionBodies.push(body)
    return body
  }

  private createBall() {
    this.ball = this.matter.add.image(tableLayout.ball.spawn.x, tableLayout.ball.spawn.y, 'ball')
    this.ball.setCircle(tableLayout.ball.radius)
    this.ball.setBounce(tableLayout.tuning.ballBounce)
    this.ball.setFriction(tableLayout.tuning.ballFriction, 0.002, 0.01)
    this.ball.setFrictionAir(tableLayout.tuning.ballFrictionAir)
    this.ball.setMass(0.55)
    this.ball.setDepth(10)
    this.ballBody = this.ball.body as MatterJS.BodyType
    this.ballBody.label = 'ball'
    this.collisionBodies.push(this.ballBody)
  }

  private createBallTexture() {
    if (this.textures.exists('ball')) {
      return
    }

    const radius = tableLayout.ball.radius
    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0xeaffff, 1)
    graphics.fillCircle(radius, radius, radius)
    graphics.lineStyle(4, 0x51f2ff, 1)
    graphics.strokeCircle(radius, radius, radius - 2)
    graphics.generateTexture('ball', radius * 2, radius * 2)
    graphics.destroy()
  }

  private createPlungerVisual() {
    const plunger = tableLayout.plunger
    this.plungerVisual = this.add
      .rectangle(plunger.x, plunger.restY, plunger.width, plunger.height, 0xffc857, 0.88)
      .setStrokeStyle(3, 0xfff4b0, 0.9)
      .setDepth(6)
  }

  private createHud() {
    this.scoreText = this.add
      .text(24, 22, 'SCORE 0', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '28px',
        color: '#dffcff',
        stroke: '#071018',
        strokeThickness: 5,
      })
      .setDepth(40)

    this.add
      .text(24, 59, 'LEFT/A + RIGHT/L flippers   SPACE/DOWN launch   R reset   D debug', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '15px',
        color: '#8af8ff',
        stroke: '#071018',
        strokeThickness: 3,
      })
      .setDepth(40)
      .setAlpha(0.86)
  }

  private bindInput() {
    if (this.input.keyboard) {
      this.keys = {
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        leftAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        rightAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
        plunger: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        plungerAlt: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        reset: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
        debug: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      }
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer))
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer))
  }

  private bindCollisions() {
    this.matter.world.on(
      Phaser.Physics.Matter.Events.COLLISION_START,
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        event.pairs.forEach((pair: Phaser.Types.Physics.Matter.MatterCollisionPair) => {
          const bodyA = pair.collision.bodyA
          const bodyB = pair.collision.bodyB
          if (bodyA === this.ballBody) {
            this.handleBallCollision(bodyB)
          } else if (bodyB === this.ballBody) {
            this.handleBallCollision(bodyA)
          }
        })
      },
    )
  }

  private handleBallCollision(otherBody: MatterJS.BodyType) {
    const label = otherBody.label

    if (label.startsWith('bumper:')) {
      const bumper = tableLayout.bumpers.find((item) => label === `bumper:${item.id}`)
      this.addScore(bumper?.score ?? 1000)
      this.kickBallAwayFrom(otherBody.position, tableLayout.tuning.bumperForce)
      return
    }

    if (label.startsWith('sling:')) {
      const sling = tableLayout.slingshots.find((item) => label === `sling:${item.id}`)
      if (sling) {
        this.addScore(sling.score)
        this.applyBallForce(sling.force.x * tableLayout.tuning.slingForceScale, sling.force.y * tableLayout.tuning.slingForceScale)
      }
      return
    }

    if (label.startsWith('targetBank:')) {
      const targetId = label.split(':')[1]
      const target = tableLayout.sensors.find((sensor) => sensor.id === targetId)
      this.addScore(target?.score ?? 250)
      return
    }

    if (label.startsWith('drain:')) {
      this.time.delayedCall(120, () => this.resetBall())
    }
  }

  private updateKeyboardState() {
    if (!this.keys) {
      return
    }

    this.setFlipperPressed('left', this.keys.left.isDown || this.keys.leftAlt.isDown)
    this.setFlipperPressed('right', this.keys.right.isDown || this.keys.rightAlt.isDown)

    const keyboardPlunger = this.keys.plunger.isDown || this.keys.plungerAlt.isDown
    if (keyboardPlunger && !this.lastKeyboardPlunger) {
      this.plungerHeld = this.isBallInPlungerLane()
    }
    if (!keyboardPlunger && this.lastKeyboardPlunger) {
      this.releasePlunger()
    }
    this.lastKeyboardPlunger = keyboardPlunger

    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) {
      this.resetBall()
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.debug)) {
      this.debugEnabled = !this.debugEnabled
      this.debugGraphics.setVisible(this.debugEnabled)
      if (!this.debugEnabled) {
        this.debugGraphics.clear()
      }
    }
  }

  private updateFlippers(delta: number) {
    const deltaScale = Math.max(0.5, Math.min(2, delta / 16.6667))

    this.flippers.forEach((flipper) => {
      const targetAngle = Phaser.Math.DegToRad(flipper.pressed ? flipper.config.activeAngle : flipper.config.restAngle)
      const angularSpeed = flipper.pressed ? tableLayout.tuning.flipperUpSpeed : tableLayout.tuning.flipperDownSpeed
      const step = angularSpeed * deltaScale
      const angleDelta = Phaser.Math.Angle.Wrap(targetAngle - flipper.currentAngle)

      if (Math.abs(angleDelta) <= step) {
        flipper.currentAngle = targetAngle
      } else {
        flipper.currentAngle += Math.sign(angleDelta) * step
      }

      const center = this.pointFromPivot(flipper.config.pivot, flipper.currentAngle, flipper.config.length / 2)

      // TUNING: flipperUpSpeed/flipperDownSpeed control snap and return. The body is a real rotating Matter body.
      this.matter.body.setPosition(flipper.body, center, true)
      this.matter.body.setAngle(flipper.body, flipper.currentAngle, true)
      flipper.visual.setPosition(center.x, center.y)
      flipper.visual.rotation = flipper.currentAngle
    })
  }

  private updatePlunger() {
    if (this.plungerHeld) {
      this.plungerCharge = Math.min(1, this.plungerCharge + tableLayout.tuning.plungerChargeRate)
    }

    this.plungerVisual.y = tableLayout.plunger.restY + this.plungerCharge * tableLayout.plunger.chargeTravel
  }

  private releasePlunger() {
    if (!this.plungerHeld) {
      return
    }

    this.plungerHeld = false
    if (this.isBallInPlungerLane()) {
      const charge = Math.max(0.22, this.plungerCharge)
      const launchY = -Phaser.Math.Linear(
        tableLayout.tuning.plungerLaunchMinVelocity,
        tableLayout.tuning.plungerLaunchMaxVelocity,
        charge,
      )
      this.ball.setVelocity(tableLayout.tuning.plungerLaunchSideVelocity, launchY)
      this.ball.setAngularVelocity(0)
    }
    this.plungerCharge = 0
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.screenToTablePoint(pointer)
    let control: 'left' | 'right' | 'plunger'

    if (this.pointInRect(worldPoint, tableLayout.plunger.touchArea) && this.isBallInPlungerLane()) {
      control = 'plunger'
      this.plungerHeld = true
    } else {
      control = worldPoint.x < tableLayout.table.width / 2 ? 'left' : 'right'
      this.setFlipperPressed(control, true)
    }

    this.pointerControls.set(pointer.id, control)
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer) {
    const control = this.pointerControls.get(pointer.id)
    if (!control) {
      return
    }

    if (control === 'plunger') {
      this.releasePlunger()
    } else {
      this.setFlipperPressed(control, false)
    }
    this.pointerControls.delete(pointer.id)
  }

  private setFlipperPressed(id: 'left' | 'right', pressed: boolean) {
    const flipper = this.flippers.find((item) => item.config.id === id)
    if (flipper) {
      flipper.pressed = pressed
    }
  }

  private resetBall() {
    this.ball.setPosition(tableLayout.ball.spawn.x, tableLayout.ball.spawn.y)
    this.ball.setVelocity(tableLayout.ball.resetVelocity.x, tableLayout.ball.resetVelocity.y)
    this.ball.setAngularVelocity(0)
    this.plungerCharge = 0
    this.plungerHeld = false
  }

  private keepBallPlayable() {
    const outOfBounds = this.ball.y > tableLayout.table.height + 130 || this.ball.x < -130 || this.ball.x > tableLayout.table.width + 130
    if (outOfBounds) {
      this.resetBall()
    }
  }

  private isBallInPlungerLane() {
    return this.ball.x > 920 && this.ball.y > tableLayout.plunger.launchMinY
  }

  private addScore(points: number) {
    this.score += points
    this.scoreText.setText(`SCORE ${this.score}`)
  }

  private applyBallForce(x: number, y: number) {
    this.matter.body.applyForce(this.ballBody, this.ballBody.position, { x, y })
  }

  private kickBallAwayFrom(origin: Point, force: number) {
    const dx = this.ballBody.position.x - origin.x
    const dy = this.ballBody.position.y - origin.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    this.applyBallForce((dx / distance) * force, (dy / distance) * force)
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
      x: pointer.worldX,
      y: pointer.worldY,
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

  private drawPlaceholderPlayfield() {
    const graphics = this.playfieldGraphics
    graphics.clear()

    tableLayout.sensors
      .filter((sensor) => sensor.kind === 'targetBank')
      .forEach((target) => {
        graphics.fillStyle(0x7cf7ff, 0.2)
        graphics.fillRect(target.x - target.width / 2, target.y - target.height / 2, target.width, target.height)
      })
  }

  private drawDebugOverlay() {
    const graphics = this.debugGraphics
    graphics.clear()

    this.collisionBodies.forEach((body) => {
      const isSensor = body.isSensor
      const isBall = body === this.ballBody
      graphics.lineStyle(isSensor ? 2 : 3, isBall ? 0xffffff : isSensor ? 0xffd166 : 0x00ff95, isSensor ? 0.65 : 0.82)

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
