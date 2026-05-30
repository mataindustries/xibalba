export type Point = {
  x: number
  y: number
}

export type SegmentBody = {
  id: string
  kind:
    | 'wall'
    | 'inlane'
    | 'outlane'
    | 'orbit'
    | 'rampEntrance'
    | 'plungerLane'
    | 'targetBank'
    | 'bumperNest'
  from: Point
  to: Point
  thickness: number
  restitution?: number
}

export type RectBody = {
  id: string
  kind: 'targetBank' | 'drain' | 'plungerLane'
  x: number
  y: number
  width: number
  height: number
  angle?: number
  isSensor?: boolean
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
  restAngle: number
  activeAngle: number
}

export const tableLayout = {
  table: {
    width: 941,
    height: 1672,
    backgroundPath: '/assets/playfield/neon-aztec-blockout.png',
  },

  physics: {
    gravityY: 1.15,
    solverIterations: 8,
  },

  // TUNING: gameplay force and bounce constants live here so table feel can be adjusted quickly.
  tuning: {
    ballBounce: 0.68,
    wallBounce: 0.28,
    rubberBounce: 0.82,
    bumperForce: 0.064,
    slingForceScale: 0.054,
    flipperStrength: 0.34,
    flipperMaxAngularVelocity: 0.58,
    plungerMaxForce: 0.095,
    plungerChargeRate: 0.018,
    nudgeFromFlipperContact: 0.03,
  },

  ball: {
    radius: 17,
    spawn: { x: 868, y: 1488 },
    resetVelocity: { x: 0, y: 0 },
  },

  plunger: {
    x: 874,
    restY: 1582,
    width: 44,
    height: 92,
    chargeTravel: 70,
    laneBottomY: 1600,
    launchVector: { x: -0.006, y: -1 },
  },

  // TUNING: collision coordinates are intentionally explicit and centralized for fast blockout edits.
  segments: [
    { id: 'left-outer-wall', kind: 'wall', from: { x: 122, y: 247 }, to: { x: 58, y: 1500 }, thickness: 34 },
    { id: 'right-outer-wall', kind: 'wall', from: { x: 820, y: 246 }, to: { x: 812, y: 1508 }, thickness: 34 },
    { id: 'top-left-arch', kind: 'orbit', from: { x: 122, y: 247 }, to: { x: 293, y: 82 }, thickness: 30 },
    { id: 'top-center-arch', kind: 'wall', from: { x: 293, y: 82 }, to: { x: 644, y: 82 }, thickness: 30 },
    { id: 'top-right-arch', kind: 'orbit', from: { x: 644, y: 82 }, to: { x: 820, y: 246 }, thickness: 30 },
    { id: 'left-orbit-guide', kind: 'orbit', from: { x: 169, y: 248 }, to: { x: 142, y: 733 }, thickness: 24 },
    { id: 'right-orbit-guide', kind: 'orbit', from: { x: 771, y: 252 }, to: { x: 752, y: 720 }, thickness: 24 },
    { id: 'left-ramp-mouth', kind: 'rampEntrance', from: { x: 226, y: 744 }, to: { x: 356, y: 664 }, thickness: 25 },
    { id: 'right-ramp-mouth', kind: 'rampEntrance', from: { x: 589, y: 662 }, to: { x: 722, y: 744 }, thickness: 25 },
    { id: 'left-bumper-nest-rail', kind: 'bumperNest', from: { x: 251, y: 478 }, to: { x: 316, y: 622 }, thickness: 20 },
    { id: 'right-bumper-nest-rail', kind: 'bumperNest', from: { x: 676, y: 478 }, to: { x: 612, y: 622 }, thickness: 20 },
    { id: 'center-bumper-nest-rail', kind: 'bumperNest', from: { x: 392, y: 705 }, to: { x: 548, y: 705 }, thickness: 18 },
    { id: 'left-bank-guard', kind: 'targetBank', from: { x: 210, y: 875 }, to: { x: 285, y: 1010 }, thickness: 22 },
    { id: 'right-bank-guard', kind: 'targetBank', from: { x: 733, y: 875 }, to: { x: 657, y: 1010 }, thickness: 22 },
    { id: 'left-outlane-left', kind: 'outlane', from: { x: 92, y: 1130 }, to: { x: 136, y: 1496 }, thickness: 22 },
    { id: 'left-outlane-right', kind: 'outlane', from: { x: 204, y: 1134 }, to: { x: 162, y: 1460 }, thickness: 22 },
    { id: 'right-outlane-left', kind: 'outlane', from: { x: 740, y: 1134 }, to: { x: 781, y: 1460 }, thickness: 22 },
    { id: 'right-outlane-right', kind: 'outlane', from: { x: 846, y: 1130 }, to: { x: 807, y: 1496 }, thickness: 22 },
    { id: 'left-inlane', kind: 'inlane', from: { x: 222, y: 1218 }, to: { x: 342, y: 1362 }, thickness: 24 },
    { id: 'right-inlane', kind: 'inlane', from: { x: 720, y: 1218 }, to: { x: 600, y: 1362 }, thickness: 24 },
    { id: 'left-apron', kind: 'wall', from: { x: 111, y: 1572 }, to: { x: 328, y: 1478 }, thickness: 34 },
    { id: 'right-apron', kind: 'wall', from: { x: 830, y: 1572 }, to: { x: 613, y: 1478 }, thickness: 34 },
    { id: 'plunger-lane-left', kind: 'plungerLane', from: { x: 812, y: 886 }, to: { x: 812, y: 1596 }, thickness: 18 },
    { id: 'plunger-lane-right', kind: 'plungerLane', from: { x: 921, y: 210 }, to: { x: 921, y: 1620 }, thickness: 26 },
    { id: 'plunger-lane-top-hook', kind: 'plungerLane', from: { x: 835, y: 225 }, to: { x: 921, y: 210 }, thickness: 22 },
    { id: 'plunger-lane-bottom-stop', kind: 'plungerLane', from: { x: 816, y: 1614 }, to: { x: 920, y: 1614 }, thickness: 22 },
  ] satisfies SegmentBody[],

  rects: [
    { id: 'left-target-1', kind: 'targetBank', x: 279, y: 828, width: 22, height: 72, angle: -0.38, score: 250 },
    { id: 'left-target-2', kind: 'targetBank', x: 315, y: 898, width: 22, height: 72, angle: -0.38, score: 250 },
    { id: 'left-target-3', kind: 'targetBank', x: 351, y: 968, width: 22, height: 72, angle: -0.38, score: 250 },
    { id: 'right-target-1', kind: 'targetBank', x: 662, y: 828, width: 22, height: 72, angle: 0.38, score: 250 },
    { id: 'right-target-2', kind: 'targetBank', x: 626, y: 898, width: 22, height: 72, angle: 0.38, score: 250 },
    { id: 'right-target-3', kind: 'targetBank', x: 590, y: 968, width: 22, height: 72, angle: 0.38, score: 250 },
    { id: 'drain', kind: 'drain', x: 470, y: 1642, width: 230, height: 34, isSensor: true },
    { id: 'plunger-ready', kind: 'plungerLane', x: 868, y: 1517, width: 82, height: 160, isSensor: true },
  ] satisfies RectBody[],

  bumpers: [
    { id: 'quetzal', x: 391, y: 435, radius: 42, score: 1000 },
    { id: 'jaguar', x: 539, y: 435, radius: 42, score: 1000 },
    { id: 'sun', x: 466, y: 568, radius: 42, score: 1000 },
  ] satisfies BumperBody[],

  slingshots: [
    {
      id: 'left',
      from: { x: 255, y: 1325 },
      to: { x: 370, y: 1400 },
      thickness: 30,
      score: 100,
      force: { x: 0.86, y: -0.52 },
    },
    {
      id: 'right',
      from: { x: 686, y: 1325 },
      to: { x: 571, y: 1400 },
      thickness: 30,
      score: 100,
      force: { x: -0.86, y: -0.52 },
    },
  ] satisfies SlingBody[],

  flippers: [
    {
      id: 'left',
      pivot: { x: 324, y: 1455 },
      length: 154,
      width: 28,
      restAngle: -18,
      activeAngle: -62,
    },
    {
      id: 'right',
      pivot: { x: 617, y: 1455 },
      length: 154,
      width: 28,
      restAngle: 198,
      activeAngle: 242,
    },
  ] satisfies FlipperConfig[],
}
