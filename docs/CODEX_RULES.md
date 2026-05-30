# Codex Rules for Xibalba Pinball

## Do Not Break

These must continue working after every change:

- Space / Down launches ball
- A / Left controls left flipper
- D / Right controls right flipper
- R resets ball
- B toggles debug
- Shooter lane exits into playfield
- Ball can drain
- Score UI works
- Rollover lanes work
- Temple jackpot works

## Do Not Do Without Permission

- Do not redesign the whole table.
- Do not move major geometry drastically.
- Do not replace the Phaser/Matter architecture.
- Do not remove the blockout background.
- Do not add final art yet.
- Do not add menus yet.
- Do not add sound yet.
- Do not add multiball yet.
- Do not make broad geometry changes during tuning passes.

## Preferred Workflow

1. Make one focused change.
2. Run `npm run build`.
3. Preserve working controls.
4. Explain exactly what changed.
5. Do not claim playability improved unless there is a clear reason.

## Current Main Problem

Upper playfield access is too rare.

Do not solve this by blindly increasing flipper force.

Instead:
- Add shot testing tools
- Add telemetry
- Identify walls/guides blocking upper shots
- Tune center lane and cross-table shots with measurable tests
