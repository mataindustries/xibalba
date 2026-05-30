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
  kind: 'drain' | 'targetBank' | 'plungerReady' | 'shooterExit'
  x: number
  y: number
  width: number
  height: number
  angle?: number
  score?: number
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

export const tableLayout = {
  // All playable coordinates use a clean 1080x1920 table space. The 941x1672
  // blockout image is scaled to this space by the scene.
  table: {
    width: 1080,
    height: 1920,
    backgroundPath: '/assets/playfield/neon-aztec-blockout.png',
    backgroundAlpha: 0.62,
  },

  physics: {
    solverIterations: 12,
  },

  // TUNING: core table feel. Increase gravity/force/speed in small steps; these values drive the real mechanics.
  tuning: {
    gravity: 1.12,
    ballBounce: 0.66,
    ballFriction: 0.0025,
    ballFrictionAir: 0.002,
    wallBounce: 0.36,
    rubberBounce: 0.9,
    bumperBounce: 1.08,
    bumperForce: 0.066,
    slingForceScale: 0.06,
    // TUNING: left/right flipper angles are degrees in the 1080x1920 table coordinate space.
    flipperRestAngle: { left: -22, right: 202 },
    flipperActiveAngle: { left: -74, right: 254 },
    flipperSpeed: 0.52,
    flipperReturnSpeed: 0.26,
    flipperImpulse: 15.5,
    flipperContactRadius: 34,
    flipperImpulseCooldownMs: 85,
    // TUNING: plungerForce is max launch velocity; shooterExitForce kicks the ball out of the lane.
    plungerTapForce: 22,
    plungerForce: 38,
    plungerChargeRate: 0.024,
    shooterExitForce: { x: -18, y: -6 },
    shooterExitCooldownMs: 150,
  },

  ball: {
    radius: 18,
    spawn: { x: 1000, y: 1728 },
    resetVelocity: { x: 0, y: 0 },
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

  // ORBITS AND OUTER WALLS: approximate broad guide rails, leaving the center jackpot lane open.
  wallSegments: [
    { id: 'left-outer-wall', kind: 'wall', from: { x: 137, y: 284 }, to: { x: 78, y: 1712 }, thickness: 34 },
    { id: 'right-outer-wall', kind: 'wall', from: { x: 938, y: 286 }, to: { x: 930, y: 1712 }, thickness: 34 },
    { id: 'top-left-arch', kind: 'orbit', from: { x: 137, y: 284 }, to: { x: 335, y: 96 }, thickness: 30 },
    { id: 'top-center-arch', kind: 'wall', from: { x: 335, y: 96 }, to: { x: 743, y: 96 }, thickness: 30 },
    { id: 'top-right-arch', kind: 'orbit', from: { x: 743, y: 96 }, to: { x: 938, y: 286 }, thickness: 30 },
    { id: 'left-orbit-inner', kind: 'orbit', from: { x: 204, y: 306 }, to: { x: 174, y: 805 }, thickness: 20 },
    { id: 'right-orbit-inner', kind: 'orbit', from: { x: 876, y: 306 }, to: { x: 846, y: 805 }, thickness: 20 },

    // RAMP MOUTHS: simple open guides that feed the ball back toward the middle.
    { id: 'left-ramp-mouth-upper', kind: 'rampEntrance', from: { x: 242, y: 846 }, to: { x: 406, y: 756 }, thickness: 22 },
    { id: 'left-ramp-mouth-lower', kind: 'rampEntrance', from: { x: 316, y: 956 }, to: { x: 476, y: 828 }, thickness: 18 },
    { id: 'right-ramp-mouth-upper', kind: 'rampEntrance', from: { x: 674, y: 756 }, to: { x: 838, y: 846 }, thickness: 22 },
    { id: 'right-ramp-mouth-lower', kind: 'rampEntrance', from: { x: 604, y: 828 }, to: { x: 764, y: 956 }, thickness: 18 },

    // LOWER PLAYFIELD: inlanes, outlanes, apron, and drain gap. Keep the center gap clear.
    { id: 'left-outlane-outer', kind: 'outlane', from: { x: 108, y: 1288 }, to: { x: 145, y: 1732 }, thickness: 20 },
    { id: 'left-outlane-inner', kind: 'outlane', from: { x: 246, y: 1312 }, to: { x: 208, y: 1668 }, thickness: 20 },
    { id: 'right-outlane-inner', kind: 'outlane', from: { x: 834, y: 1312 }, to: { x: 872, y: 1668 }, thickness: 20 },
    { id: 'right-outlane-outer', kind: 'outlane', from: { x: 972, y: 1288 }, to: { x: 935, y: 1732 }, thickness: 20 },
    { id: 'left-inlane', kind: 'inlane', from: { x: 276, y: 1402 }, to: { x: 392, y: 1602 }, thickness: 22 },
    { id: 'right-inlane', kind: 'inlane', from: { x: 804, y: 1402 }, to: { x: 688, y: 1602 }, thickness: 22 },
    { id: 'left-apron', kind: 'apron', from: { x: 116, y: 1816 }, to: { x: 350, y: 1700 }, thickness: 32 },
    { id: 'right-apron', kind: 'apron', from: { x: 964, y: 1816 }, to: { x: 730, y: 1700 }, thickness: 32 },

    // PLUNGER LANE: right-side launch rail and top deflector into the upper playfield.
    { id: 'plunger-left-rail', kind: 'plungerLane', from: { x: 924, y: 470 }, to: { x: 924, y: 1820 }, thickness: 18 },
    { id: 'plunger-right-rail', kind: 'plungerLane', from: { x: 1062, y: 225 }, to: { x: 1062, y: 1845 }, thickness: 26 },
    { id: 'plunger-exit-guide', kind: 'plungerLane', from: { x: 1048, y: 270 }, to: { x: 902, y: 365 }, thickness: 22 },
    { id: 'plunger-top-feed', kind: 'plungerLane', from: { x: 928, y: 332 }, to: { x: 784, y: 236 }, thickness: 20 },
    { id: 'plunger-bottom-stop', kind: 'plungerLane', from: { x: 930, y: 1844 }, to: { x: 1060, y: 1844 }, thickness: 24 },
    { id: 'left-flipper-under-guide', kind: 'apron', from: { x: 300, y: 1776 }, to: { x: 454, y: 1718 }, thickness: 24 },
    { id: 'right-flipper-under-guide', kind: 'apron', from: { x: 780, y: 1776 }, to: { x: 626, y: 1718 }, thickness: 24 },
  ] satisfies WallSegment[],

  // ROUNDED POSTS: reduce sharp-corner traps around slings, lane entrances, and ramp mouths.
  posts: [
    { id: 'left-ramp-mouth-post', kind: 'rampEntrance', x: 476, y: 828, radius: 16 },
    { id: 'right-ramp-mouth-post', kind: 'rampEntrance', x: 604, y: 828, radius: 16 },
    { id: 'left-inlane-post', kind: 'inlane', x: 392, y: 1602, radius: 18 },
    { id: 'right-inlane-post', kind: 'inlane', x: 688, y: 1602, radius: 18 },
    { id: 'left-sling-post', kind: 'post', x: 294, y: 1514, radius: 17 },
    { id: 'right-sling-post', kind: 'post', x: 786, y: 1514, radius: 17 },
    { id: 'left-flipper-return-post', kind: 'post', x: 345, y: 1682, radius: 14 },
    { id: 'right-flipper-return-post', kind: 'post', x: 735, y: 1682, radius: 14 },
    { id: 'plunger-feed-post', kind: 'plungerLane', x: 928, y: 332, radius: 14 },
  ] satisfies RoundedPost[],

  // SENSORS: drain and simple target banks. Sensors score or reset without adding visible art.
  sensors: [
    { id: 'drain', kind: 'drain', x: 540, y: 1878, width: 270, height: 48 },
    { id: 'plunger-ready', kind: 'plungerReady', x: 1000, y: 1718, width: 108, height: 250 },
    { id: 'shooter-exit', kind: 'shooterExit', x: 992, y: 355, width: 132, height: 150 },
    { id: 'left-target-1', kind: 'targetBank', x: 318, y: 952, width: 32, height: 96, angle: -0.38, score: 250 },
    { id: 'left-target-2', kind: 'targetBank', x: 366, y: 1036, width: 32, height: 96, angle: -0.38, score: 250 },
    { id: 'right-target-1', kind: 'targetBank', x: 762, y: 952, width: 32, height: 96, angle: 0.38, score: 250 },
    { id: 'right-target-2', kind: 'targetBank', x: 714, y: 1036, width: 32, height: 96, angle: 0.38, score: 250 },
  ] satisfies SensorBody[],

  // BUMPER NEST: three simple circular bumpers around the upper-middle blockout.
  bumpers: [
    { id: 'quetzal', x: 448, y: 500, radius: 43, score: 1000 },
    { id: 'jaguar', x: 632, y: 500, radius: 43, score: 1000 },
    { id: 'sun', x: 540, y: 646, radius: 43, score: 1000 },
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
      pivot: { x: 382, y: 1678 },
      length: 158,
      width: 30,
    },
    {
      id: 'right',
      pivot: { x: 698, y: 1678 },
      length: 158,
      width: 30,
    },
  ] satisfies FlipperConfig[],
}
