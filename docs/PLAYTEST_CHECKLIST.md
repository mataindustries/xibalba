# Xibalba Pinball — Final Playtest Checklist

Record the device, operating system, browser/version, build URL or commit, and test date with every pass.

## Mobile

- [ ] Open the game in current iOS Safari and Android Chrome.
- [ ] Confirm the portrait table fits without page scrolling or browser zoom.
- [ ] Confirm the title, start prompt, high score, and Wall of Champions are readable.
- [ ] Tap LOCAL and GLOBAL; confirm both wall controls respond without starting the game.
- [ ] Confirm the speaker control is easy to tap and does not start the game.
- [ ] Start with a normal tap and confirm the first ball is ready in the launcher.
- [ ] Hold and release the launcher area; confirm the ball enters the playfield.
- [ ] Hold each flipper separately, then both together; confirm touch tracking remains stable.
- [ ] Confirm the ball stays readable during fast motion and multiball.
- [ ] Play through all five balls and confirm the game-over flow appears.
- [ ] Complete initials entry using touch and confirm the local score is carved immediately.
- [ ] Restart and confirm score, ball count, modes, and controls reset cleanly.
- [ ] Background and resume the browser once; confirm the game and audio recover acceptably.
- [ ] Rotate once and return to portrait; note any scaling, cropping, or input-offset issue.

## Desktop

- [ ] Open the game in current Chrome, Firefox, and Safari or Edge where available.
- [ ] Confirm the title screen loads without visible debug instructions or telemetry.
- [ ] Start with `Space` and `Down`.
- [ ] Test `A` / `Left` and `D` / `Right`, including both flippers together.
- [ ] Confirm `P` pauses and resumes without moving the ball while paused.
- [ ] Confirm `R` restarts cleanly.
- [ ] Play a complete five-ball game and verify ball count and game over.
- [ ] Enter initials with keyboard controls and confirm the local wall updates.
- [ ] Confirm LOCAL / GLOBAL controls are clickable and do not trigger game start.
- [ ] Confirm no unexpected console errors or unhandled promise rejections.
- [ ] Explicitly enable dev mode with backtick or `F1`; confirm dev help appears only then.
- [ ] Disable dev mode; confirm collision, shot-test, and telemetry overlays are cleared.

## Leaderboard

- [ ] With a working network, load the title screen and confirm GLOBAL WALL becomes active.
- [ ] Switch to LOCAL WALL and confirm locally stored champions remain available.
- [ ] Switch back to GLOBAL WALL and confirm it refreshes.
- [ ] Block `/api/leaderboard` or go offline; confirm `GLOBAL WALL UNREACHABLE` and LOCAL fallback.
- [ ] Confirm a qualifying score is saved locally before global submission finishes.
- [ ] Confirm a successful submission refreshes and displays the Global Wall.
- [ ] Confirm a failed submission retains the local score and never blocks restart.
- [ ] Repeat an exact initials/score submission; confirm duplicate handling is quiet and creates no repeated row.
- [ ] Confirm an empty global response displays `AWAITING CHAMPIONS`.
- [ ] Inspect the request body and confirm it contains only initials, score, and version.
- [ ] Confirm GET and POST success responses still use `source: "global"`.

## Audio

- [ ] Confirm the first user interaction unlocks audio without an error.
- [ ] Test flipper, launcher, bumper, target, rollover, jackpot, drain, ball-save, game-over, and champion sounds.
- [ ] Confirm rapid hits do not create harsh clipping or runaway volume.
- [ ] Mute and confirm gameplay sounds stop.
- [ ] Unmute and confirm audio resumes with the intended feedback.
- [ ] Confirm mute state changes do not affect input, timing, or gameplay.
- [ ] Confirm audio behavior remains acceptable after pausing and after backgrounding the page.

## Known-Issue Notes

For each issue, record:

- Device, OS, browser, and orientation.
- Exact reproduction steps.
- Expected and actual behavior.
- Frequency: once, intermittent, or every time.
- Severity: cosmetic, confusing, gameplay-affecting, or blocking.
- Screenshot/video plus relevant console or network output.

Current watch items:

- Mobile audio unlock requirements vary by browser.
- The layout is portrait-first; landscape and unusually short screens need explicit review.
- Network loss should affect only the Global Wall, never local scoring or restart.
- Global scores are not account-authenticated or cryptographically attested.

## Friend Feedback Prompt

1. Did the ball feel good to hit?
2. Did anything feel unfair?
3. Did you know what to aim for?
4. Did the leaderboard make you want to replay?
5. What felt most polished or least polished?
