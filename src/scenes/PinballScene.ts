import Phaser from 'phaser'
import { tableLayout } from '../config/tableLayout'
import type { BumperBody, FlipperConfig, Point, RectBody, SegmentBody, SlingBody } from '../config/tableLayout'

type FlipperRuntime = {
  config: FlipperConfig
  body: MatterJS.BodyType
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

  constructor() {
    super('PinballScene')
  }

  preload() {
    this.load.image('blockout', tableLayout.table.backgroundPath)
  }

  create() {
    this.matter.world.setBounds(0, 0, tableLayout.table.width, tableLayout.table.height, 36, true, true, false, false)
    this.cameras.main.setBackgroundColor('#050810')

    this.add.image(0, 0, 'blockout').setOrigin(0).setAlpha(0.7).setDepth(0)
    this.createBallTexture()

    this.playfieldGraphics = this.add.graphics().setDepth(2)
    this.debugGraphics = this.add.graphics().setDepth(20)

    tableLayout.segments.forEach((segment) => this.addSegmentBody(segment))
    tableLayout.rects.forEach((rect) => this.addRectBody(rect))
    tableLayout.bumpers.forEach((bumper) => this.addBumper(bumper))
    tableLayout.slingshots.forEach((sling) => this.addSlingshot(sling))
    tableLayout.flippers.forEach((flipper) => this.addFlipper(flipper))

    this.createBall()
    this.createPlungerVisual()
    this.createHud()
    this.bindInput()
    this.bindCollisions()
    this.drawStaticPlayfield()
  }

  update() {
    this.updateKeyboardState()
    this.updateFlippers()
    this.updatePlunger()
    this.keepBallPlayable()
    this.drawDebugOverlay()
  }

  private addSegmentBody(segment: SegmentBody) {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const length = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    const x = (segment.from.x + segment.to.x) / 2
    const y = (segment.from.y + segment.to.y) / 2
    const body = this.matter.add.rectangle(x, y, length, segment.thickness, {
      isStatic: true,
      label: `${segment.kind}:${segment.id}`,
      friction: 0.03,
      restitution: segment.restitution ?? tableLayout.tuning.wallBounce,
    })

    this.matter.body.setAngle(body, angle)
    this.collisionBodies.push(body)
  }

  private addRectBody(rect: RectBody) {
    const body = this.matter.add.rectangle(rect.x, rect.y, rect.width, rect.height, {
      isStatic: true,
      isSensor: rect.isSensor,
      label: `${rect.kind}:${rect.id}`,
      friction: 0.04,
      restitution: tableLayout.tuning.rubberBounce,
    })

    this.matter.body.setAngle(body, rect.angle ?? 0)
    this.collisionBodies.push(body)
  }

  private addBumper(bumper: BumperBody) {
    const body = this.matter.add.circle(bumper.x, bumper.y, bumper.radius, {
      isStatic: true,
      label: `bumper:${bumper.id}`,
      friction: 0,
      restitution: 1.1,
    })

    this.collisionBodies.push(body)
  }

  private addSlingshot(sling: SlingBody) {
    const dx = sling.to.x - sling.from.x
    const dy = sling.to.y - sling.from.y
    const length = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    const x = (sling.from.x + sling.to.x) / 2
    const y = (sling.from.y + sling.to.y) / 2
    const body = this.matter.add.rectangle(x, y, length, sling.thickness, {
      isStatic: true,
      label: `sling:${sling.id}`,
      friction: 0.02,
      restitution: tableLayout.tuning.rubberBounce,
    })

    this.matter.body.setAngle(body, angle)
    this.collisionBodies.push(body)
  }

  private addFlipper(config: FlipperConfig) {
    const angle = Phaser.Math.DegToRad(config.restAngle)
    const center = this.pointFromPivot(config.pivot, angle, config.length / 2)
    const body = this.matter.add.rectangle(center.x, center.y, config.length, config.width, {
      label: `flipper:${config.id}`,
      friction: 0.05,
      frictionAir: 0.18,
      restitution: tableLayout.tuning.ballBounce,
      density: 0.012,
      chamfer: { radius: config.width / 2 },
    })

    this.matter.body.setAngle(body, angle)
    this.matter.add.worldConstraint(body, 0, 1, {
      label: `flipper-pivot:${config.id}`,
      pointA: config.pivot,
      pointB: { x: -config.length / 2, y: 0 },
      damping: 0.03,
    })

    this.flippers.push({ config, body, pressed: false })
    this.collisionBodies.push(body)
  }

  private createBall() {
    this.ball = this.matter.add.image(tableLayout.ball.spawn.x, tableLayout.ball.spawn.y, 'ball')
    this.ball.setCircle(tableLayout.ball.radius)
    this.ball.setBounce(tableLayout.tuning.ballBounce)
    this.ball.setFriction(0.005, 0.003, 0.02)
    this.ball.setFrictionAir(0.006)
    this.ball.setMass(0.45)
    this.ball.setDepth(8)
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
    graphics.fillStyle(0xdafcff, 1)
    graphics.fillCircle(radius, radius, radius)
    graphics.lineStyle(4, 0x51f2ff, 1)
    graphics.strokeCircle(radius, radius, radius - 2)
    graphics.generateTexture('ball', radius * 2, radius * 2)
    graphics.destroy()
  }

  private createPlungerVisual() {
    const plunger = tableLayout.plunger
    this.plungerVisual = this.add
      .rectangle(plunger.x, plunger.restY, plunger.width, plunger.height, 0xffc857, 0.9)
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
      .setDepth(30)
      .setScrollFactor(0)

    this.add
      .text(24, 59, 'A/LEFT + D/RIGHT flippers   SPACE/DOWN plunger   R reset', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '15px',
        color: '#8af8ff',
        stroke: '#071018',
        strokeThickness: 3,
      })
      .setDepth(30)
      .setAlpha(0.86)
      .setScrollFactor(0)
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
        reset: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
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
      this.addScore(1000)
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
      const target = tableLayout.rects.find((rect) => rect.id === targetId)
      this.addScore(target?.score ?? 250)
      return
    }

    if (label.startsWith('drain:')) {
      this.time.delayedCall(180, () => this.resetBall())
      return
    }

    if (label.startsWith('flipper:')) {
      const flipper = this.flippers.find((item) => item.body === otherBody)
      if (flipper?.pressed) {
        const direction = flipper.config.id === 'left' ? 1 : -1
        this.applyBallForce(direction * tableLayout.tuning.nudgeFromFlipperContact, -tableLayout.tuning.nudgeFromFlipperContact)
      }
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
      this.plungerHeld = true
    }
    if (!keyboardPlunger && this.lastKeyboardPlunger) {
      this.releasePlunger()
    }
    this.lastKeyboardPlunger = keyboardPlunger

    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) {
      this.resetBall()
    }
  }

  private updateFlippers() {
    this.flippers.forEach((flipper) => {
      const targetAngle = Phaser.Math.DegToRad(flipper.pressed ? flipper.config.activeAngle : flipper.config.restAngle)
      const delta = Phaser.Math.Angle.Wrap(targetAngle - flipper.body.angle)
      const motorVelocity = Phaser.Math.Clamp(
        delta * tableLayout.tuning.flipperStrength,
        -tableLayout.tuning.flipperMaxAngularVelocity,
        tableLayout.tuning.flipperMaxAngularVelocity,
      )

      // TUNING: flipperStrength and flipperMaxAngularVelocity control snap and hold power.
      this.matter.body.setAngularVelocity(flipper.body, motorVelocity)
      this.matter.body.setVelocity(flipper.body, { x: 0, y: 0 })
      this.matter.body.setPosition(
        flipper.body,
        this.pointFromPivot(flipper.config.pivot, flipper.body.angle, flipper.config.length / 2),
      )
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
    if (this.ball.x > 800 && this.ball.y > 1180) {
      const force = tableLayout.tuning.plungerMaxForce * Math.max(0.22, this.plungerCharge)
      this.applyBallForce(tableLayout.plunger.launchVector.x * force, tableLayout.plunger.launchVector.y * force)
    }
    this.plungerCharge = 0
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.screenToTablePoint(pointer)
    let control: 'left' | 'right' | 'plunger'

    if (worldPoint.x > tableLayout.table.width - 160 && worldPoint.y > 1120) {
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
    if (this.ball.y > tableLayout.table.height + 120 || this.ball.x < -120 || this.ball.x > tableLayout.table.width + 120) {
      this.resetBall()
    }
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

  private pointFromPivot(pivot: Point, angle: number, distance: number): Point {
    return {
      x: pivot.x + Math.cos(angle) * distance,
      y: pivot.y + Math.sin(angle) * distance,
    }
  }

  private screenToTablePoint(pointer: Phaser.Input.Pointer): Point {
    const camera = this.cameras.main
    return {
      x: pointer.x / camera.zoom + camera.scrollX,
      y: pointer.y / camera.zoom + camera.scrollY,
    }
  }

  private drawStaticPlayfield() {
    const graphics = this.playfieldGraphics
    graphics.clear()

    tableLayout.bumpers.forEach((bumper) => {
      graphics.fillStyle(0xff3bc7, 0.35)
      graphics.fillCircle(bumper.x, bumper.y, bumper.radius)
      graphics.lineStyle(5, 0x58fff8, 0.85)
      graphics.strokeCircle(bumper.x, bumper.y, bumper.radius)
    })

    tableLayout.slingshots.forEach((sling) => this.drawSegmentLine(graphics, sling.from, sling.to, sling.thickness, 0xffd166, 0.45))
    tableLayout.rects
      .filter((rect) => rect.kind === 'targetBank')
      .forEach((target) => {
        graphics.fillStyle(0x7cf7ff, 0.4)
        graphics.fillRect(target.x - target.width / 2, target.y - target.height / 2, target.width, target.height)
      })
  }

  private drawDebugOverlay() {
    const graphics = this.debugGraphics
    graphics.clear()
    graphics.lineStyle(2, 0x00ff95, 0.78)

    this.collisionBodies.forEach((body) => {
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

  private drawSegmentLine(
    graphics: Phaser.GameObjects.Graphics,
    from: Point,
    to: Point,
    width: number,
    color: number,
    alpha: number,
  ) {
    graphics.lineStyle(width, color, alpha)
    graphics.beginPath()
    graphics.moveTo(from.x, from.y)
    graphics.lineTo(to.x, to.y)
    graphics.strokePath()
  }
}
