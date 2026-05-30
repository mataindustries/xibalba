# Xibalba Pinball — Project State

## Current Status

The prototype runs in Vite/Phaser/Matter.js.

Working:
- Ball launches from right shooter lane
- Shooter lane exits into playfield
- Flippers work with A/Left and D/Right
- Reset works with R
- Debug works with B
- Score system works
- Bumpers work
- Rollover lanes work
- Temple jackpot / rollover objective exists
- Anti-stuck helpers exist
- Basic gameplay feedback exists

Current issue:
- Upper rollover / jackpot area is too hard to reach during normal play.
- Player can play for a while and only hit the upper objective once.
- More raw tuning is not enough. Need shot testing and geometry diagnosis.

## Current Design Rule

Do not redesign the whole table.

Preserve:
- Shooter lane exit
- Working flippers
- Reset/debug controls
- Rollover/jackpot systems
- Anti-stuck helpers
- Existing general layout

Next priority:
Build a shot-testing/debug harness so upper-shot access can be measured instead of guessed.
