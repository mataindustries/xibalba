export type Point = {
  x: number
  y: number
}

export type SegmentKind =
  | 'wall'
  | 'orbit'
  | 'rampEntrance'
  | 'inlane'
  | 'outlane'
  | 'apron'
  | 'plungerLane'
  | 'targetBank'

export type WallSegment = {
  id: string
  kind: SegmentKind
  from: Point
  to: Point
  thickness: number
  restitution?: number
}

export type RoundedPost = {
  id: string
  kind: SegmentKind | 'post'
  x: number
  y: number
  radius: number
  restitution?: number
}

export type SensorBody = {
  id: string
  kind: 'drain' | 'targetBank' | 'plungerReady' | 'shooterExit' | 'jackpot' | 'rollover'
  x: number
  y: number
  width: number
  height: number
  angle?: number
  score?: number
}

export type TrapKickerZone = {
  id: string
  x: number
  y: number
  width: number
  height: number
  velocity: Point
  reposition?: Point
}

export type BumperBody = {
  id: string
  x: number
  y: number
  radius: number
  score: number
}

export type SlingBody = {
  id: 'left' | 'right'
  from: Point
  to: Point
  thickness: number
  score: number
  force: Point
}

export type FlipperConfig = {
  id: 'left' | 'right'
  pivot: Point
  length: number
  width: number
}

export type BallLaunch = {
  position: Point
  velocity: Point
}

const shooterExitX = 965
const shooterExitY = 320
const shooterExitWidth = 130
const shooterExitHeight = 260
const shooterExitVelocityX = -6.4
const shooterExitVelocityY = 3.2
const shooterExitRepositionX = 820
const shooterExitRepositionY = 455
const shooterExitFallbackY = 470

export const tableLayout = {
  // All playable coordinates use a clean 1080x1920 table space. The 941x1672
  // blockout image is scaled to this space by the scene.
  table: {
    width: 1080,
    height: 1920,
    background: {
      key: 'xibalba-playfield',
      path: '/art/playfield/xibalba-playfield-v3-no-flippers-with-plunger.png',
      // Source art is 941x1672; render it into the fixed 1080x1920 gameplay coordinate system.
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
    },
  },

  physics: {
    solverIterations: 12,
  },

  // TUNING: core table feel. Gravity and friction control table speed and ball slowdown.
  tuning: {
    gravity: 1.08,
    ballBounce: 0.71,
    ballFriction: 0.002,
    ballFrictionAir: 0.0014,
    wallBounce: 0.42,
    rubberBounce: 0.96,
    // TUNING: bumperBounce and bumperForce control pop-bumper rebound and added kick.
    bumperBounce: 1.12,
    bumperForce: 0.074,
    // TUNING: slingForceScale controls slingshot kick strength.
    slingForceScale: 0.064,
    // TUNING: flipper angles/speeds/impulse control shot power, timing, and return feel.
    flipperRestAngle: { left: -20, right: 200 },
    flipperActiveAngle: { left: -83, right: 263 },
    flipperSpeed: 0.64,
    flipperReturnSpeed: 0.36,
    flipperImpulse: 20.4,
    flipperContactRadius: 40,
    flipperImpulseCooldownMs: 72,
    // TUNING: plungerForce is max launch velocity; shooterExit values control lane feed into play.
    plungerTapForce: 23,
    plungerForce: 37,
    plungerChargeRate: 0.028,
    shooterExitCooldownMs: 150,
    // TUNING: shooter-lane exit. Keep the sensor near x 965, y 250-400.
    // If the ball sticks, enlarge/move the sensor or move repositionX slightly left.
    // If the exit feels fake, move repositionX closer to 900 and reduce velocityX/Y.
    shooterExitX,
    shooterExitY,
    shooterExitWidth,
    shooterExitHeight,
    shooterExitVelocityX,
    shooterExitVelocityY,
    shooterExitRepositionX,
    shooterExitRepositionY,
    shooterExitFallbackY,
    ballSaveDurationMs: 8000,
    // TUNING: anti-stuck values should stay gentle; trap kickers only fire on very slow balls.
    stuckVelocityThreshold: 0.45,
    stuckDurationMs: 1800,
    stuckNudgeVelocityX: 1.7,
    stuckNudgeVelocityY: -2.2,
    trapKickSpeedThreshold: 2.2,
    trapKickerCooldownMs: 950,
    scorePopupDurationMs: 720,
    scorePopupRise: 42,
    pulseScale: 1.16,
    pulseDurationMs: 110,
    // GAMEPLAY: first objective layer. Sensors are non-colliding; move their coordinates below to tune shots.
    jackpotScore: 10000,
    rolloverScore: 1000,
    eclipseBonusScore: 15000,
    eclipseMultiballStartScore: 25000,
    eclipseMultiballJackpotScore: 15000,
    eclipseMultiballBallSaveDurationMs: 10000,
    eclipseMultiballExtraBalls: 2,
    comboWindowMs: 3400,
    comboLaneCooldownMs: 520,
    comboX2Score: 2000,
    comboX3Score: 5000,
    scorePopupFontSize: 22,
    majorScorePopupFontSize: 34,
    majorScorePopupDurationMs: 1120,
    majorScorePopupRise: 76,
    eventScorePopupFontSize: 44,
    eventScorePopupDurationMs: 1380,
    eventScorePopupRise: 96,
    jackpotPulseScale: 1.32,
    rolloverPulseScale: 1.2,
    rolloverBonusResetDelayMs: 280,
  },

  juice: {
    soundVolume: 0.14,
    sounds: {
      flipperHit: [
        { frequency: 180, durationMs: 42, type: 'square', volume: 0.56 },
        { frequency: 320, durationMs: 34, type: 'triangle', volume: 0.28 },
      ],
      bumperHit: [{ frequency: 520, durationMs: 70, type: 'sine', volume: 0.7 }],
      slingHit: [{ frequency: 360, durationMs: 58, type: 'sawtooth', volume: 0.45 }],
      targetHit: [{ frequency: 620, durationMs: 48, type: 'square', volume: 0.34 }],
      rolloverHit: [{ frequency: 760, durationMs: 86, type: 'triangle', volume: 0.38 }],
      jackpot: [
        { frequency: 520, durationMs: 90, type: 'triangle', volume: 0.5 },
        { frequency: 780, durationMs: 120, type: 'triangle', volume: 0.42, delayMs: 60 },
      ],
      eclipseReady: [
        { frequency: 440, durationMs: 120, type: 'sine', volume: 0.46 },
        { frequency: 660, durationMs: 140, type: 'sine', volume: 0.42, delayMs: 80 },
      ],
      eclipseMultiball: [
        { frequency: 220, durationMs: 110, type: 'sawtooth', volume: 0.45 },
        { frequency: 440, durationMs: 160, type: 'triangle', volume: 0.5, delayMs: 70 },
        { frequency: 880, durationMs: 220, type: 'sine', volume: 0.34, delayMs: 150 },
      ],
      drain: [{ frequency: 140, durationMs: 180, type: 'sawtooth', volume: 0.42 }],
      ballSave: [
        { frequency: 360, durationMs: 100, type: 'triangle', volume: 0.44 },
        { frequency: 720, durationMs: 120, type: 'sine', volume: 0.36, delayMs: 80 },
      ],
    },
    screenShake: {
      bumper: { durationMs: 64, intensity: 0.0018 },
      jackpot: { durationMs: 110, intensity: 0.0026 },
      multiball: { durationMs: 180, intensity: 0.0032 },
    },
    flashAlpha: 0.2,
    flashDurationMs: 220,
    jackpotFlashDurationMs: 320,
    multiballFlashDurationMs: 480,
    trailIntervalMs: 64,
    trailDurationMs: 260,
    trailAlpha: 0.22,
    trailRadiusScale: 0.72,
  },

  ball: {
    radius: 18,
    spawn: { x: 1000, y: 1728 },
    resetVelocity: { x: 0, y: 0 },
  },

  multiball: {
    launches: [
      { position: { x: 540, y: 1080 }, velocity: { x: 0, y: -10 } },
      { position: { x: 430, y: 1180 }, velocity: { x: -2, y: -8 } },
      { position: { x: 650, y: 1180 }, velocity: { x: 2, y: -8 } },
    ] satisfies BallLaunch[],
  },

  // PLUNGER LANE: move x/restY/rails together if the launch lane drifts from the blockout.
  plunger: {
    x: 1000,
    restY: 1804,
    width: 42,
    height: 94,
    chargeTravel: 72,
    laneMinX: 920,
    launchMinY: 1330,
    touchArea: { x: 875, y: 1270, width: 205, height: 650 },
  },

  // VISUAL ONLY: these values nudge drawn inserts to match the painted art.
  // They do not move physics bodies, sensors, plunger mechanics, or scoring zones.
  visualAlignment: {
    bumpers: {
      offsetX: 0,
      offsetY: 0,
      scale: 0.82,
    },
    rollovers: {
      offsetX: 0,
      offsetY: 0,
      widthScale: 0.48,
      heightScale: 0.5,
      gapAdjust: 0,
    },
    plunger: {
      offsetX: 0,
      offsetY: 0,
      width: 24,
      height: 118,
    },
  },

  // ORBITS AND OUTER WALLS: approximate broad guide rails, leaving the center jackpot lane open.
  wallSegments: [
    { id: 'left-outer-wall', kind: 'wall', from: { x: 137, y: 284 }, to: { x: 78, y: 1712 }, thickness: 34 },
    { id: 'right-outer-wall', kind: 'wall', from: { x: 938, y: 690 }, to: { x: 930, y: 1712 }, thickness: 34 },
    // INVISIBLE CONTAINMENT: catches fast upper-left/top shots that get above the painted arch.
    { id: 'upper-left-roof-containment', kind: 'wall', from: { x: 78, y: 70 }, to: { x: 820, y: 70 }, thickness: 36 },
    { id: 'upper-left-return-guide', kind: 'wall', from: { x: 78, y: 70 }, to: { x: 137, y: 284 }, thickness: 36 },
    { id: 'top-left-arch', kind: 'orbit', from: { x: 137, y: 284 }, to: { x: 335, y: 96 }, thickness: 30 },
    { id: 'top-center-arch', kind: 'wall', from: { x: 335, y: 96 }, to: { x: 743, y: 96 }, thickness: 30 },
    { id: 'top-right-arch', kind: 'orbit', from: { x: 743, y: 96 }, to: { x: 938, y: 286 }, thickness: 30 },
    { id: 'left-orbit-inner', kind: 'orbit', from: { x: 250, y: 325 }, to: { x: 238, y: 505 }, thickness: 16 },
    { id: 'right-orbit-inner', kind: 'orbit', from: { x: 888, y: 520 }, to: { x: 864, y: 670 }, thickness: 16 },

    // RAMP MOUTHS: simple open guides that feed the ball back toward the middle.
    { id: 'left-ramp-mouth-upper', kind: 'rampEntrance', from: { x: 226, y: 872 }, to: { x: 292, y: 842 }, thickness: 16 },
    { id: 'left-ramp-mouth-lower', kind: 'rampEntrance', from: { x: 286, y: 972 }, to: { x: 360, y: 918 }, thickness: 12 },
    { id: 'right-ramp-mouth-upper', kind: 'rampEntrance', from: { x: 760, y: 820 }, to: { x: 854, y: 872 }, thickness: 16 },
    { id: 'right-ramp-mouth-lower', kind: 'rampEntrance', from: { x: 720, y: 918 }, to: { x: 794, y: 972 }, thickness: 12 },
    { id: 'rightTrapFixGuide', kind: 'orbit', from: { x: 945, y: 350 }, to: { x: 890, y: 410 }, thickness: 12 },

    // LOWER PLAYFIELD: inlanes feed flippers; outlanes and the widened middle gap drain cleanly.
    { id: 'left-outlane-outer', kind: 'outlane', from: { x: 108, y: 1288 }, to: { x: 145, y: 1800 }, thickness: 20 },
    { id: 'left-outlane-inner', kind: 'outlane', from: { x: 248, y: 1312 }, to: { x: 220, y: 1740 }, thickness: 20 },
    { id: 'right-outlane-inner', kind: 'outlane', from: { x: 832, y: 1312 }, to: { x: 860, y: 1740 }, thickness: 20 },
    { id: 'right-outlane-outer', kind: 'outlane', from: { x: 972, y: 1288 }, to: { x: 940, y: 1600 }, thickness: 18 },
    { id: 'left-inlane', kind: 'inlane', from: { x: 260, y: 1390 }, to: { x: 330, y: 1604 }, thickness: 22 },
    { id: 'right-inlane', kind: 'inlane', from: { x: 820, y: 1390 }, to: { x: 750, y: 1604 }, thickness: 22 },
    { id: 'left-apron', kind: 'apron', from: { x: 106, y: 1840 }, to: { x: 280, y: 1730 }, thickness: 30 },
    { id: 'right-apron', kind: 'apron', from: { x: 974, y: 1840 }, to: { x: 800, y: 1730 }, thickness: 30 },

    // PLUNGER LANE: rails stay intact below the exit; the top exit is open so the sensor can feed into play.
    { id: 'plunger-left-rail', kind: 'plungerLane', from: { x: 924, y: 500 }, to: { x: 924, y: 1820 }, thickness: 18 },
    { id: 'plunger-right-rail', kind: 'plungerLane', from: { x: 1062, y: 225 }, to: { x: 1062, y: 1845 }, thickness: 26 },
    { id: 'plunger-bottom-stop', kind: 'plungerLane', from: { x: 930, y: 1844 }, to: { x: 1060, y: 1844 }, thickness: 24 },
  ] satisfies WallSegment[],

  // ROUNDED POSTS: reduce sharp-corner traps around slings, lane entrances, and ramp mouths.
  posts: [
    { id: 'left-ramp-mouth-post', kind: 'rampEntrance', x: 476, y: 828, radius: 16 },
    { id: 'right-ramp-mouth-post', kind: 'rampEntrance', x: 604, y: 828, radius: 16 },
    { id: 'left-inlane-post', kind: 'inlane', x: 330, y: 1604, radius: 18 },
    { id: 'right-inlane-post', kind: 'inlane', x: 750, y: 1604, radius: 18 },
    { id: 'left-sling-post', kind: 'post', x: 294, y: 1514, radius: 17 },
    { id: 'right-sling-post', kind: 'post', x: 786, y: 1514, radius: 17 },
    { id: 'left-flipper-return-post', kind: 'post', x: 292, y: 1684, radius: 14 },
    { id: 'right-flipper-return-post', kind: 'post', x: 788, y: 1684, radius: 14 },
    { id: 'left-outlane-save-post', kind: 'outlane', x: 238, y: 1288, radius: 15 },
    { id: 'right-outlane-save-post', kind: 'outlane', x: 842, y: 1288, radius: 15 },
    { id: 'plunger-feed-post', kind: 'plungerLane', x: 928, y: 332, radius: 14 },
    { id: 'upper-left-containment-cap', kind: 'wall', x: 137, y: 284, radius: 22 },
  ] satisfies RoundedPost[],

  // SENSORS: all are non-colliding. Jackpot/rollovers add objectives without changing table geometry.
  sensors: [
    { id: 'drain', kind: 'drain', x: 540, y: 1790, width: 190, height: 150 },
    { id: 'left-outlane-drain', kind: 'drain', x: 182, y: 1780, width: 100, height: 210 },
    { id: 'right-outlane-drain', kind: 'drain', x: 890, y: 1780, width: 90, height: 210 },
    { id: 'plunger-ready', kind: 'plungerReady', x: 1000, y: 1718, width: 108, height: 250 },
    {
      id: 'shooterExitSensor',
      kind: 'shooterExit',
      x: shooterExitX,
      y: shooterExitY,
      width: shooterExitWidth,
      height: shooterExitHeight,
    },
    // TEMPLE JACKPOT: move this gate sensor to tune the center jackpot shot.
    { id: 'temple-jackpot', kind: 'jackpot', x: 540, y: 365, width: 190, height: 100, score: 10000 },
    // UPPER ROLLOVERS: five lane sensors under the temple gate.
    { id: 'rollover-1', kind: 'rollover', x: 380, y: 760, width: 54, height: 78, score: 1000 },
    { id: 'rollover-2', kind: 'rollover', x: 460, y: 760, width: 54, height: 78, score: 1000 },
    { id: 'rollover-3', kind: 'rollover', x: 540, y: 760, width: 54, height: 78, score: 1000 },
    { id: 'rollover-4', kind: 'rollover', x: 620, y: 760, width: 54, height: 78, score: 1000 },
    { id: 'rollover-5', kind: 'rollover', x: 700, y: 760, width: 54, height: 78, score: 1000 },
    { id: 'left-target-1', kind: 'targetBank', x: 318, y: 952, width: 32, height: 96, angle: -0.38, score: 250 },
    { id: 'left-target-2', kind: 'targetBank', x: 366, y: 1036, width: 32, height: 96, angle: -0.38, score: 250 },
    { id: 'right-target-1', kind: 'targetBank', x: 762, y: 952, width: 32, height: 96, angle: 0.38, score: 250 },
    { id: 'right-target-2', kind: 'targetBank', x: 714, y: 1036, width: 32, height: 96, angle: 0.38, score: 250 },
  ] satisfies SensorBody[],

  trapKickers: [
    {
      id: 'bottomRightCorner',
      x: 872,
      y: 1668,
      width: 112,
      height: 210,
      velocity: { x: -5.8, y: -4.4 },
      reposition: { x: 828, y: 1608 },
    },
    {
      id: 'rightOrbitRampPocket',
      x: 818,
      y: 610,
      width: 150,
      height: 220,
      velocity: { x: -5.5, y: 5.2 },
      reposition: { x: 770, y: 650 },
    },
    {
      id: 'upperLeftOrbitGap',
      x: 174,
      y: 478,
      width: 118,
      height: 290,
      velocity: { x: 4.8, y: 3.4 },
      reposition: { x: 236, y: 560 },
    },
  ] satisfies TrapKickerZone[],

  // BUMPER NEST: three simple circular bumpers around the upper-middle blockout.
  bumpers: [
    { id: 'quetzal', x: 392, y: 560, radius: 40, score: 1000 },
    { id: 'jaguar', x: 688, y: 560, radius: 40, score: 1000 },
    { id: 'sun', x: 615, y: 425, radius: 40, score: 1000 },
  ] satisfies BumperBody[],

  slingshots: [
    {
      id: 'left',
      from: { x: 294, y: 1514 },
      to: { x: 432, y: 1616 },
      thickness: 28,
      score: 100,
      force: { x: 0.9, y: -0.68 },
    },
    {
      id: 'right',
      from: { x: 786, y: 1514 },
      to: { x: 648, y: 1616 },
      thickness: 28,
      score: 100,
      force: { x: -0.9, y: -0.68 },
    },
  ] satisfies SlingBody[],

  // FLIPPERS: pivot/length/restAngle/activeAngle are the main lower-playfield feel controls.
  flippers: [
    {
      id: 'left',
      pivot: { x: 345, y: 1675 },
      length: 150,
      width: 30,
    },
    {
      id: 'right',
      pivot: { x: 735, y: 1675 },
      length: 150,
      width: 30,
    },
  ] satisfies FlipperConfig[],
}
