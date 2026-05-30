# Shot Testing Plan

## Problem

The ball rarely reaches the upper rollover / temple jackpot area during normal play.

We need a way to test shots directly instead of waiting for random gameplay.

## Add Test Mode

Add a debug/test mode that works only during development.

Suggested hotkeys:

- `1` = place ball on left flipper cradle
- `2` = place ball on right flipper cradle
- `3` = place ball in center lower playfield
- `4` = place ball at shooter lane exit
- `5` = place ball near upper rollover lanes
- `T` = toggle shot test overlay
- `C` = clear current ball velocity

## Add Shot Launch Helpers

When in test mode:

- `Shift + 1` = simulate left flipper shot toward right ramp/orbit
- `Shift + 2` = simulate right flipper shot toward left ramp/orbit
- `Shift + 3` = simulate center jackpot shot

These should set ball position and velocity so we can test if geometry allows the route.

## Add Telemetry

Display small debug text:

- ball x/y position
- ball velocity x/y
- current zone
- last sensor hit
- last score event
- stuck timer

## Success Criteria

Upper-shot tuning is successful when:

- From left flipper test position, a strong shot can reach upper-right ramp/orbit area.
- From right flipper test position, a strong shot can reach upper-left ramp/orbit area.
- From either flipper, a center shot can reach rollover/jackpot area.
- During normal play, upper rollovers are reached multiple times in 1–2 minutes.
